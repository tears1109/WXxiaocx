// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 确保集合存在
async function ensureCollection(collectionName) {
  try {
    // 尝试创建集合
    await db.createCollection(collectionName)
    console.log(`集合 ${collectionName} 创建成功`)
  } catch (e) {
    // 如果集合已存在，会抛出错误，这里可以忽略
    console.log(`集合 ${collectionName} 已存在`)
  }
}

exports.main = async (event) => {
  const { openid, userName, avatarUrl, roomId, content, duration, image = '' } = event

  if (!roomId) {
    return {
      success: false,
      message: '缺少房间ID'
    }
  }

  if (!duration || duration <= 0) {
    return {
      success: false,
      message: '请输入有效的打卡时长'
    }
  }

  try {
    // 确保集合存在
    await ensureCollection('checkins')

    // 根据房主设置的打卡等级计算分数，若未设置则默认 1 分
    // 获取房间文档及其 settings 字段
    const roomDoc = await db.collection('room').doc(roomId).get();
    const settings = Array.isArray(roomDoc.data.settings) ? roomDoc.data.settings : [];
    let score = 1;
    if (settings.length > 0) {
      // 解析并按时长升序排序
      const levels = settings
        .map(item => ({ duration: Number(item.duration), points: Number(item.points) }))
        .filter(l => !isNaN(l.duration) && !isNaN(l.points))
        .sort((a, b) => a.duration - b.duration);
      // 遍历找到匹配的最高等级
      for (const lvl of levels) {
        if (duration >= lvl.duration) {
          score = lvl.points;
        } else {
          break;
        }
      }
    }

    // 记录打卡
    await db.collection('checkins').add({
      data: {
        openid,
        userName,
        avatarUrl,
        roomId,
        content: content || '',    // 打卡内容
        duration: duration,        // 打卡时长（分钟）
        image: image,              // 打卡图片文件ID
        score,
        checkinTime: new Date(),
        createTime: new Date()
      }
    })

    // 更新房间用户分数到 room 集合中
    const roomForUpdate = await db.collection('room').doc(roomId).get();
    const usersArray = Array.isArray(roomForUpdate.data.users) ? roomForUpdate.data.users : [];
    const userIdx = usersArray.findIndex(u => u.openid === openid);
    if (userIdx !== -1) {
      await db.collection('room').doc(roomId).update({
        data: {
          [`users.${userIdx}.score`]: _.inc(score)
        }
      });
    }

    return {
      success: true,
      message: '打卡成功',
      score
    }
  } catch (e) {
    console.error('打卡失败:', e)
    return {
      success: false,
      message: e.message || '打卡失败'
    }
  }
} 
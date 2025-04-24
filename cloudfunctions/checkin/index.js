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
  const { openid, userName, avatarUrl, roomId, content, duration } = event

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

    // 生成分数（基于时长计算）
    // 每60分钟得到1分，最低1分，最高10分
    const score = Math.min(10, Math.max(1, Math.floor(duration / 60) + 1))

    // 记录打卡
    await db.collection('checkins').add({
      data: {
        openid,
        userName,
        avatarUrl,
        roomId,
        content: content || '',  // 打卡内容
        duration: duration,      // 打卡时长（分钟）
        score,
        checkinTime: new Date(),
        createTime: new Date()
      }
    })

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
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

exports.main = async (event, context) => {
  const { roomId, page = 1, pageSize = 20 } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!roomId) {
    return {
      success: false,
      message: '缺少房间ID'
    }
  }

  try {
    // 获取历史打卡记录
    const checkins = await db.collection('checkins')
      .where({
        roomId: roomId
      })
      .orderBy('createTime', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    // 获取所有打卡记录的用户openid
    const openids = [...new Set(checkins.data.map(item => item.openid))]

    // 从users集合获取用户信息
    const users = await db.collection('users')
      .where({
        _openid: db.command.in(openids)
      })
      .get()

    // 创建用户信息映射
    const userMap = {}
    users.data.forEach(user => {
      userMap[user._openid] = {
        nickName: user.userInfo.nickName,
        avatarUrl: user.userInfo.avatarUrl
      }
    })

    // 合并打卡记录和用户信息
    const checkinsWithUserInfo = checkins.data.map(checkin => ({
      ...checkin,
      userName: userMap[checkin.openid]?.nickName || '未知用户',
      avatarUrl: userMap[checkin.openid]?.avatarUrl || 'https://6c6f-loong-9g5c3upyfdd12980-1323550512.tcb.qcloud.la/default-avatar.jpg'
    }))

    // 获取总数
    const total = await db.collection('checkins')
      .where({
        roomId: roomId
      })
      .count()

    return {
      success: true,
      data: checkinsWithUserInfo,
      total: total.total,
      hasMore: checkins.data.length === pageSize
    }
  } catch (err) {
    console.error(err)
    return {
      success: false,
      error: err
    }
  }
}

// 格式化日期为 MM-DD HH:MM 格式
function formatDate(date) {
  const originalDate = new Date(date);
  
  // 计算中国标准时间 (UTC+8) 的偏移量（毫秒）
  const timezoneOffset = 8 * 60 * 60 * 1000;
  
  // 创建调整为CST的新Date对象
  const cstDate = new Date(originalDate.getTime() + timezoneOffset);
  
  const month = cstDate.getUTCMonth() + 1;
  const day = cstDate.getUTCDate();
  const hour = cstDate.getUTCHours();
  const minute = cstDate.getUTCMinutes();
  
  return `${padZero(month)}-${padZero(day)} ${padZero(hour)}:${padZero(minute)}`;
}

function padZero(n) {
  return n < 10 ? '0' + n : n
} 
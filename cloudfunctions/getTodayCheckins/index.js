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
    // 确保集合存在
    await ensureCollection('checkins')

    // 获取今天0点的时间戳
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 查询今日打卡记录（按房间筛选）
    const checkins = await db.collection('checkins')
      .where({
        roomId,
        checkinTime: _.gte(today)
      })
      .orderBy('checkinTime', 'desc')
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
        roomId,
        checkinTime: _.gte(today)
      })
      .count()

    return {
      success: true,
      checkins: checkinsWithUserInfo,
      total: total.total,
      hasMore: checkins.data.length === pageSize
    }
  } catch (e) {
    console.error('获取打卡记录失败:', e)
    return {
      success: false,
      message: e.message || '获取打卡记录失败'
    }
  }
}

// 格式化时间为中国标准时间 (UTC+8)
function formatTime(date) {
  const originalDate = new Date(date); // Create Date object from timestamp

  // Calculate the offset for CST (UTC+8) in milliseconds
  const timezoneOffset = 8 * 60 * 60 * 1000;

  // Create a new Date object adjusted for CST by adding the offset to the UTC time
  const cstDate = new Date(originalDate.getTime() + timezoneOffset);

  // Extract hours and minutes in UTC from the adjusted date
  // This gives the correct time components for the CST timezone
  const hour = cstDate.getUTCHours();
  const minute = cstDate.getUTCMinutes();

  return `${padZero(hour)}:${padZero(minute)}`;
}

function padZero(n) {
  return n < 10 ? '0' + n : n
}
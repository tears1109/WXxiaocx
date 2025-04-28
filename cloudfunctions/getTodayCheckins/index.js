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
  const { openid, roomId } = event

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
    const res = await db.collection('checkins').where({
      roomId,
      checkinTime: _.gte(today)
    }).get()

    return {
      success: true,
      checkins: res.data.map(item => ({
        ...item,
        checkinTime: formatTime(item.checkinTime)
      }))
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
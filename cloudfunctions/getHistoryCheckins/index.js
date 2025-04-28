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

    // 查询历史打卡记录（当天以前的，按房间筛选，按积分降序）
    const res = await db.collection('checkins').where({
      roomId,
      checkinTime: _.lt(today)
    }).orderBy('score', 'desc').limit(50).get()

    // 处理返回数据
    return {
      success: true,
      data: res.data.map(item => ({
        ...item,
        checkinTime: formatDate(item.checkinTime)
      }))
    }
  } catch (e) {
    console.error('获取历史打卡记录失败:', e)
    return {
      success: false,
      message: e.message || '获取历史打卡记录失败'
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
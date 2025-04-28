// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()
// cloud.getWXContext 已初始化 cloud

/**
 * 更新房间打卡等级配置，仅房主可操作
 * @param {Object} event
 * @param {string} event.roomId 房间 _id
 * @param {Array} event.settings 配置数组 [{duration, points}, ...]
 */
exports.main = async (event) => {
  const { roomId, settings } = event
  // 获取调用者 openid
  const { OPENID } = cloud.getWXContext()
  const openid = OPENID
  if (!openid) {
    return { success: false, message: '未登录' }
  }
  try {
    // 获取房间文档
    const roomDoc = await db.collection('room').doc(roomId).get()
    if (!roomDoc.data) {
      return { success: false, message: '房间不存在' }
    }
    // 权限校验：只有创建者可更新
    if (roomDoc.data.createdBy !== openid) {
      return { success: false, message: '无权操作' }
    }
    // 执行更新
    await db.collection('room').doc(roomId).update({ data: { settings } })
    return { success: true }
  } catch (err) {
    console.error('更新打卡等级失败', err)
    return { success: false, message: err.message }
  }
} 
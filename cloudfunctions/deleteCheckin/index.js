// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { checkinId, roomId } = event
  if (!checkinId || !roomId) {
    return { success: false, message: '参数缺失' }
  }

  const { OPENID } = cloud.getWXContext()

  try {
    // 获取打卡记录
    const checkinDoc = await db.collection('checkins').doc(checkinId).get()
    if (!checkinDoc.data) {
      return { success: false, message: '打卡记录不存在' }
    }
    const record = checkinDoc.data

    // 获取房间信息
    const roomDoc = await db.collection('room').doc(roomId).get()
    if (!roomDoc.data) {
      return { success: false, message: '房间不存在' }
    }
    const room = roomDoc.data

    // 校验权限：房主或本人
    if (record.openid !== OPENID && room.createdBy !== OPENID) {
      return { success: false, message: '无权限删除' }
    }

    // 删除打卡记录
    await db.collection('checkins').doc(checkinId).remove()

    // 更新房间用户分数
    const users = Array.isArray(room.users) ? room.users : []
    const idx = users.findIndex(u => u.openid === record.openid)
    if (idx !== -1) {
      await db.collection('room').doc(roomId).update({ data: { [`users.${idx}.score`]: _.inc(-record.score) } })
    }

    return { success: true }
  } catch (err) {
    console.error('删除打卡失败：', err)
    return { success: false, message: err.message || '删除打卡失败' }
  }
} 
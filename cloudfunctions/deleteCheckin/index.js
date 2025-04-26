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
  
  console.log('准备删除打卡记录', { checkinId, roomId, OPENID })

  try {
    // 获取打卡记录
    const checkinDoc = await db.collection('checkins').doc(checkinId).get()
    if (!checkinDoc.data) {
      return { success: false, message: '打卡记录不存在' }
    }
    const record = checkinDoc.data
    console.log('找到打卡记录', record)
    
    // 确保 score 是数字
    const scoreToSubtract = Number(record.score) || 0
    console.log('将要减去的分数', scoreToSubtract)
    
    if (scoreToSubtract <= 0) {
      console.log('警告: 打卡记录分数无效', { score: record.score, openid: record.openid })
    }

    // 获取房间信息
    const roomDoc = await db.collection('room').doc(roomId).get()
    if (!roomDoc.data) {
      return { success: false, message: '房间不存在' }
    }
    const room = roomDoc.data
    console.log('找到房间', { roomId: room._id, roomUsers: room.users ? room.users.length : 0 })

    // 校验权限：房主或本人
    if (record.openid !== OPENID && room.createdBy !== OPENID) {
      return { success: false, message: '无权限删除' }
    }

    // 删除打卡记录
    await db.collection('checkins').doc(checkinId).remove()
    console.log('打卡记录已删除')

    // 更新房间用户分数
    const users = Array.isArray(room.users) ? room.users : []
    const idx = users.findIndex(u => u.openid === record.openid)
    console.log('查找用户索引', { userOpenid: record.openid, foundIndex: idx })
    
    if (idx !== -1) {
      const currentScore = users[idx].score || 0
      console.log('用户当前分数', currentScore)
      console.log('更新后分数将为', currentScore - scoreToSubtract)
      
      const updateResult = await db.collection('room').doc(roomId).update({ 
        data: { [`users.${idx}.score`]: _.inc(-scoreToSubtract) } 
      })
      console.log('分数更新结果', updateResult)
    } else {
      console.log('错误: 未找到用户', { openid: record.openid, users: users })
    }

    return { success: true }
  } catch (err) {
    console.error('删除打卡失败：', err)
    return { success: false, message: err.message || '删除打卡失败' }
  }
} 
// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { roomId } = event
  const { OPENID } = cloud.getWXContext()

  if (!roomId) {
    return {
      success: false,
      message: '缺少房间ID'
    }
  }

  try {
    // 获取房间信息
    const roomDoc = await db.collection('room').doc(roomId).get()
    if (!roomDoc.data) {
      return {
        success: false,
        message: '房间不存在'
      }
    }

    // 检查权限：只有房主可以重新统计
    if (roomDoc.data.createdBy !== OPENID) {
      return {
        success: false,
        message: '只有房主可以重新统计'
      }
    }

    // 获取该房间的所有打卡记录
    const checkinsRes = await db.collection('checkins')
      .where({
        roomId: roomId
      })
      .get()
    
    const checkins = checkinsRes.data || []
    
    // 统计每个用户的打卡次数和分数
    const userStats = {}
    checkins.forEach(checkin => {
      const userOpenid = checkin.openid
      if (!userStats[userOpenid]) {
        userStats[userOpenid] = {
          attempts: 0,
          score: 0
        }
      }
      userStats[userOpenid].attempts++
      userStats[userOpenid].score += Number(checkin.score) || 0
    })

    // 更新房间中每个用户的统计信息
    const users = roomDoc.data.users || []
    const updatePromises = users.map(user => {
      const stats = userStats[user.openid] || { attempts: 0, score: 0 }
      return db.collection('room').doc(roomId).update({
        data: {
          [`users.${users.indexOf(user)}.attempts`]: stats.attempts,
          [`users.${users.indexOf(user)}.score`]: stats.score
        }
      })
    })

    await Promise.all(updatePromises)

    return {
      success: true,
      message: '重新统计完成'
    }
  } catch (err) {
    console.error('重新统计失败:', err)
    return {
      success: false,
      message: err.message || '重新统计失败'
    }
  }
} 
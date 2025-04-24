// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const { roomId, openid, score } = event
  
  try {
    // 先获取房间信息
    const room = await db.collection('room').doc(roomId).get()
    if (!room.data) {
      return {
        success: false,
        message: '房间不存在'
      }
    }

    // 找到用户在数组中的索引
    const userIndex = room.data.users.findIndex(user => user.openid === openid)
    if (userIndex === -1) {
      return {
        success: false,
        message: '用户不在房间中'
      }
    }

    // 使用数组索引更新分数
    const result = await db.collection('room').doc(roomId).update({
      data: {
        [`users.${userIndex}.score`]: _.inc(score)
      }
    })

    return {
      success: true,
      message: '分数更新成功'
    }
  } catch (err) {
    console.error('更新分数失败：', err)
    return {
      success: false,
      message: '更新分数失败',
      error: err
    }
  }
} 
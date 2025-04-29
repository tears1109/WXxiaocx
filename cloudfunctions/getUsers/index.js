const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { roomId } = event;  // 从参数中获取房间ID
    
    if (!roomId) {
      return {
        code: -1,
        msg: '缺少房间ID'
      }
    }

    // 先获取房间信息
    const roomRes = await db.collection('room').doc(roomId).get();
    if (!roomRes.data) {
      return {
        code: -1,
        msg: '房间不存在'
      }
    }

    const roomUsers = roomRes.data.users || [];
    const openids = roomUsers.map(user => user.openid);

    // 获取这些用户的详细信息
    const users = await db.collection('users')
      .where({
        _openid: db.command.in(openids)
      })
      .field({
        _id: true,
        _openid: true,
        nickName: true,
        avatarUrl: true,
        cardColor: true,
        userInfo: true
      })
      .get()
    
    // 处理用户数据，确保所有必要字段都存在
    const processedUsers = users.data.map(user => {
      // 找到用户在房间中的信息
      const roomUser = roomUsers.find(ru => ru.openid === user._openid) || {};
      
      return {
        _id: user._id,
        _openid: user._openid,
        nickName: user.nickName || (user.userInfo && user.userInfo.nickName) || '微信用户',
        avatarUrl: user.avatarUrl || (user.userInfo && user.userInfo.avatarUrl) || 'https://6c6f-loong-9g5c3upyfdd12980-1323550512.tcb.qcloud.la/default-avatar.jpg?sign=4adae4cbdbab4ca56c55437c80ee8e14&t=1745476793',
        cardColor: user.cardColor || ' ',
        score: roomUser.score || 0,  // 从房间数据中获取分数
        attempts: roomUser.attempts || 0  // 从房间数据中获取打卡次数
      }
    })
    
    return {
      code: 0,
      msg: '获取成功',
      data: processedUsers
    }
  } catch (err) {
    console.error(err)
    return {
      code: -1,
      msg: '获取失败'
    }
  }
} 
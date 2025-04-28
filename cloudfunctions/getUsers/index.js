const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const users = await db.collection('users')
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
    const processedUsers = users.data.map(user => ({
      _id: user._id,
      _openid: user._openid,
      nickName: user.nickName || (user.userInfo && user.userInfo.nickName) || '微信用户',
      avatarUrl: user.avatarUrl || (user.userInfo && user.userInfo.avatarUrl) || 'https://6c6f-loong-9g5c3upyfdd12980-1323550512.tcb.qcloud.la/default-avatar.jpg?sign=4adae4cbdbab4ca56c55437c80ee8e14&t=1745476793',
      cardColor: user.cardColor || ' '
    }))
    
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
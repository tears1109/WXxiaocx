const cloud = require('wx-server-sdk')
cloud.init()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  
  // 获取用户信息
  const user = await db.collection('users').where({
    _openid: event.openid || wxContext.OPENID
  }).get()
  
  return {
    userInfo: user.data[0] || null
  }
}
const cloud = require('wx-server-sdk')
cloud.init()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()

  const user = await db.collection('users').where({
    _openid: wxContext.OPENID
  }).get()

  return {
    success: true, // ✅ 添加这个字段
    isLoggedIn: user.data.length > 0,
    openid: wxContext.OPENID
  }
}

// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: 'loong-9g5c3upyfdd12980'
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  try {
    // 更新用户记录，标记为已登出
    await db.collection('users').where({
      _openid: openid
    }).update({
      data: {
        isLoggedIn: false,
        lastLogoutTime: db.serverDate()
      }
    })
    
    return {
      success: true,
      message: '登出成功'
    }
  } catch (err) {
    console.error(err)
    return {
      success: false,
      message: '登出失败',
      error: err
    }
  }
}

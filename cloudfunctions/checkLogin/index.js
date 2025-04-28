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
  
  if (!openid) {
    return {
      success: false,
      message: '未获取到用户openid'
    }
  }
  
  try {
    // 查询数据库中的用户状态
    const userRecord = await db.collection('users').where({
      _openid: openid
    }).get()
    
    // 如果找到用户记录
    if (userRecord.data && userRecord.data.length > 0) {
      // 更新最后活跃时间
      await db.collection('users').where({
        _openid: openid
      }).update({
        data: {
          lastActiveTime: db.serverDate(),
          isLoggedIn: true
        }
      })
      
      return {
        success: true,
        openid: openid,
        userInfo: userRecord.data[0]
      }
    } else {
      // 用户不存在或已登出状态
      return {
        success: false,
        message: '用户未登录或会话已过期'
      }
    }
  } catch (err) {
    console.error(err)
    return {
      success: false,
      message: '验证登录状态时发生错误',
      error: err
    }
  }
}
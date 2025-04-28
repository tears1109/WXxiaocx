const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

exports.main = async (event, context) => {
  const { userId, cardColor } = event
  const wxContext = cloud.getWXContext()
  const currentUserOpenid = wxContext.OPENID
  
  // 检查权限
  if (currentUserOpenid !== 'ow3S1644I7vbH0v13rsMu1QKvYqM') {
    return {
      code: -1,
      msg: '没有权限使用此功能'
    }
  }
  
  if (!userId || !cardColor) {
    return {
      code: -1,
      msg: '参数错误'
    }
  }

  try {
    await db.collection('users').where({
      _openid: userId
    }).update({
      data: {
        cardColor: cardColor
      }
    })
    
    return {
      code: 0,
      msg: '更新成功'
    }
  } catch (err) {
    console.error(err)
    return {
      code: -1,
      msg: '更新失败'
    }
  }
} 
const cloud = require('wx-server-sdk')
cloud.init()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  const _ = db.command

  try {
    const userCollection = db.collection('users')
    
    // 先查找是否已有该 openid 的记录
    const userRes = await userCollection.where({
      openid: wxContext.OPENID
    }).get()

    if (userRes.data.length > 0) {
      // 已存在，执行更新
      const updateRes = await userCollection.where({
        openid: wxContext.OPENID
      }).update({
        data: {
          name: 'users',
          updateTime: new Date()
        }
      })
      return {
        success: true,
        action: 'updated',
        openid: wxContext.OPENID,
        updateResult: updateRes
      }
    } else {
      // 不存在，执行添加
      const addRes = await userCollection.add({
        data: {
          name: 'users',
          createTime: new Date(),
          openid: wxContext.OPENID
        }
      })
      return {
        success: true,
        action: 'added',
        openid: wxContext.OPENID,
        addResult: addRes
      }
    }
  } catch (err) {
    console.error('云函数执行错误:', err)
    return {
      success: false,
      error: err.message
    }
  }
}

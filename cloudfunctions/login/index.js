// cloudfunctions/login/index.js
const cloud = require('wx-server-sdk')
cloud.init()

exports.main = async (event, context) => {
  const { code, userInfo, encryptedData, iv } = event
  
  // 1. 获取openid
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  // 2. 解密用户信息（如果需要）
  // 注意：在最新版本中，可以直接使用wx.getUserProfile获取的用户信息，无需解密
  // 这里保留解密逻辑以备需要
  let decryptedData = userInfo
  try {
    const res = await cloud.getOpenData({
      list: [encryptedData, iv]
    })
    decryptedData = res.list[0].data
  } catch (err) {
    console.log('解密失败，使用原始数据', err)
  }
  
  // 3. 将用户信息存入云数据库
  const db = cloud.database()
  const usersCollection = db.collection('users')
  
  // 检查用户是否已存在
  const userRecord = await usersCollection.where({
    _openid: openid
  }).get()
  
  if (userRecord.data.length === 0) {
    // 新用户，创建记录
    await usersCollection.add({
      data: {
        ...decryptedData,
        openid,
        createdAt: db.serverDate(),
        lastLogin: db.serverDate()
      }
    })
  } else {
    // 老用户，更新最后登录时间
    await usersCollection.doc(userRecord.data[0]._id).update({
      data: {
        lastLogin: db.serverDate()
      }
    })
  }
  
  // 4. 返回用户信息
  return {
    openid,
    userInfo: decryptedData
  }
}
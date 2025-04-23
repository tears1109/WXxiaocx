// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init()

// 云函数入口函数
exports.main = async (event, context) => {
  const db = cloud.database()
  const { openid, userInfo, lastLoginTime } = event

  try {
    const res = await db.collection('users').where({
      _openid: openid
    }).get()

    if (res.data.length > 0) {
      // 已存在用户，只更新 lastLoginTime，不更新 userInfo
      await db.collection('users').doc(res.data[0]._id).update({
        data: {
          lastLoginTime: lastLoginTime
        }
      })
    } else {
      // 新用户，存储所有信息
      await db.collection('users').add({
        data: {
          _openid: openid,
          userInfo: userInfo,
          registerTime: lastLoginTime,
          lastLoginTime: lastLoginTime
        }
      })
    }

    return { success: true }
  } catch (err) {
    console.error(err)
    return { success: false, error: err }
  }
}

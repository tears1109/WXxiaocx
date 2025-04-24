// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init()

const db = cloud.database()
const dbCmd = db.command

exports.main = async (event) => {
  const { code, openid, userName, avatarUrl, isOwner } = event
  if (!code || !openid) {
    return { success: false, message: '参数缺失' }
  }

  try {
    // 查询房间
    const res = await db.collection('room').where({ code }).get()
    if (res.data.length === 0) {
      return { success: false, message: '房间不存在' }
    }

    const room = res.data[0]
    console.log('房间信息',room.users[0],openid);

    // 判断是否已加入
    const isJoined = Array.isArray(room.users) && room.users.some(u => u.openid === openid)
    if (isJoined) {
      return { success: true, message: '已在房间中' }
    }

    // 加入房间
    await db.collection('room').doc(room._id).update({
      data: {
        users: dbCmd.push({
          openid,
          userName: userName || '',
          avatarUrl: avatarUrl || '',
          score: 0,
          attempts: 0,
          isOwner: false,
          joinTime: new Date()
        })
      }
    })

    return { success: true, message: '加入成功' }
  } catch (e) {
    console.error('加入房间失败:', e)
    return { success: false, message: '系统错误，请稍后再试', error: e.message }
  }
}

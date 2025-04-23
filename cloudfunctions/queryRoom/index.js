// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init()

const db = cloud.database()

exports.main = async (event) => {
  const { openid } = event

  if (!openid) {
    return { success: false, message: '缺少 openid' }
  }

  try {
    const res = await db.collection('room').where({
      users: db.command.elemMatch({
        openid: openid
      })
    }).get()
    console.log('加入的房间',openid,res);
    if (res.data.length === 0) {
      return { success: false, message: '未加入任何房间' }
    }

    return {
      success: true,
      room: res.data // 如果用户只能在一个房间中
    }
  } catch (e) {
    console.error('查询房间失败:', e)
    return { success: false, message: '系统错误', error: e.message }
  }
}

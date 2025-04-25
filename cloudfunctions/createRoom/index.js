const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()

function generateCode(length = 6) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

exports.main = async (event) => {
  const { openid, userName, avatarUrl, roomName, roomType } = event

  if (!openid || !roomName || !roomType) {
    return {
      success: false,
      message: '参数缺失'
    }
  }

  const code = generateCode()
  try {
    const roomRes = await db.collection('room').add({
      data: {
        code,
        name: roomName,           // ✅ 新增字段：房间名称
        type: roomType,           // ✅ 新增字段：房间类型
        createTime: new Date(),
        createdBy: openid,
        settings: [],            // ✅ 默认打卡等级配置
        users: [
          {
            openid,
            userName: userName || '',
            avatarUrl: avatarUrl || '',
            score: 0,
            isOwner: true,
            joinTime: new Date()
          }
        ]
      }
    })

    return {
      success: true,
      code,
      roomId: roomRes._id
    }
  } catch (err) {
    return {
      success: false,
      message: '创建失败',
      error: err
    }
  }
}

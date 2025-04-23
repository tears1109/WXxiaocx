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
  const { openid, userName, avatarUrl } = event // 可传入创建者头像和昵称

  const code = generateCode()

  try {
    const roomRes = await db.collection('room').add({
      data: {
        code,
        createTime: new Date(),
        createdBy: openid,
        users: [
          {
            openid,
            userName: userName || '',     // 创建者名称（可选）
            avatarUrl: avatarUrl || '',   // 创建者头像（可选）
            score: 0,
            isOwner: true,                // ✅ 设为房主
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

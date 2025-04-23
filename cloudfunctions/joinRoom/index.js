exports.main = async (event) => {
  const { code, openid } = event
  const dbCmd = db.command

  try {
    const res = await db.collection('room').where({ code }).get()

    if (res.data.length === 0) {
      return { success: false, message: '房间不存在' }
    }

    const room = res.data[0]

    // 已存在则跳过加入
    const isJoined = room.users.some(u => u.openid === openid)
    if (isJoined) {
      return { success: true, message: '已在房间中' }
    }

    await db.collection('room').doc(room._id).update({
      data: {
        users: dbCmd.push({
          openid,
          score: 0,
          joinTime: new Date()
        })
      }
    })

    return { success: true }
  } catch (e) {
    return { success: false, message: '加入失败', error: e }
  }
}

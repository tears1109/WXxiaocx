// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const pull = db.command.pull

exports.main = async (event, context) => {
  const { roomId, targetOpenid } = event;
  if (!roomId || !targetOpenid) {
    return { success: false, message: '参数缺失' };
  }

  const { OPENID } = cloud.getWXContext();

  // 获取房间信息
  const roomRes = await db.collection('room').doc(roomId).get();
  if (!roomRes.data) {
    return { success: false, message: '房间不存在' };
  }
  const room = roomRes.data;

  // 权限校验：房主可以踢人，用户自己可以退出
  if (OPENID !== room.createdBy && OPENID !== targetOpenid) {
    return { success: false, message: '无权限操作' };
  }

  try {
    // 从 users 数组中移除对应用户
    await db.collection('room').doc(roomId).update({
      data: {
        users: pull({ openid: targetOpenid })
      }
    });
    return { success: true };
  } catch (err) {
    console.error('移除用户失败：', err);
    return { success: false, message: err.message || '移除用户失败' };
  }
} 
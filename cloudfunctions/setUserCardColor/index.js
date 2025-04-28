// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { targetOpenid, cardColor, roomId } = event;
  const { OPENID } = cloud.getWXContext();

  if (!targetOpenid || !cardColor || !roomId) {
    return {
      success: false,
      message: '参数缺失'
    };
  }

  try {
    // 获取房间信息
    const roomRes = await db.collection('room').doc(roomId).get();
    if (!roomRes.data) {
      return {
        success: false,
        message: '房间不存在'
      };
    }

    // 检查权限：只有房主可以设置颜色
    if (OPENID !== roomRes.data.createdBy) {
      return {
        success: false,
        message: '无权限操作'
      };
    }

    // 检查目标用户是否在房间中
    const targetUser = roomRes.data.users.find(u => u.openid === targetOpenid);
    if (!targetUser) {
      return {
        success: false,
        message: '目标用户不在房间中'
      };
    }

    // 更新用户卡片颜色
    await db.collection('users').where({
      _openid: targetOpenid
    }).update({
      data: {
        cardColor: cardColor
      }
    });

    return {
      success: true,
      message: '设置成功'
    };
  } catch (err) {
    console.error('设置卡片颜色失败:', err);
    return {
      success: false,
      message: err.message || '设置失败'
    };
  }
}; 
// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('收到加分请求:', event);
  const { roomId, targetOpenid, score } = event;
  const { OPENID } = cloud.getWXContext();

  if (!roomId || !targetOpenid || score === undefined) {
    console.error('参数缺失:', { roomId, targetOpenid, score });
    return {
      success: false,
      message: '参数缺失'
    };
  }

  try {
    // 获取房间信息
    console.log('获取房间信息:', roomId);
    const roomRes = await db.collection('room').doc(roomId).get();
    if (!roomRes.data) {
      console.error('房间不存在:', roomId);
      return {
        success: false,
        message: '房间不存在'
      };
    }

    // 检查是否给自己加分
    if (targetOpenid === OPENID) {
      console.error('不能给自己加分');
      return {
        success: false,
        message: '不能给自己加分'
      };
    }

    // 检查目标用户是否在房间中
    const targetUser = roomRes.data.users.find(u => u.openid === targetOpenid);
    if (!targetUser) {
      console.error('目标用户不在房间中');
      return {
        success: false,
        message: '目标用户不在房间中'
      };
    }

    // 获取操作人和目标用户的信息
    const [operatorRes, targetUserRes] = await Promise.all([
      db.collection('users').where({ _openid: OPENID }).get(),
      db.collection('users').where({ _openid: targetOpenid }).get()
    ]);

    const operator = operatorRes.data[0] || {};
    const targetUserInfo = targetUserRes.data[0] || {};

    // 创建加分记录
    const recordData = {
      roomId: roomId,
      openid: OPENID,
      targetOpenid: targetOpenid,
      score: Number(score),
      type: 'score',
      createTime: db.serverDate(),
      operator: {
        name: operator.userInfo?.nickName || '未知用户',
        avatarUrl: operator.userInfo?.avatarUrl
      },
      targetUser: {
        name: targetUserInfo.userInfo?.nickName || '未知用户',
        avatarUrl: targetUserInfo.userInfo?.avatarUrl
      }
    };

    // 更新 room 集合中用户的分数
    const users = roomRes.data.users || [];
    const targetUserIndex = users.findIndex(u => u.openid === targetOpenid);
    const ownerIndex = users.findIndex(u => u.openid === OPENID);

    if (targetUserIndex !== -1 && ownerIndex !== -1) {
      // 使用事务确保数据一致性
      const transaction = await db.startTransaction();
      try {
        // 更新用户分数
        await transaction.collection('room').doc(roomId).update({
          data: {
            [`users.${targetUserIndex}.score`]: _.inc(Number(score)),
            [`users.${ownerIndex}.score`]: _.inc(-Number(score))
          }
        });

        // 创建加分记录
        await transaction.collection('checkins').add({
          data: recordData
        });

        // 提交事务
        await transaction.commit();
        console.log('加分记录创建成功');
      } catch (err) {
        // 回滚事务
        await transaction.rollback();
        throw err;
      }
    } else {
      console.error('未找到用户:', { targetUserIndex, ownerIndex });
      return {
        success: false,
        message: '未找到用户'
      };
    }

    return {
      success: true,
      message: '加分成功'
    };
  } catch (err) {
    console.error('加分失败:', err);
    return {
      success: false,
      message: err.message || '加分失败'
    };
  }
};

async function loadRecords() {
  // 从 checkins 集合中获取 type 为 'score' 的记录
  const recordsRes = await db.collection('checkins')
    .where({
      roomId: this.data.roomId,
      type: 'score'
    })
    .orderBy('createTime', 'desc')
    .skip(skip)
    .limit(this.data.pageSize)
    .get();
} 
// 云函数入口文件
const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

// 该函数会遍历 room 集合中的所有文档，若缺少 settings 字段则添加默认空数组
exports.main = async (event) => {
  try {
    const res = await db.collection('room').get();
    const rooms = res.data || [];
    let count = 0;
    for (const room of rooms) {
      if (room._id && room.settings === undefined) {
        await db.collection('room').doc(room._id).update({
          data: { settings: [] }
        });
        count++;
      }
    }
    return { success: true, updatedCount: count };
  } catch (err) {
    console.error('迁移失败', err);
    return { success: false, error: err.message };
  }
}; 
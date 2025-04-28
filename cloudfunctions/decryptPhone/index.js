const cloud = require('wx-server-sdk');
cloud.init();

// 云函数入口函数
exports.main = async (event, context) => {
  const { encryptedData, iv } = event;
  try {
    // 调用微信开放能力解密手机号
    const res = await cloud.openapi.user.getPhoneNumber({
      encryptedData,
      iv
    });
    // 返回手机号
    return {
      success: true,
      phoneNumber: res.phoneInfo.phoneNumber
    };
  } catch (err) {
    console.error('decryptPhone error', err);
    return {
      success: false,
      error: err.message
    };
  }
}; 
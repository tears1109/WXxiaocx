// pages/login/login.js
Page({
  onGetUserInfo(e) {
    if (e.detail.userInfo) {
      // 用户点击了允许授权按钮
      this.loginWithWechat();
    } else {
      // 用户点击了拒绝按钮
      wx.showToast({
        title: '您拒绝了授权',
        icon: 'none'
      });
    }
  },
  
  loginWithWechat() {
    wx.showLoading({
      title: '登录中...',
    });
    
    // 1. 获取微信登录凭证code
    wx.login({
      success: (loginRes) => {
        if (loginRes.code) {
          // 2. 获取用户信息
          wx.getUserInfo({
            success: (userRes) => {
              // 3. 调用云函数进行登录
              wx.cloud.callFunction({
                name: 'login',
                data: {
                  code: loginRes.code,
                  userInfo: userRes.userInfo,
                  encryptedData: userRes.encryptedData,
                  iv: userRes.iv
                },
                success: (res) => {
                  wx.hideLoading();
                  // 登录成功处理
                  wx.showToast({
                    title: '登录成功',
                  });
                  // 存储用户信息到本地
                  wx.setStorageSync('userInfo', res.result.userInfo);
                  wx.setStorageSync('openid', res.result.openid);
                  // 跳转到首页或其他页面
                  wx.reLaunch({
                    url: '/pages/index/index',
                  });
                },
                fail: (err) => {
                  wx.hideLoading();
                  console.error('登录失败', err);
                  wx.showToast({
                    title: '登录失败',
                    icon: 'none'
                  });
                }
              });
            },
            fail: (err) => {
              wx.hideLoading();
              console.error('获取用户信息失败', err);
            }
          });
        } else {
          wx.hideLoading();
          console.error('获取登录code失败', loginRes);
        }
      }
    });
    
  },
  loginWithWechat() {
    wx.login({
      success: (loginRes) => {
        if (loginRes.code) {
          wx.getUserInfo({
            success: (userRes) => {
              wx.cloud.callFunction({
                name: 'login',
                data: {
                  code: loginRes.code,
                  userInfo: userRes.userInfo
                },
                success: (res) => {
                  // 存储用户信息
                  wx.setStorageSync('userInfo', res.result.userInfo);
                  wx.setStorageSync('openid', res.result.openid);
                  
                  // 获取当前页面栈
                  const pages = getCurrentPages();
                  if (pages.length > 1) {
                    // 如果有上一页，返回上一页
                    wx.navigateBack();
                  } else {
                    // 否则跳转到首页
                    wx.reLaunch({
                      url: '/pages/index/index',
                    });
                  }
                }
              });
            }
          });
        }
      }
    });
  }
});
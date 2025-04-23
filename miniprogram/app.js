// app.js
App({
  globalData: {
    userInfo: null,
    openid: null,
    cloudInitialized: false
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error("请使用基础库 2.2.3 或以上版本以使用云能力");
      wx.showToast({
        title: '微信版本过低',
        icon: 'none'
      });
      return;
    }
    
    wx.cloud.init({
      env: 'loong-9g5c3upyfdd12980',
      traceUser: true,
    });
    this.globalData.cloudInitialized = true;

    // 自动检查登录状态
    this.checkLoginStatus();
  },

  // 检查登录状态
  checkLoginStatus() {
    console.log(46546);
    const userInfo = wx.getStorageSync('userInfo');
    const openid = wx.getStorageSync('openid');
    console.log(userInfo,openid);
    if (userInfo && openid) {
      this.globalData.userInfo = userInfo;
      this.globalData.openid = openid;
      return true;
    }
    return false;
  },

  // 检查是否登录
  checkLogin() {
    if (!this.checkLoginStatus()) {
      wx.redirectTo({
        url: '/pages/login/login',
      });
      return false;
    }
    return true;
  },

  // 新增：云函数登录方法
  loginWithWeixin() {
    return new Promise((resolve, reject) => {
      if (!this.globalData.cloudInitialized) {
        reject('云开发未初始化');
        return;
      }

      // 1. 获取用户信息
      wx.getUserProfile({
        desc: '用于完善会员资料',
        success: (res) => {
          const userInfo = res.userInfo;
          
          // 2. 调用云函数获取openid
          wx.cloud.callFunction({
            name: 'login',
            data: {},
            success: (cloudRes) => {
              const { openid } = cloudRes.result;
              
              // 3. 保存到全局和缓存
              this.globalData.userInfo = userInfo;
              this.globalData.openid = openid;
              wx.setStorageSync('userInfo', userInfo);
              wx.setStorageSync('openid', openid);
              
              // 4. 可选：将用户信息存入云数据库
              this.saveUserToCloud(userInfo, openid)
                .then(() => resolve({ userInfo, openid }))
                .catch(err => reject(err));
            },
            fail: (err) => {
              reject('获取openid失败: ' + err);
            }
          });
        },
        fail: (err) => {
          reject('获取用户信息失败: ' + err);
        }
      });
    });
  },
  logout() {
    this.globalData.userInfo = null;
    this.globalData.openid = null;
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('openid');
    wx.reLaunch({
      url: '/pages/login/login'
    });
  },
  // 新增：保存用户信息到云数据库
  saveUserToCloud(userInfo, openid) {
    return wx.cloud.callFunction({
      name: 'updateUserInfo',
      data: {
        openid: openid,
        userInfo: userInfo,
        lastLoginTime: new Date()
      }
    });
  }
});
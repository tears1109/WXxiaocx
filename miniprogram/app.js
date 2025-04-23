// app.js
App({
  globalData: {
    userInfo: null,
    openid: null
  },
  
  onLaunch() {
    // 初始化时尝试从缓存中获取用户信息
    const userInfo = wx.getStorageSync('userInfo');
    const openid = wx.getStorageSync('openid');
    
    if (userInfo && openid) {
      this.globalData.userInfo = userInfo;
      this.globalData.openid = openid;
    }
  },
  
  // 检查登录状态的方法
  checkLogin() {
    if (!this.globalData.userInfo || !this.globalData.openid) {
      // 跳转到登录页面
      wx.redirectTo({
        url: '/pages/login/login',
      });
      return false;
    }
    return true;
  },
  onLaunch: function () {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        // env 参数说明：
        //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
        //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
        //   如不填则使用默认环境（第一个创建的环境）
        env: "",
        traceUser: true,
      });
    }

    this.globalData = {};
  },
});

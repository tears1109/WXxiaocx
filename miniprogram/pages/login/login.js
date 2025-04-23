const app = getApp()

Page({
  data: {
    canIUseGetUserProfile: wx.canIUse('getUserProfile'),
    loading: false
  },

  onLoad() {
    // 如果已经登录，直接跳转首页
    if (app.checkLoginStatus()) {
      wx.redirectTo({
        url: '/pages/room/room'
      });
    }
  },

  // 处理登录
  handleLogin() {
    wx.showToast({
      title: '登录中',
    });
    this.setData({ loading: true });
    
    app.loginWithWeixin()
      .then(() => {
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        });
        console.log('登录成功');
          wx.redirectTo({
            url: '/pages/room/room'
          });
      })
      .catch(err => {
        console.error('登录失败:', err);
        wx.showToast({
          title: '登录失败',
          icon: 'none'
        });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  }
});
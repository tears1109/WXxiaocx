// pages/room/room.js
const db = wx.cloud.database()
const app = getApp();
Page({
  data: {
    code: '',
    userInfo: {}, // 可通过 wx.getUserProfile 获取或全局 app.userInfo
    openid: '',   // 登录后获取
  },

  onLoad() {
    this.getUserData(app.globalData.openid);
  },
  // 获取用户数据
  async getUserData(openid) {
    try {
      const res = await db.collection('users').where({
        _openid: openid
      }).get()
      if (res.data.length > 0) {
        this.setData({
          userInfo: {
            ...this.data.userInfo,
            ...res.data[0].userInfo // 合并云数据库中的用户数据
          }
        })
      }
      console.log('res', this.data.userInfo);

    } catch (error) {
      console.error('获取用户数据失败:', error)
      wx.showToast({
        title: '获取用户数据失败',
        icon: 'none'
      })
    }
  },
  onInputCode(e) {
    this.setData({ code: e.detail.value });
  },
  async onCreateRoom() {
    wx.showLoading({ title: '创建中...' })
  
    try {
      const res = await wx.cloud.callFunction({
        name: 'createRoom',
        data: {
          openid: this.data.openid,
          userName: this.data.userInfo.nickName,
          avatarUrl: this.data.userInfo.avatarUrl
        }
      })
  
      wx.hideLoading()
  
      if (res.result.success) {
        wx.showToast({ title: '房间创建成功', icon: 'success' })
        wx.navigateTo({ url: `/pages/room/room?code=${res.result.code}` })
      } else {
        wx.showToast({ title: res.result.message || '失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '系统错误', icon: 'none' })
    }
  },
  async onJoinRoom() {
    if (!this.data.code) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '加入中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'joinRoom',
        data: {
          code: this.data.code,
          openid: this.data.openid
        }
      });

      wx.hideLoading();

      if (res.result.success) {
        wx.showToast({ title: '加入成功', icon: 'success' });
        // 这里可以跳转房间页
        wx.navigateTo({ url: `/pages/room/room?code=${this.data.code}` });
      } else {
        wx.showToast({ title: res.result.message || '加入失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '系统错误', icon: 'none' });
    }
  }
});

// pages/room/room.js
const db = wx.cloud.database()
const app = getApp();
Page({
  data: {
    showCreateModal: false,
    roomName: '',
    roomList: [],
    roomTypes: ['普通房间', '限时房间', '答题房间'],
    selectedRoomType: '',
    code: '',
    userInfo: {}, // 可通过 wx.getUserProfile 获取或全局 app.userInfo
    openid: app.globalData.openid,   // 登录后获取
  },

  onLoad() {
    this.getUserData(app.globalData.openid);
    this.queryRoom();
  },
  openCreateModal() {
    this.setData({ showCreateModal: true })
  },

  closeCreateModal() {
    this.setData({ showCreateModal: false })
  },

  stopTap() {},

  onInputRoomName(e) {
    this.setData({ roomName: e.detail.value })
  },

  onRoomTypeChange(e) {
    const index = e.detail.value
    this.setData({
      selectedRoomType: this.data.roomTypes[index]
    })
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
    const { roomName, selectedRoomType, userInfo } = this.data
    if (!roomName || !selectedRoomType) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }
  
    wx.showLoading({ title: '创建中...' })
  console.log('roomName',roomName);
    try {
      const res = await wx.cloud.callFunction({
        name: 'createRoom',
        data: {
          openid: getApp().globalData.openid,
          userName: userInfo.nickName,
          avatarUrl: userInfo.avatarUrl,
          roomName,
          roomType: selectedRoomType
        }
      })
  
      wx.hideLoading()
  
      if (res.result.success) {
        wx.showToast({ title: '房间创建成功', icon: 'success' })
        this.setData({ showCreateModal: false })
        this.queryRoom();
        // wx.navigateTo({ url: `/pages/room/room?code=${res.result.code}` })
      } else {
        wx.showToast({ title: res.result.message || '创建失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '系统错误', icon: 'none' })
    }
  }
  ,
  async queryRoom() {
    try {
      console.log(666,this.data.openid);
      const res = await wx.cloud.callFunction({
        name: 'queryRoom',
        data: { openid: this.data.openid }
      })
  
      const result = res.result
  
      if (result.success) {
        console.log('当前所在房间:', result.room)
        this.setData({ roomList: result.room })
        // 你可以这里赋值到 data 或跳转页面等处理
      } else {
        wx.showToast({ title: result.message, icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '系统错误', icon: 'none' })
      console.error('调用失败:', err)
    }
  }
,  
  async onJoinRoom() {
    if (!this.data.code) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '加入中...' });

    try {
      console.log('jkxx', this.data.code,this.data.openid);
      const res = await wx.cloud.callFunction({
        name: 'joinRoom',
        data: {
          code: this.data.code,
          openid: app.globalData.openid
        }
      });

      wx.hideLoading();

      if (res.result.success) {
        wx.showToast({ title: res.result.message, icon: 'success' });
        // 这里可以跳转房间页
        // wx.navigateTo({ url: `/pages/room/room?code=${this.data.code}` });
      } else {
        wx.showToast({ title: res.result.message || '加入失败', icon: 'none' });
      }
    } catch (err) {
        wx.hideLoading();
        console.error('加入房间失败：', err); // 打印出错误详情
        wx.showToast({ title: '系统错误', icon: 'none' });
    }
  }
});

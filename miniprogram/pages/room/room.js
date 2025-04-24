// pages/room/room.js
const db = wx.cloud.database()
const app = getApp();
Page({
  data: {
    showCreateModal: false,
    roomName: '',
    roomList: [],
    roomTypes: ['计分房间', '排行房间', '普通房间'],
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
        // 按创建时间倒序排序
        const sortedRooms = result.room.sort((a, b) => {
          return new Date(b.createTime) - new Date(a.createTime);
        });
        this.setData({ roomList: sortedRooms })
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
          openid: app.globalData.openid,
          userName: this.data.userInfo.nickName,
          avatarUrl: this.data.userInfo.avatarUrl,
          isOwner: false
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
        console.error('加入房间失败：', err);
        wx.showToast({ title: '系统错误', icon: 'none' });
    }
  },

  // 从房间列表点击加入按钮
  onJoinRoomFromList(e) {
    const roomCode = e.currentTarget.dataset.code;
    const room = e.currentTarget.dataset.room;
    
    if (room && room.type === '排行房间') {
      wx.navigateTo({
        url: `/pages/index/index?id=${room._id}`
      });
    } else {
      // 其他类型房间的处理逻辑
      wx.showToast({ title: '加入中...', icon: 'loading' });
      this.setData({ code: roomCode }, () => {
        this.onJoinRoom();
      });
    }
  }
});

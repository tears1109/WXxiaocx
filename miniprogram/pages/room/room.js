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
    openid: '', // 登录后获取，不要在此初始化
    isSidebarVisible: false,
    sidebarAnimClass: '',
    isRightSidebar: false, // 是否为右侧边栏
    user: null,
    userInfo: null,
    hasUserInfo: false,
    canIUseGetUserProfile: false,
    showJoinPopup: false,
    roomCode: '',
    roomId: '',
    room: null,
    leaderboard: [],
    loading: true,
    sidebarOpen: false,
    isDarkMode: false,  // 添加深色模式标志
  },

  onLoad() {
    if (!app.checkLogin()) {
      return;
    }
    // 确保获取并设置正确的openid
    this.setData({
      openid: app.globalData.openid
    });
    this.getUserData(app.globalData.openid);
    this.queryRoom();
    this.loadThemeSetting();
  },
    // 进入页面时更新数据
    onShow() {
      if (!app.checkLogin()) {
        return;
      }
      // 确保每次显示页面时都获取最新的openid
      this.setData({
        openid: app.globalData.openid
      });
      this.getUserData(app.globalData.openid);
      this.queryRoom();
    },
  // 处理头像点击事件，显示侧边栏
  onAvatarTap() {
    this.setData({
      isSidebarVisible: true,
      isRightSidebar: false
    });

    setTimeout(() => {
      this.setData({
        sidebarAnimClass: 'slide-in'
      });
    }, 20);
  },
  
  // 处理点击用户名或其他区域打开右侧边栏
  onOtherTap() {
    this.setData({
      isSidebarVisible: true,
      isRightSidebar: true
    });

    setTimeout(() => {
      this.setData({
        sidebarAnimClass: 'slide-in'
      });
    }, 20);
  },

  // 关闭侧边栏
  closeSidebar() {
    this.setData({
      sidebarAnimClass: 'slide-out'
    });

    setTimeout(() => {
      this.setData({
        isSidebarVisible: false
      });
    }, 300);
  },
  
  // 阻止事件冒泡
  stopTap() {
    // 防止点击侧边栏内容时关闭侧边栏
  },
  
  // 导航到个人资料页
  navigateToProfile() {
    wx.navigateTo({
      url: '/pages/profile/profile',
    });
    this.closeSidebar();
  },
  
  // 处理退出登录
  handleLogout() {
    app.logout();
  },

  openCreateModal() {
    this.setData({ showCreateModal: true })
  },

  closeCreateModal() {
    this.setData({ showCreateModal: false })
  },

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
      // 确保在调用前检查openid是否存在
      const openid = app.globalData.openid;
      if (!openid) {
        console.error('缺少openid，请先登录');
        wx.showToast({ 
          title: '请先登录', 
          icon: 'none' 
        });
        return;
      }
      
      console.log('正在查询房间，使用openid:', openid);
      
      const res = await wx.cloud.callFunction({
        name: 'queryRoom',
        data: { openid: openid } // 确保使用app.globalData中的openid
      });
  
      const result = res.result;
  
      if (result.success) {
        console.log('当前所在房间:', result.room);
        // 按创建时间倒序排序
        const sortedRooms = result.room.sort((a, b) => {
          return new Date(b.createTime) - new Date(a.createTime);
        });
        this.setData({ roomList: sortedRooms });
      } else {
        console.log('查询房间返回失败:', result.message);
        if (result.message === '未加入任何房间') {
          // 这是正常情况，不显示错误提示
          this.setData({ roomList: [] });
        } else {
          wx.showToast({ title: result.message, icon: 'none' });
        }
      }
    } catch (err) {
      console.error('调用queryRoom失败:', err);
      wx.showToast({ title: '系统错误', icon: 'none' });
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
        this.queryRoom();
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
  },

  // 加载主题设置
  loadThemeSetting() {
    const themeSettings = wx.getStorageSync('themeSettings') || { isDarkMode: false };
    this.setData({
      isDarkMode: themeSettings.isDarkMode
    });
    
    // 更新导航栏颜色
    wx.setNavigationBarColor({
      frontColor: themeSettings.isDarkMode ? '#ffffff' : '#000000',
      backgroundColor: themeSettings.isDarkMode ? '#121212' : '#ffffff',
      animation: {
        duration: 300,
        timingFunc: 'easeIn'
      }
    });
  },
  
  // 切换主题
  toggleTheme() {
    const newDarkMode = !this.data.isDarkMode;
    this.setData({
      isDarkMode: newDarkMode
    });
    
    // 保存设置到存储
    wx.setStorageSync('themeSettings', { isDarkMode: newDarkMode });
    
    // 更新导航栏颜色
    wx.setNavigationBarColor({
      frontColor: newDarkMode ? '#ffffff' : '#000000',
      backgroundColor: newDarkMode ? '#121212' : '#ffffff',
      animation: {
        duration: 300,
        timingFunc: 'easeIn'
      }
    });
    
    // 通知app更新全局主题
    const app = getApp();
    if (app.globalData) {
      app.globalData.darkMode = newDarkMode;
    }
  },
});

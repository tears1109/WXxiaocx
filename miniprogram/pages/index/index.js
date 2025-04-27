const db = wx.cloud.database()
const app = getApp();
Page({
  data: {
    currentOpenid: '', // 当前用户 openid
    isSidebarVisible: false, // 控制侧边栏弹窗显示
    sidebarAnimClass: '',
    isRightSidebar: false, // 是否为右侧边栏
    userInfo: null,
    stats: {
      users: 0,
      attempts: 0,
      totalScore: 0
    },
    leaderboard: [],
    isLoggedIn: false,
    roomId: '', // 添加房间id
    roomInfo: null, // 添加房间信息
    isLoading: false,
    isRefreshing: false,
    userScore: 0,    // 用户总分
    userRank: '-',   // 用户排名
    roomUser: { name: '', avatarUrl: '' },
    isOwner: false, // 是否为房主
    showSettingsModal: false,
    settings: [], // 打卡配置等级
    showUserModal: false, // 控制用户详情弹窗显示
    selectedUser: {},     // 存储选择的用户信息
    isDarkMode: false // 主题模式：false为浅色，true为深色
  },

  onLoad(options) {
    // 检查登录状态，未登录时会自动跳转登录页
    if (!app.checkLogin()) {
      return;
    }
    
    // 设置当前用户 openid
    this.setData({ currentOpenid: app.globalData.openid });
    this.getUserData(app.globalData.openid);
    
    // 如果有传入房间id，加载房间数据
    if (options.id) {
      this.setData({ roomId: options.id });
      this.loadRoomData(options.id);
    } else {
      this.navigateToRoom();
    }
    
    // 加载主题设置
    this.loadThemeSettings();
  },

  // 进入页面时更新数据
  onShow() {
    // 检查登录状态，未登录时会自动跳转登录页
    if (!app.checkLogin()) {
      return;
    }
    
    this.getUserData(app.globalData.openid);
    if (this.data.roomId) {
      this.loadRoomData(this.data.roomId);
    }
  },

  // 启用下拉刷新
  onPullDownRefresh() {
    if (this.data.roomId) {
      this.setData({ isRefreshing: true });
      this.loadRoomData(this.data.roomId).then(() => {
        wx.stopPullDownRefresh();
        this.setData({ isRefreshing: false });
      });
    } else {
      wx.stopPullDownRefresh();
    }
  },

  // 加载房间数据
  async loadRoomData(roomId) {
    if (this.data.isLoading) return;
    
    this.setData({ isLoading: true });
    try {
      // 获取房间信息
      const roomRes = await db.collection('room').doc(roomId).get();
      
      if (roomRes.data) {
        const users = roomRes.data.users || [];
        
        // 新增：从全局 users 集合拉取最新头像和昵称
        let userInfoMap = {};
        if (users.length > 0) {
          const openids = users.map(u => u.openid);
          const userDocs = await db.collection('users').where({
            _openid: db.command.in(openids)
          }).get();
          userDocs.data.forEach(doc => {
            userInfoMap[doc._openid] = doc.userInfo || {};
          });
        }
        
        // 获取该房间的所有打卡记录
        const checkinsRes = await db.collection('checkins')
          .where({
            roomId: roomId
          })
          .get();
        
        const checkins = checkinsRes.data || [];
        
        // 统计每个用户的打卡次数和分数
        const userAttempts = {};
        const userScores = {};
        
        checkins.forEach(checkin => {
          const userOpenid = checkin.openid;
          // 更新打卡次数
          userAttempts[userOpenid] = (userAttempts[userOpenid] || 0) + 1;
          // 更新用户总分 - 从打卡记录中累加分数
          userScores[userOpenid] = (userScores[userOpenid] || 0) + (Number(checkin.score) || 0);
        });
        
        // 处理用户数据
        const sortedUsers = users.map(user => {
          const globalInfo = userInfoMap[user.openid] || {};
          console.log(666,globalInfo.nickName);
          
          return {
            name: globalInfo.nickName || user.userName || '未知用户',
            avatarUrl: globalInfo.avatarUrl || user.avatarUrl || '',
            // 使用从打卡记录中计算的分数，而不是room中存储的分数
            score: userScores[user.openid] || 0,
            attempts: userAttempts[user.openid] || 0,
            lastCheckin: user.lastCheckin,
            openid: user.openid
          };
        }).sort((a, b) => b.score - a.score);

        // 计算当前用户的排名和分数
        const currentUserIndex = sortedUsers.findIndex(user => user.openid === app.globalData.openid);
        const currentUser = sortedUsers[currentUserIndex];
        const roomUser = currentUser ? { name: currentUser.name, avatarUrl: currentUser.avatarUrl } : { name: '', avatarUrl: '' };
        const userRank = currentUserIndex !== -1 ? currentUserIndex + 1 : '-';
        const userScore = currentUser ? currentUser.score : 0;

        this.setData({
          roomInfo: roomRes.data,
          leaderboard: sortedUsers,
          userScore: userScore,
          userRank: userRank,
          stats: {
            users: users.length,
            attempts: checkins.length,
            totalScore: sortedUsers.reduce((sum, user) => sum + user.score, 0)
          },
          roomUser: roomUser,
          // 房主判断及初始设置
          isOwner: roomRes.data.createdBy === app.globalData.openid,
          settings: roomRes.data.settings || [{ duration: '', points: '' }]
        });
      }
    } catch (err) {
      console.error('获取房间数据失败:', err);
      wx.showToast({
        title: '获取房间数据失败',
        icon: 'none'
      });
    } finally {
      this.setData({ isLoading: false });
    }
  },

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

  // 添加点击用户名或其他区域打开右侧边栏
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

  stopTap() {},

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
            ...res.data[0].userInfo
          }
        })
      }
    } catch (error) {
      console.error('获取用户数据失败:', error)
      wx.showToast({
        title: '获取用户数据失败',
        icon: 'none'
      })
    }
  },

  navigateToCheckins() {
    wx.navigateTo({
      url: `/pages/checkins/checkins?roomId=${this.data.roomId}`
    });
  },

  navigateToRoom() {
    wx.navigateTo({
      url: '/pages/room/room'
    });
  },

  // 新增：处理退出登录
  handleLogout() {
    app.logout();
  },

  // 新增：跳转到资料编辑页
  navigateToProfile() {
    wx.navigateTo({
      url: '/pages/profile/profile',
    });
  },

  // 新增：复制邀请码
  copyInviteCode() {
    const code = this.data.roomInfo && this.data.roomInfo.code;
    if (!code) return;
    wx.setClipboardData({
      data: code,
      success: () => {
        wx.showToast({ title: '复制成功', icon: 'success' });
      }
    });
  },

  // 处理滚动到底部事件
  onReachBottom() {
    // 目前不需要加载更多数据，因为所有数据都一次性加载
    // 如果将来需要分页，可以在这里实现
  },

  // 打开设置弹窗
  openSettingsModal() {
    this.setData({ showSettingsModal: true });
  },

  // 关闭设置弹窗
  closeSettingsModal() {
    this.setData({ showSettingsModal: false });
  },

  // 输入配置项
  onSettingInput(e) {
    const { index, key } = e.currentTarget.dataset;
    const value = e.detail.value;
    const newSettings = [...this.data.settings];
    newSettings[index][key] = value;
    this.setData({ settings: newSettings });
  },

  // 添加等级
  addLevel() {
    if (this.data.settings.length < 5) {
      this.setData({ settings: [...this.data.settings, { duration: '', points: '' }] });
    }
  },

  // 删除等级
  removeLevel(e) {
    const { index } = e.currentTarget.dataset;
    const newSettings = this.data.settings.filter((_, i) => i !== index);
    this.setData({ settings: newSettings });
  },

  // 保存设置
  async onSaveSettings() {
    const { settings } = this.data;
    // 简单校验
    for (const item of settings) {
      if (!item.duration || !item.points) {
        wx.showToast({ title: '请填写完整等级信息', icon: 'none' });
        return;
      }
    }
    try {
      wx.showLoading({ title: '保存中...' });
      // 使用云函数执行更新
      const resCloud = await wx.cloud.callFunction({
        name: 'updateRoomSettings',
        data: { roomId: this.data.roomId, settings: this.data.settings }
      });
      console.log('-> 云函数更新结果', resCloud);
      if (!resCloud.result || !resCloud.result.success) {
        wx.hideLoading();
        wx.showToast({ title: resCloud.result.message || '保存失败', icon: 'none' });
        return;
      }
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      this.closeSettingsModal();
      // 刷新房间数据
      this.loadRoomData(this.data.roomId);
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
      console.error('保存设置失败', err);
    }
  },

  // 新增：显示用户详情弹窗
  showUserModal(e) {
    const user = e.currentTarget.dataset.item;
    this.setData({
      showUserModal: true,
      selectedUser: user
    });
  },

  // 新增：隐藏用户详情弹窗
  hideUserModal() {
    this.setData({
      showUserModal: false,
      selectedUser: {}
    });
  },

  // 新增：从弹窗踢出用户
  kickSelectedUser() {
    const targetOpenid = this.data.selectedUser.openid;
    wx.showModal({
      title: '踢出成员',
      content: '确定要踢出该成员吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '操作中...' });
          wx.cloud.callFunction({
            name: 'removeUser',
            data: { roomId: this.data.roomId, targetOpenid },
            success: () => {
              wx.hideLoading();
              wx.showToast({ title: '已踢出', icon: 'success' });
              this.hideUserModal();
              this.loadRoomData(this.data.roomId);
            },
            fail: (err) => {
              wx.hideLoading();
              wx.showToast({ title: '操作失败', icon: 'none' });
              console.error('踢人失败：', err);
            }
          });
        }
      }
    });
  },

  // 新增：退出房间
  exitRoom() {
    wx.showModal({
      title: '退出房间',
      content: '确定要退出当前房间吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '退出中...' });
          wx.cloud.callFunction({
            name: 'removeUser',
            data: { roomId: this.data.roomId, targetOpenid: this.data.currentOpenid },
            success: () => {
              wx.hideLoading();
              wx.showToast({ title: '已退出', icon: 'success' });
              // 跳转到房间列表页
              wx.navigateTo({ url: '/pages/room/room' });
            },
            fail: (err) => {
              wx.hideLoading();
              wx.showToast({ title: '操作失败', icon: 'none' });
              console.error('退出房间失败：', err);
            }
          });
        }
      }
    });
  },

  // 加载主题设置
  loadThemeSettings() {
    const themeSettings = wx.getStorageSync('themeSettings') || { isDarkMode: false };
    this.setData({
      isDarkMode: themeSettings.isDarkMode
    });
    
    // 应用主题设置
    if (themeSettings.isDarkMode) {
      wx.setNavigationBarColor({
        frontColor: '#ffffff',
        backgroundColor: '#121212'
      });
    } else {
      wx.setNavigationBarColor({
        frontColor: '#000000',
        backgroundColor: '#f5f6fa'
      });
    }
  },
  
  // 切换主题
  toggleTheme() {
    const newDarkMode = !this.data.isDarkMode;
    this.setData({
      isDarkMode: newDarkMode
    });
    
    // 保存设置
    wx.setStorageSync('themeSettings', { isDarkMode: newDarkMode });
    
    // 设置导航栏颜色
    if (newDarkMode) {
      wx.setNavigationBarColor({
        frontColor: '#ffffff',
        backgroundColor: '#121212'
      });
    } else {
      wx.setNavigationBarColor({
        frontColor: '#000000',
        backgroundColor: '#f5f6fa'
      });
    }
  },
});
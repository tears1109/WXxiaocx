const db = wx.cloud.database()
const _ = db.command
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
    isDarkMode: false, // 主题模式：false为浅色，true为深色
    colorOptions: [
      ' ', // 白色渐变
      'linear-gradient(135deg, #ffeb3b 0%, #fbc02d 100%)', // 黄色渐变
      'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)', // 绿色渐变
      'linear-gradient(135deg, #2196f3 0%, #1565c0 100%)', // 蓝色渐变
      'linear-gradient(135deg, #9c27b0 0%, #6a1b9a 100%)', // 紫色渐变
      'linear-gradient(135deg, #f44336 0%, #c62828 100%)', // 红色渐变
      'linear-gradient(135deg, #ff9800 0%, #ef6c00 100%)', // 橙色渐变
      'linear-gradient(135deg, #795548 0%, #4e342e 100%)', // 棕色渐变
      'linear-gradient(135deg, #607d8b 0%, #37474f 100%)', // 蓝灰色渐变
      'linear-gradient(135deg, #FF69A0 0%, #FFB7C5 100%)'   // 粉色渐变
    ]
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
        
        // 从全局 users 集合拉取最新头像和昵称
        let userInfoMap = {};
        if (users.length > 0) {
          // 调用 getUsers 云函数获取用户信息
          const userRes = await wx.cloud.callFunction({
            name: 'getUsers'
          });
          
          if (userRes.result && userRes.result.code === 0) {
            const allUsers = userRes.result.data;
            // 创建用户信息映射
            allUsers.forEach(user => {
              userInfoMap[user._openid] = {
                nickName: user.nickName,
                avatarUrl: user.avatarUrl,
                cardColor: user.cardColor
              };
            });
          }
        }
        
        // 处理用户数据，优先使用 users 集合中的信息
        const sortedUsers = users.map(user => {
          const globalInfo = userInfoMap[user.openid] || {};
          
          return {
            name: globalInfo.nickName || '未知用户',
            avatarUrl: globalInfo.avatarUrl || 'https://6c6f-loong-9g5c3upyfdd12980-1323550512.tcb.qcloud.la/default-avatar.jpg',
            score: user.score || 0,
            attempts: user.attempts || 0,
            lastCheckin: user.lastCheckin,
            openid: user.openid,
            cardColor: globalInfo.cardColor || ''
          };
        }).sort((a, b) => b.score - a.score);

        // 计算当前用户的排名和分数
        const currentUserIndex = sortedUsers.findIndex(user => user.openid === app.globalData.openid);
        const currentUser = sortedUsers[currentUserIndex];
        const roomUser = currentUser ? { 
          name: currentUser.name, 
          avatarUrl: currentUser.avatarUrl,
          cardColor: currentUser.cardColor
        } : { name: '', avatarUrl: '', cardColor: '' };
        const userRank = currentUserIndex !== -1 ? currentUserIndex + 1 : '-';
        const userScore = currentUser ? currentUser.score : 0;

        // 计算总打卡次数和总分
        const totalAttempts = users.reduce((sum, user) => sum + (user.attempts || 0), 0);
        const totalScore = users.reduce((sum, user) => sum + (user.score || 0), 0);

        this.setData({
          roomInfo: roomRes.data,
          leaderboard: sortedUsers,
          userScore: userScore,
          userRank: userRank,
          stats: {
            users: users.length,
            attempts: totalAttempts,
            totalScore: totalScore
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

  // 新增：设置用户卡片颜色
  async setUserCardColor(e) {
    const color = e.currentTarget.dataset.color;
    const targetOpenid = this.data.selectedUser.openid;

    try {
      wx.showLoading({ title: '设置中...' });
      const result = await wx.cloud.callFunction({
        name: 'setUserCardColor',
        data: {
          targetOpenid,
          cardColor: color,
          roomId: this.data.roomId
        }
      });

      if (result.result && result.result.success) {
        wx.showToast({
          title: '设置成功',
          icon: 'success'
        });

        // 更新本地数据
        const updatedUser = {
          ...this.data.selectedUser,
          cardColor: color
        };
        this.setData({
          selectedUser: updatedUser
        });

        // 更新排行榜中的用户数据
        const leaderboard = this.data.leaderboard.map(user => {
          if (user.openid === targetOpenid) {
            return {
              ...user,
              cardColor: color
            };
          }
          return user;
        });
        this.setData({ leaderboard });

        // 重新加载房间数据以确保数据同步
        this.loadRoomData(this.data.roomId);
      } else {
        throw new Error(result.result?.message || '设置失败');
      }
    } catch (err) {
      console.error('设置卡片颜色失败:', err);
      wx.showToast({
        title: err.message || '设置失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 新增：重新统计房间数据
  async recalculateRoomStats() {
    if (!this.data.isOwner) {
      wx.showToast({
        title: '只有房主可以重新统计',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '重新统计',
      content: '确定要重新统计所有用户的打卡次数和分数吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '统计中...' });
          try {
            const result = await wx.cloud.callFunction({
              name: 'recalculateRoomStats',
              data: {
                roomId: this.data.roomId
              }
            });

            if (result.result && result.result.success) {
              wx.showToast({
                title: '统计完成',
                icon: 'success'
              });
              // 刷新房间数据
              this.loadRoomData(this.data.roomId);
            } else {
              throw new Error(result.result?.message || '统计失败');
            }
          } catch (err) {
            console.error('重新统计失败:', err);
            wx.showToast({
              title: err.message || '统计失败',
              icon: 'none'
            });
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  },
});
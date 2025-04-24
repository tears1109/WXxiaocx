const db = wx.cloud.database()
const app = getApp();
Page({
  data: {
    isSidebarVisible: false, // 控制侧边栏弹窗显示
    sidebarAnimClass: '',
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
  },

  onLoad(options) {
    if (!app.checkLogin()) {
      return;
    }
    this.getUserData(app.globalData.openid);
    
    // 如果有传入房间id，加载房间数据
    if (options.id) {
      this.setData({ roomId: options.id });
      this.loadRoomData(options.id);
    }
  },

  // 进入页面时更新数据
  onShow() {
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
        
        // 获取该房间的所有打卡记录
        const checkinsRes = await db.collection('checkins')
          .where({
            roomId: roomId
          })
          .get();
        
        const checkins = checkinsRes.data || [];
        
        // 统计每个用户的打卡次数
        const userAttempts = {};
        checkins.forEach(checkin => {
          userAttempts[checkin.openid] = (userAttempts[checkin.openid] || 0) + 1;
        });
        
        // 处理用户数据
        const sortedUsers = users.map(user => ({
          name: user.userName || '未知用户',
          score: user.score || 0,
          attempts: userAttempts[user.openid] || 0,
          avatarUrl: user.avatarUrl,
          lastCheckin: user.lastCheckin,
          openid: user.openid
        })).sort((a, b) => b.score - a.score);

        // 计算当前用户的排名和分数
        const currentUserIndex = sortedUsers.findIndex(user => user.openid === app.globalData.openid);
        const currentUser = sortedUsers[currentUserIndex];
        const userRank = currentUserIndex !== -1 ? currentUserIndex + 1 : '-';
        const userScore = currentUser ? currentUser.score : 0;

        this.setData({
          roomInfo: roomRes.data,
          leaderboard: sortedUsers,
          userScore: userScore,
          userRank: userRank,
          stats: {
            users: users.length,
            attempts: checkins.length, // 使用实际的打卡记录总数
            totalScore: users.reduce((sum, user) => sum + (user.score || 0), 0)
          }
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
      isSidebarVisible: true
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

  // 处理滚动到底部事件
  onReachBottom() {
    // 目前不需要加载更多数据，因为所有数据都一次性加载
    // 如果将来需要分页，可以在这里实现
  }
});
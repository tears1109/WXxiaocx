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
    isLoggedIn: false
  },

  onLoad() {
    if (!app.checkLogin()) {
      return;
    }
    this.getUserData(app.globalData.openid)
    this.loadLeaderboard();
  },
  onAvatarTap() {
    this.setData({
      isSidebarVisible: true
    });

    setTimeout(() => {
      this.setData({
        sidebarAnimClass: 'slide-in'
      });
    }, 20); // 给一点延迟，保证 class 变更生效
  },

  closeSidebar() {
    this.setData({
      sidebarAnimClass: 'slide-out'
    });

    setTimeout(() => {
      this.setData({
        isSidebarVisible: false
      });
    }, 300); // 和动画时长一致
  },

  stopTap() {}, // 阻止冒泡,
  loadLeaderboard() {
    // wx.getStorageSync('leaderboard') ||
    let leaderboard =  [
      {
      name: '阿威',
      score: 57,
      attempts: 20
    },
      {
      name: '阿威',
      score: 57,
      attempts: 20
    },
      {
      name: '阿威',
      score: 57,
      attempts: 20
    },
      {
      name: '阿威',
      score: 57,
      attempts: 20
    },
      {
      name: '阿威',
      score: 57,
      attempts: 20
    },
      {
      name: '阿威',
      score: 57,
      attempts: 20
    },
      {
      name: '阿威',
      score: 57,
      attempts: 20
    },
      {
      name: '阿威',
      score: 57,
      attempts: 20
    },
      {
      name: '阿威',
      score: 57,
      attempts: 20
    },
    {
      name: 'Yohanes',
      score: 56,
      attempts: 21
    },
    {
      name: '乐乐',
      score: 44,
      attempts: 18
    },
    {
      name: '小明',
      score: 39,
      attempts: 15
    },
    {
      name: '张三',
      score: 35,
      attempts: 12
    }];
    console.log(leaderboard);
    leaderboard.sort((a, b) => b.score - a.score); // 按分数排序
    
    let stats = {
      users: leaderboard.length,
      attempts: leaderboard.reduce((sum, user) => sum + user.attempts, 0),
      totalScore: leaderboard.reduce((sum, user) => sum + user.score, 0)
    };

    this.setData({ leaderboard, stats });
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
  navigateToCheckins() {
    wx.navigateTo({
      url: '/pages/checkins/checkins'
    });
  }
  ,
  navigateToRoom() {
    wx.navigateTo({
      url: '/pages/room/room'
    });
  }
});
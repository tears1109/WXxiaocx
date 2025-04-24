const db = wx.cloud.database()
const app = getApp();

Page({
  data: {
    userInfo: null,
    todayCheckins: [], // 今日打卡用户列表
    roomInfo: null,    // 房间信息
    roomId: '', // 房间ID
    stats: {
      todayUsers: 0,   // 今日打卡人数
      totalScore: 0    // 今日总分
    },
    checkinContent: '', // 打卡内容
    duration: '',      // 打卡时长
    showCheckinModal: false // 控制打卡弹窗显示
  },

  onLoad(options) {
    if (!app.checkLogin()) {
      return;
    }
    if (options.roomId) {
      this.setData({ roomId: options.roomId });
      this.loadRoomInfo(options.roomId);
    }
    this.getUserData(app.globalData.openid);
    this.loadTodayCheckins();
  },

  // 显示打卡弹窗
  showCheckinModal() {
    this.setData({
      showCheckinModal: true
    });
  },

  // 隐藏打卡弹窗
  hideCheckinModal() {
    this.setData({
      showCheckinModal: false
    });
  },

  // 阻止冒泡
  stopPropagation() {
    return;
  },

  // 处理打卡内容输入
  onContentInput(e) {
    this.setData({
      checkinContent: e.detail.value
    });
  },

  // 处理时长输入
  onDurationInput(e) {
    this.setData({
      duration: e.detail.value
    });
  },

  // 打卡
  async onCheckin() {
    if (!this.data.roomId) {
      wx.showToast({
        title: '房间信息错误',
        icon: 'none'
      });
      return;
    }

    if (!this.data.duration) {
      wx.showToast({
        title: '请输入打卡时长',
        icon: 'none'
      });
      return;
    }

    const duration = parseInt(this.data.duration);
    if (isNaN(duration) || duration <= 0) {
      wx.showToast({
        title: '请输入有效的时长',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '打卡中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'checkin',
        data: {
          openid: app.globalData.openid,
          userName: this.data.userInfo.nickName,
          avatarUrl: this.data.userInfo.avatarUrl,
          roomId: this.data.roomId,
          content: this.data.checkinContent,
          duration: duration
        }
      });

      wx.hideLoading();

      if (res.result.success) {
        // 更新房间用户分数
        await this.updateRoomUserScore(res.result.score);
        
        wx.showToast({
          title: '打卡成功',
          icon: 'success'
        });

        // 清空输入并关闭弹窗
        this.setData({
          checkinContent: '',
          duration: '',
          showCheckinModal: false
        });

        // 重新加载打卡数据
        this.loadTodayCheckins();
      } else {
        wx.showToast({
          title: res.result.message || '打卡失败',
          icon: 'none'
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('打卡失败：', err);
      wx.showToast({
        title: '系统错误',
        icon: 'none'
      });
    }
  },

  // 加载房间信息
  async loadRoomInfo(roomId) {
    try {
      const res = await db.collection('room').doc(roomId).get();
      this.setData({
        roomInfo: res.data
      });
    } catch (err) {
      console.error('获取房间信息失败：', err);
      wx.showToast({
        title: '获取房间信息失败',
        icon: 'none'
      });
    }
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

  // 加载今日打卡数据
  async loadTodayCheckins() {
    if (!this.data.roomId) return;

    try {
      const res = await wx.cloud.callFunction({
        name: 'getTodayCheckins',
        data: {
          openid: app.globalData.openid,
          roomId: this.data.roomId
        }
      });

      if (res.result.success) {
        // 按分数降序排序
        const sortedCheckins = res.result.checkins.sort((a, b) => b.score - a.score);
        
        // 计算统计数据
        const stats = {
          todayUsers: sortedCheckins.length,
          totalScore: sortedCheckins.reduce((sum, user) => sum + user.score, 0)
        };

        this.setData({
          todayCheckins: sortedCheckins,
          stats
        });
      }
    } catch (err) {
      console.error('获取今日打卡数据失败：', err);
      wx.showToast({
        title: '获取数据失败',
        icon: 'none'
      });
    }
  },

  // 更新房间用户分数
  async updateRoomUserScore(score) {
    try {
      await wx.cloud.callFunction({
        name: 'updateRoomUserScore',
        data: {
          roomId: this.data.roomId,
          openid: app.globalData.openid,
          score: score
        }
      });
    } catch (err) {
      console.error('更新房间分数失败：', err);
    }
  },

  navigateBack() {
    wx.navigateBack();
  }
});
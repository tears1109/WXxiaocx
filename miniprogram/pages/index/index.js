const db = wx.cloud.database()
const app = getApp()

Page({
  data: {
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
    this.initPage()
  },

  onShow() {
    // 每次页面显示时检查登录状态
    this.checkLoginStatus()
  },

  // 初始化页面
  initPage() {
    this.loadLeaderboard()
    this.checkLoginStatus()
  },

  // 检查登录状态
  checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo')
    const openid = wx.getStorageSync('openid')
    
    if (userInfo && openid) {
      // 已登录状态
      this.setData({
        isLoggedIn: true,
        userInfo: userInfo
      })
      app.globalData.userInfo = userInfo
      this.getUserData(openid)
    } else {
      // 未登录状态
      this.setData({
        isLoggedIn: false,
        userInfo: null
      })
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
            ...res.data[0] // 合并云数据库中的用户数据
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

  // 用户登录
  async onGetUserInfo(e) {
    if (e.detail.userInfo) {
      try {
        wx.showLoading({
          title: '登录中...',
        })

        // 1. 获取微信登录凭证code
        const loginRes = await wx.login()
        if (!loginRes.code) {
          throw new Error('获取登录code失败')
        }

        // 2. 调用云函数登录
        const res = await wx.cloud.callFunction({
          name: 'login',
          data: {
            code: loginRes.code,
            userInfo: e.detail.userInfo
          }
        })

        wx.hideLoading()

        if (res.result && res.result.openid) {
          // 3. 存储用户信息
          const userData = {
            ...e.detail.userInfo,
            openid: res.result.openid
          }
          
          wx.setStorageSync('userInfo', userData)
          wx.setStorageSync('openid', res.result.openid)
          
          // 4. 更新全局和页面数据
          app.globalData.userInfo = userData
          this.setData({
            isLoggedIn: true,
            userInfo: userData
          })

          // 5. 获取用户数据
          this.getUserData(res.result.openid)

          wx.showToast({
            title: '登录成功',
            icon: 'success'
          })
        } else {
          throw new Error('登录失败: 无效的响应')
        }
      } catch (err) {
        wx.hideLoading()
        console.error('登录失败:', err)
        wx.showToast({
          title: '登录失败: ' + (err.message || '未知错误'),
          icon: 'none'
        })
      }
    }
  },

  // 退出登录
  logout() {
    try {
      wx.showLoading({
        title: '退出中...',
      })

      // 清除本地存储
      wx.removeStorageSync('userInfo')
      wx.removeStorageSync('openid')

      // 清除全局数据
      app.globalData.userInfo = null

      // 更新页面状态
      this.setData({
        isLoggedIn: false,
        userInfo: null
      })

      wx.hideLoading()
      wx.showToast({
        title: '已退出登录',
        icon: 'success'
      })
    } catch (err) {
      wx.hideLoading()
      console.error('退出登录失败:', err)
      wx.showToast({
        title: '退出登录失败',
        icon: 'none'
      })
    }
  },

  // 加载排行榜数据
  async loadLeaderboard() {
    try {
      // 这里应该是从云数据库获取真实数据
      // const res = await db.collection('leaderboard').orderBy('score', 'desc').get()
      // const leaderboard = res.data
      
      // 暂时使用模拟数据
      const leaderboard = [
        {name: '阿威', score: 57, attempts: 20, avatarUrl: '/assets/images/default-avatar.jpg'},
        {name: 'Yohanes', score: 56, attempts: 21, avatarUrl: '/assets/images/default-avatar.jpg'},
        {name: '乐乐', score: 44, attempts: 18, avatarUrl: '/assets/images/default-avatar.jpg'},
        // ...其他用户数据
      ]

      const stats = {
        users: leaderboard.length,
        attempts: leaderboard.reduce((sum, user) => sum + user.attempts, 0),
        totalScore: leaderboard.reduce((sum, user) => sum + user.score, 0)
      }

      this.setData({
        leaderboard,
        stats
      })
    } catch (error) {
      console.error('加载排行榜失败:', error)
      wx.showToast({
        title: '加载排行榜失败',
        icon: 'none'
      })
    }
  },

  navigateToCheckins() {
    if (!this.data.isLoggedIn) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }
    
    wx.navigateTo({
      url: '/pages/checkins/checkins'
    })
  }
})
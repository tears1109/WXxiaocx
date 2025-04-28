const db = wx.cloud.database()
const app = getApp();

Page({
  data: {
    roomId: '',
    users: [],
    selectedUserId: '',
    points: '',
    isDarkMode: false,
    currentUserScore: 0
  },

  onLoad(options) {
    // 检查登录状态
    if (!app.checkLogin()) {
      return;
    }
    
    if (options.roomId) {
      this.setData({ roomId: options.roomId });
      this.loadRoomUsers(options.roomId);
    } else {
      wx.showToast({
        title: '缺少房间ID',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
    
    // 加载主题设置
    this.loadThemeSettings();
  },

  // 在页面显示时重新加载主题设置
  onShow() {
    // 重新加载主题设置，确保与其他页面保持一致
    this.loadThemeSettings();
  },

  // 加载房间用户
  async loadRoomUsers(roomId) {
    if (!roomId) {
      console.error('房间ID为空');
      return;
    }
    
    console.log('开始加载房间用户数据, roomId:', roomId);
    wx.showLoading({
      title: '加载用户中...',
    });
    
    try {
      // 获取房间信息
      const roomRes = await db.collection('room').doc(roomId).get();
      console.log('获取房间信息成功:', roomRes.data);
      
      if (roomRes.data) {
        const roomUsers = roomRes.data.users || [];
        
        if (roomUsers.length === 0) {
          console.warn('房间中没有用户');
          this.setData({ users: [] });
          wx.hideLoading();
          return;
        }
        
        // 获取用户全局信息（最新头像和昵称）
        let userInfoMap = {};
        try {
          const openids = roomUsers.map(u => u.openid);
          console.log('待查询用户ID:', openids);
          
          const userDocs = await db.collection('users').where({
            _openid: db.command.in(openids)
          }).get();
          console.log('获取全局用户信息成功:', userDocs.data);
          
          userDocs.data.forEach(doc => {
            userInfoMap[doc._openid] = doc.userInfo || {};
          });
        } catch (err) {
          console.error('获取全局用户信息失败:', err);
        }
        
        // 获取该房间的所有打卡记录
        console.log('开始获取打卡记录...');
        let checkins = [];
        try {
          const checkinsRes = await db.collection('checkins')
            .where({
              roomId: roomId
            })
            .get();
          checkins = checkinsRes.data || [];
          console.log('获取打卡记录成功:', checkins.length + '条');
        } catch (err) {
          console.error('获取打卡记录失败:', err);
        }
        
        // 统计每个用户的打卡次数和分数
        const userAttempts = {};
        const userScores = {};
        
        checkins.forEach(checkin => {
          if (!checkin.openid) {
            console.warn('发现无效打卡记录:', checkin);
            return;
          }
          
          const userOpenid = checkin.openid;
          // 更新打卡次数
          userAttempts[userOpenid] = (userAttempts[userOpenid] || 0) + 1;
          // 更新用户总分 - 从打卡记录中累加分数
          userScores[userOpenid] = (userScores[userOpenid] || 0) + (Number(checkin.score) || 0);
        });
        
        // 处理用户数据
        const users = roomUsers.map(user => {
          if (!user.openid) {
            console.warn('发现无效用户:', user);
            return null;
          }
          
          const globalInfo = userInfoMap[user.openid] || {};
          return {
            openid: user.openid,
            name: globalInfo.nickName || user.userName || '未知用户',
            avatarUrl: globalInfo.avatarUrl || user.avatarUrl || '',
            // 使用从打卡记录中计算的分数，而不是room中存储的分数
            score: userScores[user.openid] || 0
          };
        }).filter(Boolean); // 过滤掉null值
        
        console.log('处理后的用户列表:', users);

        // 过滤掉当前用户（不能给自己加分）
        const currentOpenid = app.globalData.openid;
        console.log('当前用户ID:', currentOpenid);
        
        const filteredUsers = users.filter(user => user.openid !== currentOpenid);
        console.log('过滤后的用户列表:', filteredUsers);
        
        this.setData({ users: filteredUsers });
      }
    } catch (err) {
      console.error('获取房间用户数据失败:', err);
      wx.showToast({
        title: '获取用户数据失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 选择用户
  selectUser(e) {
    const openid = e.currentTarget.dataset.openid;
    this.setData({ selectedUserId: openid });
  },

  // 处理理由输入
  onReasonInput(e) {
    this.setData({ reason: e.detail.value });
  },

  // 处理分数输入
  onPointsInput(e) {
    this.setData({ points: e.detail.value });
  },

  // 提交加分
  async submitPoints() {
    console.log('submitPoints 被调用');
    const { selectedUserId, points, roomId } = this.data;
    console.log('提交数据:', { selectedUserId, points, roomId });
    
    if (!selectedUserId) {
      wx.showToast({
        title: '请选择用户',
        icon: 'none'
      });
      return;
    }
    
    if (!points || isNaN(Number(points)) || Number(points) <= 0) {
      wx.showToast({
        title: '请输入有效的分数',
        icon: 'none'
      });
      return;
    }
    
    // 检查当前用户是否已登录
    if (!app.globalData.openid) {
      console.error('当前用户未登录', app.globalData);
      wx.showToast({
        title: '用户未登录，请重新登录',
        icon: 'none',
        duration: 2000
      });
      // 2秒后跳转到登录页
      setTimeout(() => {
        wx.navigateTo({
          url: '/pages/login/login'
        });
      }, 1000);
      return;
    }

    wx.showLoading({ title: '处理中...' });
    
    try {
      console.log('开始创建checkin记录');
      // 1. 创建接收用户的加分记录
      try {
        const result1 = await db.collection('checkins').add({
          data: {
            openid: selectedUserId,
            roomId: roomId,
            content: `[奖励加分]`,
            duration: 0,       // 奖励加分不计入时长
            score: Number(points),
            checkinTime: new Date(),
            createTime: new Date(),
            awardedBy: app.globalData.openid  // 记录谁给的加分
          }
        });
        console.log('接收用户加分记录创建成功', result1);
      } catch (err) {
        console.error('创建接收用户加分记录失败', err);
        throw err;
      }
      
      // 2. 创建当前用户的扣分记录
      try {
        const result2 = await db.collection('checkins').add({
          data: {
            openid: app.globalData.openid,
            roomId: roomId,
            content: `[扣分] 给他人加分扣除`,
            duration: 0,
            score: -Number(points), // 负分值表示扣分
            checkinTime: new Date(),
            createTime: new Date()
          }
        });
        console.log('当前用户扣分记录创建成功', result2);
      } catch (err) {
        console.error('创建当前用户扣分记录失败', err);
        throw err;
      }
      
      wx.hideLoading();
      wx.showToast({
        title: '加分成功',
        icon: 'success'
      });
      
      // 重置表单并刷新用户列表
      this.setData({
        selectedUserId: '',
        points: ''
      });
      console.log('刷新用户列表');
      this.loadRoomUsers(roomId);
      
      // 2秒后返回上一页并刷新数据
      setTimeout(() => {
        console.log('准备返回上一页');
        
        // 获取当前页面栈
        const pages = getCurrentPages();
        console.log('当前页面栈:', pages.length);
        
        // 返回上一页并传递需要刷新的消息
        wx.navigateBack({
          success: function() {
            console.log('返回上一页成功');
            // 向父页面发送事件通知，告知其需要刷新
            const prevPage = getCurrentPages()[getCurrentPages().length - 1];
            if (prevPage && prevPage.loadRoomData) {
              console.log('主动调用上一页的loadRoomData方法');
              prevPage.loadRoomData(roomId);
            } else {
              console.warn('无法获取上一页或上一页没有loadRoomData方法');
              
              // 如果无法直接调用方法，尝试设置一个标记
              if (prevPage) {
                prevPage.setData({
                  needRefresh: true,
                  refreshRoomId: roomId
                });
              }
            }
          },
          fail: function(err) {
            console.error('返回上一页失败', err);
            
            // 如果返回失败，尝试重定向到积分页
            wx.redirectTo({
              url: `/pages/Scoring/Scoring?id=${roomId}&refresh=true`,
              fail: (e) => console.error('重定向到积分页失败', e)
            });
          }
        });
      }, 2000);
      
    } catch (err) {
      wx.hideLoading();
      console.error('加分失败:', err);
      wx.showToast({
        title: '加分失败: ' + (err.message || err.errMsg || '未知错误'),
        icon: 'none',
        duration: 3000
      });
    }
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
  }
}) 
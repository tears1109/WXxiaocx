const db = wx.cloud.database()
const app = getApp();
const _ = db.command;

Page({
  data: {
    currentOpenid: '', // 当前用户openid
    userInfo: null,
    todayCheckins: [], // 今日打卡用户列表
    historyCheckins: [], // 历史打卡用户列表
    currentSwiper: 0, // 当前swiper索引
    roomInfo: null,    // 房间信息
    roomId: '', // 房间ID
    stats: {
      todayUsers: 0,   // 今日打卡人数
      totalScore: 0    // 今日总分
    },
    checkinContent: '', // 打卡内容
    duration: '',      // 打卡时长
    showCheckinModal: false, // 控制打卡弹窗显示
    checkinImage: '', // 存储选中的图片临时路径
    showContentModal: false, // 控制查看打卡内容弹窗
    selectedContent: '', // 存储待查看的打卡内容
    selectedDuration: '', // 存储待查看的打卡时长
    selectedImage: '', // 存储待查看的打卡图片
    itemToDelete: null, // 要删除的项目ID
    isDarkMode: false, // 主题模式：false为浅色，true为深色
    records: [],
    hasMore: true,
    pageSize: 20,
    currentPage: 0
  },

  onLoad(options) {
    if (!app.checkLogin()) {
      return;
    }
    // 设置当前用户openid和房间ID
    const currentOpenid = app.globalData.openid;
    if (options.roomId) {
      this.setData({ currentOpenid, roomId: options.roomId });
      this.loadRoomInfo(options.roomId);
    } else {
      this.setData({ currentOpenid });
    }
    this.getUserData(app.globalData.openid);
    this.loadTodayCheckins();
    this.loadHistoryCheckins();
    this.loadRecords();
    
    // 加载存储的主题设置
    this.loadThemeSettings();
  },

  onReady() {
    // 不再需要初始化粒子画布
  },

  onUnload() {
    // 不再需要清理动画相关资源
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

  // 选择图片
  chooseImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({
          checkinImage: res.tempFilePaths[0]
        });
      }
    });
  },

  // 删除图片
  deleteImage() {
    this.setData({
      checkinImage: ''
    });
  },

  // 提交打卡
  submitCheckin() {
    const { checkinContent, duration, checkinImage } = this.data;
    
    if (!checkinContent) {
      wx.showToast({
        title: '请输入打卡内容',
        icon: 'none'
      });
      return;
    }

    if (!duration) {
      wx.showToast({
        title: '请输入学习时长',
        icon: 'none'
      });
      return;
    }

    // 如果有图片，先上传图片
    if (checkinImage) {
      wx.showLoading({
        title: '上传图片中...',
      });
      
      wx.cloud.uploadFile({
        cloudPath: `checkin_images/${Date.now()}.jpg`,
        filePath: checkinImage,
        success: res => {
          // 上传成功后提交打卡数据
          this.submitCheckinData(res.fileID);
        },
        fail: err => {
          wx.hideLoading();
          wx.showToast({
            title: '图片上传失败',
            icon: 'none'
          });
          console.error('图片上传失败：', err);
        }
      });
    } else {
      // 没有图片直接提交打卡数据
      this.submitCheckinData();
    }
  },

  // 提交打卡数据
  submitCheckinData(imageFileID = '') {
    const { checkinContent, duration } = this.data;
    
    wx.cloud.callFunction({
      name: 'checkin',
      data: {
        openid: app.globalData.openid,
        userName: this.data.userInfo.nickName,
        avatarUrl: this.data.userInfo.avatarUrl,
        roomId: this.data.roomId,
        content: checkinContent,
        duration: duration,
        image: imageFileID
      },
      success: res => {
        const score = res.result && res.result.score;
        wx.hideLoading();
        wx.showToast({
          title: '打卡成功',
          icon: 'success'
        });
        this.setData({
          showCheckinModal: false,
          checkinContent: '',
          duration: '',
          checkinImage: ''
        });
        // 更新房间用户分数
        const updateScorePromise = score ? this.updateRoomUserScore(score) : Promise.resolve();
        // 刷新打卡列表
        this.loadTodayCheckins();
        // 完成分数更新后，返回首页并刷新排行榜
        updateScorePromise.then(() => {
          wx.navigateBack({
            success: () => {
              const pages = getCurrentPages();
              const prevPage = pages[pages.length - 1];
              if (prevPage && prevPage.loadRoomData) {
                prevPage.loadRoomData(prevPage.data.roomId);
              }
            }
          });
        });
      },
      fail: err => {
        wx.hideLoading();
        wx.showToast({
          title: '打卡失败',
          icon: 'none'
        });
        console.error('打卡失败：', err);
      }
    });
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
  },

  // 新增：显示打卡内容弹窗
  showContentModal(e) {
    const { content = '', duration = '', image = '' } = e.currentTarget.dataset;
    this.setData({
      showContentModal: true,
      selectedContent: content,
      selectedDuration: duration,
      selectedImage: image
    });
  },

  // 新增：隐藏打卡内容弹窗
  hideContentModal() {
    this.setData({
      showContentModal: false,
      selectedContent: '',
      selectedDuration: '',
      selectedImage: ''
    });
  },

  // 新增：预览图片方法
  previewImageByUrl(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.previewImage({
      current: url,
      urls: [url]
    });
  },

  // 修改删除打卡记录函数
  deleteCheckin(e) {
    const checkinId = e.currentTarget.dataset.id;
    const itemId = e.currentTarget.id || `checkin-${checkinId}`;
    
    wx.showModal({
      title: '删除打卡',
      content: '确定要删除此条打卡记录吗？',
      success: (res) => {
        if (res.confirm) {
          // 设置要删除的项目
          this.setData({
            itemToDelete: itemId
          });
          
          // 添加删除动画CSS类
          const query = wx.createSelectorQuery();
          query.select(`#${itemId}`).boundingClientRect();
          query.exec((rects) => {
            if (rects && rects[0]) {
              // 找到对应元素
              wx.showLoading({ title: '删除中...' });
              
              // 延迟调用云函数，给动画留出时间
              setTimeout(() => {
                wx.cloud.callFunction({
                  name: 'deleteCheckin',
                  data: { checkinId, roomId: this.data.roomId },
                  success: (resp) => {
                    wx.hideLoading();
                    wx.showToast({ title: '删除成功', icon: 'success' });
                    
                    // 重新加载打卡列表
                    this.loadTodayCheckins();
                    this.loadHistoryCheckins();
                    
                    // 刷新首页的排行榜数据
                    const pages = getCurrentPages();
                    for (let i = 0; i < pages.length; i++) {
                      if (pages[i].route === 'pages/index/index') {
                        const indexPage = pages[i];
                        if (indexPage && indexPage.loadRoomData) {
                          indexPage.loadRoomData(this.data.roomId);
                        }
                        break;
                      }
                    }
                  },
                  fail: (err) => {
                    wx.hideLoading();
                    wx.showToast({ title: '删除失败', icon: 'none' });
                    console.error('删除打卡失败：', err);
                  }
                });
              }, 300); // 给动画留出时间
            } else {
              // 未找到元素，直接调用云函数
              wx.showLoading({ title: '删除中...' });
              wx.cloud.callFunction({
                name: 'deleteCheckin',
                data: { checkinId, roomId: this.data.roomId },
                success: (resp) => {
                  wx.hideLoading();
                  wx.showToast({ title: '删除成功', icon: 'success' });
                  this.loadTodayCheckins();
                  this.loadHistoryCheckins();
                  
                  const pages = getCurrentPages();
                  for (let i = 0; i < pages.length; i++) {
                    if (pages[i].route === 'pages/index/index') {
                      const indexPage = pages[i];
                      if (indexPage && indexPage.loadRoomData) {
                        indexPage.loadRoomData(this.data.roomId);
                      }
                      break;
                    }
                  }
                },
                fail: (err) => {
                  wx.hideLoading();
                  wx.showToast({ title: '删除失败', icon: 'none' });
                  console.error('删除打卡失败：', err);
                }
              });
            }
          });
        }
      }
    });
  },

  // 加载历史打卡数据
  async loadHistoryCheckins() {
    if (!this.data.roomId) return;

    try {
      const res = await wx.cloud.callFunction({
        name: 'getHistoryCheckins',
        data: {
          openid: app.globalData.openid,
          roomId: this.data.roomId
        }
      });

      if (res.result && res.result.data) {
        this.setData({
          historyCheckins: res.result.data
        });
      }
    } catch (err) {
      console.error('获取历史打卡数据失败：', err);
      wx.showToast({
        title: '获取历史数据失败',
        icon: 'none'
      });
    }
  },

  // 处理swiper切换
  swiperChange(e) {
    this.setData({
      currentSwiper: e.detail.current
    });
    
    // 如果切换到历史打卡，确保数据已加载
    if (e.detail.current === 1 && this.data.historyCheckins.length === 0) {
      this.loadHistoryCheckins();
    }
  },

  // 点击标题切换tab
  switchTab(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      currentSwiper: index
    });
    
    // 如果切换到历史打卡，确保数据已加载
    if (index === 1 && this.data.historyCheckins.length === 0) {
      this.loadHistoryCheckins();
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

  // 加载加分记录
  async loadRecords() {
    if (!this.data.hasMore) return;
    
    try {
      const skip = this.data.currentPage * this.data.pageSize;
      const recordsRes = await db.collection('checkins')
        .where({
          roomId: this.data.roomId,
          type: 'score' // 只获取加分记录
        })
        .orderBy('createTime', 'desc')
        .skip(skip)
        .limit(this.data.pageSize)
        .get();

      if (recordsRes.data.length > 0) {
        // 获取用户信息
        const openids = [...new Set(recordsRes.data.map(r => [r.openid, r.targetOpenid]).flat())];
        const userRes = await db.collection('users').where({
          _openid: _.in(openids)
        }).get();
        
        const userMap = {};
        userRes.data.forEach(user => {
          userMap[user._openid] = user;
        });

        // 处理记录数据
        const records = recordsRes.data.map(record => ({
          ...record,
          targetUser: {
            name: userMap[record.targetOpenid]?.userInfo?.nickName || '未知用户',
            avatarUrl: userMap[record.targetOpenid]?.userInfo?.avatarUrl
          },
          operator: {
            name: userMap[record.openid]?.userInfo?.nickName || '未知用户',
            avatarUrl: userMap[record.openid]?.userInfo?.avatarUrl
          },
          createTime: this.formatTime(record.createTime)
        }));

        this.setData({
          records: [...this.data.records, ...records],
          currentPage: this.data.currentPage + 1,
          hasMore: records.length === this.data.pageSize
        });
      } else {
        this.setData({ hasMore: false });
      }
    } catch (err) {
      console.error('获取加分记录失败:', err);
      wx.showToast({
        title: '获取记录失败',
        icon: 'none'
      });
    }
  },

  // 加载更多
  onReachBottom() {
    this.loadRecords();
  },

  // 格式化时间
  formatTime(date) {
    date = new Date(date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes();
    
    return `${year}-${this.padZero(month)}-${this.padZero(day)} ${this.padZero(hour)}:${this.padZero(minute)}`;
  },

  padZero(num) {
    return num < 10 ? '0' + num : num;
  }
});
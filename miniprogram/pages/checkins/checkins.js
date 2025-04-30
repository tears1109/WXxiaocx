const db = wx.cloud.database()
const app = getApp();

Page({
  data: {
    currentOpenid: '', // 当前用户openid
    userInfo: null,
    todayCheckins: [], // 今日打卡用户列表
    historyCheckins: [], // 历史打卡用户列表
    activeTab: 0, // 当前激活的标签页：0-今日打卡，1-历史打卡
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
    isSubmitting: false, // 防抖标志
    todayPage: 1, // 今日打卡页码
    historyPage: 1, // 历史打卡页码
    todayHasMore: true, // 今日打卡是否还有更多
    historyHasMore: true, // 历史打卡是否还有更多
    isLoadingMore: false // 是否正在加载更多
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
    if (this.data.isSubmitting) return;
    this.setData({ isSubmitting: true });
    const { checkinContent, duration, checkinImage } = this.data;
    
    if (!checkinContent) {
      wx.showToast({
        title: '请输入打卡内容',
        icon: 'none'
      });
      this.setData({ isSubmitting: false });
      return;
    }

    if (!duration) {
      wx.showToast({
        title: '请输入学习时长',
        icon: 'none'
      });
      this.setData({ isSubmitting: false });
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
          this.setData({ isSubmitting: false });
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
        // 刷新打卡列表
        this.loadTodayCheckins();
        // 返回首页并刷新排行榜
        wx.navigateBack({
          success: () => {
            const pages = getCurrentPages();
            const prevPage = pages[pages.length - 1];
            if (prevPage && prevPage.loadRoomData) {
              prevPage.loadRoomData(prevPage.data.roomId);
            }
          }
        });
      },
      fail: err => {
        wx.hideLoading();
        wx.showToast({
          title: '打卡失败',
          icon: 'none'
        });
        console.error('打卡失败：', err);
      },
      complete: () => {
        this.setData({ isSubmitting: false });
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
  async loadTodayCheckins(isLoadMore = false) {
    if (!this.data.roomId) return;
    if (isLoadMore && !this.data.todayHasMore) return;
    if (this.data.isLoadingMore) return;

    this.setData({ isLoadingMore: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'getTodayCheckins',
        data: {
          openid: app.globalData.openid,
          roomId: this.data.roomId,
          page: isLoadMore ? this.data.todayPage + 1 : 1,
          pageSize: 20
        }
      });

      if (res.result.success) {
        const newCheckins = res.result.checkins;
        // 按分数降序排序
        const sortedCheckins = newCheckins.sort((a, b) => b.score - a.score);
        
        // 计算统计数据
        const stats = {
          todayUsers: res.result.total,
          totalScore: sortedCheckins.reduce((sum, user) => sum + user.score, 0)
        };

        this.setData({
          todayCheckins: isLoadMore ? [...this.data.todayCheckins, ...sortedCheckins] : sortedCheckins,
          stats,
          todayPage: isLoadMore ? this.data.todayPage + 1 : 1,
          todayHasMore: res.result.hasMore
        });
      }
    } catch (err) {
      console.error('获取今日打卡数据失败：', err);
      wx.showToast({
        title: '获取数据失败',
        icon: 'none'
      });
    } finally {
      this.setData({ isLoadingMore: false });
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
  async loadHistoryCheckins(isLoadMore = false) {
    if (!this.data.roomId) return;
    if (isLoadMore && !this.data.historyHasMore) return;
    if (this.data.isLoadingMore) return;

    this.setData({ isLoadingMore: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'getHistoryCheckins',
        data: {
          openid: app.globalData.openid,
          roomId: this.data.roomId,
          page: isLoadMore ? this.data.historyPage + 1 : 1,
          pageSize: 20
        }
      });

      if (res.result && res.result.success) {
        this.setData({
          historyCheckins: isLoadMore ? [...this.data.historyCheckins, ...res.result.data] : res.result.data,
          historyPage: isLoadMore ? this.data.historyPage + 1 : 1,
          historyHasMore: res.result.hasMore
        });
      }
    } catch (err) {
      console.error('获取历史打卡数据失败：', err);
      wx.showToast({
        title: '获取历史数据失败',
        icon: 'none'
      });
    } finally {
      this.setData({ isLoadingMore: false });
    }
  },

  // 处理标签切换
  onTabChange(e) {
    const index = e.detail.index || e.detail.current;
    if (typeof index === 'undefined') return;
    
    this.setData({
      activeTab: index
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

  // 处理滚动到底部事件
  onReachBottom() {
    if (this.data.isLoadingMore) return;
    
    if (this.data.activeTab === 0) {
      // 今日打卡
      if (this.data.todayHasMore) {
        this.loadTodayCheckins(true);
      }
    } else {
      // 历史打卡
      if (this.data.historyHasMore) {
        this.loadHistoryCheckins(true);
      }
    }
  },
});
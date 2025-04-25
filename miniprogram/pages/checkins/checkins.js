const db = wx.cloud.database()
const app = getApp();

Page({
  data: {
    currentOpenid: '', // 当前用户openid
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
    showCheckinModal: false, // 控制打卡弹窗显示
    checkinImage: '', // 存储选中的图片临时路径
    showContentModal: false, // 控制查看打卡内容弹窗
    selectedContent: '', // 存储待查看的打卡内容
    selectedDuration: '', // 存储待查看的打卡时长
    selectedImage: '' // 存储待查看的打卡图片
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

  // 删除打卡记录
  deleteCheckin(e) {
    const checkinId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除打卡',
      content: '确定要删除此条打卡记录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          wx.cloud.callFunction({
            name: 'deleteCheckin',
            data: { checkinId, roomId: this.data.roomId },
            success: (resp) => {
              wx.hideLoading();
              wx.showToast({ title: '删除成功', icon: 'success' });
              // 重新加载打卡列表
              this.loadTodayCheckins();
            },
            fail: (err) => {
              wx.hideLoading();
              wx.showToast({ title: '删除失败', icon: 'none' });
              console.error('删除打卡失败：', err);
            }
          });
        }
      }
    });
  }
});
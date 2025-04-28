const db = wx.cloud.database();
const app = getApp();
Page({
  data: {
    openid: '',
    avatarUrl: '',
    nickName: '',
    phoneNumber: '',
    genderIndex: 0,
    genderOptions: ['未知', '男', '女'],
    gender: '未知',
    canIUseGetUserProfile: false,
    hasUserInfo: false,
    defaultAvatar: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
    isDarkMode: false
  },

  onLoad() {
    this.loadUserData();
    this.loadThemeSettings();
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
        backgroundColor: '#ffffff'
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
        backgroundColor: '#ffffff'
      });
    }
    
    // 通知app更新全局主题
    if (app.globalData) {
      app.globalData.isDarkMode = newDarkMode;
    }
  },

  // 加载用户数据
  loadUserData() {
    const openid = app.globalData.openid;
    this.setData({ openid });
    this.setData({ canIUseGetUserProfile: wx.canIUse('getUserProfile') });
    const loginUserInfo = app.globalData.userInfo || {};
    if (loginUserInfo.nickName) {
      this.setData({ nickName: loginUserInfo.nickName });
    }
    if (loginUserInfo.avatarUrl) {
      this.setData({ avatarUrl: loginUserInfo.avatarUrl });
    }
    wx.showLoading({ title: '加载中...' });
    db.collection('users').where({ _openid: openid }).get()
      .then(res => {
        if (res.data.length > 0) {
          const info = res.data[0].userInfo || {};
          const avatarUrl = info.avatarUrl || this.data.avatarUrl;
          const nickName = info.nickName || this.data.nickName;
          const phoneNumber = info.phoneNumber || '';
          let genderIndex = 0;
          if (typeof info.gender === 'number') {
            genderIndex = info.gender;
          } else if (typeof info.gender === 'string') {
            const idx = this.data.genderOptions.indexOf(info.gender);
            genderIndex = idx >= 0 ? idx : 0;
          }
          const gender = this.data.genderOptions[genderIndex];
          this.setData({ 
            avatarUrl, 
            nickName, 
            phoneNumber, 
            genderIndex, 
            gender,
            hasUserInfo: !!avatarUrl
          });
        }
      })
      .catch(err => {
        console.error('加载用户信息失败', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      })
      .finally(() => {
        wx.hideLoading();
      });
  },

  onNicknameInput(e) {
    this.setData({ nickName: e.detail.value });
  },

  onPhoneInput(e) {
    this.setData({ phoneNumber: e.detail.value });
  },

  onGenderChange(e) {
    const idx = e.detail.value;
    this.setData({ genderIndex: idx, gender: this.data.genderOptions[idx] });
  },

  fetchWxUserInfo() {
    wx.getUserProfile({
      desc: '用于完善会员资料',
      success: res => {
        const { nickName, avatarUrl } = res.userInfo;
        this.setData({ nickName, avatarUrl, hasUserInfo: true });
      },
      fail: err => {
        wx.showToast({ title: '获取失败', icon: 'none' });
      }
    });
  },

  onGetPhoneNumber(e) {
    if (e.detail.errMsg !== 'getPhoneNumber:ok') return;
    const { encryptedData, iv } = e.detail;
    wx.showLoading({ title: '获取中...' });
    wx.cloud.callFunction({
      name: 'decryptPhone',
      data: { encryptedData, iv }
    })
    .then(res => {
      wx.hideLoading();
      if (res.result && res.result.success) {
        this.setData({ phoneNumber: res.result.phoneNumber });
      } else {
        wx.showToast({ title: '获取失败', icon: 'none' });
      }
    })
    .catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '获取失败', icon: 'none' });
    });
  },

  // 处理微信头像组件选择事件
  onChooseAvatar(e) {
    console.log('选择头像事件触发', e);
    
    // 检查事件对象和detail是否存在
    if (!e || !e.detail) {
      console.log('选择头像事件对象异常', e);
      return;
    }
    
    // 更宽容地检查错误消息
    if (!e.detail.avatarUrl) {
      console.log('未获取到头像URL，可能是用户取消了选择');
      return;
    }
    
    const tempFilePath = e.detail.avatarUrl;
    console.log('获取到临时头像路径', tempFilePath);
    
    // 先临时显示所选头像，解决UI不更新问题
    this.setData({
      avatarUrl: tempFilePath,
      hasUserInfo: true
    }, () => {
      console.log('临时头像已设置', this.data.avatarUrl);
    });
    
    // 上传头像到云存储
    wx.showLoading({ title: '上传中...' });
    const randomStr = Math.random().toString(36).slice(2, 11);
    const cloudPath = `user-avatar/${this.data.openid}/${Date.now()}-${randomStr}.png`;
    
    // 确保openid存在
    if (!this.data.openid) {
      console.error('用户openid不存在，无法上传头像');
      wx.hideLoading();
      wx.showToast({ title: '用户未登录', icon: 'none' });
      return;
    }
    
    wx.cloud.uploadFile({
      cloudPath,
      filePath: tempFilePath,
      success: uploadRes => {
        console.log('头像上传成功', uploadRes);
        this.setData({ 
          avatarUrl: uploadRes.fileID,
          hasUserInfo: true 
        }, () => {
          console.log('云存储头像已设置', this.data.avatarUrl);
          wx.showToast({ title: '头像已更新', icon: 'success' });
        });
      },
      fail: (err) => {
        console.error('头像上传失败', err);
        wx.showToast({ title: '上传失败', icon: 'none' });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  onSave() {
    const { openid, avatarUrl, nickName, phoneNumber, gender } = this.data;
    const userInfo = { avatarUrl, nickName, phoneNumber, gender };
    wx.showLoading({ title: '保存中...' });
    wx.cloud.callFunction({
      name: 'updateUserInfo',
      data: {
        openid,
        userInfo,
        loginOnly: false,
        lastLoginTime: new Date()
      }
    })
    .then(resp => {
      wx.hideLoading();
      if (resp.result && resp.result.success) {
        wx.showToast({ title: '保存成功', icon: 'success' });
        app.globalData.userInfo = { ...app.globalData.userInfo, ...userInfo };
        setTimeout(() => wx.navigateBack(), 800);
      } else {
        wx.showToast({ title: resp.result.error || '保存失败', icon: 'none' });
      }
    })
    .catch(err => {
      wx.hideLoading();
      console.error('保存失败', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    });
  },

  // 新增：处理微信获取昵称和头像事件
  onGetUserProfile(e) {
    if (e.detail.errMsg !== 'getUserProfile:ok') return;
    const { nickName, avatarUrl } = e.detail.userInfo;
    this.setData({ nickName, avatarUrl, hasUserInfo: true });
  },
}); 
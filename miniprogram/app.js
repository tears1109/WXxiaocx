// app.js
App({
  globalData: {
    userInfo: null,
    openid: '',
    isLoggedIn: false,
    isDarkMode: false,
    cloudInitialized: false
  },

  onLaunch: async function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'loong-9g5c3upyfdd12980',
        traceUser: true,
      })
      // 标记云开发已初始化
      this.globalData.cloudInitialized = true;
    }

    // 加载全局主题设置
    this.loadThemeSettings();

    // 检查登录状态
    this.checkLoginStatus();
  },

  // 加载主题设置
  loadThemeSettings() {
    const themeSettings = wx.getStorageSync('themeSettings') || { isDarkMode: false };
    this.globalData.isDarkMode = themeSettings.isDarkMode;
    
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
    const newDarkMode = !this.globalData.isDarkMode;
    this.globalData.isDarkMode = newDarkMode;
    
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
    
    // 发送主题变更事件通知各页面
    wx.getSystemInfo({
      success: () => {
        wx.nextTick(() => {
          const pages = getCurrentPages();
          if (pages.length) {
            const currentPage = pages[pages.length - 1];
            if (currentPage && currentPage.setData) {
              currentPage.setData({
                isDarkMode: newDarkMode
              });
            }
          }
        });
      }
    });
  },

  // 检查登录状态 - 应用启动时调用
  checkLoginStatus() {
    console.log('检查登录状态');
    const storedOpenid = wx.getStorageSync('openid');
    const storedUserInfo = wx.getStorageSync('userInfo');
    
    // 如果没有本地存储的登录信息，直接判定为未登录
    if (!storedOpenid || !storedUserInfo) {
      console.log('本地无登录信息，未登录状态');
      this.clearLoginState();
      return;
    }
    
    // 临时使用本地存储先恢复状态
    this.globalData.openid = storedOpenid;
    this.globalData.userInfo = storedUserInfo;
    this.globalData.isLoggedIn = true;
    
    // 然后验证云端登录状态
    wx.cloud.callFunction({
      name: 'checkLogin',
      success: (res) => {
        console.log('云函数checkLogin返回:', res);
        
        // 检查云端登录状态是否有效
        const cloudLoginValid = 
          (res.result && res.result.success === true) || 
          (res.userInfo && res.userInfo.openId) || 
          (res.result && res.result.openid) || 
          (res.result && res.result.userInfo && res.result.userInfo.openId);
        
        if (!cloudLoginValid) {
          console.log('云端验证失败，清除登录状态');
          this.clearLoginState();
          // 不需要立即跳转登录页，让各页面的checkLogin处理
        }
      },
      fail: (err) => {
        console.error('检查登录状态失败', err);
        // 云函数调用失败时，仍然信任本地存储
      }
    });
  },
  
  // 清除登录状态的通用方法
  clearLoginState() {
    // 清除全局数据
    this.globalData.openid = '';
    this.globalData.isLoggedIn = false;
    this.globalData.userInfo = null;
    
    // 清除本地存储
    wx.removeStorageSync('openid');
    wx.removeStorageSync('userInfo');
  },

  // 页面调用，检查是否已登录，未登录则跳转登录页
  checkLogin() {
    console.log('检查当前页面登录状态');
    
    // 如果全局已登录，直接返回true
    if (this.globalData.isLoggedIn) {
      return true;
    }
    
    // 尝试从本地存储恢复
    const storedOpenid = wx.getStorageSync('openid');
    const storedUserInfo = wx.getStorageSync('userInfo');
    
    if (storedOpenid && storedUserInfo) {
      // 恢复登录状态
      this.globalData.openid = storedOpenid;
      this.globalData.userInfo = storedUserInfo;
      this.globalData.isLoggedIn = true;
      
      // 在后台验证云端状态，不阻塞UI
      this.validateCloudLogin();
      return true;
    }
    
    // 未登录，跳转到登录页
    console.log('未登录，跳转到登录页面');
    wx.reLaunch({
      url: '/pages/login/login'
    });
    return false;
  },
  
  // 后台验证云端登录状态
  validateCloudLogin() {
    wx.cloud.callFunction({
      name: 'checkLogin',
      success: (res) => {
        const valid = res.result && res.result.success === true;
        if (!valid) {
          console.log('云端登录无效，清除登录状态并跳转登录页');
          this.clearLoginState();
          wx.reLaunch({
            url: '/pages/login/login'
          });
        }
      },
      fail: (err) => {
        console.error('云端验证失败', err);
        // 出错时不处理，保持当前状态
      }
    });
  },

  logout() {
    // 显示加载中
    wx.showLoading({
      title: '退出中...',
      mask: true
    });
    
    // 调用云函数清除云端登录状态
    wx.cloud.callFunction({
      name: 'logout',
      data: {},
      success: () => {
        console.log('云端登录状态已清除');
      },
      fail: (err) => {
        console.error('清除云端登录状态失败', err);
      },
      complete: () => {
        // 清除本地状态
        this.clearLoginState();
        
        // 隐藏加载提示
        wx.hideLoading();
        
        // 重启应用并跳转到登录页
        wx.reLaunch({
          url: '/pages/login/login'
        });
      }
    });
  },

  // 云函数登录方法
  loginWithWeixin() {
    return new Promise((resolve, reject) => {
      // 检查云开发是否初始化
      if (!this.globalData.cloudInitialized) {
        console.error('云开发未初始化，尝试重新初始化...');
        
        // 尝试重新初始化云环境
        if (wx.cloud) {
          wx.cloud.init({
            env: 'loong-9g5c3upyfdd12980',
            traceUser: true,
          });
          this.globalData.cloudInitialized = true;
          console.log('云环境重新初始化成功');
        } else {
          reject('云开发未初始化，且无法自动初始化');
          return;
        }
      }

      // 调用云函数获取openid (使用匿名登录)
      wx.cloud.callFunction({
        name: 'login',
        data: {},
        success: (cloudRes) => {
          if (!cloudRes.result || !cloudRes.result.openid) {
            reject('获取openid失败: 返回数据格式错误');
            return;
          }
          
          const { openid } = cloudRes.result;
          
          // 生成默认用户信息
          const defaultUserInfo = {
            nickName: '微信用户_' + openid.substring(0, 6),
            avatarUrl: 'https://6c6f-loong-9g5c3upyfdd12980-1323550512.tcb.qcloud.la/default-avatar.jpg?sign=0949834e659d7b0e6fa29adb5752d4cb&t=1745672829',
            gender: 0,
            country: '',
            province: '',
            city: ''
          };
          
          // 保存到全局和缓存
          this.globalData.userInfo = defaultUserInfo;
          this.globalData.openid = openid;
          this.globalData.isLoggedIn = true;
          wx.setStorageSync('userInfo', defaultUserInfo);
          wx.setStorageSync('openid', openid);
          
          // 将用户信息存入云数据库
          this.saveUserToCloud(defaultUserInfo, openid)
            .then((result) => {
              // 检查是否为首次登录并获取随机生成的名称
              if (result && result.result && result.result.isNewUser && result.result.userInfo) {
                const serverUserInfo = result.result.userInfo;
                // 更新本地存储的用户信息，使用服务器生成的随机名字
                this.globalData.userInfo = {
                  ...defaultUserInfo,
                  nickName: serverUserInfo.nickName // 使用服务器生成的随机名字
                };
                wx.setStorageSync('userInfo', this.globalData.userInfo);
              }
              resolve({ userInfo: this.globalData.userInfo, openid });
            })
            .catch(err => {
              console.error('保存用户信息到云数据库失败:', err);
              // 即使保存失败，仍然认为登录成功
              resolve({ userInfo: this.globalData.userInfo, openid });
            });
        },
        fail: (err) => {
          console.error('调用login云函数失败:', err);
          reject('获取openid失败: ' + (err.errMsg || err));
        }
      });
    });
  },

  // 新增：保存用户信息到云数据库
  saveUserToCloud(userInfo, openid) {
    return wx.cloud.callFunction({
      name: 'updateUserInfo',
      data: {
        openid: openid,
        loginOnly: true,  // 新增标志，表示只更新登录时间
        lastLoginTime: new Date()
      }
    });
  }
});
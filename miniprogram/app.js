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

  // 检查登录状态
  checkLoginStatus() {
    // 首先尝试从本地存储恢复登录状态
    const storedOpenid = wx.getStorageSync('openid');
    const storedUserInfo = wx.getStorageSync('userInfo');
    
    if (storedOpenid && storedUserInfo) {
      console.log('从本地存储恢复登录状态');
      this.globalData.openid = storedOpenid;
      this.globalData.userInfo = storedUserInfo;
      this.globalData.isLoggedIn = true;
      return;
    }
    
    // 如果本地存储没有登录信息，则调用云函数验证
    wx.cloud.callFunction({
      name: 'checkLogin',
      success: (res) => {
        console.log('云函数checkLogin返回:', res);
        
        // 处理新格式：res.userInfo.openId
        if (res.userInfo && res.userInfo.openId) {
          this.globalData.openid = res.userInfo.openId;
          this.globalData.isLoggedIn = true;
          // 保存到本地存储，防止下次需要重新登录
          wx.setStorageSync('openid', res.userInfo.openId);
          return;
        }
        
        // 处理旧格式：res.result.openid
        if (res.result && res.result.openid) {
          this.globalData.openid = res.result.openid;
          this.globalData.isLoggedIn = true;
          // 保存到本地存储，防止下次需要重新登录
          wx.setStorageSync('openid', res.result.openid);
          return;
        }
        
        // 处理其他情况，例如收到整个对象作为返回
        if (res.result && res.result.userInfo && res.result.userInfo.openId) {
          this.globalData.openid = res.result.userInfo.openId;
          this.globalData.isLoggedIn = true;
          // 保存到本地存储，防止下次需要重新登录
          wx.setStorageSync('openid', res.result.userInfo.openId);
          return;
        }
        
        // 如果没有找到openid，则设置为未登录状态
        console.log('未找到有效的openid');
        this.globalData.isLoggedIn = false;
      },
      fail: (err) => {
        console.error('检查登录状态失败', err);
        this.globalData.isLoggedIn = false;
      }
    });
  },

  checkLogin() {
    // 先检查本地存储，看是否有登录信息
    if (!this.globalData.isLoggedIn) {
      const storedOpenid = wx.getStorageSync('openid');
      const storedUserInfo = wx.getStorageSync('userInfo');
      
      if (storedOpenid && storedUserInfo) {
        // 如果本地存储有登录信息，恢复登录状态
        console.log('使用本地存储的登录信息');
        this.globalData.openid = storedOpenid;
        this.globalData.userInfo = storedUserInfo;
        this.globalData.isLoggedIn = true;
        return true;
      }
      
      // 如果确实未登录，跳转到登录页
      console.log('未登录，跳转到登录页面');
      wx.redirectTo({
        url: '/pages/login/login'
      });
      return false;
    }
    return true;
  },

  logout() {
    // Clear global data
    this.globalData.openid = '';
    this.globalData.isLoggedIn = false;
    this.globalData.userInfo = null;

    // Clear local storage data
    wx.removeStorageSync('openid');
    wx.removeStorageSync('userInfo');
    
    // Redirect to login page
    wx.redirectTo({
      url: '/pages/login/login'
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

      // 1. 获取用户信息
      wx.getUserProfile({
        desc: '用于完善会员资料',
        success: (res) => {
          const userInfo = res.userInfo;
          
          // 2. 调用云函数获取openid
          wx.cloud.callFunction({
            name: 'login',
            data: {},
            success: (cloudRes) => {
              if (!cloudRes.result || !cloudRes.result.openid) {
                reject('获取openid失败: 返回数据格式错误');
                return;
              }
              
              const { openid } = cloudRes.result;
              
              // 3. 保存到全局和缓存
              this.globalData.userInfo = userInfo;
              this.globalData.openid = openid;
              this.globalData.isLoggedIn = true;
              wx.setStorageSync('userInfo', userInfo);
              wx.setStorageSync('openid', openid);
              
              // 4. 将用户信息存入云数据库
              this.saveUserToCloud(userInfo, openid)
                .then((result) => {
                  // 检查是否为首次登录并获取随机生成的名称
                  if (result && result.result && result.result.isNewUser && result.result.userInfo) {
                    const serverUserInfo = result.result.userInfo;
                    // 更新本地存储的用户信息，使用服务器生成的随机名字
                    this.globalData.userInfo = {
                      ...userInfo,
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
        },
        fail: (err) => {
          console.error('获取用户信息失败:', err);
          reject('获取用户信息失败: ' + (err.errMsg || err));
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
// 获取应用实例
const app = getApp()

Page({
  data: {
    canIUseGetUserProfile: wx.canIUse('getUserProfile'),
    loading: false,
    rainDrops: [],
    canvasWidth: 0,
    canvasHeight: 0,
    animationTimer: null,
    isAnimating: false,
    // 代码雨速度控制
    rainSpeedFactor: 0.8, // 调整此值可以控制代码雨速度: <1慢速, 1正常, >1快速
    // 控制代码雨显示
    showCodeRain: false,
    symbols: '',
    fontSize: 18,
    showRipple: false,
    rippleStyle: '',
    particles: [],
    animationComplete: false,
    loginBoxAnimation: null,
    isDarkMode: false // 主题模式：false为浅色，true为深色
  },

  onLoad() {
    // 检查用户是否已登录
    if (app.checkLoginStatus()) {
      wx.redirectTo({
        url: '/pages/room/room'
      });
      return;
    }
    
    // 初始化屏幕尺寸
    const systemInfo = wx.getSystemInfoSync();
    this.setData({
      canvasWidth: systemInfo.windowWidth,
      canvasHeight: systemInfo.windowHeight
    });
    
    // 初始化动画
    setTimeout(() => {
      this.setData({
        loginBoxAnimation: wx.createAnimation({
          duration: 1000,
          timingFunction: 'ease',
        }).opacity(1).translateY(0).step().export()
      });
    }, 500);
    
    // 加载主题设置
    this.loadThemeSettings();
  },

  onReady() {
    // 初始化花瓣动画的画布
    this.initPetalCanvas();
  },

  onUnload() {
    // 取消动画循环
    this.stopAnimation();
  },
  
  onHide() {
    // 页面隐藏时停止动画
    this.stopAnimation();
  },

  // 停止动画
  stopAnimation() {
    if (this.data.animationTimer) {
      clearTimeout(this.data.animationTimer);
      this.setData({
        animationTimer: null,
        isAnimating: false
      });
    }
  },

  // 初始化花瓣画布动画
  initPetalCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#petalsCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0] || !res[0].node) {
          console.error('获取画布节点失败');
          return;
        }

        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio;
        
        // 设置画布尺寸
        canvas.width = this.data.canvasWidth * dpr;
        canvas.height = this.data.canvasHeight * dpr;
        ctx.scale(dpr, dpr);
        
        // 创建代码雨对象
        this.createCodeRain(ctx, canvas);
      });
  },

  // 创建代码雨动画
  createCodeRain(ctx, canvas) {
    // 代码雨使用的中文字符
    const symbols = '桃李春风一杯酒江湖夜雨十年灯';
    
    // 字符的颜色
    const colors = ['pink', 'lightblue', 'lightgreen'];
    
    // 创建雨滴
    const rainDrops = [];
    const columnCount = Math.floor(this.data.canvasWidth / 18); // 根据18px字体大小计算列数
    
    for (let i = 0; i < columnCount; i++) {
      rainDrops.push({
        x: i * 18,
        y: Math.random() * this.data.canvasHeight * 2 - this.data.canvasHeight,
        speed: Math.random() * 2 + 3,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    
    // 动画循环
    let lastTime = Date.now();
    const animate = () => {
      const now = Date.now();
      const dt = now - lastTime;
      lastTime = now;
      
      // 用半透明黑色清除画布以产生轨迹效果
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, this.data.canvasWidth, this.data.canvasHeight);
      
      // 更新并绘制每个雨滴
      rainDrops.forEach(drop => {
        // 更新位置
        drop.y += drop.speed * (dt / 16);
        
        // 如果超出屏幕则重置
        if (drop.y > this.data.canvasHeight) {
          drop.y = -20;
        }
        
        // 绘制字符
        const char = symbols[Math.floor(Math.random() * symbols.length)];
        ctx.fillStyle = drop.color;
        ctx.font = '18px monospace';
        ctx.fillText(char, drop.x, drop.y);
      });
      
      // 继续动画循环
      this.animationTimer = requestAnimationFrame(animate);
    };
    
    // 开始动画
    animate();
  },

  // 处理按钮涟漪效果
  createRipple(e) {
    // 获取点击的触摸坐标
    const touch = e.touches[0];
    const pageX = touch.pageX;
    const pageY = touch.pageY;
    
    // 使用微信小程序的选择器查询来获取按钮位置
    const query = wx.createSelectorQuery();
    query.select(`#${e.currentTarget.id}`).boundingClientRect();
    query.exec((rects) => {
      if (rects && rects[0]) {
        const btnRect = rects[0];
        // 计算相对于按钮的触摸位置
        const x = pageX - btnRect.left;
        const y = pageY - btnRect.top;
        
        // 显示涟漪效果
        this.setData({
          rippleStyle: `left: ${x}px; top: ${y}px;`,
          showRipple: true
        });
        
        // 动画完成后移除涟漪效果
        setTimeout(() => {
          this.setData({ showRipple: false });
        }, 800);
      } else {
        // 如果无法获取按钮位置，则使用触摸点坐标作为默认值
        this.setData({
          rippleStyle: `left: ${pageX}px; top: ${pageY}px;`,
          showRipple: true
        });
        
        setTimeout(() => {
          this.setData({ showRipple: false });
        }, 800);
      }
    });
  },

  // 处理登录按钮点击
  handleLogin() {
    // 防止重复点击
    if (this.data.loading) {
      return;
    }
    
    // 显示加载指示器
    wx.showLoading({
      title: '登录中...',
      mask: true
    });
    
    // 设置加载状态
    this.setData({ loading: true });
    
    const loginAttempt = (retry = false) => {
      app.loginWithWeixin()
        .then(result => {
          const { userInfo, openid } = result;
          console.log('登录成功，openid:', openid);
          
          // 将用户信息设置到全局数据
          app.globalData.userInfo = userInfo;
          app.globalData.openid = openid;
          
          // 隐藏加载并显示成功消息
          wx.hideLoading();
          wx.showToast({
            title: '登录成功',
            icon: 'success'
          });
          
          // 创建退出动画
          const exitAnimation = wx.createAnimation({
            duration: 800,
            timingFunction: 'ease-out'
          });
          
          exitAnimation.opacity(0).scale(1.2).step();
          this.setData({
            loginBoxAnimation: exitAnimation.export()
          });
          
          // 动画完成后导航到主页
          setTimeout(() => {
            wx.redirectTo({
              url: '/pages/room/room'
            });
          }, 1000);
        })
        .catch(err => {
          console.error('登录失败:', err);
          wx.hideLoading();
          
          // 如果是云开发未初始化的错误且没有重试过，则尝试一次重试
          if (!retry && (String(err).includes('云开发未初始化') || String(err).includes('cloud not initialized'))) {
            console.log('正在尝试重新初始化云环境并重试登录...');
            
            wx.showToast({
              title: '正在重试...',
              icon: 'loading',
              duration: 2000
            });
            
            // 延迟1秒后重试
            setTimeout(() => {
              loginAttempt(true);
            }, 1000);
            return;
          }
          
          wx.showModal({
            title: '登录失败',
            content: '无法完成登录: ' + err,
            showCancel: false
          });
        })
        .finally(() => {
          if (!retry) {
            this.setData({ loading: false });
          }
        });
    };
    
    // 开始登录尝试
    loginAttempt();
  },

  // 初始化落花瓣动画
  initPetalCanvas: function() {
    const query = wx.createSelectorQuery();
    query.select('#petalsCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        
        // 设置画布宽高以匹配屏幕
        const info = wx.getSystemInfoSync();
        canvas.width = info.windowWidth;
        canvas.height = info.windowHeight;
        
        // 创建花瓣
        const petals = [];
        for (let i = 0; i < 30; i++) {
          petals.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 10 + 5,
            speedX: Math.random() * 2 - 1,
            speedY: Math.random() * 1 + 0.5,
            opacity: Math.random() * 0.7 + 0.3,
            rotate: Math.random() * 360
          });
        }
        
        // 动画循环
        function animate() {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          petals.forEach(petal => {
            ctx.save();
            ctx.translate(petal.x, petal.y);
            ctx.rotate((petal.rotate * Math.PI) / 180);
            
            // 绘制花瓣
            ctx.beginPath();
            ctx.globalAlpha = petal.opacity;
            ctx.fillStyle = "#ffccd5";
            ctx.ellipse(0, 0, petal.size, petal.size / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            
            // 更新位置
            petal.x += petal.speedX;
            petal.y += petal.speedY;
            petal.rotate += 0.5;
            
            // 如果超出屏幕则重置
            if (petal.y > canvas.height) {
              petal.y = -petal.size;
              petal.x = Math.random() * canvas.width;
            }
            if (petal.x < -petal.size || petal.x > canvas.width + petal.size) {
              petal.x = Math.random() * canvas.width;
            }
          });
          
          canvas.requestAnimationFrame(animate);
        }
        
        canvas.requestAnimationFrame(animate);
      });
  },

  // 初始化动画效果
  initAnimations: function() {
    // 添加带延迟的淡入动画类
    let titleEl = this.selectComponent('.title-text');
    let subtitleEl = this.selectComponent('.subtitle-text');
    let loginBoxEl = this.selectComponent('.login-box');
    
    if (titleEl) titleEl.addClass('fade-in');
    if (subtitleEl) subtitleEl.addClass('fade-in-delayed');
    if (loginBoxEl) loginBoxEl.addClass('fade-in');
  },

  // 初始化粒子效果
  initParticles: function() {
    const particleCount = 30;
    let particles = [];
    
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * this.data.canvasWidth,
        y: Math.random() * this.data.canvasHeight,
        size: Math.random() * 5 + 2,
        speedX: Math.random() * 2 - 1,
        speedY: Math.random() * 2 - 1,
        opacity: Math.random() * 0.5 + 0.3,
        color: i % 3 === 0 ? '#ffaa33' : (i % 3 === 1 ? '#e5955c' : '#ba723e')
      });
    }
    
    this.setData({
      particles: particles
    });
  },

  // 粒子动画效果
  animateParticles: function(canvas, ctx) {
    const self = this;
    
    function animate() {
      ctx.clearRect(0, 0, self.data.canvasWidth, self.data.canvasHeight);
      
      const particles = self.data.particles;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        
        // 绘制粒子
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
        
        // 更新位置
        p.x += p.speedX;
        p.y += p.speedY;
        
        // 边界检查和反弹
        if (p.x < 0 || p.x > self.data.canvasWidth) {
          p.speedX *= -1;
        }
        if (p.y < 0 || p.y > self.data.canvasHeight) {
          p.speedY *= -1;
        }
      }
      
      self.data.animationTimer = requestAnimationFrame(animate);
    }
    
    animate();
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
  }
});
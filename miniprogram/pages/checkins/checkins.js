Page({
  data: {
    todayCheckins: [{
        name: "张三",
        avatar: "/assets/images/default-avatar.jpg",
        state: 0
      },
      {
        name: "李四",
        avatar: "/assets/images/default-avatar.jpg",
        state: 1
      },
      {
        name: "王五",
        avatar: "/assets/images/default-avatar.jpg",
        state: 2
      },
      {
        name: "赵六",
        avatar: "/assets/images/default-avatar.jpg",
        state: 0
      },
      {
        name: "钱七",
        avatar: "/assets/images/default-avatar.jpg",
        state: 1
      },
      {
        name: "孙八",
        avatar: "/assets/images/default-avatar.jpg",
        state: 2
      },
      {
        name: "孙八",
        avatar: "/assets/images/default-avatar.jpg",
        state: 2
      }
    ],
    stateMap: ['高度', '中度', '轻度']
  },
  onLoad() {
    this.loadCheckins();
  },
  loadCheckins() {
    // let todayCheckins = wx.getStorageSync('todayCheckins') || [];
    // this.setData({ todayCheckins });
  },
  // 新增的状态映射方法
  getStateText: function (state) {
    return ['高度', '中度', '轻度'][state] || '未知'
  },
  navigateBack() {
    wx.navigateBack();
  },
  navigateToCheckins() {
    wx.navigateTo({
      url: '/pages/punchCard/punchCard'
    });
  }
});
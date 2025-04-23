// personal-checkin.js
Page({
  data: {
    totalCheckins: 23,
    totalDuration: 86.5,
    checkinRecords: [
      { name: "项目开发", type: "work", date: "今天 08:30", duration: "4.5" },
      { name: "英语学习", type: "study", date: "昨天 19:00", duration: "2.0" },
      { name: "会议讨论", type: "work", date: "昨天 14:00", duration: "1.5" },
      { name: "技术阅读", type: "study", date: "前天 20:30", duration: "1.0" }
    ]
  },

  navigateBack: function() {
    wx.navigateBack()
  },

  doCheckin: function() {
    wx.showToast({
      title: '打卡成功',
      icon: 'success'
    })
    // 实际开发中这里应该调用打卡接口
  }
})
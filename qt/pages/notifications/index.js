const { request, ensureLogin } = require('../../utils/request')

Page({
  data: {
    notifications: [],
    loading: true,
    confirmVisible: false
  },

  onLoad() {
    this.loadNotifications()
  },

  onShow() {
    if (!wx.getStorageSync('token')) {
      this.setData({ notifications: [], loading: false, confirmVisible: false })
    }
  },

  loadNotifications() {
    this.setData({ loading: true })
    ensureLogin()
      .then(() => request({ url: '/api/notifications' }))
      .then((data) => this.setData({ notifications: data.notifications || [], loading: false }))
      .catch((error) => {
        this.setData({ loading: false })
        wx.showToast({ title: error.message || '通知加载失败', icon: 'none' })
      })
  },

  markRead() {
    if (!this.data.notifications.length) {
      wx.showToast({ title: '暂无通知', icon: 'none' })
      return
    }
    this.setData({ confirmVisible: true })
  },

  closeConfirm() {
    this.setData({ confirmVisible: false })
  },

  confirmMarkRead() {
    this.setData({ confirmVisible: false })
    request({ url: '/api/notifications', method: 'POST', data: {} })
      .then(() => {
        wx.showToast({ title: '已全部标记', icon: 'success' })
        return this.loadNotifications()
      })
      .catch((error) => wx.showToast({ title: error.message || '操作失败', icon: 'none' }))
  }
})

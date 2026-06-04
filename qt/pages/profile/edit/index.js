const { request, uploadImage, getStoredUser } = require('../../../utils/request')

Page({
  data: {
    needLogin: false,
    user: null,
    username: '',
    avatarUrl: '',
    avatarText: '我',
    bio: '',
    saving: false,
    uploadingAvatar: false
  },

  onLoad() {
    if (!wx.getStorageSync('token')) {
      this.setData({ needLogin: true })
      return
    }
    const user = getStoredUser()
    if (user) this.bindUser(user)
    this.loadMe()
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/index?next=%2Fpages%2Fprofile%2Fedit%2Findex' })
  },

  bindUser(user) {
    this.setData({
      user,
      username: user.username || '',
      avatarUrl: user.avatarUrl || '',
      avatarText: (user.username || '我').slice(0, 1),
      bio: user.bio || ''
    })
  },

  loadMe() {
    request({ url: '/api/users/me' })
      .then((data) => {
        wx.setStorageSync('user', data.user)
        this.bindUser(data.user)
      })
      .catch((error) => wx.showToast({ title: error.message || '资料加载失败', icon: 'none' }))
  },

  onUsernameInput(event) {
    const username = event.detail.value
    this.setData({ username, avatarText: (username || '我').slice(0, 1) })
  },

  onBioInput(event) {
    this.setData({ bio: event.detail.value })
  },

  chooseAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const filePath = res.tempFilePaths[0]
        if (!filePath) return
        this.setData({ avatarUrl: filePath, uploadingAvatar: true })
        uploadImage(filePath)
          .then((data) => {
            this.setData({ avatarUrl: data.url || filePath })
            wx.showToast({ title: '头像已上传', icon: 'success' })
          })
          .catch((error) => wx.showToast({ title: error.message || '头像上传失败', icon: 'none' }))
          .finally(() => this.setData({ uploadingAvatar: false }))
      }
    })
  },

  previewAvatar() {
    if (!this.data.avatarUrl) return
    wx.previewImage({ urls: [this.data.avatarUrl], current: this.data.avatarUrl })
  },

  saveProfile() {
    if (this.data.uploadingAvatar || this.data.saving) return
    const username = this.data.username.trim()
    if (!username) {
      wx.showToast({ title: '请输入用户名', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    request({
      url: '/api/users/me/profile',
      method: 'PUT',
      data: {
        username,
        bio: this.data.bio.trim(),
        avatarUrl: this.data.avatarUrl
      }
    })
      .then((data) => {
        wx.setStorageSync('user', data.user)
        this.bindUser(data.user)
        wx.showToast({ title: '已保存', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 400)
      })
      .catch((error) => wx.showToast({ title: error.message || '保存失败', icon: 'none' }))
      .finally(() => this.setData({ saving: false }))
  }
})

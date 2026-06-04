const { request, ensureLogin } = require('../../utils/request')

Page({
  data: {
    peerId: '',
    peerName: '',
    messages: [],
    content: '',
    loading: true,
    sending: false
  },

  onLoad(options) {
    this.setData({
      peerId: options.peerId || '',
      peerName: decodeURIComponent(options.peerName || '会话')
    })
    wx.setNavigationBarTitle({ title: this.data.peerName })
    this.loadMessages()
  },

  loadMessages() {
    this.setData({ loading: true })
    ensureLogin()
      .then(() => request({ url: `/api/messages?peerId=${this.data.peerId}` }))
      .then((data) => this.setData({ messages: data.messages || [], loading: false }))
      .catch((error) => {
        this.setData({ loading: false })
        wx.showToast({ title: error.message || '会话加载失败', icon: 'none' })
      })
  },

  onInput(event) {
    this.setData({ content: event.detail.value })
  },

  send() {
    const content = this.data.content.trim()
    if (!content || this.data.sending) return

    this.setData({ sending: true })
    request({
      url: '/api/messages',
      method: 'POST',
      data: { receiverId: this.data.peerId, content }
    })
      .then(() => {
        this.setData({ content: '' })
        return this.loadMessages()
      })
      .catch((error) => wx.showToast({ title: error.message || '发送失败', icon: 'none' }))
      .finally(() => this.setData({ sending: false }))
  }
})

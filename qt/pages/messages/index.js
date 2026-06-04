const { request, ensureLogin } = require('../../utils/request')

function welcomeMessage() {
  return {
    role: 'assistant',
    content: '我是 Vitex AI 助手，可以检索你可见的社区文章、收藏、浏览历史和你自己的文章，帮你整理回复、推荐内容和完善表达。',
    createdAt: Date.now()
  }
}

Page({
  data: {
    threads: [],
    loading: true,
    loadedThreads: false,
    aiMessages: [welcomeMessage()],
    aiInput: '',
    aiSending: false
  },

  onLoad() {
    this.loadThreads()
  },

  onShow() {
    if (wx.getStorageSync('token') && !this.data.loadedThreads) this.loadThreads()
  },

  loadThreads() {
    this.setData({ loading: true })
    ensureLogin()
      .then(() => request({ url: '/api/messages/threads' }))
      .then((data) => this.setData({ threads: data.threads || [], loading: false, loadedThreads: true }))
      .catch((error) => {
        this.setData({ loading: false })
        wx.showToast({ title: error.message || '消息加载失败', icon: 'none' })
      })
  },

  openChat(event) {
    const id = event.currentTarget.dataset.id
    const name = event.currentTarget.dataset.name
    this.setData({ loadedThreads: false })
    wx.navigateTo({ url: `/pages/messages/chat?peerId=${id}&peerName=${encodeURIComponent(name)}` })
  },

  onAiInput(event) {
    this.setData({ aiInput: event.detail.value })
  },

  sendAi() {
    const content = this.data.aiInput.trim()
    if (!content || this.data.aiSending) return
    const userMessage = { role: 'user', content, createdAt: Date.now() }
    const nextMessages = this.data.aiMessages.concat(userMessage)
    this.setData({ aiMessages: nextMessages, aiInput: '', aiSending: true })
    ensureLogin()
      .then(() => request({
        url: '/api/ai/profile-chat',
        method: 'POST',
        data: {
          messages: nextMessages.map((item) => ({ role: item.role, content: item.content })).slice(-12)
        }
      }))
      .then((data) => {
        const reply = data.reply || {}
        this.setData({
          aiMessages: this.data.aiMessages.concat({
            role: 'assistant',
            content: reply.content || 'AI 暂时没有返回内容。',
            createdAt: Date.now()
          })
        })
      })
      .catch((error) => {
        this.setData({
          aiMessages: this.data.aiMessages.concat({
            role: 'assistant',
            content: error.message || 'AI 对话失败',
            createdAt: Date.now()
          })
        })
      })
      .finally(() => this.setData({ aiSending: false }))
  }
})

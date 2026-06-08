const { request, ensureLogin, getStoredUser, getSessionScope } = require('../../utils/request')

const detailCache = {}

function getDetailCacheKey(id) {
  return `${getSessionScope()}:${id}`
}

Page({
  data: {
    post: null,
    comments: [],
    commentContent: '',
    loading: true,
    error: '',
    submitting: false,
    favoriting: false,
    unfavoriteConfirmVisible: false,
    aiRecommending: false,
    aiRecommendation: null,
    currentUserId: '',
    cacheScope: ''
  },

  onLoad(options) {
    const user = getStoredUser()
    if (user && user.id) this.setData({ currentUserId: user.id })
    const id = options.id || ''
    const cacheScope = getSessionScope()
    this.setData({ cacheScope })
    const cached = detailCache[getDetailCacheKey(id)]
    if (cached) {
      this.setData({ post: cached.post, comments: cached.comments, loading: false, error: '' })
      return
    }
    this.loadPost(id)
  },

  onShow() {
    const user = getStoredUser()
    const cacheScope = getSessionScope()
    const previousScope = this.data.cacheScope
    this.setData({ currentUserId: user && user.id ? user.id : '', cacheScope })
    if (this.data.post && previousScope && previousScope !== cacheScope) {
      this.loadPost(this.data.post.id)
    }
  },

  loadPost(id) {
    if (!id) {
      this.setData({ loading: false, error: '文章不存在' })
      return
    }

    this.setData({ loading: true, error: '' })
    request({ url: `/api/posts/${id}` })
      .then((data) => {
        this.setData({ post: data.post, loading: false })
        return this.loadComments(data.post.id)
      })
      .catch((error) => {
        this.setData({ error: error.message || '文章加载失败', loading: false })
      })
  },

  loadComments(id) {
    return request({ url: `/api/posts/${id}/comments` })
      .then((data) => {
        const comments = data.comments || []
        this.setData({ comments })
        if (this.data.post) detailCache[getDetailCacheKey(id)] = { post: this.data.post, comments }
      })
  },

  favoritePost() {
    if (!this.data.post || this.data.favoriting) return
    if (this.data.post.isFavorited) {
      this.setData({ unfavoriteConfirmVisible: true })
      return
    }
    this.setData({ favoriting: true })
    ensureLogin()
      .then(() => request({ url: `/api/posts/${this.data.post.id}/favorite`, method: 'POST' }))
      .then((data) => {
        const post = data.post || this.data.post
        this.setData({ post })
        detailCache[getDetailCacheKey(post.id)] = { post, comments: this.data.comments }
        wx.setStorageSync('favorites_dirty', Date.now())
        wx.showToast({ title: '已收藏', icon: 'success' })
      })
      .catch((error) => wx.showToast({ title: error.message || '收藏失败', icon: 'none' }))
      .finally(() => this.setData({ favoriting: false }))
  },

  closeUnfavoriteConfirm() {
    if (this.data.favoriting) return
    this.setData({ unfavoriteConfirmVisible: false })
  },

  confirmUnfavorite() {
    if (!this.data.post || this.data.favoriting) return
    this.setData({ favoriting: true })
    ensureLogin()
      .then(() => request({ url: `/api/posts/${this.data.post.id}/favorite`, method: 'DELETE' }))
      .then((data) => {
        const post = data.post || Object.assign({}, this.data.post, { isFavorited: false })
        this.setData({ post, unfavoriteConfirmVisible: false })
        detailCache[getDetailCacheKey(post.id)] = { post, comments: this.data.comments }
        wx.setStorageSync('favorites_dirty', Date.now())
        wx.showToast({ title: '已取消收藏', icon: 'success' })
      })
      .catch((error) => wx.showToast({ title: error.message || '取消失败', icon: 'none' }))
      .finally(() => this.setData({ favoriting: false }))
  },

  recommendPost() {
    if (!this.data.post || this.data.aiRecommending) return
    this.setData({ aiRecommending: true, aiRecommendation: null })
    request({
      url: '/api/ai/recommend-post',
      method: 'POST',
      data: { postId: this.data.post.id }
    })
      .then((data) => {
        const result = data.result || {}
        this.setData({
          aiRecommendation: {
            score: result.score || 0,
            summary: result.summary || 'AI 暂未返回点评。',
            recommendation: result.recommendation || (result.score >= 60 ? 'recommended' : 'not_recommended')
          }
        })
      })
      .catch((error) => wx.showToast({ title: error.message || 'AI 推荐失败', icon: 'none' }))
      .finally(() => this.setData({ aiRecommending: false }))
  },

  openAuthorChat() {
    if (!this.data.post) return
    if (this.data.currentUserId && this.data.currentUserId === this.data.post.authorId) {
      wx.showToast({ title: '不能和自己发起会话', icon: 'none' })
      return
    }
    ensureLogin()
      .then(() => {
        const peerId = this.data.post.authorId
        const peerName = encodeURIComponent(this.data.post.authorName || '作者')
        wx.navigateTo({ url: `/pages/messages/chat?peerId=${peerId}&peerName=${peerName}` })
      })
      .catch(() => {})
  },

  onCommentInput(event) {
    this.setData({ commentContent: event.detail.value })
  },

  submitComment() {
    const content = this.data.commentContent.trim()
    if (!content) {
      wx.showToast({ title: '评论不能为空', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    ensureLogin()
      .then(() => request({
        url: `/api/posts/${this.data.post.id}/comments`,
        method: 'POST',
        data: { content }
      }))
      .then(() => {
        this.setData({ commentContent: '' })
        wx.showToast({ title: '评论成功', icon: 'success' })
        delete detailCache[getDetailCacheKey(this.data.post.id)]
        return this.loadComments(this.data.post.id)
      })
      .catch((error) => {
        wx.showToast({ title: error.message || '评论失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ submitting: false })
      })
  }
})

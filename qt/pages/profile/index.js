const { request, getStoredUser, logout } = require('../../utils/request')

const tabs = [
  { key: 'published', label: '我的文章', status: 'published' },
  { key: 'draft', label: '草稿箱', status: 'draft' },
  { key: 'pending', label: '审核中', status: 'pending' }
]

function tagText(post) {
  if (post.moderationReason === 'rejected') return '审核不通过'
  if (post.moderationReason === 'takedown') return '下架待整改'
  if (post.status === 'pending') return '审核中'
  if (post.status === 'published') return '已发布'
  return '草稿'
}

function decoratePosts(posts) {
  return (posts || []).map((post) => Object.assign({}, post, { tagText: tagText(post) }))
}

function countByStatus(cache) {
  return {
    published: cache.published ? cache.published.length : 0,
    draft: cache.draft ? cache.draft.length : 0,
    pending: cache.pending ? cache.pending.length : 0
  }
}

Page({
  data: {
    tabs,
    tab: 'published',
    listMode: 'posts',
    listTitle: '我的文章',
    user: null,
    avatarUrl: '',
    avatarText: '我',
    posts: [],
    postsCache: {},
    collectionCache: {},
    counts: { published: 0, draft: 0, pending: 0 },
    loading: true,
    needLogin: false,
    loadedMe: false,
    busyId: '',
    clearingHistory: false,
    confirmVisible: false,
    confirmLoading: false,
    confirmType: '',
    confirmId: '',
    confirmKicker: '',
    confirmTitle: '',
    confirmText: '',
    confirmOkText: '确认'
  },

  onLoad() {
    if (!wx.getStorageSync('token')) {
      this.setData({ needLogin: true, loading: false })
      return
    }
    const user = getStoredUser()
    if (user) this.bindUser(user)
    this.loadMe()
    this.loadPosts(this.data.tab)
    this.prefetchCounts()
  },

  onShow() {
    const loggedIn = Boolean(wx.getStorageSync('token'))
    this.setData({ needLogin: !loggedIn })
    if (!loggedIn) return
    if (wx.getStorageSync('favorites_dirty')) {
      wx.removeStorageSync('favorites_dirty')
      const collectionCache = Object.assign({}, this.data.collectionCache)
      delete collectionCache.favorites
      this.setData({ collectionCache })
      if (this.data.listMode === 'favorites') this.loadCollection('favorites', true)
    }
    const user = getStoredUser()
    if (user) this.bindUser(user)
    if (!this.data.loadedMe) this.loadMe()
    if (this.data.listMode === 'posts' && !this.data.postsCache[this.data.tab]) this.loadPosts(this.data.tab)
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/index?next=%2Fpages%2Fprofile%2Findex' })
  },

  bindUser(user) {
    this.setData({
      user,
      avatarUrl: user.avatarUrl || '',
      avatarText: (user.username || '我').slice(0, 1)
    })
  },

  loadMe() {
    request({ url: '/api/users/me' })
      .then((data) => {
        wx.setStorageSync('user', data.user)
        this.bindUser(data.user)
        this.setData({ loadedMe: true })
      })
      .catch((error) => wx.showToast({ title: error.message || '资料加载失败', icon: 'none' }))
  },

  prefetchCounts() {
    ;['published', 'draft', 'pending'].forEach((key) => {
      if (this.data.postsCache[key]) return
      request({ url: `/api/posts?mine=1&status=${key}` })
        .then((data) => {
          const posts = decoratePosts(data.posts)
          const postsCache = Object.assign({}, this.data.postsCache, { [key]: posts })
          this.setData({ postsCache, counts: countByStatus(postsCache) })
          if (this.data.tab === key && this.data.listMode === 'posts') this.setData({ posts })
        })
        .catch(() => {})
    })
  },

  loadPosts(tab, force) {
    const cached = this.data.postsCache[tab]
    const label = tabs.find((item) => item.key === tab)?.label || '我的文章'
    if (cached && !force) {
      this.setData({ posts: cached, loading: false, listMode: 'posts', listTitle: label, counts: countByStatus(this.data.postsCache) })
      return
    }
    this.setData({ loading: true, listMode: 'posts', listTitle: label })
    request({ url: `/api/posts?mine=1&status=${tab}` })
      .then((data) => {
        const posts = decoratePosts(data.posts)
        const postsCache = Object.assign({}, this.data.postsCache, { [tab]: posts })
        this.setData({ posts, loading: false, postsCache, counts: countByStatus(postsCache) })
      })
      .catch((error) => {
        this.setData({ loading: false })
        wx.showToast({ title: error.message || '文章加载失败', icon: 'none' })
      })
  },

  loadCollection(mode, force) {
    const cached = this.data.collectionCache[mode]
    const title = mode === 'favorites' ? '我的收藏' : '浏览历史'
    if (cached && !force) {
      this.setData({ posts: cached, loading: false, listMode: mode, listTitle: title })
      return
    }
    this.setData({ loading: true, posts: [], listMode: mode, listTitle: title })
    const url = mode === 'favorites' ? '/api/users/me/favorites' : '/api/users/me/history'
    request({ url })
      .then((data) => {
        const posts = decoratePosts(data.posts)
        this.setData({ posts, loading: false, collectionCache: Object.assign({}, this.data.collectionCache, { [mode]: posts }) })
      })
      .catch((error) => {
        this.setData({ loading: false })
        wx.showToast({ title: error.message || '列表加载失败', icon: 'none' })
      })
  },

  switchTab(event) {
    const tab = event.currentTarget.dataset.tab
    if (tab === this.data.tab && this.data.listMode === 'posts') return
    this.setData({ tab })
    this.loadPosts(tab)
  },

  openFavorites() { this.loadCollection('favorites') },
  openHistory() { this.loadCollection('history') },
  askConfirm(options) {
    this.setData({
      confirmVisible: true,
      confirmLoading: false,
      confirmType: options.type || '',
      confirmId: options.id || '',
      confirmKicker: options.kicker || '操作确认',
      confirmTitle: options.title || '确认继续吗？',
      confirmText: options.text || '',
      confirmOkText: options.okText || '确认'
    })
  },
  closeConfirm() {
    this.setData({
      confirmVisible: false,
      confirmLoading: false,
      confirmType: '',
      confirmId: '',
      confirmKicker: '',
      confirmTitle: '',
      confirmText: '',
      confirmOkText: '确认'
    })
  },
  askClearHistory() {
    this.askConfirm({
      type: 'clearHistory',
      kicker: '清空确认',
      title: '确认清空浏览历史吗？',
      text: '清空后浏览历史列表会被移除，但不会影响文章本身。',
      okText: '确认清空'
    })
  },

  confirmClearHistory() {
    this.setData({ clearingHistory: true, confirmLoading: true })
    request({ url: '/api/users/me/history', method: 'DELETE' })
      .then(() => {
        wx.showToast({ title: '已清空历史', icon: 'success' })
        const collectionCache = Object.assign({}, this.data.collectionCache, { history: [] })
        this.setData({ collectionCache, posts: this.data.listMode === 'history' ? [] : this.data.posts })
        this.closeConfirm()
      })
      .catch((error) => wx.showToast({ title: error.message || '清空失败', icon: 'none' }))
      .finally(() => this.setData({ clearingHistory: false, confirmLoading: false }))
  },

  removeFavorite(event) {
    const id = event.currentTarget.dataset.id
    this.askConfirm({
      type: 'removeFavorite',
      id,
      kicker: '取消确认',
      title: '取消收藏',
      text: '确认从我的收藏中移除这篇文章吗？',
      okText: '确认取消'
    })
  },

  confirmRemoveFavorite(id) {
    this.setData({ busyId: id, confirmLoading: true })
    request({ url: `/api/posts/${id}/favorite`, method: 'DELETE' })
      .then(() => {
        wx.showToast({ title: '已取消收藏', icon: 'success' })
        const nextFavorites = (this.data.collectionCache.favorites || this.data.posts).filter((post) => post.id !== id)
        const collectionCache = Object.assign({}, this.data.collectionCache, { favorites: nextFavorites })
        this.setData({ collectionCache, posts: this.data.listMode === 'favorites' ? nextFavorites : this.data.posts })
        this.closeConfirm()
      })
      .catch((error) => wx.showToast({ title: error.message || '取消失败', icon: 'none' }))
      .finally(() => this.setData({ busyId: '', confirmLoading: false }))
  },

  invalidatePostCaches(keys) {
    const next = Object.assign({}, this.data.postsCache)
    keys.forEach((key) => delete next[key])
    this.setData({ postsCache: next, collectionCache: {}, counts: countByStatus(next) })
  },

  previewAvatar() { if (this.data.avatarUrl) wx.previewImage({ urls: [this.data.avatarUrl], current: this.data.avatarUrl }) },
  editProfile() { wx.navigateTo({ url: '/pages/profile/edit/index' }) },
  openNotifications() { wx.navigateTo({ url: '/pages/notifications/index' }) },
  editPost(event) { wx.navigateTo({ url: `/pages/post/edit/index?id=${event.currentTarget.dataset.id}` }) },

  submitPost(event) {
    const id = event.currentTarget.dataset.id
    this.askConfirm({
      type: 'submitPost',
      id,
      kicker: '提交确认',
      title: '提交审核',
      text: '提交后会进入管理员审核队列，审核中不能继续编辑。',
      okText: '确认提交'
    })
  },

  confirmSubmitPost(id) {
    this.setData({ busyId: id, confirmLoading: true })
    request({ url: `/api/posts/${id}/status`, method: 'POST', data: { action: 'submit' } })
      .then(() => {
        wx.showToast({ title: '已提交审核', icon: 'success' })
        this.invalidatePostCaches(['draft', 'pending'])
        this.setData({ tab: 'pending' })
        this.loadPosts('pending', true)
        this.closeConfirm()
      })
      .catch((error) => wx.showToast({ title: error.message || '提交失败', icon: 'none' }))
      .finally(() => this.setData({ busyId: '', confirmLoading: false }))
  },

  unpublishPost(event) {
    const id = event.currentTarget.dataset.id
    this.askConfirm({
      type: 'unpublishPost',
      id,
      kicker: '下架确认',
      title: '下架文章',
      text: '下架后文章会回到草稿箱，可以重新修改后再提交审核。',
      okText: '确认下架'
    })
  },

  confirmUnpublishPost(id) {
    this.setData({ busyId: id, confirmLoading: true })
    request({ url: `/api/posts/${id}/status`, method: 'POST', data: { action: 'unpublish' } })
      .then(() => {
        wx.showToast({ title: '已下架到草稿箱', icon: 'success' })
        this.invalidatePostCaches(['published', 'draft'])
        this.setData({ tab: 'draft' })
        this.loadPosts('draft', true)
        this.closeConfirm()
      })
      .catch((error) => wx.showToast({ title: error.message || '下架失败', icon: 'none' }))
      .finally(() => this.setData({ busyId: '', confirmLoading: false }))
  },

  deletePost(event) {
    const id = event.currentTarget.dataset.id
    this.askConfirm({
      type: 'deletePost',
      id,
      kicker: '删除确认',
      title: '删除草稿',
      text: '确认删除这篇草稿吗？此操作不可恢复。',
      okText: '确认删除'
    })
  },

  confirmDeletePost(id) {
    this.setData({ busyId: id, confirmLoading: true })
    request({ url: `/api/posts/${id}`, method: 'DELETE' })
      .then(() => {
        wx.showToast({ title: '已删除', icon: 'success' })
        this.invalidatePostCaches(['draft'])
        this.loadPosts('draft', true)
        this.closeConfirm()
      })
      .catch((error) => wx.showToast({ title: error.message || '删除失败', icon: 'none' }))
      .finally(() => this.setData({ busyId: '', confirmLoading: false }))
  },

  openPost(event) { wx.navigateTo({ url: `/pages/post/detail?id=${event.currentTarget.dataset.id}` }) },
  askLogout() {
    this.askConfirm({
      type: 'logout',
      kicker: '退出确认',
      title: '确认退出登录吗？',
      text: '退出后将清除当前账号状态，发布、消息和个人中心需要重新登录后才能使用。',
      okText: '确认退出'
    })
  },
  confirmLogout() {
    this.closeConfirm()
    logout()
    wx.showToast({ title: '已退出', icon: 'success' })
    setTimeout(() => wx.switchTab({ url: '/pages/index/index' }), 400)
  },
  confirmAction() {
    const type = this.data.confirmType
    const id = this.data.confirmId
    if (type === 'clearHistory') return this.confirmClearHistory()
    if (type === 'removeFavorite') return this.confirmRemoveFavorite(id)
    if (type === 'submitPost') return this.confirmSubmitPost(id)
    if (type === 'unpublishPost') return this.confirmUnpublishPost(id)
    if (type === 'deletePost') return this.confirmDeletePost(id)
    if (type === 'logout') return this.confirmLogout()
    this.closeConfirm()
  }
})

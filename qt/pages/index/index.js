const { request, getStoredUser } = require('../../utils/request')

Page({
  data: {
    allPosts: [],
    posts: [],
    keyword: '',
    sortMode: 'latest',
    user: null,
    loading: true,
    loadingMore: false,
    error: '',
    page: 1,
    pageSize: 6,
    hasMore: false,
    visibleCount: 0
  },

  onLoad() {
    this.loadPosts()
    const user = getStoredUser()
    if (user) this.setData({ user })
  },

  onShow() {
    this.setData({ user: getStoredUser() })
  },

  onPullDownRefresh() {
    this.loadPosts().finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    this.loadMore()
  },

  loadPosts() {
    this.setData({ loading: true, error: '' })
    return request({ url: '/api/posts' })
      .then((data) => {
        this.setData({ allPosts: data.posts || [], page: 1, loading: false })
        this.applySearch()
      })
      .catch((error) => this.setData({ error: error.message || '文章加载失败', loading: false }))
  },

  handleLogin() {
    wx.navigateTo({ url: '/pages/login/index' })
  },

  onSearchInput(event) {
    this.setData({ keyword: event.detail.value, page: 1 })
    this.applySearch()
  },

  switchSort(event) {
    const mode = event.currentTarget.dataset.mode
    if (!mode || mode === this.data.sortMode) return
    this.setData({ sortMode: mode, page: 1 })
    this.applySearch()
  },

  matchPost(post, keyword) {
    if (!keyword) return true
    const values = [post.title, post.excerpt, post.content, post.categoryName, post.authorName].concat(post.tags || [])
    return values.some((value) => String(value || '').toLowerCase().indexOf(keyword) >= 0)
  },

  applySearch() {
    const keyword = this.data.keyword.trim().toLowerCase()
    const matched = this.data.allPosts.filter((post) => this.matchPost(post, keyword))
    const sorted = this.sortPosts(matched)
    const count = this.data.page * this.data.pageSize
    this.setData({ posts: sorted.slice(0, count), visibleCount: sorted.length, hasMore: sorted.length > count })
  },

  sortPosts(posts) {
    const items = posts.slice()
    if (this.data.sortMode === 'hot') return items.sort((a, b) => this.hotScore(b) - this.hotScore(a))
    return items.sort((a, b) => Number(new Date(b.createdAt || 0)) - Number(new Date(a.createdAt || 0)))
  },

  hotScore(post) {
    return (post.viewCount || 0) + (post.favoriteCount || 0) * 5 + (post.commentCount || 0) * 3
  },

  loadMore() {
    if (this.data.loading || this.data.loadingMore || !this.data.hasMore) return
    this.setData({ loadingMore: true, page: this.data.page + 1 })
    this.applySearch()
    this.setData({ loadingMore: false })
  },

  openPost(event) {
    wx.navigateTo({ url: `/pages/post/detail?id=${event.currentTarget.dataset.id}` })
  },

  createPost() {
    wx.switchTab({ url: '/pages/post/create/index' })
  }
})

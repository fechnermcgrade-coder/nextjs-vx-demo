const { request, uploadImage } = require('../../../utils/request')

Page({
  data: {
    id: '',
    needLogin: false,
    title: '',
    content: '',
    coverUrl: '',
    categoryId: '',
    categoryIndex: 0,
    categories: [],
    categoryNames: [],
    loading: true,
    loadingCategories: false,
    saving: false,
    submitting: false,
    uploadingCover: false,
    confirmVisible: false,
    confirmType: '',
    confirmTitle: '',
    confirmText: '',
    confirmDanger: false
  },

  onLoad(options) {
    if (!wx.getStorageSync('token')) {
      this.setData({ needLogin: true, loading: false })
      return
    }
    if (!options.id) {
      wx.showToast({ title: '文章不存在', icon: 'none' })
      wx.navigateBack()
      return
    }
    this.setData({ id: options.id })
    this.loadCategories()
    this.loadPost(options.id)
  },

  onShow() {
    this.setData({ needLogin: !wx.getStorageSync('token') })
  },

  goLogin() {
    wx.navigateTo({ url: `/pages/login/index?next=${encodeURIComponent(`/pages/post/edit/index?id=${this.data.id || ''}`)}` })
  },

  loadPost(id) {
    this.setData({ loading: true })
    request({ url: `/api/posts/${id}` })
      .then((data) => {
        const post = data.post || {}
        this.setData({
          title: post.title || '',
          content: post.content || '',
          coverUrl: post.coverUrl || '',
          categoryId: post.categoryId || '',
          loading: false
        })
        if (post.categoryId) this.loadCategories(post.categoryId)
      })
      .catch((error) => {
        this.setData({ loading: false })
        wx.showToast({ title: error.message || '文章加载失败', icon: 'none' })
      })
  },

  onTitleInput(event) {
    this.setData({ title: event.detail.value })
  },

  onContentInput(event) {
    this.setData({ content: event.detail.value })
  },

  loadCategories(selectedId) {
    this.setData({ loadingCategories: true })
    request({ url: '/api/categories' })
      .then((data) => {
        const categories = data.categories || []
        const categoryNames = categories.map((category) => category.name)
        const targetId = selectedId || this.data.categoryId || categories[0]?.id || ''
        const foundIndex = categories.findIndex((category) => category.id === targetId)
        const categoryIndex = foundIndex >= 0 ? foundIndex : 0
        const selected = categories[categoryIndex]
        this.setData({
          categories,
          categoryNames,
          categoryIndex,
          categoryId: selected?.id || ''
        })
      })
      .catch((error) => wx.showToast({ title: error.message || '分类加载失败', icon: 'none' }))
      .finally(() => this.setData({ loadingCategories: false }))
  },

  onCategoryChange(event) {
    const categoryIndex = Number(event.detail.value)
    const selected = this.data.categories[categoryIndex]
    this.setData({
      categoryIndex,
      categoryId: selected?.id || ''
    })
  },

  chooseCover() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const filePath = res.tempFilePaths[0]
        if (!filePath) return
        this.setData({ coverUrl: filePath, uploadingCover: true })
        uploadImage(filePath)
          .then((data) => {
            this.setData({ coverUrl: data.url || filePath })
            wx.showToast({ title: '封面已上传', icon: 'success' })
          })
          .catch((error) => wx.showToast({ title: error.message || '封面上传失败', icon: 'none' }))
          .finally(() => this.setData({ uploadingCover: false }))
      }
    })
  },

  previewCover() {
    if (!this.data.coverUrl) return
    wx.previewImage({ urls: [this.data.coverUrl], current: this.data.coverUrl })
  },

  removeCover() {
    this.setData({ coverUrl: '' })
  },

  validate() {
    const title = this.data.title.trim()
    const content = this.data.content.trim()
    if (!title || !content) {
      wx.showToast({ title: '标题和正文都要填写', icon: 'none' })
      return null
    }
    if (this.data.loadingCategories) {
      wx.showToast({ title: '分类加载中，请稍候', icon: 'none' })
      return null
    }
    if (this.data.categories.length && !this.data.categoryId) {
      wx.showToast({ title: '请选择文章分类', icon: 'none' })
      return null
    }
    const payload = { title, content, coverUrl: this.data.coverUrl }
    if (this.data.categoryId) payload.categoryId = this.data.categoryId
    return payload
  },

  showConfirm(type, title, text, danger) {
    this.setData({ confirmVisible: true, confirmType: type, confirmTitle: title, confirmText: text, confirmDanger: Boolean(danger) })
  },

  closeConfirm() {
    this.setData({ confirmVisible: false, confirmType: '', confirmTitle: '', confirmText: '', confirmDanger: false })
  },

  confirmAction() {
    const type = this.data.confirmType
    this.closeConfirm()
    if (type === 'draft') this.saveDraftNow()
    if (type === 'submit') this.submitNow()
  },

  saveDraft() {
    if (this.validate() && !this.data.uploadingCover) this.showConfirm('draft', '保存草稿', '确认保存当前修改到草稿箱吗？')
  },

  saveDraftNow() {
    const payload = this.validate()
    if (payload) this.save(false, payload)
  },

  submit() {
    if (this.validate() && !this.data.uploadingCover) this.showConfirm('submit', '提交审核', '提交后会进入管理员后台，审核中不可继续编辑。确认提交吗？', true)
  },

  submitNow() {
    const payload = this.validate()
    if (payload) this.save(true, payload)
  },

  save(submit, payload) {
    const key = submit ? 'submitting' : 'saving'
    this.setData({ [key]: true })
    request({
      url: `/api/posts/${this.data.id}`,
      method: 'PUT',
      data: Object.assign({}, payload, { submit })
    })
      .then(() => {
        wx.showToast({ title: submit ? '已提交审核' : '草稿已保存', icon: 'success' })
        setTimeout(() => wx.switchTab({ url: '/pages/profile/index' }), 500)
      })
      .catch((error) => wx.showToast({ title: error.message || '保存失败', icon: 'none' }))
      .finally(() => this.setData({ [key]: false }))
  }
})

const { request, uploadImage } = require('../../../utils/request')

const emptyForm = {
  id: '',
  title: '',
  content: '',
  coverUrl: '',
  categoryId: '',
  categoryIndex: 0,
  loading: false,
  generating: false,
  saving: false,
  submitting: false,
  uploadingCover: false,
  confirmVisible: false,
  confirmType: '',
  confirmTitle: '',
  confirmText: '',
  confirmDanger: false
}

Page({
  data: {
    needLogin: false,
    categories: [],
    categoryNames: [],
    loadingCategories: false,
    ...emptyForm
  },

  resetForm() {
    const next = { ...emptyForm }
    const firstCategory = this.data.categories[0]
    if (firstCategory) next.categoryId = firstCategory.id
    this.setData(next)
  },

  onLoad() {
    if (!wx.getStorageSync('token')) {
      this.setData({ needLogin: true, loading: false })
      return
    }
    this.resetForm()
    this.loadCategories()
  },

  onShow() {
    if (!wx.getStorageSync('token')) {
      this.setData({ needLogin: true })
      return
    }
    this.setData({ needLogin: false })
    if (this.data.id) this.resetForm()
    if (!this.data.categories.length && !this.data.loadingCategories) this.loadCategories()
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/index?next=%2Fpages%2Fpost%2Fcreate%2Findex' })
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
    if (this.data.coverUrl) wx.previewImage({ urls: [this.data.coverUrl], current: this.data.coverUrl })
  },

  removeCover() {
    this.setData({ coverUrl: '' })
  },

  validate() {
    if (this.data.needLogin) return null
    const title = this.data.title.trim()
    const content = this.data.content.trim()
    if (!title || !content) {
      wx.showToast({ title: '标题和正文都要填写', icon: 'none' })
      return null
    }
    if (this.data.uploadingCover) {
      wx.showToast({ title: '封面上传中，请稍候', icon: 'none' })
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

  validateTitle() {
    const title = this.data.title.trim()
    if (!title) {
      wx.showToast({ title: '请输入标题后再使用 AI 生文', icon: 'none' })
      return ''
    }
    return title
  },

  showConfirm(type, title, text, danger) {
    this.setData({
      confirmVisible: true,
      confirmType: type,
      confirmTitle: title,
      confirmText: text,
      confirmDanger: Boolean(danger)
    })
  },

  closeConfirm() {
    this.setData({
      confirmVisible: false,
      confirmType: '',
      confirmTitle: '',
      confirmText: '',
      confirmDanger: false
    })
  },

  confirmAction() {
    const type = this.data.confirmType
    this.closeConfirm()
    if (type === 'ai') this.runAiWrite()
    if (type === 'draft') this.saveDraftNow()
    if (type === 'submit') this.submitNow()
  },

  aiWrite() {
    if (!this.validateTitle() || this.data.generating) return
    const text = this.data.content.trim()
    this.showConfirm(
      'ai',
      'AI 生文',
      text ? 'AI 会结合标题和你已输入的正文生成新正文，确认继续吗？' : 'AI 会根据标题生成正文，确认继续吗？'
    )
  },

  runAiWrite() {
    const title = this.validateTitle()
    if (!title) return
    this.setData({ generating: true })
    request({ url: '/api/ai/write-post', method: 'POST', data: { title, content: this.data.content.trim() } })
      .then((data) => {
        this.setData({ content: data.content || data.result?.content || '' })
        wx.showToast({ title: 'AI 正文已生成', icon: 'success' })
      })
      .catch((error) => wx.showToast({ title: error.message || 'AI 生文失败', icon: 'none' }))
      .finally(() => this.setData({ generating: false }))
  },

  saveDraft() {
    if (this.validate()) this.showConfirm('draft', '保存草稿', '确认保存当前标题和正文到草稿箱吗？')
  },

  saveDraftNow() {
    const payload = this.validate()
    if (payload) this.save(false, payload)
  },

  submit() {
    if (this.validate()) this.showConfirm('submit', '提交审核', '提交后会进入管理员后台，审核中不可继续编辑。确认提交吗？', true)
  },

  submitNow() {
    const payload = this.validate()
    if (payload) this.save(true, payload)
  },

  save(submit, payload) {
    const key = submit ? 'submitting' : 'saving'
    this.setData({ [key]: true })
    request({ url: '/api/posts', method: 'POST', data: Object.assign({}, payload, { submit }) })
      .then((data) => {
        if (data.post?.id) wx.setStorageSync('posts_dirty', '1')
        wx.showToast({ title: submit ? '已提交审核' : '草稿已保存', icon: 'success' })
        this.resetForm()
        setTimeout(() => wx.switchTab({ url: '/pages/profile/index' }), 500)
      })
      .catch((error) => wx.showToast({ title: error.message || '保存失败', icon: 'none' }))
      .finally(() => this.setData({ [key]: false }))
  }
})

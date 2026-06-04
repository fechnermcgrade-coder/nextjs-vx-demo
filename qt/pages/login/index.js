const { loginByEmail, registerByEmail } = require('../../utils/request')

Page({
  data: {
    mode: 'login',
    email: '',
    username: '',
    password: '',
    next: '',
    submitting: false
  },

  onLoad(options) {
    this.setData({ next: options.next ? decodeURIComponent(options.next) : '' })
  },

  switchMode() {
    this.setData({ mode: this.data.mode === 'login' ? 'register' : 'login' })
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [field]: event.detail.value })
  },

  submit() {
    if (this.data.submitting) return
    const email = this.data.email.trim()
    const password = this.data.password
    if (!email || password.length < 6) {
      wx.showToast({ title: '请输入邮箱和至少 6 位密码', icon: 'none' })
      return
    }
    if (this.data.mode === 'register' && !this.data.username.trim()) {
      wx.showToast({ title: '请输入用户名', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    const task = this.data.mode === 'login'
      ? loginByEmail(email, password)
      : registerByEmail({ email, password, username: this.data.username.trim() })

    task
      .then(() => {
        wx.showToast({ title: this.data.mode === 'login' ? '登录成功' : '注册成功', icon: 'success' })
        setTimeout(() => {
          if (this.data.next) {
            const path = this.data.next.split('?')[0]
            if (['/pages/index/index', '/pages/post/create/index', '/pages/messages/index', '/pages/profile/index'].includes(path)) {
              wx.switchTab({ url: path })
            } else {
              wx.redirectTo({ url: this.data.next })
            }
          } else {
            wx.navigateBack({ delta: 1 })
          }
        }, 400)
      })
      .catch((error) => wx.showToast({ title: error.message || '操作失败', icon: 'none' }))
      .finally(() => this.setData({ submitting: false }))
  }
})

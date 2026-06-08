const API_BASE_URL = 'http://localhost:3001'
const SESSION_STORAGE_KEYS = ['favorites_dirty']

function getSessionUserId() {
  if (!wx.getStorageSync('token')) return ''
  const user = wx.getStorageSync('user')
  return user && user.id ? user.id : ''
}

function getSessionScope() {
  return getSessionUserId() || 'guest'
}

function clearSessionStorage() {
  SESSION_STORAGE_KEYS.forEach((key) => wx.removeStorageSync(key))
}

function request(options) {
  const token = wx.getStorageSync('token')
  const headers = Object.assign({}, options.header || {})

  if (token) headers.Authorization = `Bearer ${token}`

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: Object.assign({ 'Content-Type': 'application/json' }, headers),
      success(res) {
        const body = res.data || {}
        if (res.statusCode >= 200 && res.statusCode < 300 && body.success !== false) {
          resolve(body.data || {})
          return
        }
        if (res.statusCode === 401) logout()
        if (res.statusCode >= 500) console.error('[Vitex API 500]', options.method || 'GET', options.url, body)
        reject(new Error(body.message || '请求失败'))
      },
      fail(error) {
        reject(error)
      }
    })
  })
}

function uploadImage(filePath) {
  const token = wx.getStorageSync('token')
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${API_BASE_URL}/api/uploads`,
      filePath,
      name: 'file',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success(res) {
        let body = {}
        try {
          body = JSON.parse(res.data || '{}')
        } catch (error) {
          reject(new Error('上传结果解析失败'))
          return
        }
        if (res.statusCode >= 200 && res.statusCode < 300 && body.success !== false) {
          resolve(body.data || {})
          return
        }
        if (res.statusCode === 401) logout()
        if (res.statusCode >= 500) console.error('[Vitex Upload 500]', '/api/uploads', body)
        reject(new Error(body.message || '图片上传失败'))
      },
      fail(error) {
        reject(error)
      }
    })
  })
}

function saveSession(data) {
  clearSessionStorage()
  wx.setStorageSync('token', data.token)
  wx.setStorageSync('user', data.user)
  return data.user
}

function loginByEmail(email, password) {
  return request({
    url: '/api/auth/login',
    method: 'POST',
    data: { email, password }
  }).then(saveSession)
}

function registerByEmail(payload) {
  return request({
    url: '/api/auth/register',
    method: 'POST',
    data: payload
  }).then(saveSession)
}

function getCurrentUrl() {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1]
  if (!current) return '/pages/index/index'
  const query = current.options
    ? Object.keys(current.options).map((key) => `${key}=${encodeURIComponent(current.options[key])}`).join('&')
    : ''
  return `/${current.route}${query ? `?${query}` : ''}`
}

function goLogin() {
  const next = encodeURIComponent(getCurrentUrl())
  wx.navigateTo({ url: `/pages/login/index?next=${next}` })
  return Promise.reject(new Error('请先登录'))
}

function logout() {
  clearSessionStorage()
  wx.removeStorageSync('token')
  wx.removeStorageSync('user')
}

function login() {
  return goLogin()
}

function requireToken() {
  const token = wx.getStorageSync('token')
  if (!token) return goLogin()
  return Promise.resolve(token)
}

function ensureLogin() {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token')
    if (!token) {
      goLogin().catch(reject)
      return
    }
    resolve(getStoredUser())
  })
}

function requirePageLogin(page) {
  if (wx.getStorageSync('token')) return true
  wx.showToast({ title: '请先登录', icon: 'none' })
  goLogin().catch(() => {})
  if (page && page.setData) page.setData({ loading: false })
  return false
}

function getStoredUser() {
  if (!wx.getStorageSync('token')) return null
  return wx.getStorageSync('user') || null
}

module.exports = {
  API_BASE_URL,
  request,
  uploadImage,
  login,
  loginByEmail,
  registerByEmail,
  logout,
  getSessionUserId,
  getSessionScope,
  clearSessionStorage,
  requireToken,
  ensureLogin,
  requirePageLogin,
  getStoredUser
}

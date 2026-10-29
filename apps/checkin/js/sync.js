// GitHub Gist 云同步：打卡数据上传/拉取（个人使用）
// 数据保存在一个私密 Gist 的 toolbox-sync.json 里，本应用只读写 checkin 分节
(function () {
  var CFG = {
    section: 'checkin',
    keys: ['checkin.habits.v1', 'checkin.checkins.v1']
  }
  var FILE = 'toolbox-sync.json'
  var TOKEN_KEY = 'gistsync.token'
  var GIST_KEY = 'gistsync.gistId'

  function lsGet(k) {
    try { return localStorage.getItem(k) } catch (e) { return null }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, v) } catch (e) {}
  }
  function hasToken() {
    var t = lsGet(TOKEN_KEY)
    return !!(t && t.length > 10)
  }

  function api(path, opts) {
    opts = opts || {}
    opts.headers = Object.assign({
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + lsGet(TOKEN_KEY),
      'Content-Type': 'application/json'
    }, opts.headers || {})
    return fetch('https://api.github.com' + path, opts).then(function (res) {
      if (res.ok) return res.json()
      return res.json().catch(function () { return {} }).then(function (data) {
        var msg = (data && data.message) || ('HTTP ' + res.status)
        if (res.status === 401) msg = '令牌无效或已过期，请重新粘贴（401）'
        if (res.status === 403) msg = '令牌权限不足，请确认勾选了 gist 权限（403）'
        if (res.status === 404 && path.indexOf('/gists/') === 0) {
          lsSet(GIST_KEY, '')
          msg = '云端备份不存在或已被删除，请重新点击上传创建（404）'
        }
        throw new Error(msg)
      })
    })
  }

  function createGist() {
    var files = {}
    files[FILE] = { content: '{}' }
    return api('/gists', {
      method: 'POST',
      body: JSON.stringify({
        description: 'toolbox-cloud-sync（个人工具数据备份，请勿删除）',
        public: false,
        files: files
      })
    })
  }

  function readCloud() {
    var id = lsGet(GIST_KEY)
    var p = id ? api('/gists/' + id) : createGist()
    return p.then(function (gist) {
      if (lsGet(GIST_KEY) !== gist.id) lsSet(GIST_KEY, gist.id)
      var f = gist.files && gist.files[FILE]
      var data = {}
      try { data = JSON.parse((f && f.content) || '{}') } catch (e) {}
      return { gistId: gist.id, data: data }
    })
  }

  function collect() {
    var section = {}
    CFG.keys.forEach(function (k) {
      var v = lsGet(k)
      if (v != null) section[k] = v
    })
    return section
  }

  function upload() {
    if (!hasToken()) return Promise.reject(new Error('请先粘贴访问令牌并保存'))
    return readCloud().then(function (r) {
      r.data[CFG.section] = collect()
      r.data.savedAt = new Date().toISOString()
      var files = {}
      files[FILE] = { content: JSON.stringify(r.data) }
      return api('/gists/' + r.gistId, {
        method: 'PATCH',
        body: JSON.stringify({ files: files })
      })
    })
  }

  function download() {
    if (!hasToken()) return Promise.reject(new Error('请先粘贴访问令牌并保存'))
    return readCloud().then(function (r) {
      var section = r.data[CFG.section]
      if (!section) {
        throw new Error('云端还没有打卡数据：请先在存有记录的设备上点“上传到云端”')
      }
      Object.keys(section).forEach(function (k) { lsSet(k, section[k]) })
      location.reload()
    })
  }

  function fmtTime(iso) {
    try {
      var d = new Date(iso)
      return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' +
        String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
    } catch (e) { return iso }
  }

  // ---------- 界面 ----------
  var box = document.createElement('details')
  box.className = 'gistsync-box'
  box.setAttribute('style',
    'margin:12px 16px 24px;background:#fff;border:1px solid #E4E2DD;border-radius:14px;' +
    'font-family:inherit;font-size:13px;color:#1A1A1A;overflow:hidden')
  box.innerHTML =
    '<summary style="cursor:pointer;list-style:none;padding:13px 16px;font-weight:600;user-select:none">' +
      '☁️ 云同步（GitHub Gist）' +
    '</summary>' +
    '<div style="padding:0 16px 14px">' +
      '<div class="gs-status" style="color:#8A8781;font-size:12px;margin-bottom:10px"></div>' +
      '<div class="gs-tokenrow" style="display:flex;gap:8px;margin-bottom:8px">' +
        '<input class="gs-token" type="password" placeholder="粘贴 GitHub 访问令牌（ghp_ 开头）" ' +
          'style="flex:1;min-width:0;padding:9px 11px;border:1px solid #E4E2DD;border-radius:10px;' +
          'font-size:13px;background:#FAFAF8;color:#1A1A1A" autocomplete="off">' +
        '<button class="gs-save" style="padding:9px 13px;border:1px solid #E4E2DD;border-radius:10px;' +
          'background:#fff;font-size:13px;cursor:pointer">保存</button>' +
      '</div>' +
      '<div style="display:flex;gap:8px">' +
        '<button class="gs-up" style="flex:1;padding:10px;border:none;border-radius:10px;' +
          'background:#111;color:#fff;font-size:13px;cursor:pointer">上传到云端</button>' +
        '<button class="gs-down" style="flex:1;padding:10px;border:1px solid #E4E2DD;border-radius:10px;' +
          'background:#fff;font-size:13px;cursor:pointer">从云端拉取</button>' +
      '</div>' +
      '<div class="gs-hint" style="color:#8A8781;font-size:11px;line-height:1.6;margin-top:10px">' +
        '首次使用：GitHub → Settings → Developer settings → Personal access tokens (classic) → ' +
        'Generate new token，只勾选 gist，生成后粘贴到上面。数据存你自己的私密 Gist 里。' +
      '</div>' +
    '</div>'

  var app = document.querySelector('.app') || document.body
  var tabbar = app.querySelector('.tabbar')
  if (tabbar) app.insertBefore(box, tabbar)
  else app.appendChild(box)

  var status = box.querySelector('.gs-status')
  var tokenInput = box.querySelector('.gs-token')

  function renderStatus(msg, isError) {
    var tokenTxt = hasToken() ? '令牌已保存' : '未配置令牌'
    var gistTxt = lsGet(GIST_KEY) ? '云端已连接' : '云端未创建'
    status.textContent = (msg || (tokenTxt + ' · ' + gistTxt)) +
      (lsGet('gistsync.lastSavedAt') ? ' · 最近上传 ' + fmtTime(lsGet('gistsync.lastSavedAt')) : '')
    status.style.color = isError ? '#C0392B' : '#8A8781'
  }

  if (hasToken()) tokenInput.value = lsGet(TOKEN_KEY)
  box.addEventListener('toggle', function () {
    if (box.open) renderStatus()
  })

  box.querySelector('.gs-save').addEventListener('click', function () {
    var t = tokenInput.value.trim()
    if (!t) { renderStatus('请先粘贴令牌', true); return }
    lsSet(TOKEN_KEY, t)
    renderStatus('令牌已保存')
  })

  function busy(btn, label, done) {
    btn.disabled = true
    var old = btn.textContent
    btn.textContent = label
    return function (err) {
      btn.disabled = false
      btn.textContent = old
      if (err) {
        renderStatus('失败：' + err.message, true)
      } else if (done) {
        done()
      }
    }
  }

  box.querySelector('.gs-up').addEventListener('click', function () {
    var btn = this
    var end = busy(btn, '上传中…')
    upload().then(function () {
      lsSet('gistsync.lastSavedAt', new Date().toISOString())
      end()
      renderStatus('已上传到云端')
    }).catch(end)
  })

  box.querySelector('.gs-down').addEventListener('click', function () {
    var btn = this
    var end = busy(btn, '拉取中…')
    download().then(end).catch(function (err) { end(err); renderStatus('失败：' + err.message, true) })
  })

  renderStatus()
})()

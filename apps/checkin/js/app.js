(function () {
  var D = window.CheckinDate
  var H = window.CheckinHabit
  var store = window.CheckinStore
  var C = window.CONFIG

  var PALETTE = ['#F5B60B', '#4C8DF6', '#8B7CF6', '#EC6FA8', '#F08A45', '#EF6B5E', '#37B6E8', '#6E6BE8']
  var FILTERS = [
    { value: 'all', label: '全部' },
    { value: '0', label: '必做' },
    { value: '1', label: '常规' },
    { value: '2', label: '可选' }
  ]

  var views = {
    today: document.getElementById('view-today'),
    habits: document.getElementById('view-habits'),
    stats: document.getElementById('view-stats'),
    edit: document.getElementById('view-edit')
  }
  var tabbar = document.getElementById('tabbar')
  var modal = document.getElementById('modal')
  var toastEl = document.getElementById('toast')

  var state = {
    tab: 'today',
    filter: 'all',
    year: 0,
    month: 0,
    draft: null,
    editReturn: 'today',
    installPrompt: null,
    currentDate: D.today()
  }

  var toastTimer = null

  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }

  function activeHabits() {
    return store.getHabits().filter(function (h) {
      return !h.archived
    })
  }

  function makeDoneSet() {
    return new Set(store.getCheckins().map(function (c) {
      return H.keyOf(c.habitId, c.date)
    }))
  }

  // 按习惯顺序分配颜色，前几个习惯颜色差别最大
  function buildColorMap() {
    var map = {}
    H.sortHabits(activeHabits()).forEach(function (h, i) {
      map[h.id] = h.color || PALETTE[i % PALETTE.length]
    })
    return map
  }

  // 新建习惯时挑一个当前用得最少的颜色，之后固定不变
  function pickColor(habits) {
    var used = {}
    habits.forEach(function (h) {
      if (h.color) used[h.color] = (used[h.color] || 0) + 1
    })
    var best = PALETTE[0]
    var bestCount = Infinity
    PALETTE.forEach(function (color) {
      var count = used[color] || 0
      if (count < bestCount) {
        best = color
        bestCount = count
      }
    })
    return best
  }

  // 旧数据没有颜色字段时补上，避免之后新增习惯导致颜色跳动
  function ensureHabitColors() {
    var habits = store.getHabits()
    var active = H.sortHabits(habits.filter(function (h) {
      return !h.archived
    }))
    var used = {}
    var changed = false

    active.forEach(function (h) {
      if (h.color) {
        used[h.color] = (used[h.color] || 0) + 1
        return
      }
      var best = PALETTE[0]
      var bestCount = Infinity
      PALETTE.forEach(function (color) {
        var count = used[color] || 0
        if (count < bestCount) {
          best = color
          bestCount = count
        }
      })
      h.color = best
      used[best] = (used[best] || 0) + 1
      changed = true
    })

    if (changed) store.saveHabits(habits)
  }

  function hexToRgba(hex, alpha) {
    var n = parseInt(hex.slice(1), 16)
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')'
  }

  // 某个习惯最近 N 天的打卡痕迹
  function lastDays(habit, doneSet, date, count) {
    var result = []
    for (var i = count - 1; i >= 0; i--) {
      var d = D.addDays(date, -i)
      var due = H.isDue(habit, d)
      result.push({ due: due, done: due && doneSet.has(H.keyOf(habit.id, d)) })
    }
    return result
  }

  function toast(message) {
    toastEl.textContent = message
    toastEl.classList.add('show')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('show')
    }, 1800)
  }

  function vibrate() {
    if (navigator.vibrate) navigator.vibrate(8)
  }

  /* ---------- 今日 ---------- */

  function habitCard(habit, done, doneSet, date, color) {
    var days = lastDays(habit, doneSet, date, 10)
    var dots = days.map(function (day) {
      return '<i class="seg' + (day.done ? ' on' : (day.due ? ' due' : '')) + '"></i>'
    }).join('')

    return '<button class="habit-card' + (done ? ' is-done' : '') + '" data-action="toggle" data-id="' + habit.id + '" ' +
      'aria-pressed="' + (done ? 'true' : 'false') + '" aria-label="' + esc(habit.name) + (done ? '，已完成' : '，未完成') + '" ' +
      'style="--hc:' + color + ';--hcs:' + hexToRgba(color, .13) + '">' +
      '<span class="habit-main">' +
        '<span class="habit-name">' + esc(habit.name) + '</span>' +
        '<span class="habit-meta"><span class="freq">' + H.freqLabel(habit) + '</span> · ' + H.PRIORITY_LABEL[habit.priority] + '</span>' +
        '<span class="habit-dots">' + dots + '</span>' +
      '</span>' +
      '<span class="habit-state">' +
        '<span class="state-check"></span>' +
      '</span>' +
    '</button>'
  }

  function summaryItem(value, label) {
    return '<span class="summary-item"><span class="summary-value">' + value + '</span>' +
      '<span class="summary-label">' + label + '</span></span>'
  }

  function renderToday() {
    var date = D.today()
    var active = activeHabits()
    var doneSet = makeDoneSet()
    var isDone = function (h) {
      return doneSet.has(H.keyOf(h.id, date))
    }

    var due = H.sortHabits(active.filter(function (h) {
      return H.isDue(h, date)
    }))
    var required = due.filter(function (h) {
      return h.priority === 0
    })
    var requiredDone = required.filter(isDone).length
    var doneCount = due.filter(isDone).length
    var streak = H.calcStreak(active, doneSet, date)

    var filtered = state.filter === 'all'
      ? due
      : due.filter(function (h) {
        return h.priority === Number(state.filter)
      })
    var colors = buildColorMap()

    var html = '<div class="page-head">' +
      '<h1 class="page-title">今天</h1>' +
      '<p class="page-subtitle">' + D.formatHeader(date) + '</p>' +
    '</div>'

    if (active.length) {
      html += '<div class="chips">'
      FILTERS.forEach(function (f) {
        html += '<button class="chip' + (state.filter === f.value ? ' active' : '') + '" data-action="filter" data-value="' + f.value + '" ' +
          'aria-pressed="' + (state.filter === f.value ? 'true' : 'false') + '">' + f.label + '</button>'
      })
      html += '</div>'
    }

    if (due.length) {
      html += '<div class="summary">' +
        summaryItem(required.length ? requiredDone + '/' + required.length : '—', '今日必做') +
        '<i class="summary-divider"></i>' +
        summaryItem(streak, '连续天数') +
        '<i class="summary-divider"></i>' +
        summaryItem(doneCount + '/' + due.length, '今日完成') +
      '</div>'
    }

    filtered.forEach(function (h) {
      html += habitCard(h, isDone(h), doneSet, date, colors[h.id])
    })

    if (!active.length) {
      html += '<div class="empty-state">' +
        '<div class="empty-state-title">还没有习惯</div>' +
        '<div class="empty-state-desc">先添加一个，从今天开始记录</div>' +
        '<button class="empty-state-action" data-action="new">去添加</button>' +
      '</div>'
    } else if (!due.length) {
      html += '<div class="empty-state">' +
        '<div class="empty-state-title">今天没有需要打卡的习惯</div>' +
        '<div class="empty-state-desc">休息一下，或者去调整习惯频率</div>' +
      '</div>'
    } else if (!filtered.length) {
      html += '<div class="empty-state">' +
        '<div class="empty-state-title">这个分类还没有习惯</div>' +
        '<div class="empty-state-desc">换一个分类看看</div>' +
      '</div>'
    }

    views.today.innerHTML = html
  }

  /* ---------- 习惯 ---------- */

  function renderHabits() {
    var habits = H.sortHabits(activeHabits())
    var required = habits.filter(function (h) {
      return h.priority === 0
    }).length

    var html = '<div class="page-head">' +
      '<h1 class="page-title">习惯</h1>' +
      '<p class="page-subtitle">' + (habits.length
        ? '共 ' + habits.length + ' 个 · 必做 ' + required + '/' + C.MAX_REQUIRED_HABITS
        : '先添加一个想坚持的习惯') + '</p>' +
    '</div>'

    if (habits.length) {
      html += '<div class="stack">'
      var colors = buildColorMap()
      habits.forEach(function (h) {
        var color = colors[h.id]
        html += '<button class="habit-row" data-action="edit" data-id="' + h.id + '" ' +
          'style="--hc:' + color + ';--hcs:' + hexToRgba(color, .13) + '">' +
          '<span class="row-icon">' + esc(Array.from(h.name)[0] || '·') + '</span>' +
          '<span class="row-body">' +
            '<span class="row-title">' + esc(h.name) + '</span>' +
            '<span class="row-meta">' + H.freqLabel(h) + ' · ' + H.PRIORITY_LABEL[h.priority] + '</span>' +
          '</span>' +
          '<span class="chevron"></span>' +
        '</button>'
      })
      html += '</div>'
    } else {
      html += '<div class="empty-state">' +
        '<div class="empty-state-title">还没有习惯</div>' +
        '<div class="empty-state-desc">建议从 1 个必做习惯开始</div>' +
      '</div>'
    }

    html += '<button class="btn-primary add-btn" data-action="new">添加习惯</button>'

    if (state.installPrompt) {
      html += '<button class="btn-ghost" data-action="install">安装到主屏幕</button>'
    }

    html += '<div class="footnote">数据只保存在本机浏览器，不上传云端</div>'

    views.habits.innerHTML = html
  }

  /* ---------- 统计 ---------- */

  function statCard(value, label) {
    return '<div class="stat-card"><div class="stat-value">' + value + '</div><div class="stat-label">' + label + '</div></div>'
  }

  function renderStats() {
    var todayStr = D.today()
    var base = D.parseDate(todayStr)
    var year = state.year
    var month = state.month
    var isCurrentMonth = year === base.getFullYear() && month === base.getMonth() + 1

    var active = activeHabits()
    var checkins = store.getCheckins()
    var doneSet = makeDoneSet()
    var prefix = D.monthPrefix(year, month)

    var monthCheckins = checkins.filter(function (c) {
      return c.date.indexOf(prefix) === 0
    }).length

    var firstWeekday = new Date(year, month - 1, 1).getDay()
    var totalDays = D.daysInMonth(year, month)
    var cells = []
    var i

    for (i = 0; i < firstWeekday; i++) {
      cells.push({ day: 0, status: 'blank' })
    }

    var requiredTotal = 0
    var requiredDone = 0
    var normalTotal = 0
    var normalDone = 0

    for (var d = 1; d <= totalDays; d++) {
      var dateStr = year + '-' + D.pad2(month) + '-' + D.pad2(d)
      var isFuture = dateStr > todayStr
      var status = 'future'

      if (!isFuture) {
        var required = active.filter(function (h) {
          return h.priority === 0 && H.isDue(h, dateStr)
        })
        var doneRequired = required.filter(function (h) {
          return doneSet.has(H.keyOf(h.id, dateStr))
        }).length

        requiredTotal += required.length
        requiredDone += doneRequired

        var normal = active.filter(function (h) {
          return h.priority === 1 && H.isDue(h, dateStr)
        })
        normalTotal += normal.length
        normalDone += normal.filter(function (h) {
          return doneSet.has(H.keyOf(h.id, dateStr))
        }).length

        if (!required.length) {
          status = 'nodue'
        } else if (doneRequired === required.length) {
          status = 'done'
        } else if (doneRequired > 0) {
          status = 'partial'
        } else {
          status = 'missed'
        }
      }

      cells.push({
        day: d,
        status: status,
        isToday: dateStr === todayStr
      })
    }

    var html = '<div class="page-head">' +
      '<h1 class="page-title">统计</h1>' +
    '</div>'

    html += '<div class="month-nav">' +
      '<button class="month-btn prev" data-action="prev-month" aria-label="上个月"></button>' +
      '<span class="month-label">' + year + '年' + month + '月</span>' +
      '<button class="month-btn next" data-action="next-month"' + (isCurrentMonth ? ' disabled' : '') + ' aria-label="下个月"></button>' +
    '</div>'

    html += '<div class="calendar">' +
      '<div class="week-row">' +
        ['日', '一', '二', '三', '四', '五', '六'].map(function (w) {
          return '<span class="week-cell">' + w + '</span>'
        }).join('') +
      '</div>' +
      '<div class="day-grid">'

    cells.forEach(function (cell) {
      if (!cell.day) {
        html += '<div class="day-cell"></div>'
        return
      }
      html += '<div class="day-cell"><span class="day ' + cell.status + (cell.isToday ? ' today' : '') + '">' + cell.day + '</span></div>'
    })

    html += '</div>' +
      '<div class="legend">' +
        '<span class="legend-item"><span class="dot done"></span>全部完成</span>' +
        '<span class="legend-item"><span class="dot partial"></span>部分完成</span>' +
        '<span class="legend-item"><span class="dot missed"></span>未完成</span>' +
      '</div>' +
    '</div>'

    html += '<div class="stat-grid">' +
      statCard(requiredTotal ? Math.round(requiredDone * 100 / requiredTotal) + '%' : '—', '必做完成率') +
      statCard(normalTotal ? Math.round(normalDone * 100 / normalTotal) + '%' : '—', '常规完成率') +
      statCard(H.calcStreak(active, doneSet, todayStr), '当前连续') +
      statCard(H.calcMaxStreak(active, doneSet, todayStr), '最长连续') +
    '</div>' +
    '<div class="footnote">当月共完成 ' + monthCheckins + ' 次打卡</div>'

    views.stats.innerHTML = html
  }

  /* ---------- 编辑 ---------- */

  function renderEdit() {
    var draft = state.draft
    if (!draft) return

    var required = H.requiredCount(activeHabits(), draft.id || '')
    var html = '<div class="edit-head">' +
      '<button class="back-btn" data-action="back" aria-label="返回">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"></path></svg>' +
      '</button>' +
      '<h1 class="page-title">' + (draft.id ? '编辑习惯' : '添加习惯') + '</h1>' +
    '</div>'

    html += '<div class="field">' +
      '<div class="field-label">名称</div>' +
      '<input class="input" id="habit-name" maxlength="12" placeholder="例如：晨跑、阅读、早睡" value="' + esc(draft.name) + '">' +
    '</div>'

    html += '<div class="field">' +
      '<div class="field-label">优先级</div>'
    C.PRIORITIES.forEach(function (p) {
      html += '<button class="priority' + (draft.priority === p.value ? ' active' : '') + '" data-action="priority" data-value="' + p.value + '">' +
        '<span class="priority-name">' + p.label + '</span>' +
        '<span class="priority-desc">' + p.desc + '</span>' +
        '<span class="radio"></span>' +
      '</button>'
    })
    if (draft.priority === 0) {
      html += '<div class="field-hint">必做最多 ' + C.MAX_REQUIRED_HABITS + ' 个，其他必做已有 ' + required + ' 个</div>'
    }
    html += '</div>'

    html += '<div class="field">' +
      '<div class="field-label">频率</div>' +
      '<div class="segment">'

    ;[
      { value: 'daily', label: '每天' },
      { value: 'weekdays', label: '指定星期' },
      { value: 'interval', label: '隔 N 天' }
    ].forEach(function (f) {
      html += '<button class="segment-item' + (draft.freqType === f.value ? ' active' : '') + '" data-action="freq" data-value="' + f.value + '">' + f.label + '</button>'
    })

    html += '</div>'

    if (draft.freqType === 'weekdays') {
      html += '<div class="weekdays">'
      C.WEEKDAYS.forEach(function (w) {
        html += '<button class="weekday' + (draft.weekdays.indexOf(w.value) >= 0 ? ' active' : '') + '" data-action="weekday" data-value="' + w.value + '">' + w.label + '</button>'
      })
      html += '</div>'
    }

    if (draft.freqType === 'interval') {
      html += '<div class="interval-row">' +
        '<span>每</span>' +
        '<button class="step" data-action="interval" data-delta="-1">-</button>' +
        '<span class="interval-num">' + draft.intervalDays + '</span>' +
        '<button class="step" data-action="interval" data-delta="1">+</button>' +
        '<span>天打卡一次</span>' +
      '</div>'
    }

    html += '</div>'

    html += '<div class="actions">' +
      '<button class="btn-primary" data-action="save">保存</button>' +
      (draft.id ? '<button class="btn-danger" data-action="delete">删除习惯</button>' : '') +
    '</div>'

    views.edit.innerHTML = html
  }

  /* ---------- 视图切换 ---------- */

  function showView(name) {
    Object.keys(views).forEach(function (key) {
      views[key].classList.toggle('active', key === name)
    })
    tabbar.classList.toggle('hidden', name === 'edit')
    document.querySelectorAll('.tab').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.tab === state.tab && name !== 'edit')
    })
    window.scrollTo(0, 0)
  }

  function switchTab(tab) {
    state.tab = tab
    if (tab === 'today') renderToday()
    if (tab === 'habits') renderHabits()
    if (tab === 'stats') renderStats()
    showView(tab)
  }

  function openEdit(id) {
    var habit = null
    if (id) {
      habit = store.getHabits().find(function (h) {
        return h.id === id
      }) || null
    }
    var freq = (habit && habit.freq) || { type: 'daily' }

    state.editReturn = state.tab
    state.draft = {
      id: habit ? habit.id : '',
      name: habit ? habit.name : '',
      priority: habit ? habit.priority : 1,
      freqType: freq.type || 'daily',
      weekdays: (freq.weekdays || [1, 2, 3, 4, 5]).slice(),
      intervalDays: freq.intervalDays || 2,
      original: habit
    }
    renderEdit()
    showView('edit')
  }

  function closeEdit() {
    state.draft = null
    showView(state.editReturn)
    if (state.editReturn === 'today') renderToday()
    if (state.editReturn === 'habits') renderHabits()
    if (state.editReturn === 'stats') renderStats()
  }

  function saveDraft() {
    var draft = state.draft
    if (!draft) return

    var name = draft.name.trim()
    if (!name) {
      toast('请输入习惯名称')
      return
    }
    if (draft.freqType === 'weekdays' && !draft.weekdays.length) {
      toast('至少选择一天')
      return
    }

    var active = activeHabits()
    if (draft.priority === 0 && H.requiredCount(active, draft.id || '') >= C.MAX_REQUIRED_HABITS) {
      toast('必做最多 ' + C.MAX_REQUIRED_HABITS + ' 个')
      return
    }

    var now = Date.now()
    var freq = { type: draft.freqType }
    if (draft.freqType === 'weekdays') freq.weekdays = draft.weekdays
    if (draft.freqType === 'interval') freq.intervalDays = draft.intervalDays

    var habit
    if (draft.original) {
      habit = Object.assign({}, draft.original, {
        name: name,
        priority: draft.priority,
        freq: freq,
        updatedAt: now
      })
    } else {
      habit = {
        id: store.uid(),
        name: name,
        priority: draft.priority,
        freq: freq,
        color: pickColor(active),
        archived: false,
        startDate: D.today(),
        sort: now,
        createdAt: now,
        updatedAt: now
      }
    }

    store.upsertHabit(habit)
    toast('已保存')
    closeEdit()
  }

  function openModal(html) {
    modal.innerHTML = '<div class="modal-card">' + html + '</div>'
    modal.hidden = false
    document.body.classList.add('modal-open')
  }

  function closeModal() {
    modal.hidden = true
    modal.innerHTML = ''
    document.body.classList.remove('modal-open')
  }

  function askDelete() {
    var draft = state.draft
    if (!draft || !draft.id) return
    openModal(
      '<div class="modal-title">删除习惯</div>' +
      '<div class="modal-desc">会同时删除它的所有打卡记录，确定吗？</div>' +
      '<div class="modal-actions">' +
        '<button class="modal-btn ghost" data-action="modal-cancel">取消</button>' +
        '<button class="modal-btn danger" data-action="modal-confirm">删除</button>' +
      '</div>'
    )
  }

  function confirmDelete() {
    var draft = state.draft
    if (!draft || !draft.id) return
    store.deleteHabit(draft.id)
    closeModal()
    state.draft = null
    toast('已删除')
    showView(state.editReturn)
    if (state.editReturn === 'today') renderToday()
    if (state.editReturn === 'habits') renderHabits()
    if (state.editReturn === 'stats') renderStats()
  }

  /* ---------- 事件 ---------- */

  document.addEventListener('click', function (e) {
    var target = e.target.closest('[data-action]')
    if (!target) return
    var action = target.dataset.action

    if (action === 'tab') {
      switchTab(target.dataset.tab)
      return
    }

    if (action === 'filter') {
      state.filter = target.dataset.value
      renderToday()
      return
    }

    if (action === 'toggle') {
      var id = target.dataset.id
      var done = store.toggleCheckin(id, D.today())
      vibrate()
      target.classList.toggle('is-done', done)
      setTimeout(renderToday, 180)
      return
    }

    if (action === 'new') {
      openEdit(null)
      return
    }

    if (action === 'edit') {
      openEdit(target.dataset.id)
      return
    }

    if (action === 'back') {
      closeEdit()
      return
    }

    if (action === 'priority') {
      state.draft.priority = Number(target.dataset.value)
      renderEdit()
      return
    }

    if (action === 'freq') {
      state.draft.freqType = target.dataset.value
      renderEdit()
      return
    }

    if (action === 'weekday') {
      var value = Number(target.dataset.value)
      var index = state.draft.weekdays.indexOf(value)
      if (index >= 0) {
        state.draft.weekdays.splice(index, 1)
      } else {
        state.draft.weekdays.push(value)
      }
      renderEdit()
      return
    }

    if (action === 'interval') {
      var delta = Number(target.dataset.delta)
      state.draft.intervalDays = Math.min(30, Math.max(2, state.draft.intervalDays + delta))
      renderEdit()
      return
    }

    if (action === 'save') {
      saveDraft()
      return
    }

    if (action === 'delete') {
      askDelete()
      return
    }

    if (action === 'modal-cancel') {
      closeModal()
      return
    }

    if (action === 'modal-confirm') {
      confirmDelete()
      return
    }

    if (action === 'prev-month') {
      state.month -= 1
      if (state.month < 1) {
        state.month = 12
        state.year -= 1
      }
      renderStats()
      return
    }

    if (action === 'next-month') {
      var base = D.parseDate(D.today())
      if (state.year === base.getFullYear() && state.month === base.getMonth() + 1) return
      state.month += 1
      if (state.month > 12) {
        state.month = 1
        state.year += 1
      }
      renderStats()
      return
    }

    if (action === 'install' && state.installPrompt) {
      state.installPrompt.prompt()
      state.installPrompt = null
      renderHabits()
    }
  })

  document.addEventListener('input', function (e) {
    if (e.target.id === 'habit-name' && state.draft) {
      state.draft.name = e.target.value
    }
  })

  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal()
  })

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hidden) closeModal()
  })

  // 同一浏览器多个标签页之间同步数据
  window.addEventListener('storage', function (e) {
    if (e.key && e.key.indexOf('checkin.') !== 0) return
    if (state.draft) return
    if (state.tab === 'today') renderToday()
    if (state.tab === 'habits') renderHabits()
    if (state.tab === 'stats') renderStats()
  })

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault()
    state.installPrompt = e
    if (state.tab === 'habits') renderHabits()
  })

  // 跨天时自动刷新，凌晨 4 点后进入新的一天
  setInterval(function () {
    var nowDate = D.today()
    if (nowDate !== state.currentDate) {
      state.currentDate = nowDate
      if (state.draft) return
      if (state.tab === 'today') renderToday()
      if (state.tab === 'stats') renderStats()
    }
  }, 60000)

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible' || state.draft) return
    if (state.tab === 'today') renderToday()
    if (state.tab === 'stats') renderStats()
  })

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function (err) {
        console.warn('service worker 注册失败', err)
      })
    })
  }

  ensureHabitColors()

  var baseDate = D.parseDate(D.today())
  state.year = baseDate.getFullYear()
  state.month = baseDate.getMonth() + 1
  renderToday()
  showView('today')
})()

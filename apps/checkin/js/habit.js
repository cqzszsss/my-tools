window.CheckinHabit = (function () {
  var C = window.CONFIG
  var D = window.CheckinDate

  var PRIORITY_LABEL = {}
  C.PRIORITIES.forEach(function (item) {
    PRIORITY_LABEL[item.value] = item.label
  })

  function keyOf(habitId, date) {
    return habitId + '|' + date
  }

  // 某天是否需要打卡
  function isDue(habit, date) {
    if (!habit || habit.archived) return false
    if (habit.startDate && date < habit.startDate) return false

    var freq = habit.freq || { type: 'daily' }
    if (freq.type === 'weekdays') {
      return (freq.weekdays || []).indexOf(D.weekdayIndex(date)) >= 0
    }
    if (freq.type === 'interval') {
      var n = Math.max(2, Number(freq.intervalDays) || 2)
      var start = habit.startDate || date
      return D.diffDays(start, date) % n === 0
    }
    return freq.type === 'daily'
  }

  function sortHabits(habits) {
    return habits.slice().sort(function (a, b) {
      return (a.priority - b.priority) ||
        ((a.sort || 0) - (b.sort || 0)) ||
        ((a.createdAt || 0) - (b.createdAt || 0))
    })
  }

  function requiredDue(habits, date) {
    return habits.filter(function (h) {
      return h.priority === 0 && isDue(h, date)
    })
  }

  function isQualifiedDay(habits, doneSet, date) {
    var required = requiredDue(habits, date)
    if (!required.length) return false
    return required.every(function (h) {
      return doneSet.has(keyOf(h.id, date))
    })
  }

  function earliestStart(habits) {
    var earliest = null
    habits.forEach(function (h) {
      if (h.startDate && (earliest === null || h.startDate < earliest)) {
        earliest = h.startDate
      }
    })
    return earliest
  }

  // 今天尚未达标时从昨天开始算，避免早上打开就显示 0
  function calcStreak(habits, doneSet, todayStr) {
    var hasRequired = habits.some(function (h) {
      return !h.archived && h.priority === 0
    })
    if (!hasRequired) return 0

    var earliest = earliestStart(habits)
    var cursor = todayStr
    if (!isQualifiedDay(habits, doneSet, cursor)) {
      cursor = D.addDays(cursor, -1)
    }

    var streak = 0
    for (var i = 0; i < 3650; i++) {
      if (earliest && cursor < earliest) break
      var required = requiredDue(habits, cursor)
      if (required.length) {
        var done = required.every(function (h) {
          return doneSet.has(keyOf(h.id, cursor))
        })
        if (!done) break
        streak += 1
      }
      cursor = D.addDays(cursor, -1)
    }
    return streak
  }

  function calcMaxStreak(habits, doneSet, todayStr) {
    var active = habits.filter(function (h) {
      return !h.archived
    })
    if (!active.length) return 0
    if (!active.some(function (h) {
      return h.priority === 0
    })) return 0

    var starts = active.map(function (h) {
      return h.startDate
    }).filter(Boolean).sort()
    var cursor = starts.length ? starts[0] : todayStr

    var best = 0
    var current = 0
    for (var i = 0; i < 3650 && cursor <= todayStr; i++) {
      var required = requiredDue(active, cursor)
      if (required.length) {
        var done = required.every(function (h) {
          return doneSet.has(keyOf(h.id, cursor))
        })
        if (done) {
          current += 1
          if (current > best) best = current
        } else {
          current = 0
        }
      }
      cursor = D.addDays(cursor, 1)
    }
    return best
  }

  function freqLabel(habit) {
    var freq = habit.freq || { type: 'daily' }
    if (freq.type === 'weekdays') {
      var selected = C.WEEKDAYS.filter(function (w) {
        return (freq.weekdays || []).indexOf(w.value) >= 0
      })
      if (selected.length === 7) return '每天'
      if (!selected.length) return '未设置'
      return '每周' + selected.map(function (w) {
        return w.label
      }).join('、')
    }
    if (freq.type === 'interval') {
      return '每 ' + (Number(freq.intervalDays) || 2) + ' 天'
    }
    return '每天'
  }

  function requiredCount(habits, excludeId) {
    return habits.filter(function (h) {
      return h.priority === 0 && !h.archived && h.id !== excludeId
    }).length
  }

  return {
    PRIORITY_LABEL: PRIORITY_LABEL,
    keyOf: keyOf,
    isDue: isDue,
    sortHabits: sortHabits,
    requiredDue: requiredDue,
    isQualifiedDay: isQualifiedDay,
    calcStreak: calcStreak,
    calcMaxStreak: calcMaxStreak,
    freqLabel: freqLabel,
    requiredCount: requiredCount
  }
})()

window.CheckinStore = (function () {
  var HABITS_KEY = 'checkin.habits.v1'
  var CHECKINS_KEY = 'checkin.checkins.v1'

  function safeGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : fallback
    } catch (e) {
      return fallback
    }
  }

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch (e) {
      console.error('storage write failed', key, e)
      return false
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  }

  function getHabits() {
    var list = safeGet(HABITS_KEY, [])
    return Array.isArray(list) ? list : []
  }

  function saveHabits(habits) {
    return safeSet(HABITS_KEY, habits)
  }

  function getCheckins() {
    var list = safeGet(CHECKINS_KEY, [])
    return Array.isArray(list) ? list : []
  }

  function saveCheckins(checkins) {
    return safeSet(CHECKINS_KEY, checkins)
  }

  function upsertHabit(habit) {
    var list = getHabits()
    var index = -1
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === habit.id) {
        index = i
        break
      }
    }
    if (index >= 0) {
      list[index] = habit
    } else {
      list.push(habit)
    }
    saveHabits(list)
    return habit
  }

  function deleteHabit(id) {
    saveHabits(getHabits().filter(function (h) {
      return h.id !== id
    }))
    saveCheckins(getCheckins().filter(function (c) {
      return c.habitId !== id
    }))
  }

  // 返回切换后的状态：true 表示已打卡
  function toggleCheckin(habitId, date) {
    var list = getCheckins()
    var index = -1
    for (var i = 0; i < list.length; i++) {
      if (list[i].habitId === habitId && list[i].date === date) {
        index = i
        break
      }
    }

    if (index >= 0) {
      list.splice(index, 1)
      saveCheckins(list)
      return false
    }

    var habit = getHabits().find(function (h) {
      return h.id === habitId
    })
    list.push({
      id: uid(),
      habitId: habitId,
      date: date,
      prioritySnapshot: habit ? habit.priority : 1,
      source: 'manual',
      createdAt: Date.now()
    })
    saveCheckins(list)
    return true
  }

  return {
    uid: uid,
    getHabits: getHabits,
    saveHabits: saveHabits,
    getCheckins: getCheckins,
    saveCheckins: saveCheckins,
    upsertHabit: upsertHabit,
    deleteHabit: deleteHabit,
    toggleCheckin: toggleCheckin
  }
})()

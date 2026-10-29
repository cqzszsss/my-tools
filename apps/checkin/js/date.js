window.CheckinDate = (function () {
  var DAY_START_HOUR = 4
  var WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']

  function pad2(n) {
    return n < 10 ? '0' + n : String(n)
  }

  function formatDate(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate())
  }

  // 以凌晨 4 点为分界：0:00-3:59 仍算前一天
  function today(now) {
    var d = now ? new Date(now) : new Date()
    if (d.getHours() < DAY_START_HOUR) {
      d.setDate(d.getDate() - 1)
    }
    return formatDate(d)
  }

  function parseDate(str) {
    var parts = String(str).split('-')
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  }

  function addDays(str, n) {
    var d = parseDate(str)
    d.setDate(d.getDate() + n)
    return formatDate(d)
  }

  function diffDays(from, to) {
    return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86400000)
  }

  function weekdayIndex(str) {
    return parseDate(str).getDay()
  }

  function weekdayLabel(str) {
    return '周' + WEEKDAY_NAMES[weekdayIndex(str)]
  }

  function formatHeader(str) {
    var d = parseDate(str)
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + weekdayLabel(str)
  }

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate()
  }

  function monthPrefix(year, month) {
    return year + '-' + pad2(month)
  }

  return {
    DAY_START_HOUR: DAY_START_HOUR,
    pad2: pad2,
    formatDate: formatDate,
    today: today,
    parseDate: parseDate,
    addDays: addDays,
    diffDays: diffDays,
    weekdayIndex: weekdayIndex,
    weekdayLabel: weekdayLabel,
    formatHeader: formatHeader,
    daysInMonth: daysInMonth,
    monthPrefix: monthPrefix
  }
})()

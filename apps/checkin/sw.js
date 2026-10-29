var CACHE_NAME = 'checkin-v8'

var ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/date.js',
  './js/habit.js',
  './js/store.js',
  './js/app.js',
  './js/sync.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
]

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS)
    }).then(function () {
      return self.skipWaiting()
    })
  )
})

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key !== CACHE_NAME
      }).map(function (key) {
        return caches.delete(key)
      }))
    }).then(function () {
      return self.clients.claim()
    })
  )
})

self.addEventListener('fetch', function (event) {
  var request = event.request
  if (request.method !== 'GET' || request.url.indexOf('http') !== 0) return

  // 联网时优先取最新文件，离线时回退到缓存，避免更新后一直用旧版本
  event.respondWith(
    fetch(request).then(function (response) {
      if (response && response.status === 200 && response.type === 'basic') {
        var copy = response.clone()
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(request, copy)
        })
      }
      return response
    }).catch(function () {
      return caches.match(request).then(function (cached) {
        if (cached) return cached
        if (request.mode === 'navigate') return caches.match('./index.html')
        return new Response('', { status: 504, statusText: 'Offline' })
      })
    })
  )
})

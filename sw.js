// 工具入口页的离线缓存：联网优先，失败回退缓存
const CACHE = 'toolbox-v1'
const PRECACHE = [
  './',
  './manifest.webmanifest',
  './apps/checkin/icons/icon-192.png',
  './apps/checkin/icons/icon-512.png'
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('toolbox-') && key !== CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== location.origin) return

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone()
          caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {})
        }
        return response
      })
      .catch(() =>
        caches.match(request).then(hit => {
          if (hit) return hit
          if (request.mode === 'navigate') return caches.match('./index.html')
          return new Response('', { status: 504, statusText: 'Offline' })
        })
      )
  )
})

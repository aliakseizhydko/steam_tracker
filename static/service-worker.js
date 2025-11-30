const CACHE_VERSION = 'core-v5';
const STATIC_CACHE_NAME = CACHE_VERSION + '_static';
const API_CACHE_NAME = CACHE_VERSION + '_api';

const coreAssets = [
    '/',
    '/week',
    '/achievements',
    '/friends',
    '/profile',
    '/static/manifest.json',
    '/static/css/components/loaders.css',
    '/static/pics/icon0.png',
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/chart.js',
    '/static/js/pages/friends.js',
    '/static/js/pages/week.js',
    '/static/js/pages/index.js',
];

self.addEventListener('install', event => {
    console.log(`[ServiceWorker] Installing v${CACHE_VERSION}. Caching App Shell.`);
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then(cache => {
                return cache.addAll(coreAssets);
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    console.log(`[ServiceWorker] Activated v${CACHE_VERSION}. Clearing old caches.`);
    event.waitUntil(
        caches.keys().then(keyList => {
            return Promise.all(keyList.map(key => {
                if (key !== STATIC_CACHE_NAME && key !== API_CACHE_NAME) {
                    console.log('[ServiceWorker] Removing old cache:', key);
                    return caches.delete(key);
                }
            }));
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    if (url.origin !== location.origin) return;
    if (url.pathname.startsWith('/api/')) return;
    if (url.pathname.startsWith('/static/service-worker')) return;

    if (event.request.mode === 'navigate') {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request).then(networkResponse => {
                    if (networkResponse.ok) {
                        caches.open(STATIC_CACHE_NAME).then(cache => {
                            cache.put(event.request, networkResponse.clone());
                        });
                    }
                    return networkResponse;
                });
            }).catch(() => {
                return caches.match('/');
            })
        );
        return;
    }

    if (url.pathname.startsWith('/static/') || coreAssets.some(asset => url.pathname === asset || url.href === asset)) {
        event.respondWith(
            caches.match(event.request).then(response => response || fetch(event.request))
        );
    }
});

self.addEventListener("push", (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || "Steam Tracker";
    const options = {
        body: data.body || "No message",
        icon: data.icon || "/static/pics/icon0.png",
        badge: "/static/pics/icon0.png",
        vibrate: [200, 100, 200],
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow("/")
    );
});
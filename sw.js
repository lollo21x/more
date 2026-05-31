const CACHE_NAME = 'more-v7.9';

const CORE_ASSETS = [
    './',
    './index.html',
    './questpool.js?v=2',
    './manifest.json?v=7',
    'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js'
];

const OPTIONAL_ASSETS = [
    './icons/logo.png',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-192.png',
    './icons/icon-maskable-512.png',
    './icons/icon-152.png',
    './icons/icon-167.png',
    './icons/apple-touch-icon.png'
];

const API_HOSTS = new Set([
    'api.github.com',
    'firestore.googleapis.com',
    'firebaseinstallations.googleapis.com',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    'www.googleapis.com',
    'accounts.google.com',
    'apis.google.com'
]);

function isApiRequest(url) {
    return API_HOSTS.has(url.hostname);
}

function isNavigationRequest(request, url) {
    return request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
}

function isAppCodeRequest(url) {
    return url.origin === self.location.origin
        && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('/manifest.json'));
}

async function putOkResponse(request, response) {
    if (!response || (!response.ok && response.type !== 'opaque')) return;
    try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
    } catch (error) {
        // Quota/private-mode failures should never break the response path.
    }
}

async function matchAppShell() {
    return await caches.match('./index.html') || await caches.match('./');
}

async function networkFirst(request, preloadPromise) {
    try {
        let response = preloadPromise ? await preloadPromise.catch(() => null) : null;
        if (!response) response = await fetch(request);
        await putOkResponse(request, response);
        return response;
    } catch (error) {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
            const shell = await matchAppShell();
            if (shell) return shell;
        }
        throw error;
    }
}

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    await putOkResponse(request, response);
    return response;
}

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await Promise.allSettled(CORE_ASSETS.map((asset) => cache.add(asset)));
        await Promise.allSettled(OPTIONAL_ASSETS.map((asset) => cache.add(asset)));
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        if (self.registration.navigationPreload) {
            await self.registration.navigationPreload.enable();
        }

        const keys = await caches.keys();
        await Promise.all(
            keys
                .filter((key) => key !== CACHE_NAME)
                .map((key) => caches.delete(key))
        );

        await clients.claim();
    })());
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    if (!url.protocol.startsWith('http')) return;

    if (isApiRequest(url)) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Firebase Auth redirect handler — must never be cached
    if (url.pathname.startsWith('/__/auth/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    if (isNavigationRequest(event.request, url) || isAppCodeRequest(url)) {
        event.respondWith(networkFirst(event.request, event.preloadResponse));
        return;
    }

    event.respondWith(cacheFirst(event.request));
});

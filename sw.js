const CACHE_NAME = 'more-v7.9.4';

const CORE_ASSETS = [
    './',
    './index.html',
    './questpool.js?v=2',
    './manifest.json?v=7',
    'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Syne:wght@700;800&display=swap'
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

// Firebase API hosts — use Network First with cache fallback
const FIREBASE_API_HOSTS = new Set([
    'firestore.googleapis.com',
    'firebaseinstallations.googleapis.com',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    'www.googleapis.com',
    'accounts.google.com',
    'apis.google.com'
]);

// Hosts that must always go to network (no caching)
const PASSTHROUGH_HOSTS = new Set([
    'api.github.com',
    'www.googletagmanager.com',
    'www.google-analytics.com',
    'analytics.google.com'
]);

function isFirebaseApiRequest(url) {
    return FIREBASE_API_HOSTS.has(url.hostname);
}

function isPassthroughRequest(url) {
    return PASSTHROUGH_HOSTS.has(url.hostname);
}

function isNavigationRequest(request, url) {
    return request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
}

function isAppCodeRequest(url) {
    return url.origin === self.location.origin
        && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('/manifest.json'));
}

/**
 * Detect immutable CDN static assets (font files, versioned JS/CSS)
 * that can safely be served Cache First forever.
 */
function isCdnStaticAsset(url) {
    const host = url.hostname;
    const path = url.pathname;

    // Google Fonts woff2 files
    if (host === 'fonts.gstatic.com' && path.endsWith('.woff2')) return true;

    // Font Awesome woff2 files
    if (host === 'cdnjs.cloudflare.com' && path.includes('/font-awesome/') && (path.endsWith('.woff2') || path.endsWith('.woff') || path.endsWith('.ttf'))) return true;

    // Font Awesome CSS (versioned)
    if (host === 'cdnjs.cloudflare.com' && path.includes('/font-awesome/') && path.endsWith('.css')) return true;

    // Firebase SDK JS (versioned, e.g. /10.8.1/firebase-app.js)
    if (host === 'www.gstatic.com' && path.includes('/firebasejs/') && path.endsWith('.js')) return true;

    // Google Fonts CSS
    if (host === 'fonts.googleapis.com' && path.startsWith('/css')) return true;

    return false;
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

/**
 * Cache First: serve from cache, fall back to network.
 * Used for static and immutable resources.
 */
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        await putOkResponse(request, response);
        return response;
    } catch (error) {
        // If offline and nothing in cache, return empty fallback
        return createEmptyFallback(request);
    }
}

/**
 * Cache First with background update for navigation (app shell).
 * Serves cached version immediately, then updates cache in background.
 * Avoids iOS PWA white-screen on slow networks.
 */
async function cacheFirstWithUpdate(request, preloadPromise) {
    const cached = await caches.match(request) || await matchAppShell();
    if (cached) {
        // Update in background for next visit
        const updateCache = async () => {
            try {
                let response = preloadPromise ? await preloadPromise.catch(() => null) : null;
                if (!response) response = await fetch(request);
                await putOkResponse(request, response);
            } catch (e) {
                // Network unavailable — no problem, we served from cache
            }
        };
        // Fire and forget
        updateCache();
        return cached;
    }
    // Nothing in cache: must go to network
    try {
        let response = preloadPromise ? await preloadPromise.catch(() => null) : null;
        if (!response) response = await fetch(request);
        await putOkResponse(request, response);
        return response;
    } catch (error) {
        // Completely offline, no cache — return minimal HTML shell
        return new Response(
            '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#0a0a0f;color:#f0f0f5;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><p>Offline — ricarica quando hai connessione.</p></body></html>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=UTF-8' } }
        );
    }
}

/**
 * Network First: try network, fall back to cache.
 * Used for Firebase API requests.
 */
async function networkFirst(request) {
    try {
        const response = await fetch(request);
        await putOkResponse(request, response);
        return response;
    } catch (error) {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw error;
    }
}

/**
 * Create an empty but valid response for offline CDN misses.
 * Prevents SW from crashing when a CDN resource isn't cached and network is down.
 */
function createEmptyFallback(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.endsWith('.css')) {
        return new Response('/* offline — no cached version */', {
            status: 200,
            headers: { 'Content-Type': 'text/css' }
        });
    }
    if (path.endsWith('.js')) {
        return new Response('/* offline — no cached version */', {
            status: 200,
            headers: { 'Content-Type': 'application/javascript' }
        });
    }
    if (path.endsWith('.woff2') || path.endsWith('.woff') || path.endsWith('.ttf')) {
        return new Response(new ArrayBuffer(0), {
            status: 200,
            headers: { 'Content-Type': 'font/woff2' }
        });
    }
    // Generic empty response
    return new Response('', { status: 200 });
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

    // Passthrough: GitHub API, Analytics — always network, never intercept
    if (isPassthroughRequest(url)) return;

    // Firebase Auth redirect handler — must never be cached
    if (url.pathname.startsWith('/__/auth/')) return;

    // Firebase API: Network First with cache fallback
    if (isFirebaseApiRequest(url)) {
        event.respondWith(networkFirst(event.request));
        return;
    }

    // Navigation (index.html): Cache First with background update
    if (isNavigationRequest(event.request, url)) {
        event.respondWith(cacheFirstWithUpdate(event.request, event.preloadResponse));
        return;
    }

    // App code (own JS/CSS/manifest): Cache First
    if (isAppCodeRequest(url)) {
        event.respondWith(cacheFirst(event.request));
        return;
    }

    // CDN static assets (fonts, Firebase SDK, Font Awesome): Cache First
    if (isCdnStaticAsset(url)) {
        event.respondWith(cacheFirst(event.request));
        return;
    }

    // Everything else (images, icons, etc.): Cache First
    event.respondWith(cacheFirst(event.request));
});

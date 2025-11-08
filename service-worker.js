// Health Hero Service Worker v1.0.0
const CACHE_NAME = 'health-hero-v1.0.0';
const RUNTIME_CACHE = 'health-hero-runtime';

// Files to cache on install
const STATIC_CACHE_URLS = [
    './',
    './index.html',
    './manifest.json',
    // Add more static assets as they're created
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
    /health\.gov\/myhealthfinder/,
    /openfoodfacts\.org/
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_CACHE_URLS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Handle API requests with network-first strategy
    if (API_CACHE_PATTERNS.some(pattern => pattern.test(url.href))) {
        event.respondWith(networkFirst(request));
        return;
    }

    // Handle static assets with cache-first strategy
    event.respondWith(cacheFirst(request));
});

// Cache-first strategy (for static assets)
async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    
    if (cached) {
        console.log('[SW] Serving from cache:', request.url);
        return cached;
    }
    
    try {
        const response = await fetch(request);
        
        // Cache successful responses
        if (response.ok) {
            const clone = response.clone();
            cache.put(request, clone);
        }
        
        return response;
    } catch (error) {
        console.error('[SW] Fetch failed:', error);
        
        // Return offline page or fallback
        return new Response('Offline - Please check your connection', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
                'Content-Type': 'text/plain'
            })
        });
    }
}

// Network-first strategy (for API calls)
async function networkFirst(request) {
    const cache = await caches.open(RUNTIME_CACHE);
    
    try {
        const response = await fetch(request);
        
        // Cache successful API responses
        if (response.ok) {
            const clone = response.clone();
            cache.put(request, clone);
        }
        
        return response;
    } catch (error) {
        console.log('[SW] Network failed, serving from cache:', request.url);
        
        const cached = await cache.match(request);
        
        if (cached) {
            return cached;
        }
        
        // No cache available
        return new Response(JSON.stringify({
            error: 'Offline',
            message: 'No cached data available'
        }), {
            status: 503,
            headers: new Headers({
                'Content-Type': 'application/json'
            })
        });
    }
}

// Background sync for future features
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync triggered:', event.tag);
    
    if (event.tag === 'sync-health-tips') {
        event.waitUntil(syncHealthTips());
    }
});

async function syncHealthTips() {
    try {
        const response = await fetch('https://health.gov/myhealthfinder/api/v3/topicsearch.json?lang=en');
        const data = await response.json();
        
        // Store in cache for offline use
        const cache = await caches.open(RUNTIME_CACHE);
        await cache.put('health-tips-latest', new Response(JSON.stringify(data)));
        
        console.log('[SW] Health tips synced successfully');
    } catch (error) {
        console.error('[SW] Sync failed:', error);
    }
}

// Push notifications (for future features)
self.addEventListener('push', (event) => {
    console.log('[SW] Push notification received');
    
    const options = {
        body: event.data ? event.data.text() : 'New health tip available!',
        icon: './assets/icons/icon-192x192.png',
        badge: './assets/icons/icon-72x72.png',
        vibrate: [200, 100, 200],
        tag: 'health-hero-notification',
        actions: [
            { action: 'open', title: 'Open Game' },
            { action: 'close', title: 'Close' }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('Health Hero', options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'open') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Message handler for client communication
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);
    
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data.type === 'CACHE_URLS') {
        event.waitUntil(
            caches.open(RUNTIME_CACHE)
                .then((cache) => cache.addAll(event.data.urls))
        );
    }
    
    if (event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys()
                .then((names) => Promise.all(names.map((name) => caches.delete(name))))
        );
    }
});
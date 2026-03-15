const CACHE_NAME = "health-hero-v3.0.0";
const RUNTIME_CACHE = "health-hero-runtime-v3.0.0";

const STATIC_ASSETS = [
    "./",
    "./index.html",
    "./manifest.json",
    "./assets/css/app.css",
    "./assets/js/content.js",
    "./assets/js/game.js",
    "./assets/js/app.js"
];

self.addEventListener("install", function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function (cache) {
                return cache.addAll(STATIC_ASSETS);
            })
            .then(function () {
                return self.skipWaiting();
            })
    );
});

self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys().then(function (cacheNames) {
            return Promise.all(
                cacheNames
                    .filter(function (cacheName) {
                        return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
                    })
                    .map(function (cacheName) {
                        return caches.delete(cacheName);
                    })
            );
        }).then(function () {
            return self.clients.claim();
        })
    );
});

self.addEventListener("fetch", function (event) {
    const request = event.request;
    const url = new URL(request.url);

    if (request.method !== "GET") {
        return;
    }

    if (url.origin !== self.location.origin) {
        return;
    }

    if (request.mode === "navigate") {
        event.respondWith(handleNavigationRequest(request));
        return;
    }

    event.respondWith(cacheFirst(request));
});

async function handleNavigationRequest(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedIndex = await cache.match("./index.html");

    try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok) {
            cache.put("./index.html", networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        return cachedIndex || new Response("Offline", {
            status: 503,
            statusText: "Offline"
        });
    }
}

async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);

        if (networkResponse && networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        return new Response("Offline", {
            status: 503,
            statusText: "Offline"
        });
    }
}

self.addEventListener("message", function (event) {
    if (!event.data) {
        return;
    }

    if (event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }

    if (event.data.type === "CLEAR_CACHE") {
        event.waitUntil(
            caches.keys().then(function (names) {
                return Promise.all(names.map(function (name) {
                    return caches.delete(name);
                }));
            })
        );
    }
});

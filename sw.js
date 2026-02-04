const CACHE_NAME = 'gracia-divina-v2';  // Incremented version for new changes
const SW_DEBUG_MODE = false;  // Set to false in production

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/css/styles.css',
    '/js/app.js',
    '/js/db.js',
    '/js/firebase-sync-modular.js',  // Added firebase sync file
    '/icons/icon-72x72.png',
    '/icons/icon-96x96.png',
    '/icons/icon-128x128.png',
    '/icons/icon-144x144.png',
    '/icons/icon-152x152.png',
    '/icons/icon-192x192.png',
    '/icons/icon-384x384.png',
    '/icons/icon-512x512.png'
];

// Debug logging utility for Service Worker
const swLog = (...args) => SW_DEBUG_MODE && console.log('[ServiceWorker]', ...args);
const swError = (...args) => console.error('[ServiceWorker]', ...args);

// Install Event - Cache static assets
self.addEventListener('install', event => {
    swLog('Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                swLog('Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                swLog('Install complete');
                return self.skipWaiting();
            })
            .catch(error => {
                swError('Install failed:', error);
            })
    );
});
});

// Activate Event - Clean up old caches
self.addEventListener('activate', event => {
    swLog('Activating...');
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            swLog('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                swLog('Activation complete');
                return self.clients.claim();
            })
    );
});

// Fetch Event - Network first, fallback to cache
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip external requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Clone the response
                const responseClone = response.clone();
                
                // Cache successful responses
                if (response.status === 200) {
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseClone);
                        });
                }
                
                return response;
            })
            .catch(() => {
                // Network failed, try cache
                return caches.match(event.request)
                    .then(response => {
                        if (response) {
                            return response;
                        }
                        
                        // If no cache and it's a navigation request, return index.html
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        
                        // Return a fallback response
                        return new Response('Offline - Contenido no disponible', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({
                                'Content-Type': 'text/plain'
                            })
                        });
                    });
            })
    );
});

// Handle background sync
self.addEventListener('sync', event => {
    swLog('Background sync:', event.tag);
    if (event.tag === 'sync-sales') {
        event.waitUntil(syncSales());
    }
});

// Sync sales data
async function syncSales() {
    // This would sync sales data to a server when online
    // For now, it's a placeholder for future functionality
    swLog('Syncing sales data...');
}

// Handle push notifications
self.addEventListener('push', event => {
    const options = {
        body: event.data ? event.data.text() : 'Nueva notificación de Gracia Divina',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            { action: 'explore', title: 'Ver detalles' },
            { action: 'close', title: 'Cerrar' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('Gracia Divina', options)
    );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

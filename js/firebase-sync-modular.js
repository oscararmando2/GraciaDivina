/**
 * Gracia Divina POS - Firebase Realtime Database Sync (Modular SDK v12.7.0+)
 * Compatible con Windows 7, Mac y móviles
 */

// Firebase modules will be loaded from index.html
let firebaseApp = null;
let firebaseDb = null;
let firebaseAuth = null;
let isLoggedIn = false;
let syncInterval = null;
let currentUserId = null;

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBagLJ4kGy9LepoGqUJ7mirAhC2uflaoAs",
    databaseURL: "https://gracia-divina-c70c6-default-rtdb.firebaseio.com",
    authDomain: "gracia-divina-c70c6.firebaseapp.com",
    projectId: "gracia-divina-c70c6"
};

// Constants
const SYNC_INTERVAL_MS = 10000;  // Sync every 10 seconds
const rootPath = 'graciadivina_ketzy2025';

// Collection mapping: local -> Firebase
const collectionMap = {
    'products': 'productos',
    'sales': 'ventas',
    'layaways': 'apartados',
    'owners': 'duenas',
    'settings': 'config'
};

// Track pending save operations to prevent duplicates
const pendingSaveOperations = {};

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Normalize phone number for comparison
 */
function normalizePhone(phone) {
    if (!phone) return '';
    return phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');
}

/**
 * Normalize name for comparison
 */
function normalizeName(name) {
    if (!name) return '';
    return name.trim().toLowerCase();
}

/**
 * Check if viewport is mobile size
 */
function isMobileViewport() {
    return window.innerWidth <= 768;
}

/**
 * Recalculate layaway totals from payments array
 */
function recalculateLayawayTotals(layaway) {
    if (!layaway) return layaway;
    
    const payments = Array.isArray(layaway.payments) ? layaway.payments : [];
    const totalPaid = payments.reduce((sum, p) => sum + (p && p.amount ? p.amount : 0), 0);
    const total = typeof layaway.total === 'number' ? layaway.total : 0;
    const pendingAmount = Math.max(0, total - totalPaid);
    
    layaway.totalPaid = totalPaid;
    layaway.pendingAmount = pendingAmount;
    
    return layaway;
}

// ========================================
// FIREBASE INITIALIZATION
// ========================================

/**
 * Initialize Firebase with modular SDK
 */
async function initFirebase() {
    try {
        // Wait for Firebase modules to be loaded
        if (!window.firebaseModulesReady) {
            await new Promise((resolve) => {
                window.addEventListener('firebaseModulesReady', resolve, { once: true });
            });
        }

        const modules = window.firebaseModules;
        if (!modules) {
            throw new Error('Firebase modules not available');
        }

        // Initialize Firebase app
        firebaseApp = modules.initializeApp(firebaseConfig);
        firebaseDb = modules.getDatabase(firebaseApp);
        firebaseAuth = modules.getAuth(firebaseApp);

        // Enable offline persistence with multi-tab support
        try {
            await modules.enableMultiTabIndexedDbPersistence(firebaseDb);
            console.log('✓ Firebase offline persistence enabled with multi-tab support');
        } catch (error) {
            console.warn('Offline persistence error (already enabled or not supported):', error.message);
        }

        console.log('✓ Firebase initialized successfully (modular SDK)');
        return true;
    } catch (error) {
        console.error('✗ Error initializing Firebase:', error);
        updateConnectionStatus('offline', 'Error de conexión');
        showFirebaseWarning();
        return false;
    }
}

/**
 * Show warning banner when Firebase is unavailable
 */
function showFirebaseWarning() {
    if (document.getElementById('firebase-warning-banner')) return;
    
    const warningBanner = document.createElement('div');
    warningBanner.id = 'firebase-warning-banner';
    const topPosition = isMobileViewport() ? '56px' : '0';
    
    warningBanner.style.cssText = `position:fixed;top:${topPosition};left:0;right:0;z-index:10000;` +
        'background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);' +
        'color:white;padding:12px 20px;text-align:center;' +
        'box-shadow:0 2px 10px rgba(0,0,0,0.2);font-size:14px;' +
        'display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;';
    
    warningBanner.innerHTML = '⚠️ <span>Sincronización en la nube no disponible. Los datos solo se guardan localmente.</span> ' +
        '<button id="retry-firebase-btn" style="background:white;color:#d97706;border:none;' +
        'padding:6px 12px;border-radius:4px;cursor:pointer;font-weight:600;">Reintentar</button>';
    
    document.body.appendChild(warningBanner);
    
    document.getElementById('retry-firebase-btn').onclick = () => location.reload();
    
    window.addEventListener('resize', () => {
        warningBanner.style.top = isMobileViewport() ? '56px' : '0';
    });
}

/**
 * Update connection status indicator in UI
 */
function updateConnectionStatus(status, message) {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        const statusDot = statusElement.querySelector('.status-dot');
        const statusText = statusElement.querySelector('.status-text');
        
        if (statusDot) {
            statusDot.className = 'status-dot ' + status;
        }
        
        if (statusText) {
            statusText.textContent = message || (status === 'online' ? 'En línea' : 'Sin conexión');
        }
    }
}

// ========================================
// AUTHENTICATION
// ========================================

/**
 * Auto login with anonymous authentication
 */
async function autoLogin() {
    if (!firebaseAuth) {
        console.warn('Firebase Auth not available');
        return;
    }

    try {
        const modules = window.firebaseModules;
        const userCredential = await modules.signInAnonymously(firebaseAuth);
        currentUserId = userCredential.user.uid;
        isLoggedIn = true;
        
        console.log('✓ Anonymous login successful - User ID:', currentUserId);
        updateConnectionStatus('online', 'Conectado a la nube');
        
        // Hide warning banner if exists
        const warningBanner = document.getElementById('firebase-warning-banner');
        if (warningBanner) {
            warningBanner.style.display = 'none';
        }
        
        // Setup real-time listeners and connection monitoring
        setupRealtimeListeners();
        setupConnectionMonitoring();
        startAutoSync();
    } catch (error) {
        console.error('✗ Error in anonymous login:', error.message);
        updateConnectionStatus('offline', 'Error de autenticación');
        showFirebaseWarning();
    }
}

/**
 * Setup authentication state listener
 */
function setupAuthListener() {
    if (!firebaseAuth) return;
    
    const modules = window.firebaseModules;
    modules.onAuthStateChanged(firebaseAuth, (user) => {
        if (user) {
            currentUserId = user.uid;
            isLoggedIn = true;
            console.log('✓ User authenticated:', user.uid);
            setupRealtimeListeners();
            setupConnectionMonitoring();
            startAutoSync();
        } else {
            isLoggedIn = false;
            console.log('User signed out, attempting auto-login...');
            autoLogin();
        }
    });
}

// ========================================
// CONNECTION MONITORING
// ========================================

/**
 * Setup real-time connection monitoring
 */
function setupConnectionMonitoring() {
    if (!firebaseDb) return;
    
    const modules = window.firebaseModules;
    const connectedRef = modules.ref(firebaseDb, '.info/connected');
    
    modules.onValue(connectedRef, (snapshot) => {
        if (snapshot.val() === true) {
            console.log('✓ Connected to Firebase');
            updateConnectionStatus('online', 'En línea');
            
            // Upload pending local data when reconnecting
            uploadLocalData();
        } else {
            console.log('⚠ Disconnected from Firebase');
            updateConnectionStatus('offline', 'Sin conexión');
        }
    });
}

// ========================================
// FIREBASE PATH HELPERS
// ========================================

/**
 * Get full Firebase path for a collection
 */
function getFirebasePath(collection) {
    const firebaseName = collectionMap[collection] || collection;
    return `${rootPath}/${firebaseName}`;
}

// ========================================
// REAL-TIME LISTENERS
// ========================================

/**
 * Setup real-time listeners for all collections
 */
function setupRealtimeListeners() {
    if (!firebaseDb || !isLoggedIn) return;
    
    const modules = window.firebaseModules;
    const collections = ['productos', 'ventas', 'apartados', 'duenas', 'config'];
    
    collections.forEach((col) => {
        const collectionRef = modules.ref(firebaseDb, `${rootPath}/${col}`);
        
        modules.onValue(collectionRef, (snapshot) => {
            const data = snapshot.val();
            if (!data) return;
            
            console.log(`📡 Data received for ${col}:`, Object.keys(data).length, 'items');
            
            // Process each item
            Object.keys(data).forEach((key) => {
                handleRemoteData(col, key, data[key]);
            });
            
            // Reload UI for the affected collection
            reloadUIForCollection(col);
        });
    });
    
    console.log('✓ Real-time listeners configured');
}

/**
 * Reload UI when data changes
 */
function reloadUIForCollection(collection) {
    // Prevent too frequent reloads
    if (window._uiReloadTimeout) {
        clearTimeout(window._uiReloadTimeout);
    }
    
    window._uiReloadTimeout = setTimeout(() => {
        switch (collection) {
            case 'productos':
                if (window.loadProducts && typeof window.loadProducts === 'function') {
                    window.loadProducts();
                }
                break;
            case 'apartados':
                if (window.loadLayaways && typeof window.loadLayaways === 'function') {
                    window.loadLayaways();
                }
                break;
            case 'ventas':
                if (window.loadSalesHistory && typeof window.loadSalesHistory === 'function') {
                    window.loadSalesHistory();
                }
                if (window.updateSalesSummary && typeof window.updateSalesSummary === 'function') {
                    window.updateSalesSummary();
                }
                break;
            case 'duenas':
                if (window.loadOwners && typeof window.loadOwners === 'function') {
                    window.loadOwners();
                }
                break;
            case 'config':
                if (window.loadSettings && typeof window.loadSettings === 'function') {
                    window.loadSettings();
                }
                break;
        }
    }, 1000); // Debounce 1 second
}

/**
 * Handle remote data changes
 */
function handleRemoteData(collection, key, data) {
    if (!db || !db.isReady) return;
    
    let localCollection = null;
    for (const local in collectionMap) {
        if (collectionMap[local] === collection) {
            localCollection = local;
            break;
        }
    }
    
    if (!localCollection) return;
    
    saveToLocal(localCollection, key, data);
}

/**
 * Handle remote deletions
 */
function handleRemoteDelete(collection, firebaseKey) {
    if (!db || !db.isReady) return;
    
    let localCollection = null;
    for (const local in collectionMap) {
        if (collectionMap[local] === collection) {
            localCollection = local;
            break;
        }
    }
    
    if (!localCollection) return;
    
    deleteFromLocal(localCollection, firebaseKey);
}

// ========================================
// LOCAL DATA OPERATIONS
// ========================================

/**
 * Save data to local IndexedDB
 */
async function saveToLocal(collection, firebaseKey, data) {
    if (!db || !db.isReady) return;
    
    try {
        const record = { ...data, firebaseKey };
        
        switch (collection) {
            case 'products':
                const products = await db.getAllProducts();
                const existingProduct = products.find(p => 
                    p.firebaseKey === firebaseKey ||
                    (p.sku && record.sku && p.sku === record.sku) ||
                    (p.name === record.name && p.price === record.price)
                );
                
                if (!existingProduct) {
                    await db.addProduct(record);
                } else if (!existingProduct.firebaseKey) {
                    existingProduct.firebaseKey = firebaseKey;
                    await db.updateProduct(existingProduct);
                }
                break;
                
            case 'sales':
                // Sales are created locally and synced up
                break;
                
            case 'layaways':
                const operationKey = 'layaway_' + firebaseKey;
                if (pendingSaveOperations[operationKey]) {
                    return;
                }
                pendingSaveOperations[operationKey] = true;
                
                const recalculatedRecord = recalculateLayawayTotals(record);
                
                const layaways = await db.getAllLayaways();
                const existingLayaway = layaways.find(l =>
                    l.firebaseKey === firebaseKey ||
                    (l.customerName && record.customerName &&
                     l.customerPhone && record.customerPhone &&
                     normalizeName(l.customerName) === normalizeName(record.customerName) &&
                     normalizePhone(l.customerPhone) === normalizePhone(record.customerPhone) &&
                     l.date && record.date &&
                     new Date(l.date).toDateString() === new Date(record.date).toDateString())
                );
                
                if (existingLayaway) {
                    if (!existingLayaway.firebaseKey) {
                        existingLayaway.firebaseKey = firebaseKey;
                    }
                    
                    let needsUpdate = false;
                    if (record.updatedAt && existingLayaway.updatedAt) {
                        const remoteUpdated = new Date(record.updatedAt);
                        const localUpdated = new Date(existingLayaway.updatedAt);
                        if (!isNaN(remoteUpdated.getTime()) && !isNaN(localUpdated.getTime())) {
                            needsUpdate = remoteUpdated > localUpdated;
                        }
                    } else if (record.updatedAt && !existingLayaway.updatedAt) {
                        needsUpdate = true;
                    }
                    
                    if (record.totalPaid !== existingLayaway.totalPaid ||
                        record.pendingAmount !== existingLayaway.pendingAmount ||
                        record.status !== existingLayaway.status) {
                        needsUpdate = true;
                    }
                    
                    if (needsUpdate) {
                        const updatedLayaway = {
                            ...recalculatedRecord,
                            id: existingLayaway.id,
                            firebaseKey
                        };
                        await db.updateLayaway(updatedLayaway);
                    } else if (!existingLayaway.firebaseKey || existingLayaway.firebaseKey !== firebaseKey) {
                        await db.updateLayaway(existingLayaway);
                    }
                } else {
                    const store = db.getStore('layaways', 'readwrite');
                    await new Promise((resolve, reject) => {
                        const request = store.add(recalculatedRecord);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    });
                }
                
                delete pendingSaveOperations[operationKey];
                break;
                
            case 'owners':
                if (data.name) {
                    const owners = await db.getAllOwners();
                    const exists = owners.find(o => o.name === data.name);
                    if (!exists) {
                        await db.addOwner(data.name);
                    }
                }
                break;
                
            case 'settings':
                if (data.value !== undefined) {
                    await db.saveSetting(firebaseKey, data.value);
                }
                break;
        }
    } catch (error) {
        console.error('Error saving to local:', error);
    }
}

/**
 * Delete data from local IndexedDB
 */
async function deleteFromLocal(collection, firebaseKey) {
    if (!db || !db.isReady) return;
    
    try {
        switch (collection) {
            case 'products':
                const products = await db.getAllProducts();
                const product = products.find(p => p.firebaseKey === firebaseKey);
                if (product && product.id) {
                    await db.deleteProduct(product.id);
                }
                break;
                
            case 'layaways':
                const layaways = await db.getAllLayaways();
                const layaway = layaways.find(l => l.firebaseKey === firebaseKey);
                if (layaway && layaway.id && layaway.status === 'pending') {
                    const store = db.getStore('layaways', 'readwrite');
                    await new Promise((resolve, reject) => {
                        const request = store.delete(layaway.id);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    });
                }
                break;
                
            case 'owners':
                const owners = await db.getAllOwners();
                const owner = owners.find(o => o.firebaseKey === firebaseKey);
                if (owner && owner.id) {
                    await db.deleteOwner(owner.id);
                }
                break;
        }
    } catch (error) {
        console.error('Error deleting from local:', error);
    }
}

// ========================================
// UPLOAD TO FIREBASE
// ========================================

/**
 * Upload local data to Firebase
 */
async function uploadLocalData() {
    if (!firebaseDb || !isLoggedIn || !db || !db.isReady) return;
    
    const modules = window.firebaseModules;
    
    try {
        // Upload products
        const products = await db.getAllProducts();
        for (const product of products) {
            const key = product.firebaseKey || ('local_' + product.id);
            const data = { ...product };
            delete data.id;
            data.updatedAt = data.updatedAt || new Date().toISOString();
            
            const productRef = modules.ref(firebaseDb, `${getFirebasePath('products')}/${key}`);
            await modules.set(productRef, data);
        }
        
        // Upload sales
        const sales = await db.getAllSales();
        for (const sale of sales) {
            const key = sale.firebaseKey || ('local_' + sale.id);
            const data = { ...sale };
            delete data.id;
            data.updatedAt = data.updatedAt || new Date().toISOString();
            
            const saleRef = modules.ref(firebaseDb, `${getFirebasePath('sales')}/${key}`);
            await modules.set(saleRef, data);
        }
        
        // Upload layaways
        const layaways = await db.getAllLayaways();
        for (const layaway of layaways) {
            const key = layaway.firebaseKey || ('local_' + layaway.id);
            const data = { ...layaway };
            delete data.id;
            data.updatedAt = new Date().toISOString();
            
            const layawayRef = modules.ref(firebaseDb, `${getFirebasePath('layaways')}/${key}`);
            await modules.set(layawayRef, data);
            
            if (!layaway.firebaseKey) {
                layaway.firebaseKey = key;
                await db.updateLayaway(layaway);
            }
        }
        
        // Upload owners
        const owners = await db.getAllOwners();
        for (const owner of owners) {
            const key = owner.firebaseKey || ('owner_' + owner.id);
            const data = { name: owner.name, updatedAt: new Date().toISOString() };
            
            const ownerRef = modules.ref(firebaseDb, `${getFirebasePath('owners')}/${key}`);
            await modules.set(ownerRef, data);
        }
        
        // Upload settings
        const settings = await db.getAllSettings();
        for (const [key, value] of Object.entries(settings)) {
            const data = { value, updatedAt: new Date().toISOString() };
            
            const settingRef = modules.ref(firebaseDb, `${getFirebasePath('settings')}/${key}`);
            await modules.set(settingRef, data);
        }
        
        console.log('✓ Local data uploaded to Firebase');
    } catch (error) {
        console.error('Error uploading local data:', error);
    }
}

/**
 * Start auto-sync interval
 */
function startAutoSync() {
    if (syncInterval) clearInterval(syncInterval);
    
    syncInterval = setInterval(() => {
        if (isLoggedIn) {
            uploadLocalData();
        }
    }, SYNC_INTERVAL_MS);
    
    console.log('✓ Auto-sync started (every 10 seconds)');
}

// ========================================
// SYNC BUTTON
// ========================================

/**
 * Create floating sync button
 */
function createSyncButton() {
    const btn = document.createElement('button');
    btn.id = 'sync-now-btn';
    btn.innerHTML = '🔄';
    btn.title = 'Sincronizar ahora';
    btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;' +
        'background:linear-gradient(135deg,#8B5CF6 0%,#7C3AED 100%);' +
        'color:white;border:none;width:48px;height:48px;border-radius:50%;' +
        'font-size:20px;display:flex;align-items:center;justify-content:center;' +
        'cursor:pointer;box-shadow:0 4px 15px rgba(139,92,246,0.4);' +
        'transition:all 0.3s ease;';
    
    btn.onmouseover = () => {
        btn.style.transform = 'scale(1.05)';
        btn.style.boxShadow = '0 6px 20px rgba(139,92,246,0.5)';
    };
    
    btn.onmouseout = () => {
        btn.style.transform = 'scale(1)';
        btn.style.boxShadow = '0 4px 15px rgba(139,92,246,0.4)';
    };
    
    btn.onclick = () => {
        btn.style.animation = 'spin 1s linear infinite';
        btn.disabled = true;
        
        if (isLoggedIn) {
            uploadLocalData();
        }
        
        setTimeout(() => {
            location.reload();
        }, 1500);
    };
    
    const style = document.createElement('style');
    style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
    
    document.body.appendChild(btn);
}

// ========================================
// INITIALIZATION
// ========================================

/**
 * Initialize when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
    createSyncButton();
    
    setTimeout(async () => {
        const initialized = await initFirebase();
        
        if (initialized) {
            setupAuthListener();
        }
    }, 2000);
});

// ========================================
// PUBLIC API
// ========================================

/**
 * API for app.js to use
 */
window.firebaseSync = {
    isUserAuthenticated: () => isLoggedIn,
    
    uploadSingle: async (collection, record) => {
        if (!firebaseDb || !isLoggedIn) {
            throw new Error('Firebase not available');
        }
        
        const modules = window.firebaseModules;
        const key = record.firebaseKey || ('local_' + record.id);
        const data = { ...record };
        delete data.id;
        data.updatedAt = data.updatedAt || new Date().toISOString();
        
        const recordRef = modules.ref(firebaseDb, `${getFirebasePath(collection)}/${key}`);
        await modules.set(recordRef, data);
        
        if (!record.firebaseKey && record.id) {
            record.firebaseKey = key;
            if (collection === 'layaways') {
                await db.updateLayaway(record);
            } else if (collection === 'products') {
                await db.updateProduct(record);
            }
        }
    },
    
    deleteSingle: async (collection, localId, firebaseKey) => {
        if (!firebaseDb || !isLoggedIn) {
            throw new Error('Firebase not available');
        }
        
        const modules = window.firebaseModules;
        const key = firebaseKey || ('local_' + localId);
        const recordRef = modules.ref(firebaseDb, `${getFirebasePath(collection)}/${key}`);
        
        await modules.remove(recordRef);
        console.log('Deleted from Firebase:', `${getFirebasePath(collection)}/${key}`);
    },
    
    /**
     * Add layaway payment using transaction to prevent overwrite conflicts
     */
    addLayawayPaymentTransaction: async (layawayId, amount, paymentMethod, localLayaway) => {
        if (!firebaseDb || !isLoggedIn) {
            throw new Error('Firebase not available');
        }
        
        const modules = window.firebaseModules;
        const key = localLayaway.firebaseKey || ('local_' + layawayId);
        const layawayRef = modules.ref(firebaseDb, `${getFirebasePath('layaways')}/${key}`);
        
        try {
            await modules.runTransaction(layawayRef, (currentData) => {
                if (currentData === null) {
                    // If layaway doesn't exist in Firebase, upload the local version
                    const data = { ...localLayaway };
                    delete data.id;
                    data.updatedAt = new Date().toISOString();
                    return data;
                }
                
                // Add new payment to existing payments array
                const payments = Array.isArray(currentData.payments) ? currentData.payments : [];
                const newPayment = {
                    amount,
                    paymentMethod,
                    date: new Date().toISOString()
                };
                payments.push(newPayment);
                
                // Recalculate totals
                const totalPaid = payments.reduce((sum, p) => sum + (p?.amount || 0), 0);
                const total = typeof currentData.total === 'number' ? currentData.total : 0;
                const pendingAmount = Math.max(0, total - totalPaid);
                
                // Return updated data with new payment
                return {
                    ...currentData,
                    payments,
                    totalPaid,
                    pendingAmount,
                    updatedAt: new Date().toISOString()
                };
            });
            
            console.log('✓ Layaway payment added via transaction');
            return true;
        } catch (error) {
            console.error('✗ Transaction failed:', error);
            throw error;
        }
    },
    
    /**
     * Create sale using transaction to ensure atomic operation
     */
    createSaleTransaction: async (sale) => {
        if (!firebaseDb || !isLoggedIn) {
            throw new Error('Firebase not available');
        }
        
        const modules = window.firebaseModules;
        const key = sale.firebaseKey || ('local_' + sale.id);
        const saleRef = modules.ref(firebaseDb, `${getFirebasePath('sales')}/${key}`);
        
        try {
            await modules.runTransaction(saleRef, (currentData) => {
                if (currentData !== null) {
                    // Sale already exists, don't overwrite
                    return undefined; // Abort transaction
                }
                
                // Create new sale
                const data = { ...sale };
                delete data.id;
                data.updatedAt = new Date().toISOString();
                data.createdAt = data.createdAt || new Date().toISOString();
                
                return data;
            });
            
            console.log('✓ Sale created via transaction');
            return true;
        } catch (error) {
            console.error('✗ Sale transaction failed:', error);
            // This is expected if sale already exists
            return false;
        }
    }
};

/**
 * Manual sync function
 */
window.syncNow = () => {
    if (isLoggedIn) {
        uploadLocalData();
    }
};

/**
 * Diagnostic function
 */
window.diagnosticoFirebase = async () => {
    console.log('=== DIAGNÓSTICO DE FIREBASE (MODULAR SDK) ===');
    console.log('Firebase modules available:', !!window.firebaseModules);
    console.log('Firebase App initialized:', firebaseApp !== null);
    console.log('Firebase Database available:', firebaseDb !== null);
    console.log('Firebase Auth available:', firebaseAuth !== null);
    console.log('User authenticated:', isLoggedIn);
    console.log('User ID:', currentUserId);
    console.log('Root path in Firebase:', rootPath);
    
    if (isLoggedIn && firebaseDb) {
        const modules = window.firebaseModules;
        console.log('Reading layaways from Firebase...');
        try {
            const apartadosRef = modules.ref(firebaseDb, `${rootPath}/apartados`);
            const snapshot = await modules.get(apartadosRef);
            const data = snapshot.val();
            if (data) {
                const count = Object.keys(data).length;
                console.log('✓ Layaways found in Firebase:', count);
                console.log('Data:', data);
            } else {
                console.log('⚠ No layaways in Firebase');
            }
        } catch (error) {
            console.error('✗ Error reading from Firebase:', error);
        }
    } else {
        console.log('⚠ Cannot read from Firebase (not authenticated or not initialized)');
    }
    
    if (db && db.isReady) {
        try {
            const layaways = await db.getAllLayaways();
            console.log('✓ Local layaways in IndexedDB:', layaways.length);
            if (layaways.length > 0) {
                console.log('Layaway details:', layaways.map(l => ({
                    id: l.id,
                    customer: l.customerName,
                    phone: l.customerPhone,
                    total: l.total,
                    status: l.status,
                    firebaseKey: l.firebaseKey || 'no key'
                })));
            }
        } catch (error) {
            console.error('✗ Error reading IndexedDB:', error);
        }
    } else {
        console.log('⚠ IndexedDB not ready');
    }
    
    console.log('=== END OF DIAGNOSTIC ===');
    console.log('To run this again, type: diagnosticoFirebase()');
};

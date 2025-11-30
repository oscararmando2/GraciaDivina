/**
 * Gracia Divina POS - Firebase Realtime Database Synchronization Module
 * 
 * Este módulo proporciona sincronización bidireccional entre IndexedDB local
 * y Firebase Realtime Database, con soporte para sincronización en tiempo real
 * entre dispositivos (Windows, Mac, móvil).
 * 
 * Características:
 * - Persistencia offline con IndexedDB
 * - Sincronización en tiempo real con Firebase Realtime Database
 * - Sincronización automática cuando hay conexión
 * - Compatibilidad con múltiples dispositivos
 */

// ============================================================================
// CONFIGURACIÓN DE FIREBASE - DEBES COMPLETAR ESTOS VALORES
// ============================================================================
// IMPORTANTE: Reemplaza los valores placeholder con tus credenciales reales de Firebase.
// 
// Para obtener las credenciales:
// 1. Ve a Firebase Console: https://console.firebase.google.com/
// 2. Selecciona tu proyecto "gracia-divina-c70c6"
// 3. Ve a Configuración del proyecto (⚙️) > General
// 4. En "Tus apps", busca la configuración de la app web
// 5. Copia los valores de apiKey, messagingSenderId y appId
//
// NOTA: Sin estas credenciales reales, la sincronización NO funcionará
// ============================================================================
const FIREBASE_CONFIG = {
    apiKey: "TU_API_KEY_AQUI",           // Reemplaza con tu apiKey real
    authDomain: "gracia-divina-c70c6.firebaseapp.com",
    projectId: "gracia-divina-c70c6",
    storageBucket: "gracia-divina-c70c6.firebasestorage.app",
    messagingSenderId: "TU_MESSAGING_SENDER_ID",  // Reemplaza con tu messagingSenderId real
    appId: "TU_APP_ID",                           // Reemplaza con tu appId real
    databaseURL: "https://gracia-divina-c70c6-default-rtdb.firebaseio.com"
};

// Constantes de tiempo (en milisegundos)
const FIREBASE_INIT_DELAY_MS = 2000;       // Tiempo de espera antes de inicializar Firebase
const STATUS_UPDATE_INTERVAL_MS = 5000;    // Intervalo para actualizar el indicador de estado

// Mapeo de colecciones IndexedDB a nodos de Realtime Database
// IndexedDB usa nombres en inglés, Realtime Database usa nombres según las reglas del usuario
const COLLECTION_MAPPING = {
    'products': 'productos',
    'sales': 'ventas',
    'layaways': 'apartados',
    'owners': 'duenas',
    'settings': 'config'
};

// Estado de sincronización
const syncState = {
    isInitialized: false,
    isAuthenticated: false,
    isOnline: navigator.onLine,
    lastSyncTime: null,
    syncInProgress: false,
    firebaseApp: null,
    database: null,
    auth: null,
    listeners: [],
    pendingWrites: []
};

/**
 * Clase para manejar la sincronización con Firebase Realtime Database
 */
class FirebaseSync {
    constructor() {
        this.listeners = [];
    }

    /**
     * Inicializa Firebase con Realtime Database
     */
    async init() {
        try {
            // Verificar si Firebase SDK está cargado
            if (typeof firebase === 'undefined') {
                console.warn('Firebase SDK no cargado. Sincronización deshabilitada.');
                console.warn('Asegúrate de que los scripts de Firebase estén incluidos en index.html');
                return false;
            }

            // Inicializar Firebase App
            if (!firebase.apps.length) {
                syncState.firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
            } else {
                syncState.firebaseApp = firebase.apps[0];
            }

            // Obtener referencia a Realtime Database
            syncState.database = firebase.database();
            syncState.auth = firebase.auth();

            // Configurar listener de estado de conexión
            this.setupConnectionListener();

            // Configurar listener de autenticación
            this.setupAuthListener();

            // Marcar como inicializado
            syncState.isInitialized = true;
            console.log('✅ Firebase Realtime Database inicializado correctamente');
            console.log('📍 URL de base de datos:', FIREBASE_CONFIG.databaseURL);

            return true;

        } catch (error) {
            console.error('Error inicializando Firebase Realtime Database:', error);
            return false;
        }
    }

    /**
     * Configura listener de autenticación
     */
    setupAuthListener() {
        if (!syncState.auth) return;

        syncState.auth.onAuthStateChanged(async (user) => {
            if (user) {
                syncState.isAuthenticated = true;
                console.log('✅ Usuario autenticado:', user.email);
                this.showSyncNotification('Sesión iniciada - Sincronización activa', 'success');
                
                // Configurar listeners en tiempo real
                await this.setupRealtimeListeners();
                
                // Realizar sincronización inicial
                await this.forceSyncAll();
            } else {
                syncState.isAuthenticated = false;
                console.log('⚠️ Usuario no autenticado');
                this.showSyncNotification('Inicia sesión para sincronizar', 'warning');
                
                // Desconectar listeners
                this.disconnectListeners();
            }
        });
    }

    /**
     * Inicia sesión con email y contraseña
     */
    async signIn(email, password) {
        if (!syncState.auth) {
            console.error('Firebase Auth no inicializado');
            return false;
        }

        try {
            const userCredential = await syncState.auth.signInWithEmailAndPassword(email, password);
            console.log('✅ Inicio de sesión exitoso:', userCredential.user.email);
            return true;
        } catch (error) {
            console.error('Error al iniciar sesión:', error);
            this.showSyncNotification('Error al iniciar sesión: ' + error.message, 'error');
            return false;
        }
    }

    /**
     * Cierra sesión
     */
    async signOut() {
        if (!syncState.auth) return;

        try {
            await syncState.auth.signOut();
            console.log('✅ Sesión cerrada');
            this.showSyncNotification('Sesión cerrada', 'info');
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    }

    /**
     * Obtiene el usuario actual
     */
    getCurrentUser() {
        return syncState.auth ? syncState.auth.currentUser : null;
    }

    /**
     * Verifica si el usuario está autenticado
     */
    isUserAuthenticated() {
        return syncState.isAuthenticated && syncState.auth && syncState.auth.currentUser;
    }

    /**
     * Configura listener para cambios en estado de conexión
     */
    setupConnectionListener() {
        // Listener de navegador
        window.addEventListener('online', () => {
            syncState.isOnline = true;
            console.log('🌐 Conexión restaurada');
            this.showSyncNotification('Conexión restaurada', 'success');
            if (syncState.isAuthenticated) {
                this.forceSyncAll();
            }
        });

        window.addEventListener('offline', () => {
            syncState.isOnline = false;
            console.log('📴 Sin conexión - Modo offline');
            this.showSyncNotification('Sin conexión - Datos guardados localmente', 'warning');
        });

        // Listener de Firebase para estado de conexión
        if (syncState.database) {
            const connectedRef = syncState.database.ref('.info/connected');
            connectedRef.on('value', (snapshot) => {
                if (snapshot.val() === true) {
                    console.log('🔗 Conectado a Firebase Realtime Database');
                } else {
                    console.log('🔌 Desconectado de Firebase Realtime Database');
                }
            });
        }

        // Actualizar estado inicial
        syncState.isOnline = navigator.onLine;
    }

    /**
     * Configura listeners en tiempo real para sincronización automática
     */
    async setupRealtimeListeners() {
        if (!syncState.database || !syncState.isAuthenticated) {
            console.log('⚠️ No se pueden configurar listeners: no autenticado');
            return;
        }

        console.log('🔄 Configurando listeners en tiempo real...');

        // Listener para productos
        this.addRealtimeListener('productos', async (data) => {
            await this.syncRemoteToLocal('products', data);
            // Recargar UI si estamos en la página de productos
            if (typeof loadProducts === 'function') {
                await loadProducts();
            }
        });

        // Listener para ventas
        this.addRealtimeListener('ventas', async (data) => {
            await this.syncRemoteToLocal('sales', data);
            // Actualizar resumen de ventas
            if (typeof updateSalesSummary === 'function') {
                await updateSalesSummary();
            }
            if (typeof loadSalesHistory === 'function') {
                await loadSalesHistory();
            }
        });

        // Listener para apartados
        this.addRealtimeListener('apartados', async (data) => {
            await this.syncRemoteToLocal('layaways', data);
            // Actualizar badge y lista
            if (typeof updateLayawayBadge === 'function') {
                await updateLayawayBadge();
            }
            if (typeof loadLayaways === 'function') {
                await loadLayaways();
            }
        });

        // Listener para dueñas
        this.addRealtimeListener('duenas', async (data) => {
            await this.syncRemoteToLocal('owners', data);
            if (typeof loadOwners === 'function') {
                await loadOwners();
            }
        });

        // Listener para configuración
        this.addRealtimeListener('config', async (data) => {
            await this.syncRemoteToLocal('settings', data);
            if (typeof loadSettings === 'function') {
                await loadSettings();
            }
        });

        console.log('✅ Listeners en tiempo real configurados');
    }

    /**
     * Agrega un listener en tiempo real para un nodo
     */
    addRealtimeListener(nodeName, callback) {
        if (!syncState.database) return;

        const ref = syncState.database.ref(nodeName);
        
        const listener = ref.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                console.log(`📥 Datos recibidos de ${nodeName}`);
                callback(data);
            }
        }, (error) => {
            console.error(`Error en listener de ${nodeName}:`, error);
        });

        this.listeners.push({ ref, listener });
    }

    /**
     * Desconecta todos los listeners
     */
    disconnectListeners() {
        this.listeners.forEach(({ ref, listener }) => {
            ref.off('value', listener);
        });
        this.listeners = [];
        console.log('🔌 Listeners desconectados');
    }

    /**
     * Fuerza sincronización de todas las colecciones
     */
    async forceSyncAll() {
        if (syncState.syncInProgress) {
            console.log('⏳ Sincronización ya en progreso...');
            return false;
        }

        if (!syncState.isInitialized) {
            console.log('⚠️ Firebase no inicializado');
            return false;
        }

        if (!syncState.isAuthenticated) {
            console.log('⚠️ Usuario no autenticado, sincronización deshabilitada');
            return false;
        }

        syncState.syncInProgress = true;
        console.log('🔄 Iniciando sincronización completa...');

        try {
            // Sincronizar cada colección
            for (const [localName, remoteName] of Object.entries(COLLECTION_MAPPING)) {
                await this.syncCollection(localName, remoteName);
            }

            // Procesar escrituras pendientes
            await this.processPendingWrites();

            syncState.lastSyncTime = new Date();
            console.log('✅ Sincronización completada:', syncState.lastSyncTime);
            this.showSyncNotification('Sincronización completada', 'success');

            return true;

        } catch (error) {
            console.error('Error en sincronización:', error);
            this.showSyncNotification('Error de sincronización', 'error');
            return false;

        } finally {
            syncState.syncInProgress = false;
        }
    }

    /**
     * Sincroniza una colección específica
     */
    async syncCollection(localName, remoteName) {
        console.log(`🔄 Sincronizando: ${localName} ↔ ${remoteName}`);

        try {
            // Obtener datos locales
            const localData = await this.getLocalData(localName);
            
            // Obtener datos remotos
            const remoteData = await this.getRemoteData(remoteName);

            // Sincronizar local → remoto (subir nuevos/actualizados)
            await this.syncLocalToRemote(localName, remoteName, localData, remoteData);

            // Sincronizar remoto → local (descargar nuevos/actualizados)
            await this.syncRemoteToLocalMerge(localName, localData, remoteData);

            console.log(`✅ ${localName} sincronizado`);

        } catch (error) {
            console.error(`Error sincronizando ${localName}:`, error);
            throw error;
        }
    }

    /**
     * Obtiene datos locales de IndexedDB
     */
    async getLocalData(collectionName) {
        if (!db || !db.isReady) {
            return [];
        }

        try {
            switch (collectionName) {
                case 'products':
                    return await db.getAllProducts();
                case 'sales':
                    return await db.getAllSales();
                case 'layaways':
                    return await db.getAllLayaways();
                case 'owners':
                    return await db.getAllOwners();
                case 'settings':
                    const settingsObj = await db.getAllSettings();
                    return Object.entries(settingsObj).map(([key, value]) => ({
                        key,
                        value,
                        id: key
                    }));
                default:
                    return [];
            }
        } catch (error) {
            console.error(`Error obteniendo datos locales de ${collectionName}:`, error);
            return [];
        }
    }

    /**
     * Obtiene datos remotos de Firebase Realtime Database
     */
    async getRemoteData(nodeName) {
        if (!syncState.database || !syncState.isOnline || !syncState.isAuthenticated) {
            return {};
        }

        try {
            const snapshot = await syncState.database.ref(nodeName).once('value');
            return snapshot.val() || {};
        } catch (error) {
            console.error(`Error obteniendo datos remotos de ${nodeName}:`, error);
            return {};
        }
    }

    /**
     * Sincroniza datos locales hacia Firebase
     */
    async syncLocalToRemote(localName, remoteName, localData, remoteData) {
        if (!syncState.database || !syncState.isOnline || !syncState.isAuthenticated) {
            return;
        }

        const isSettings = localName === 'settings';

        for (const localItem of localData) {
            const itemKey = isSettings ? localItem.key : (localItem.firebaseKey || `local_${localItem.id}`);
            const remoteItem = remoteData[itemKey];

            const localTime = new Date(localItem.updatedAt || localItem.createdAt || 0).getTime();
            const remoteTime = remoteItem ? new Date(remoteItem.updatedAt || remoteItem.createdAt || 0).getTime() : 0;

            // Subir si es nuevo o más reciente
            if (!remoteItem || localTime > remoteTime) {
                const dataToUpload = this.prepareForUpload(localItem, isSettings);
                
                try {
                    await syncState.database.ref(`${remoteName}/${itemKey}`).set(dataToUpload);
                    
                    // Guardar la clave de Firebase en el registro local si es nuevo
                    if (!localItem.firebaseKey && !isSettings) {
                        localItem.firebaseKey = itemKey;
                        await this.updateLocalWithFirebaseKey(localName, localItem);
                    }
                } catch (error) {
                    console.error(`Error subiendo ${remoteName}/${itemKey}:`, error);
                    syncState.pendingWrites.push({ remoteName, itemKey, data: dataToUpload });
                }
            }
        }
    }

    /**
     * Prepara datos para subir a Firebase
     */
    prepareForUpload(item, isSettings) {
        const data = { ...item };
        
        if (isSettings) {
            return { value: data.value, updatedAt: new Date().toISOString() };
        }
        
        // No subir el ID de IndexedDB, pero mantener otros campos
        delete data.id;
        data.updatedAt = data.updatedAt || new Date().toISOString();
        
        return data;
    }

    /**
     * Actualiza registro local con la clave de Firebase
     */
    async updateLocalWithFirebaseKey(collectionName, item) {
        if (!db || !db.isReady) return;

        try {
            switch (collectionName) {
                case 'products':
                    await db.updateProduct(item);
                    break;
                case 'layaways':
                    await db.updateLayaway(item);
                    break;
                // Sales no se actualizan después de crearse
            }
        } catch (error) {
            console.error(`Error actualizando firebaseKey en ${collectionName}:`, error);
        }
    }

    /**
     * Sincroniza datos remotos hacia local (merge inicial)
     */
    async syncRemoteToLocalMerge(localName, localData, remoteData) {
        const isSettings = localName === 'settings';
        const localMap = new Map();

        // Crear mapa de datos locales
        localData.forEach(item => {
            const key = isSettings ? item.key : (item.firebaseKey || `local_${item.id}`);
            localMap.set(key, item);
        });

        // Procesar datos remotos
        for (const [remoteKey, remoteItem] of Object.entries(remoteData)) {
            const localItem = localMap.get(remoteKey);

            if (!localItem) {
                // Nuevo registro remoto, guardar localmente
                await this.saveRemoteToLocal(localName, remoteKey, remoteItem);
            } else {
                // Verificar si remoto es más reciente
                const localTime = new Date(localItem.updatedAt || localItem.createdAt || 0).getTime();
                const remoteTime = new Date(remoteItem.updatedAt || remoteItem.createdAt || 0).getTime();

                if (remoteTime > localTime) {
                    await this.saveRemoteToLocal(localName, remoteKey, remoteItem, localItem.id);
                }
            }
        }
    }

    /**
     * Sincroniza datos remotos hacia local (desde listener en tiempo real)
     */
    async syncRemoteToLocal(localName, remoteData) {
        if (!remoteData || !db || !db.isReady) return;

        const isSettings = localName === 'settings';
        const localData = await this.getLocalData(localName);
        const localMap = new Map();

        localData.forEach(item => {
            const key = isSettings ? item.key : (item.firebaseKey || `local_${item.id}`);
            localMap.set(key, item);
        });

        for (const [remoteKey, remoteItem] of Object.entries(remoteData)) {
            const localItem = localMap.get(remoteKey);

            if (!localItem) {
                await this.saveRemoteToLocal(localName, remoteKey, remoteItem);
            } else {
                const localTime = new Date(localItem.updatedAt || localItem.createdAt || 0).getTime();
                const remoteTime = new Date(remoteItem.updatedAt || remoteItem.createdAt || 0).getTime();

                if (remoteTime > localTime) {
                    await this.saveRemoteToLocal(localName, remoteKey, remoteItem, localItem.id);
                }
            }
        }
    }

    /**
     * Guarda un registro remoto en IndexedDB local
     */
    async saveRemoteToLocal(localName, firebaseKey, remoteData, existingLocalId = null) {
        if (!db || !db.isReady) return;

        try {
            const data = { ...remoteData, firebaseKey };

            switch (localName) {
                case 'products':
                    if (existingLocalId) {
                        data.id = existingLocalId;
                        await db.updateProduct(data);
                    } else {
                        await db.addProduct(data);
                    }
                    break;

                case 'sales':
                    if (!existingLocalId) {
                        // Las ventas solo se agregan, no se actualizan
                        const store = db.getStore('sales', 'readwrite');
                        await new Promise((resolve, reject) => {
                            const request = store.add(data);
                            request.onsuccess = () => resolve();
                            request.onerror = () => reject(request.error);
                        });
                    }
                    break;

                case 'layaways':
                    if (existingLocalId) {
                        data.id = existingLocalId;
                        await db.updateLayaway(data);
                    } else {
                        const store = db.getStore('layaways', 'readwrite');
                        await new Promise((resolve, reject) => {
                            const request = store.add(data);
                            request.onsuccess = () => resolve();
                            request.onerror = () => reject(request.error);
                        });
                    }
                    break;

                case 'owners':
                    if (!existingLocalId && remoteData.name) {
                        // Verificar si ya existe una dueña con ese nombre
                        const owners = await db.getAllOwners();
                        const exists = owners.some(o => o.name === remoteData.name);
                        if (!exists) {
                            await db.addOwner(remoteData.name);
                        }
                    }
                    break;

                case 'settings':
                    if (remoteData.value !== undefined) {
                        await db.saveSetting(firebaseKey, remoteData.value);
                    }
                    break;
            }

        } catch (error) {
            console.error(`Error guardando ${localName}/${firebaseKey} localmente:`, error);
        }
    }

    /**
     * Procesa escrituras pendientes que fallaron anteriormente
     */
    async processPendingWrites() {
        if (!syncState.isOnline || !syncState.isAuthenticated || syncState.pendingWrites.length === 0) {
            return;
        }

        console.log(`📤 Procesando ${syncState.pendingWrites.length} escrituras pendientes...`);

        const writes = [...syncState.pendingWrites];
        syncState.pendingWrites = [];

        for (const { remoteName, itemKey, data } of writes) {
            try {
                await syncState.database.ref(`${remoteName}/${itemKey}`).set(data);
                console.log(`✅ Escritura pendiente completada: ${remoteName}/${itemKey}`);
            } catch (error) {
                console.error(`Error procesando escritura pendiente ${remoteName}/${itemKey}:`, error);
                syncState.pendingWrites.push({ remoteName, itemKey, data });
            }
        }
    }

    /**
     * Sube un registro específico a Firebase (para uso inmediato después de crear/actualizar)
     */
    async uploadSingle(localName, item) {
        if (!syncState.database || !syncState.isOnline || !syncState.isAuthenticated) {
            console.log('⚠️ No se puede subir: offline o no autenticado');
            return false;
        }

        const remoteName = COLLECTION_MAPPING[localName];
        if (!remoteName) {
            console.error(`Colección no mapeada: ${localName}`);
            return false;
        }

        const isSettings = localName === 'settings';
        const itemKey = isSettings ? item.key : (item.firebaseKey || `local_${item.id}`);
        const dataToUpload = this.prepareForUpload(item, isSettings);

        try {
            await syncState.database.ref(`${remoteName}/${itemKey}`).set(dataToUpload);
            console.log(`📤 Subido: ${remoteName}/${itemKey}`);

            // Actualizar firebaseKey local si es nuevo
            if (!item.firebaseKey && !isSettings) {
                item.firebaseKey = itemKey;
                await this.updateLocalWithFirebaseKey(localName, item);
            }

            return true;
        } catch (error) {
            console.error(`Error subiendo ${remoteName}/${itemKey}:`, error);
            syncState.pendingWrites.push({ remoteName, itemKey, data: dataToUpload });
            return false;
        }
    }

    /**
     * Elimina un registro de Firebase
     */
    async deleteSingle(localName, item) {
        if (!syncState.database || !syncState.isOnline || !syncState.isAuthenticated) {
            return false;
        }

        const remoteName = COLLECTION_MAPPING[localName];
        if (!remoteName) return false;

        const isSettings = localName === 'settings';
        const itemKey = isSettings ? item.key : item.firebaseKey;

        if (!itemKey) {
            console.log('⚠️ Registro sin firebaseKey, no se puede eliminar de Firebase');
            return true; // El registro solo existía localmente
        }

        try {
            await syncState.database.ref(`${remoteName}/${itemKey}`).remove();
            console.log(`🗑️ Eliminado de Firebase: ${remoteName}/${itemKey}`);
            return true;
        } catch (error) {
            console.error(`Error eliminando ${remoteName}/${itemKey}:`, error);
            return false;
        }
    }

    /**
     * Muestra notificación de sincronización
     */
    showSyncNotification(message, type = 'info') {
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    /**
     * Obtiene el estado actual de sincronización
     */
    getStatus() {
        return {
            isInitialized: syncState.isInitialized,
            isAuthenticated: syncState.isAuthenticated,
            isOnline: syncState.isOnline,
            lastSyncTime: syncState.lastSyncTime,
            syncInProgress: syncState.syncInProgress,
            pendingWrites: syncState.pendingWrites.length,
            currentUser: this.getCurrentUser()?.email || null
        };
    }

    /**
     * Desconecta Firebase
     */
    disconnect() {
        this.disconnectListeners();
        console.log('🔌 Firebase desconectado');
    }
}

// Crear instancia global
const firebaseSync = new FirebaseSync();

// Exponer globalmente para uso en consola y debugging
window.firebaseSync = firebaseSync;

/**
 * Función para agregar controles de autenticación y sincronización
 */
function addSyncControls() {
    // Crear contenedor de controles
    const controlsContainer = document.createElement('div');
    controlsContainer.id = 'firebase-sync-controls';
    controlsContainer.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        align-items: flex-end;
    `;

    // Indicador de estado
    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'sync-status-indicator';
    statusIndicator.style.cssText = `
        background: rgba(255, 255, 255, 0.95);
        padding: 8px 16px;
        border-radius: 20px;
        font-family: 'Poppins', sans-serif;
        font-size: 12px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    statusIndicator.innerHTML = '<span class="status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #FCD34D;"></span><span>Conectando...</span>';

    // Botón de sincronización manual
    const syncButton = document.createElement('button');
    syncButton.id = 'manual-sync-button';
    syncButton.innerHTML = '🔄';
    syncButton.title = 'Sincronizar ahora';
    syncButton.style.cssText = `
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%);
        color: white;
        border: none;
        font-size: 20px;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);
        transition: all 0.3s ease;
    `;

    syncButton.addEventListener('click', async () => {
        if (!firebaseSync.isUserAuthenticated()) {
            showLoginModal();
            return;
        }

        syncButton.innerHTML = '⏳';
        syncButton.disabled = true;

        try {
            await firebaseSync.forceSyncAll();
            syncButton.innerHTML = '✅';
            setTimeout(() => {
                syncButton.innerHTML = '🔄';
                syncButton.disabled = false;
            }, 2000);
        } catch (error) {
            syncButton.innerHTML = '❌';
            setTimeout(() => {
                syncButton.innerHTML = '🔄';
                syncButton.disabled = false;
            }, 2000);
        }
    });

    controlsContainer.appendChild(statusIndicator);
    controlsContainer.appendChild(syncButton);

    // Agregar al DOM
    if (document.body) {
        document.body.appendChild(controlsContainer);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            document.body.appendChild(controlsContainer);
        });
    }

    // Actualizar indicador de estado periódicamente
    // para mantener la información de conexión actualizada
    setInterval(() => {
        updateSyncStatusIndicator();
    }, STATUS_UPDATE_INTERVAL_MS);
}

/**
 * Actualiza el indicador de estado de sincronización
 */
function updateSyncStatusIndicator() {
    const indicator = document.getElementById('sync-status-indicator');
    if (!indicator) return;

    const status = firebaseSync.getStatus();
    let color, text;

    if (!status.isInitialized) {
        color = '#FCD34D';
        text = 'Inicializando...';
    } else if (!status.isAuthenticated) {
        color = '#F87171';
        text = 'No autenticado';
    } else if (!status.isOnline) {
        color = '#FCD34D';
        text = 'Offline';
    } else if (status.syncInProgress) {
        color = '#60A5FA';
        text = 'Sincronizando...';
    } else {
        color = '#34D399';
        text = status.currentUser ? `Conectado (${status.currentUser})` : 'Conectado';
    }

    indicator.innerHTML = `
        <span style="width: 8px; height: 8px; border-radius: 50%; background: ${color};"></span>
        <span>${text}</span>
    `;
}

/**
 * Muestra modal de inicio de sesión
 */
function showLoginModal() {
    // Verificar si ya existe el modal
    let modal = document.getElementById('firebase-login-modal');
    if (modal) {
        modal.classList.add('active');
        return;
    }

    // Crear modal de login
    modal = document.createElement('div');
    modal.id = 'firebase-login-modal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h3>🔐 Iniciar Sesión</h3>
                <button class="modal-close" onclick="closeLoginModal()">&times;</button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom: 20px; color: var(--gray-600);">
                    Inicia sesión para sincronizar tus datos entre dispositivos.
                </p>
                <div class="form-group">
                    <label for="firebase-email">Correo electrónico</label>
                    <input type="email" id="firebase-email" class="form-input" placeholder="correo@ejemplo.com">
                </div>
                <div class="form-group">
                    <label for="firebase-password">Contraseña</label>
                    <input type="password" id="firebase-password" class="form-input" placeholder="Tu contraseña">
                </div>
                <div id="login-error" style="color: var(--danger); font-size: 14px; margin-top: 10px; display: none;"></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeLoginModal()">Cancelar</button>
                <button class="btn btn-primary" onclick="doFirebaseLogin()">Iniciar Sesión</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.classList.add('active');

    // Cerrar al hacer clic fuera
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeLoginModal();
    });
}

/**
 * Cierra el modal de login
 */
function closeLoginModal() {
    const modal = document.getElementById('firebase-login-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * Realiza el login con Firebase
 */
async function doFirebaseLogin() {
    const email = document.getElementById('firebase-email').value.trim();
    const password = document.getElementById('firebase-password').value;
    const errorDiv = document.getElementById('login-error');

    if (!email || !password) {
        errorDiv.textContent = 'Por favor ingresa correo y contraseña';
        errorDiv.style.display = 'block';
        return;
    }

    errorDiv.style.display = 'none';

    const success = await firebaseSync.signIn(email, password);

    if (success) {
        closeLoginModal();
        updateSyncStatusIndicator();
    } else {
        errorDiv.textContent = 'Error al iniciar sesión. Verifica tus credenciales.';
        errorDiv.style.display = 'block';
    }
}

// Exponer funciones globalmente
window.showLoginModal = showLoginModal;
window.closeLoginModal = closeLoginModal;
window.doFirebaseLogin = doFirebaseLogin;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    // Agregar controles de sincronización
    addSyncControls();

    // Inicializar Firebase después de un pequeño delay
    // para asegurar que la base de datos local (IndexedDB) esté lista
    setTimeout(async () => {
        await firebaseSync.init();
        updateSyncStatusIndicator();
    }, FIREBASE_INIT_DELAY_MS);
});

// Exportar para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { firebaseSync, FirebaseSync };
}

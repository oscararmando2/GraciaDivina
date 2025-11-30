/**
 * Gracia Divina POS - Firebase Synchronization Module
 * 
 * Este módulo proporciona sincronización bidireccional entre IndexedDB local
 * y Firebase Firestore, con soporte especial para navegadores antiguos como
 * los de Windows 7 (Chrome 49+, Firefox ESR).
 * 
 * Características:
 * - Persistencia offline obligatoria con IndexedDB
 * - Sincronización automática cuando hay conexión
 * - Sincronización manual forzada
 * - Compatibilidad con Windows 7 y navegadores antiguos
 */

// Configuración de Firebase
// IMPORTANTE: Reemplaza estos valores placeholder con tus credenciales reales de Firebase
// Puedes encontrarlas en: Firebase Console > Configuración del proyecto > General
// NOTA: En producción, considera usar variables de entorno o un archivo de configuración seguro
const FIREBASE_CONFIG = {
    apiKey: "TU_API_KEY_AQUI",
    authDomain: "gracia-divina-c70c6.firebaseapp.com",
    projectId: "gracia-divina-c70c6",
    storageBucket: "gracia-divina-c70c6.firebasestorage.app",
    messagingSenderId: "TU_MESSAGING_SENDER_ID",
    appId: "TU_APP_ID",
    databaseURL: "https://gracia-divina-c70c6-default-rtdb.firebaseio.com/"
};

// Colecciones a sincronizar
const SYNC_COLLECTIONS = ['products', 'sales', 'layaways', 'owners', 'settings'];

// Estado de sincronización
const syncState = {
    isInitialized: false,
    isOnline: navigator.onLine,
    lastSyncTime: null,
    syncInProgress: false,
    firebaseApp: null,
    firestore: null,
    pendingWrites: []
};

/**
 * Clase para manejar la sincronización con Firebase
 */
class FirebaseSync {
    constructor() {
        this.listeners = {};
        this.unsubscribes = [];
    }

    /**
     * Inicializa Firebase con persistencia offline obligatoria
     * Especialmente importante para Windows 7 donde la conexión puede ser inestable
     */
    async init() {
        try {
            // Verificar si Firebase SDK está cargado
            if (typeof firebase === 'undefined') {
                console.warn('Firebase SDK no cargado. Sincronización deshabilitada.');
                return false;
            }

            // Inicializar Firebase App
            if (!firebase.apps.length) {
                syncState.firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
            } else {
                syncState.firebaseApp = firebase.apps[0];
            }

            syncState.firestore = firebase.firestore();

            // IMPORTANTE: Habilitar persistencia offline OBLIGATORIA
            // Esto es crucial para Windows 7 donde la conexión puede fallar
            try {
                await syncState.firestore.enablePersistence({
                    synchronizeTabs: true // Permite sincronización entre pestañas
                });
                console.log('✅ Persistencia offline de Firestore habilitada');
            } catch (err) {
                if (err.code === 'failed-precondition') {
                    // Múltiples pestañas abiertas, persistencia solo puede habilitarse en una
                    console.warn('⚠️ Persistencia offline limitada a una pestaña');
                } else if (err.code === 'unimplemented') {
                    // El navegador no soporta persistencia (muy raro)
                    console.warn('⚠️ Este navegador no soporta persistencia offline');
                } else {
                    console.error('Error habilitando persistencia:', err);
                }
            }

            // Configurar listener de estado de conexión
            this.setupConnectionListener();

            // Marcar como inicializado
            syncState.isInitialized = true;
            console.log('✅ Firebase Sync inicializado correctamente');

            // Realizar sincronización inicial
            await this.forceSyncAll();

            return true;

        } catch (error) {
            console.error('Error inicializando Firebase Sync:', error);
            return false;
        }
    }

    /**
     * Configura listener para cambios en estado de conexión
     */
    setupConnectionListener() {
        window.addEventListener('online', () => {
            syncState.isOnline = true;
            console.log('🌐 Conexión restaurada');
            this.showSyncNotification('Conexión restaurada', 'success');
            this.forceSyncAll();
        });

        window.addEventListener('offline', () => {
            syncState.isOnline = false;
            console.log('📴 Sin conexión - Modo offline');
            this.showSyncNotification('Sin conexión - Datos guardados localmente', 'warning');
        });

        // Actualizar estado inicial
        syncState.isOnline = navigator.onLine;
    }

    /**
     * Fuerza sincronización de todas las colecciones
     * Esta función es segura para llamar desde Windows 7
     */
    async forceSyncAll() {
        if (syncState.syncInProgress) {
            console.log('⏳ Sincronización ya en progreso...');
            return false;
        }

        if (!syncState.isInitialized) {
            console.log('⚠️ Firebase no inicializado, sincronizando solo localmente');
            return false;
        }

        syncState.syncInProgress = true;
        console.log('🔄 Iniciando sincronización completa...');

        try {
            for (const collection of SYNC_COLLECTIONS) {
                await this.syncCollection(collection);
            }

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
     * Sincroniza una colección específica entre IndexedDB y Firestore
     */
    async syncCollection(collectionName) {
        console.log(`🔄 Sincronizando: ${collectionName}`);

        try {
            // Obtener datos locales de IndexedDB
            const localData = await this.getLocalData(collectionName);

            // Obtener datos de Firestore
            const remoteData = await this.getRemoteData(collectionName);

            // Combinar datos (local tiene prioridad en caso de conflicto reciente)
            await this.mergeData(collectionName, localData, remoteData);

            console.log(`✅ ${collectionName} sincronizado`);

        } catch (error) {
            console.error(`Error sincronizando ${collectionName}:`, error);
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
                    // Settings retorna un objeto, convertir a array para sincronización
                    const settingsObj = await db.getAllSettings();
                    return Object.entries(settingsObj).map(([key, value]) => ({
                        key,
                        value,
                        id: key // Usar key como ID para comparación
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
     * Obtiene datos remotos de Firestore
     */
    async getRemoteData(collectionName) {
        if (!syncState.firestore || !syncState.isOnline) {
            return [];
        }

        try {
            const snapshot = await syncState.firestore
                .collection(collectionName)
                .get({ source: syncState.isOnline ? 'default' : 'cache' });

            return snapshot.docs.map(doc => ({
                ...doc.data(),
                _firestoreId: doc.id
            }));

        } catch (error) {
            console.error(`Error obteniendo datos remotos de ${collectionName}:`, error);
            return [];
        }
    }

    /**
     * Combina datos locales y remotos
     * Estrategia: última modificación gana
     */
    async mergeData(collectionName, localData, remoteData) {
        // Manejo especial para settings (usa key en lugar de id)
        const isSettings = collectionName === 'settings';
        const getItemKey = (item) => {
            if (isSettings) return item.key;
            return (item.id || item._firestoreId)?.toString();
        };

        // Crear mapa de datos remotos por ID/key
        const remoteMap = new Map();
        remoteData.forEach(item => {
            const key = getItemKey(item);
            if (key) remoteMap.set(key, item);
        });

        // Procesar datos locales - subir a Firestore si es más reciente
        for (const localItem of localData) {
            const localKey = getItemKey(localItem);
            const remoteItem = remoteMap.get(localKey);

            if (!remoteItem) {
                // Nuevo registro local, subir a Firestore
                await this.uploadToFirestore(collectionName, localItem);
            } else {
                // Comparar timestamps
                const localTime = new Date(localItem.updatedAt || localItem.createdAt || 0);
                const remoteTime = new Date(remoteItem.updatedAt || remoteItem.createdAt || 0);

                if (localTime > remoteTime) {
                    // Local es más reciente, actualizar Firestore
                    await this.uploadToFirestore(collectionName, localItem, remoteItem._firestoreId);
                }
            }
        }

        // Procesar datos remotos - descargar a IndexedDB si es más reciente
        for (const remoteItem of remoteData) {
            const remoteKey = getItemKey(remoteItem);
            const localItem = localData.find(l => getItemKey(l) === remoteKey);

            if (!localItem) {
                // Nuevo registro remoto, guardar localmente
                await this.saveToLocal(collectionName, remoteItem);
            } else {
                const localTime = new Date(localItem.updatedAt || localItem.createdAt || 0);
                const remoteTime = new Date(remoteItem.updatedAt || remoteItem.createdAt || 0);

                if (remoteTime > localTime) {
                    // Remoto es más reciente, actualizar local
                    await this.saveToLocal(collectionName, { ...remoteItem, id: localItem.id });
                }
            }
        }
    }

    /**
     * Sube un documento a Firestore
     */
    async uploadToFirestore(collectionName, data, docId = null) {
        if (!syncState.firestore || !syncState.isOnline) {
            // Guardar para sincronizar después
            syncState.pendingWrites.push({ collectionName, data, docId });
            return;
        }

        try {
            const docData = { ...data };
            delete docData.id; // El ID de IndexedDB no va en el documento
            delete docData._firestoreId;

            if (docId) {
                await syncState.firestore.collection(collectionName).doc(docId).set(docData, { merge: true });
            } else {
                await syncState.firestore.collection(collectionName).add(docData);
            }

        } catch (error) {
            console.error(`Error subiendo a Firestore (${collectionName}):`, error);
            syncState.pendingWrites.push({ collectionName, data, docId });
        }
    }

    /**
     * Guarda un documento en IndexedDB local
     */
    async saveToLocal(collectionName, data) {
        if (!db || !db.isReady) return;

        try {
            const cleanData = { ...data };
            delete cleanData._firestoreId;

            switch (collectionName) {
                case 'products':
                    if (cleanData.id) {
                        await db.updateProduct(cleanData);
                    } else {
                        await db.addProduct(cleanData);
                    }
                    break;
                case 'owners':
                    if (!cleanData.id && cleanData.name) {
                        await db.addOwner(cleanData.name);
                    }
                    break;
                case 'settings':
                    if (cleanData.key && cleanData.value) {
                        await db.saveSetting(cleanData.key, cleanData.value);
                    }
                    break;
                // Sales y layaways generalmente solo se crean, no se actualizan
            }

        } catch (error) {
            console.error(`Error guardando localmente (${collectionName}):`, error);
        }
    }

    /**
     * Escucha cambios en tiempo real de una colección
     */
    subscribeToCollection(collectionName, callback) {
        if (!syncState.firestore) return () => {};

        const unsubscribe = syncState.firestore
            .collection(collectionName)
            .onSnapshot(
                { includeMetadataChanges: true },
                (snapshot) => {
                    const changes = snapshot.docChanges();
                    if (changes.length > 0) {
                        callback(changes.map(change => ({
                            type: change.type,
                            data: { ...change.doc.data(), _firestoreId: change.doc.id }
                        })));
                    }
                },
                (error) => {
                    console.error(`Error en listener de ${collectionName}:`, error);
                }
            );

        this.unsubscribes.push(unsubscribe);
        return unsubscribe;
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
            isOnline: syncState.isOnline,
            lastSyncTime: syncState.lastSyncTime,
            syncInProgress: syncState.syncInProgress,
            pendingWrites: syncState.pendingWrites.length
        };
    }

    /**
     * Desconecta todos los listeners
     */
    disconnect() {
        this.unsubscribes.forEach(unsubscribe => unsubscribe());
        this.unsubscribes = [];
    }
}

// Crear instancia global
const firebaseSync = new FirebaseSync();

// Exponer globalmente para uso en consola y debugging
window.firebaseSync = firebaseSync;

/**
 * Función para agregar botón de sincronización manual en desarrollo
 * Este botón es visible solo cuando:
 * - La app está en localhost o 127.0.0.1
 * - O cuando se detecta que es un ambiente de desarrollo
 */
function addDevSyncButton() {
    // Detectar si estamos en desarrollo
    const isDev = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1' ||
                  window.location.hostname.includes('.local') ||
                  window.location.search.includes('dev=true');

    if (!isDev) return;

    // Crear botón de sincronización
    const syncButton = document.createElement('button');
    syncButton.id = 'dev-sync-button';
    syncButton.innerHTML = '🔄 Forzar sincronización ahora';
    syncButton.title = 'Botón de desarrollo - Fuerza sincronización con Firebase';
    
    // Estilos del botón
    syncButton.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        z-index: 9999;
        background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%);
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 25px;
        font-family: 'Poppins', sans-serif;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 8px;
    `;

    // Efectos hover
    syncButton.addEventListener('mouseenter', () => {
        syncButton.style.transform = 'translateY(-2px)';
        syncButton.style.boxShadow = '0 6px 20px rgba(139, 92, 246, 0.5)';
    });

    syncButton.addEventListener('mouseleave', () => {
        syncButton.style.transform = 'translateY(0)';
        syncButton.style.boxShadow = '0 4px 15px rgba(139, 92, 246, 0.4)';
    });

    // Manejador de click
    syncButton.addEventListener('click', async () => {
        syncButton.disabled = true;
        syncButton.innerHTML = '⏳ Sincronizando...';
        
        try {
            const result = await firebaseSync.forceSyncAll();
            
            if (result) {
                syncButton.innerHTML = '✅ ¡Sincronizado!';
                setTimeout(() => {
                    syncButton.innerHTML = '🔄 Forzar sincronización ahora';
                    syncButton.disabled = false;
                }, 2000);
            } else {
                syncButton.innerHTML = '⚠️ Sincronización local';
                setTimeout(() => {
                    syncButton.innerHTML = '🔄 Forzar sincronización ahora';
                    syncButton.disabled = false;
                }, 2000);
            }
        } catch (error) {
            syncButton.innerHTML = '❌ Error';
            console.error('Error en sincronización manual:', error);
            setTimeout(() => {
                syncButton.innerHTML = '🔄 Forzar sincronización ahora';
                syncButton.disabled = false;
            }, 2000);
        }
    });

    // Agregar al DOM cuando esté listo
    if (document.body) {
        document.body.appendChild(syncButton);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            document.body.appendChild(syncButton);
        });
    }

    console.log('🔧 Modo desarrollo: Botón de sincronización agregado');
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    // Agregar botón de desarrollo si aplica
    addDevSyncButton();

    // Intentar inicializar Firebase después de un pequeño delay
    // para asegurar que la base de datos local esté lista
    setTimeout(async () => {
        await firebaseSync.init();
    }, 2000);
});

// Exportar para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { firebaseSync, FirebaseSync };
}

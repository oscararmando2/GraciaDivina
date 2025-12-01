/**
 * Gracia Divina POS - Firebase Realtime Database Sync
 * JavaScript puro, compatible con Windows 7, Mac y móviles
 * Firebase compat 9.22.0
 */

// Configuración de Firebase
var firebaseConfig = {
    apiKey: "AIzaSyBagLJ4kGy9LepoGqUJ7mirAhC2uflaoAs",
    databaseURL: "https://gracia-divina-c70c6-default-rtdb.firebaseio.com"
};

// Credenciales para login automático (configuración del negocio)
var autoEmail = 'ketzy@gmail.com';
var autoPassword = 'Ketzy123';

// Constantes de tiempo
var SYNC_INTERVAL_MS = 10000;  // Sincronización cada 10 segundos
var RELOAD_DELAY_MS = 1500;    // Tiempo antes de recargar la página

// Carpeta raíz en Firebase
var rootPath = 'graciadivina_ketzy2025';

// Mapeo de colecciones: local -> Firebase
var collectionMap = {
    'products': 'productos',
    'sales': 'ventas',
    'layaways': 'apartados',
    'owners': 'duenas',
    'settings': 'config'
};

// Variables globales
var firebaseApp = null;
var firebaseDb = null;
var firebaseAuth = null;
var isLoggedIn = false;
var syncInterval = null;

// Inicializar Firebase
function initFirebase() {
    try {
        if (typeof firebase === 'undefined') {
            console.warn('Firebase SDK no disponible');
            return false;
        }

        if (!firebase.apps.length) {
            firebaseApp = firebase.initializeApp(firebaseConfig);
        } else {
            firebaseApp = firebase.apps[0];
        }

        firebaseDb = firebase.database();
        firebaseAuth = firebase.auth();

        console.log('Firebase inicializado');
        return true;
    } catch (e) {
        console.error('Error inicializando Firebase:', e);
        return false;
    }
}

// Login automático
function autoLogin() {
    if (!firebaseAuth) return;

    firebaseAuth.signInWithEmailAndPassword(autoEmail, autoPassword)
        .then(function(userCredential) {
            isLoggedIn = true;
            console.log('Login exitoso:', userCredential.user.email);
            setupRealtimeListeners();
            startAutoSync();
        })
        .catch(function(error) {
            console.error('Error en login:', error.message);
        });
}

// Obtener ruta completa en Firebase
function getFirebasePath(collection) {
    var firebaseName = collectionMap[collection] || collection;
    return rootPath + '/' + firebaseName;
}

// Configurar listeners en tiempo real
function setupRealtimeListeners() {
    if (!firebaseDb || !isLoggedIn) return;

    var collections = ['productos', 'ventas', 'apartados', 'duenas', 'config'];

    collections.forEach(function(col) {
        var ref = firebaseDb.ref(rootPath + '/' + col);

        // Listener para nuevos datos
        ref.on('child_added', function(snapshot) {
            var data = snapshot.val();
            var key = snapshot.key;
            console.log('Nuevo en ' + col + ':', key);
            handleRemoteData(col, key, data);
        });

        // Listener para cambios
        ref.on('child_changed', function(snapshot) {
            var data = snapshot.val();
            var key = snapshot.key;
            console.log('Cambio en ' + col + ':', key);
            handleRemoteData(col, key, data);
        });
    });

    console.log('Listeners en tiempo real configurados');
}

// Manejar datos remotos
function handleRemoteData(collection, key, data) {
    if (!db || !db.isReady) return;

    var localCollection = null;
    for (var local in collectionMap) {
        if (collectionMap[local] === collection) {
            localCollection = local;
            break;
        }
    }

    if (!localCollection) return;

    // Guardar en IndexedDB local
    saveToLocal(localCollection, key, data);
}

// Guardar datos en local
function saveToLocal(collection, firebaseKey, data) {
    if (!db || !db.isReady) return;

    try {
        var record = Object.assign({}, data, { firebaseKey: firebaseKey });

        switch (collection) {
            case 'products':
                db.getAllProducts().then(function(products) {
                    var exists = products.find(function(p) { return p.firebaseKey === firebaseKey; });
                    if (!exists) {
                        db.addProduct(record);
                    }
                });
                break;
            case 'sales':
                // Las ventas son de solo lectura desde Firebase
                // Se crean localmente y se sincronizan hacia arriba
                break;
            case 'layaways':
                db.getAllLayaways().then(function(layaways) {
                    // Verificar si el apartado ya existe por firebaseKey O por info del cliente y fecha
                    var exists = layaways.find(function(l) { 
                        // Verificar por firebaseKey primero
                        if (l.firebaseKey === firebaseKey) return true;
                        // También verificar por nombre, teléfono y fecha aproximada (mismo día)
                        if (l.customerName === record.customerName && 
                            l.customerPhone === record.customerPhone) {
                            // Verificar que las fechas sean válidas antes de comparar
                            if (l.date && record.date) {
                                var localDate = new Date(l.date);
                                var remoteDate = new Date(record.date);
                                // Verificar que las fechas son válidas
                                if (!isNaN(localDate.getTime()) && !isNaN(remoteDate.getTime())) {
                                    if (localDate.toDateString() === remoteDate.toDateString()) {
                                        // Actualizar el registro local con firebaseKey para futuras sincronizaciones
                                        l.firebaseKey = firebaseKey;
                                        db.updateLayaway(l);
                                        return true;
                                    }
                                }
                            }
                        }
                        return false;
                    });
                    if (!exists) {
                        var store = db.getStore('layaways', 'readwrite');
                        store.add(record);
                    }
                });
                break;
            case 'owners':
                if (data.name) {
                    db.getAllOwners().then(function(owners) {
                        var exists = owners.find(function(o) { return o.name === data.name; });
                        if (!exists) {
                            db.addOwner(data.name);
                        }
                    });
                }
                break;
            case 'settings':
                if (data.value !== undefined) {
                    db.saveSetting(firebaseKey, data.value);
                }
                break;
        }
    } catch (e) {
        console.error('Error guardando localmente:', e);
    }
}

// Subir datos locales a Firebase
function uploadLocalData() {
    if (!firebaseDb || !isLoggedIn || !db || !db.isReady) return;

    // Subir productos
    db.getAllProducts().then(function(products) {
        products.forEach(function(product) {
            var key = product.firebaseKey || ('local_' + product.id);
            var path = getFirebasePath('products') + '/' + key;
            var data = Object.assign({}, product);
            delete data.id;
            data.updatedAt = data.updatedAt || new Date().toISOString();
            firebaseDb.ref(path).set(data);
        });
    });

    // Subir ventas
    db.getAllSales().then(function(sales) {
        sales.forEach(function(sale) {
            var key = sale.firebaseKey || ('local_' + sale.id);
            var path = getFirebasePath('sales') + '/' + key;
            var data = Object.assign({}, sale);
            delete data.id;
            data.updatedAt = data.updatedAt || new Date().toISOString();
            firebaseDb.ref(path).set(data);
        });
    });

    // Subir apartados
    db.getAllLayaways().then(function(layaways) {
        layaways.forEach(function(layaway) {
            var key = layaway.firebaseKey || ('local_' + layaway.id);
            var path = getFirebasePath('layaways') + '/' + key;
            var data = Object.assign({}, layaway);
            delete data.id;
            data.updatedAt = data.updatedAt || new Date().toISOString();
            firebaseDb.ref(path).set(data);
        });
    });

    // Subir dueñas
    db.getAllOwners().then(function(owners) {
        owners.forEach(function(owner) {
            var key = owner.firebaseKey || ('owner_' + owner.id);
            var path = getFirebasePath('owners') + '/' + key;
            var data = { name: owner.name, updatedAt: new Date().toISOString() };
            firebaseDb.ref(path).set(data);
        });
    });

    // Subir configuración
    db.getAllSettings().then(function(settings) {
        for (var key in settings) {
            var path = getFirebasePath('settings') + '/' + key;
            var data = { value: settings[key], updatedAt: new Date().toISOString() };
            firebaseDb.ref(path).set(data);
        }
    });

    console.log('Datos locales subidos a Firebase');
}

// Iniciar sincronización automática cada 10 segundos
function startAutoSync() {
    if (syncInterval) clearInterval(syncInterval);

    syncInterval = setInterval(function() {
        if (isLoggedIn) {
            uploadLocalData();
        }
    }, SYNC_INTERVAL_MS);

    console.log('Sincronización automática iniciada (cada 10 segundos)');
}

// Crear botón flotante morado con icono de refresh
function createSyncButton() {
    var btn = document.createElement('button');
    btn.id = 'sync-now-btn';
    btn.innerHTML = '🔄';
    btn.title = 'Sincronizar ahora';
    btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;' +
        'background:linear-gradient(135deg,#8B5CF6 0%,#7C3AED 100%);' +
        'color:white;border:none;width:48px;height:48px;border-radius:50%;' +
        'font-size:20px;display:flex;align-items:center;justify-content:center;' +
        'cursor:pointer;box-shadow:0 4px 15px rgba(139,92,246,0.4);' +
        'transition:all 0.3s ease;';

    btn.onmouseover = function() {
        btn.style.transform = 'scale(1.05)';
        btn.style.boxShadow = '0 6px 20px rgba(139,92,246,0.5)';
    };

    btn.onmouseout = function() {
        btn.style.transform = 'scale(1)';
        btn.style.boxShadow = '0 4px 15px rgba(139,92,246,0.4)';
    };

    btn.onclick = function() {
        btn.style.animation = 'spin 1s linear infinite';
        btn.disabled = true;

        if (isLoggedIn) {
            uploadLocalData();
        }

        setTimeout(function() {
            location.reload();
        }, RELOAD_DELAY_MS);
    };

    // Add spin animation for loading state
    var style = document.createElement('style');
    style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
    document.head.appendChild(style);

    document.body.appendChild(btn);
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Crear botón flotante
    createSyncButton();

    // Esperar a que IndexedDB esté lista
    setTimeout(function() {
        var initialized = initFirebase();

        if (initialized) {
            // Configurar listener de autenticación
            firebaseAuth.onAuthStateChanged(function(user) {
                if (user) {
                    isLoggedIn = true;
                    console.log('Usuario autenticado:', user.email);
                    setupRealtimeListeners();
                    startAutoSync();
                } else {
                    isLoggedIn = false;
                    autoLogin();
                }
            });
        }
    }, 2000);
});

// Exponer función para sincronización manual
window.syncNow = function() {
    if (isLoggedIn) {
        uploadLocalData();
    }
};

// API de sincronización Firebase para uso desde app.js
var firebaseSync = {
    isUserAuthenticated: function() {
        return isLoggedIn;
    },
    uploadSingle: function(collection, record) {
        return new Promise(function(resolve, reject) {
            if (!firebaseDb || !isLoggedIn) {
                reject(new Error('Firebase no disponible'));
                return;
            }
            
            try {
                var key = record.firebaseKey || ('local_' + record.id);
                var path = getFirebasePath(collection) + '/' + key;
                var data = Object.assign({}, record);
                delete data.id;
                data.updatedAt = data.updatedAt || new Date().toISOString();
                
                firebaseDb.ref(path).set(data).then(function() {
                    // Actualizar registro local con firebaseKey si no está establecido
                    if (!record.firebaseKey && record.id) {
                        record.firebaseKey = key;
                        if (collection === 'layaways') {
                            db.updateLayaway(record);
                        }
                    }
                    resolve();
                }).catch(reject);
            } catch (e) {
                reject(e);
            }
        });
    }
};

window.firebaseSync = firebaseSync;

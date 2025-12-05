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

// Mapa para rastrear operaciones de guardado pendientes y prevenir duplicados
var pendingSaveOperations = {};

// Inicializar Firebase
function initFirebase() {
    try {
        if (typeof firebase === 'undefined') {
            console.warn('Firebase SDK no disponible - Los datos solo estarán disponibles localmente');
            updateConnectionStatus('offline', 'Sin conexión a la nube');
            showFirebaseWarning();
            return false;
        }

        if (!firebase.apps.length) {
            firebaseApp = firebase.initializeApp(firebaseConfig);
        } else {
            firebaseApp = firebase.apps[0];
        }

        firebaseDb = firebase.database();
        firebaseAuth = firebase.auth();

        console.log('Firebase inicializado correctamente');
        return true;
    } catch (e) {
        console.error('Error inicializando Firebase:', e);
        updateConnectionStatus('offline', 'Error de conexión');
        showFirebaseWarning();
        return false;
    }
}

// Mostrar advertencia cuando Firebase no está disponible
function showFirebaseWarning() {
    var warningBanner = document.createElement('div');
    warningBanner.id = 'firebase-warning-banner';
    warningBanner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:10000;' +
        'background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);' +
        'color:white;padding:12px 20px;text-align:center;' +
        'box-shadow:0 2px 10px rgba(0,0,0,0.2);font-size:14px;' +
        'display:flex;align-items:center;justify-content:center;gap:10px;';
    
    warningBanner.innerHTML = '⚠️ <span>Sincronización en la nube no disponible. Los datos solo se guardan localmente.</span> ' +
        '<button id="retry-firebase-btn" style="background:white;color:#d97706;border:none;' +
        'padding:6px 12px;border-radius:4px;cursor:pointer;font-weight:600;">Reintentar</button>';
    
    document.body.appendChild(warningBanner);
    
    // Handler para reintentar conexión
    document.getElementById('retry-firebase-btn').onclick = function() {
        location.reload();
    };
}

// Actualizar el estado de conexión en la UI
function updateConnectionStatus(status, message) {
    var statusElement = document.getElementById('connection-status');
    if (statusElement) {
        var statusDot = statusElement.querySelector('.status-dot');
        var statusText = statusElement.querySelector('.status-text');
        
        if (statusDot) {
            statusDot.className = 'status-dot ' + status;
        }
        
        if (statusText) {
            statusText.textContent = message || (status === 'online' ? 'En línea' : 'Sin conexión');
        }
    }
}

// Login automático
function autoLogin() {
    if (!firebaseAuth) {
        console.warn('Firebase Auth no disponible - no se puede iniciar sesión');
        return;
    }

    firebaseAuth.signInWithEmailAndPassword(autoEmail, autoPassword)
        .then(function(userCredential) {
            isLoggedIn = true;
            console.log('Login exitoso - Sincronización activa:', userCredential.user.email);
            updateConnectionStatus('online', 'Conectado a la nube');
            // Ocultar banner de advertencia si existe
            var warningBanner = document.getElementById('firebase-warning-banner');
            if (warningBanner) {
                warningBanner.style.display = 'none';
            }
            setupRealtimeListeners();
            startAutoSync();
        })
        .catch(function(error) {
            console.error('Error en login a Firebase:', error.message);
            updateConnectionStatus('offline', 'Error de autenticación');
            showFirebaseWarning();
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

        // Listener para eliminaciones
        ref.on('child_removed', function(snapshot) {
            var key = snapshot.key;
            console.log('Eliminado de ' + col + ':', key);
            handleRemoteDelete(col, key);
        });
    });

    console.log('Listeners en tiempo real configurados');
}

// Manejar eliminaciones remotas
function handleRemoteDelete(collection, firebaseKey) {
    if (!db || !db.isReady) return;

    var localCollection = null;
    for (var local in collectionMap) {
        if (collectionMap[local] === collection) {
            localCollection = local;
            break;
        }
    }

    if (!localCollection) return;

    // Eliminar de IndexedDB local
    deleteFromLocal(localCollection, firebaseKey);
}

// Eliminar datos de local
function deleteFromLocal(collection, firebaseKey) {
    if (!db || !db.isReady) return;

    try {
        switch (collection) {
            case 'products':
                db.getAllProducts().then(function(products) {
                    var product = products.find(function(p) { return p.firebaseKey === firebaseKey; });
                    if (product && product.id) {
                        db.deleteProduct(product.id).then(function() {
                            console.log('Producto eliminado localmente:', product.name);
                        }).catch(function(err) {
                            console.error('Error eliminando producto localmente:', err);
                        });
                    }
                }).catch(function(err) {
                    console.error('Error obteniendo productos para eliminación:', err);
                });
                break;
            case 'layaways':
                db.getAllLayaways().then(function(layaways) {
                    var layaway = layaways.find(function(l) { return l.firebaseKey === firebaseKey; });
                    if (layaway && layaway.id) {
                        // Solo eliminar si está pendiente (no completado)
                        if (layaway.status === 'pending') {
                            // Usar acceso directo al store en lugar de db.deleteLayaway() 
                            // porque db.deleteLayaway() restaura el stock, pero al sincronizar 
                            // desde Firebase el stock ya fue restaurado en el dispositivo original
                            try {
                                var store = db.getStore('layaways', 'readwrite');
                                var request = store.delete(layaway.id);
                                request.onsuccess = function() {
                                    console.log('Apartado eliminado localmente:', layaway.customerName);
                                };
                                request.onerror = function() {
                                    console.error('Error eliminando apartado localmente:', request.error);
                                };
                            } catch (storeErr) {
                                console.error('Error accediendo al store de apartados:', storeErr);
                            }
                        }
                    }
                }).catch(function(err) {
                    console.error('Error obteniendo apartados para eliminación:', err);
                });
                break;
            case 'owners':
                db.getAllOwners().then(function(owners) {
                    var owner = owners.find(function(o) { return o.firebaseKey === firebaseKey; });
                    if (owner && owner.id) {
                        db.deleteOwner(owner.id).then(function() {
                            console.log('Dueña eliminada localmente:', owner.name);
                        }).catch(function(err) {
                            console.error('Error eliminando dueña localmente:', err);
                        });
                    }
                }).catch(function(err) {
                    console.error('Error obteniendo dueñas para eliminación:', err);
                });
                break;
            // sales y settings no se eliminan remotamente
        }
    } catch (e) {
        console.error('Error eliminando localmente:', e);
    }
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
                    // Verificar si el producto ya existe por firebaseKey, SKU o nombre+precio
                    var exists = products.find(function(p) { 
                        // Verificar por firebaseKey primero
                        if (p.firebaseKey === firebaseKey) return true;
                        // También verificar por SKU si existe
                        if (p.sku && record.sku && p.sku === record.sku) {
                            // Actualizar el registro local con firebaseKey para futuras sincronizaciones
                            if (!p.firebaseKey) {
                                p.firebaseKey = firebaseKey;
                                db.updateProduct(p).catch(function(err) {
                                    console.error('Error actualizando firebaseKey del producto:', err);
                                });
                            }
                            return true;
                        }
                        // También verificar por nombre y precio (para productos sin SKU)
                        if (p.name === record.name && p.price === record.price) {
                            // Actualizar el registro local con firebaseKey para futuras sincronizaciones
                            if (!p.firebaseKey) {
                                p.firebaseKey = firebaseKey;
                                db.updateProduct(p).catch(function(err) {
                                    console.error('Error actualizando firebaseKey del producto:', err);
                                });
                            }
                            return true;
                        }
                        return false;
                    });
                    if (!exists) {
                        db.addProduct(record).catch(function(err) {
                            console.error('Error agregando producto desde Firebase:', err);
                        });
                    }
                }).catch(function(err) {
                    console.error('Error obteniendo productos para sincronización:', err);
                });
                break;
            case 'sales':
                // Las ventas son de solo lectura desde Firebase
                // Se crean localmente y se sincronizan hacia arriba
                break;
            case 'layaways':
                // Prevenir operaciones duplicadas concurrentes usando un lock
                var operationKey = 'layaway_' + firebaseKey;
                if (pendingSaveOperations[operationKey]) {
                    console.log('Operación de guardado de apartado ya en progreso para:', firebaseKey);
                    return;
                }
                pendingSaveOperations[operationKey] = true;
                
                console.log('Sincronizando apartado desde Firebase:', firebaseKey, record.customerName);
                
                db.getAllLayaways().then(function(layaways) {
                    console.log('Total de apartados locales antes de sincronizar:', layaways.length);
                    
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
                                        if (!l.firebaseKey) {
                                            console.log('Vinculando apartado existente con Firebase key:', firebaseKey);
                                            l.firebaseKey = firebaseKey;
                                            db.updateLayaway(l);
                                        }
                                        return true;
                                    }
                                }
                            }
                        }
                        return false;
                    });
                    if (!exists) {
                        try {
                            var store = db.getStore('layaways', 'readwrite');
                            var request = store.add(record);
                            request.onsuccess = function() {
                                console.log('✓ Apartado agregado desde Firebase:', record.customerName, '- ID:', request.result);
                                delete pendingSaveOperations[operationKey];
                                // Recargar la lista de apartados si estamos en esa página
                                if (window.loadLayaways && typeof window.loadLayaways === 'function') {
                                    window.loadLayaways();
                                }
                            };
                            request.onerror = function() {
                                console.error('✗ Error agregando apartado:', request.error);
                                delete pendingSaveOperations[operationKey];
                            };
                        } catch (storeErr) {
                            console.error('✗ Error accediendo al store de apartados:', storeErr);
                            delete pendingSaveOperations[operationKey];
                        }
                    } else {
                        console.log('Apartado ya existe localmente, no se duplica');
                        delete pendingSaveOperations[operationKey];
                    }
                }).catch(function(err) {
                    console.error('✗ Error obteniendo apartados para sincronización:', err);
                    delete pendingSaveOperations[operationKey];
                });
                break;
            case 'owners':
                if (data.name) {
                    db.getAllOwners().then(function(owners) {
                        var exists = owners.find(function(o) { return o.name === data.name; });
                        if (!exists) {
                            db.addOwner(data.name).catch(function(err) {
                                console.error('Error agregando dueña:', err);
                            });
                        }
                    }).catch(function(err) {
                        console.error('Error obteniendo dueñas para sincronización:', err);
                    });
                }
                break;
            case 'settings':
                if (data.value !== undefined) {
                    db.saveSetting(firebaseKey, data.value).catch(function(err) {
                        console.error('Error guardando configuración:', err);
                    });
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
                        } else if (collection === 'products') {
                            db.updateProduct(record);
                        }
                    }
                    resolve();
                }).catch(reject);
            } catch (e) {
                reject(e);
            }
        });
    },
    deleteSingle: function(collection, localId, firebaseKey) {
        return new Promise(function(resolve, reject) {
            if (!firebaseDb || !isLoggedIn) {
                reject(new Error('Firebase no disponible'));
                return;
            }
            
            try {
                // Si tenemos firebaseKey, usar ese; sino, intentar con local_id
                var key = firebaseKey || ('local_' + localId);
                var path = getFirebasePath(collection) + '/' + key;
                
                firebaseDb.ref(path).remove().then(function() {
                    console.log('Eliminado de Firebase:', path);
                    resolve();
                }).catch(reject);
            } catch (e) {
                reject(e);
            }
        });
    }
};

window.firebaseSync = firebaseSync;

// Función de diagnóstico para ayudar a depurar problemas de sincronización
window.diagnosticoFirebase = function() {
    console.log('=== DIAGNÓSTICO DE FIREBASE ===');
    console.log('Firebase SDK disponible:', typeof firebase !== 'undefined');
    console.log('Firebase App inicializado:', firebaseApp !== null);
    console.log('Firebase Database disponible:', firebaseDb !== null);
    console.log('Firebase Auth disponible:', firebaseAuth !== null);
    console.log('Usuario autenticado:', isLoggedIn);
    console.log('Email configurado:', autoEmail);
    console.log('Ruta raíz en Firebase:', rootPath);
    
    if (isLoggedIn && firebaseDb) {
        console.log('Intentando leer apartados de Firebase...');
        firebaseDb.ref(rootPath + '/apartados').once('value')
            .then(function(snapshot) {
                var data = snapshot.val();
                if (data) {
                    var count = Object.keys(data).length;
                    console.log('✓ Apartados encontrados en Firebase:', count);
                    console.log('Datos:', data);
                } else {
                    console.log('⚠ No hay apartados en Firebase');
                }
            })
            .catch(function(error) {
                console.error('✗ Error leyendo de Firebase:', error);
            });
    } else {
        console.log('⚠ No se puede leer de Firebase (no autenticado o no inicializado)');
    }
    
    // Verificar datos locales
    if (db && db.isReady) {
        db.getAllLayaways().then(function(layaways) {
            console.log('✓ Apartados locales en IndexedDB:', layaways.length);
            if (layaways.length > 0) {
                console.log('Detalles de apartados locales:', layaways.map(function(l) {
                    return {
                        id: l.id,
                        cliente: l.customerName,
                        telefono: l.customerPhone,
                        total: l.total,
                        estado: l.status,
                        firebaseKey: l.firebaseKey || 'sin key'
                    };
                }));
            }
        }).catch(function(err) {
            console.error('✗ Error leyendo IndexedDB:', err);
        });
    } else {
        console.log('⚠ IndexedDB no está lista');
    }
    
    console.log('=== FIN DEL DIAGNÓSTICO ===');
    console.log('Para ejecutar este diagnóstico nuevamente, escribe: diagnosticoFirebase()');
};

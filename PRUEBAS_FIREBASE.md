# Guía de Pruebas - Firebase Modular SDK

## Requisitos Previos

Antes de comenzar las pruebas, asegúrate de:

1. ✅ Aplicar reglas de seguridad en Firebase Console (ver `FIREBASE_SECURITY_RULES.md`)
2. ✅ Habilitar autenticación anónima en Firebase Console
3. ✅ Tener al menos 2 dispositivos disponibles para pruebas (o usar modo incógnito)

## Pruebas Básicas

### Test 1: Inicialización de Firebase

**Objetivo**: Verificar que Firebase se inicializa correctamente con el SDK modular

**Pasos**:
1. Abrir la aplicación en el navegador
2. Abrir consola de desarrollador (F12)
3. Buscar los siguientes mensajes:

**Resultado Esperado**:
```
✓ Firebase initialized successfully (modular SDK)
✓ Realtime Database offline persistence is enabled by default
✓ Anonymous login successful - User ID: [uid]
✓ Connected to Firebase
✓ Real-time listeners configured
✓ Auto-sync started (every 10 seconds)
```

**Estado Conexión**:
- 🟢 Indicador debe mostrar "En línea" o "Conectado a la nube"

**Si falla**:
- Banner naranja visible → Revisa reglas de seguridad y autenticación anónima
- Error de permisos → Ejecuta `diagnosticoFirebase()` para más detalles

---

### Test 2: Autenticación Anónima

**Objetivo**: Verificar que la autenticación anónima funciona automáticamente

**Pasos**:
1. Abrir aplicación
2. En consola, ejecutar: `diagnosticoFirebase()`

**Resultado Esperado**:
```
Firebase modules available: true
Firebase App initialized: true
Firebase Database available: true
Firebase Auth available: true
User authenticated: true
User ID: [uid único]
```

**Validación Adicional**:
- Cada dispositivo debe obtener un UID diferente
- Todos los dispositivos pueden leer/escribir en Firebase
- No se requiere login manual

**Si falla**:
- `User authenticated: false` → Autenticación anónima no habilitada en Firebase Console
- `Firebase Auth available: false` → Problema cargando Firebase SDK

---

### Test 3: Persistencia Offline

**Objetivo**: Verificar que la aplicación funciona sin conexión y sincroniza al reconectar

**Pasos**:
1. Abrir aplicación con internet
2. Verificar que conexión esté 🟢 (verde)
3. Desconectar internet (modo avión o WiFi off)
4. Verificar que conexión cambie a 🔴 (rojo) y muestre "Sin conexión"
5. Crear una nueva venta:
   - Agregar productos al carrito
   - Completar venta
   - Verificar que se crea localmente con ticket #
6. Reconectar internet
7. Esperar 2-3 segundos

**Resultado Esperado**:
- La venta se sube automáticamente a Firebase
- Conexión vuelve a 🟢 (verde)
- En consola: `✓ Connected to Firebase` y `✓ Local data uploaded to Firebase`

**Si falla**:
- Venta no se sube → Verificar en consola si hay errores de permisos
- Conexión no detecta reconexión → Verificar listener de `.info/connected`

---

### Test 4: Sincronización entre Dispositivos

**Objetivo**: Verificar que los cambios se sincronizan automáticamente entre dispositivos

**Configuración**:
- Dispositivo A: Tu computadora
- Dispositivo B: Tu celular (o modo incógnito en otro navegador)

**Pasos**:

#### Prueba 4.1: Crear Producto
1. En Dispositivo A: Crear un nuevo producto
   - Nombre: "Prueba Sync Test"
   - Precio: $99.99
   - Categoría: Ropa
2. En Dispositivo B: Ir a página de Productos
3. Esperar máximo 2-3 segundos

**Resultado Esperado**:
- El producto aparece automáticamente en Dispositivo B
- Sin necesidad de recargar manualmente

#### Prueba 4.2: Crear Venta
1. En Dispositivo A: Crear una venta
2. En Dispositivo B: Ir a página de Ventas
3. Esperar máximo 2-3 segundos

**Resultado Esperado**:
- La venta aparece en Dispositivo B
- Totales se actualizan automáticamente

#### Prueba 4.3: Crear Apartado
1. En Dispositivo A: Crear un apartado
   - Cliente: "Test Cliente"
   - Teléfono: "1234567890"
   - Agregar productos
   - Abono inicial: $100
2. En Dispositivo B: Ir a página de Apartados
3. Esperar máximo 2-3 segundos

**Resultado Esperado**:
- Apartado aparece en Dispositivo B
- Saldo pendiente correcto

**Si falla**:
- No aparece → Verificar listeners en consola
- Aparece tarde (>5 segundos) → Normal, puede ser conexión lenta
- No sincroniza → Ejecutar `diagnosticoFirebase()` en ambos dispositivos

---

### Test 5: Transacciones - Prevenir Conflictos

**Objetivo**: Verificar que las transacciones previenen sobrescrituras cuando múltiples dispositivos modifican el mismo dato

#### Prueba 5.1: Abonos Simultáneos
**Configuración**: 2 dispositivos, mismo apartado abierto

**Pasos**:
1. Dispositivo A: Abrir apartado pendiente (con saldo > $50)
2. Dispositivo B: Abrir el MISMO apartado
3. Dispositivo A: Agregar abono de $20
4. Dispositivo B (inmediatamente): Agregar abono de $30
5. En ambos dispositivos: Verificar total de abonos

**Resultado Esperado**:
- Ambos abonos se registran correctamente
- Total pagado = suma de ambos abonos ($50)
- Sin sobrescrituras
- En consola: `✓ Layaway payment added via transaction`

**Si falla**:
- Solo un abono registrado → Transaction falló, revisa consola
- Total incorrecto → Problema con recalculación

#### Prueba 5.2: Ventas Simultáneas
**Pasos**:
1. Dispositivo A y B: Crear ventas al mismo tiempo
2. Verificar que ambas se registren con ticket # únicos

**Resultado Esperado**:
- Ambas ventas en Firebase
- Tickets diferentes
- En consola: `✓ Sale created via transaction`

---

### Test 6: Listeners en Tiempo Real

**Objetivo**: Verificar que la UI se recarga automáticamente cuando detecta cambios

**Pasos**:
1. Dispositivo A: Ir a página de Productos
2. Dispositivo B: Agregar un producto nuevo
3. En Dispositivo A: Observar la página (NO recargar manualmente)

**Resultado Esperado**:
- Producto aparece automáticamente en Dispositivo A después de 1-2 segundos
- En consola de Dispositivo A: 
  ```
  📡 Data received for productos: X items
  ```

**Repetir para otras secciones**:
- Ventas → Agregar venta en B, ver en A
- Apartados → Agregar apartado en B, ver en A
- Settings → Cambiar config en B, ver en A

**Si falla**:
- No se recarga → Verificar listeners en consola
- Se recarga en loop → Problema con debounce, reportar

---

### Test 7: Indicador de Conexión

**Objetivo**: Verificar que el indicador refleja el estado real de conexión

**Pasos**:
1. Con internet: Verificar 🟢 "En línea"
2. Desconectar: Verificar 🔴 "Sin conexión"
3. Reconectar: Verificar 🟢 "En línea"
4. En consola al reconectar: `✓ Connected to Firebase`

**Resultado Esperado**:
- Cambios instantáneos (<1 segundo)
- Estado consistente con conexión real

---

### Test 8: Botón de Sincronización Manual

**Objetivo**: Verificar que el botón flotante morado sincroniza correctamente

**Pasos**:
1. Hacer algunos cambios (agregar productos, ventas, etc.)
2. Hacer clic en botón 🔄 (esquina inferior derecha)
3. Observar animación de giro
4. Página se recarga automáticamente después de 1.5 segundos

**Resultado Esperado**:
- En consola antes de recargar: `✓ Local data uploaded to Firebase`
- Después de recargar: Todos los cambios persisten

---

## Pruebas Avanzadas

### Test 9: Multi-Tab en Mismo Navegador

**Objetivo**: Verificar que múltiples pestañas funcionan correctamente

**Pasos**:
1. Abrir aplicación en pestaña 1
2. Abrir aplicación en pestaña 2 (mismo navegador)
3. En pestaña 1: Agregar producto
4. En pestaña 2: Observar (sin recargar)

**Resultado Esperado**:
- Producto aparece en pestaña 2 automáticamente
- No hay errores en consola sobre IndexedDB locks

---

### Test 10: Recuperación de Errores

**Objetivo**: Verificar que la aplicación se recupera de errores

#### Escenario 1: Desconexión durante Venta
1. Iniciar una venta
2. Agregar productos
3. Desconectar internet
4. Completar venta
5. Reconectar internet

**Resultado Esperado**:
- Venta se crea localmente
- Se sube a Firebase al reconectar

#### Escenario 2: Desconexión durante Sincronización
1. Hacer varios cambios
2. Desconectar internet justo antes de sincronización automática (10 seg)
3. Reconectar después de 30 segundos

**Resultado Esperado**:
- Todos los cambios se sincronizan al reconectar

---

## Checklist de Validación

Marca cada ítem después de probarlo exitosamente:

### Inicialización
- [ ] Firebase SDK modular se carga correctamente
- [ ] Autenticación anónima funciona
- [ ] Indicador de conexión muestra estado correcto

### Funcionalidad Offline
- [ ] Aplicación funciona sin internet
- [ ] Datos se guardan localmente
- [ ] Sincroniza automáticamente al reconectar

### Sincronización entre Dispositivos
- [ ] Productos sincronizan
- [ ] Ventas sincronizan
- [ ] Apartados sincronizan
- [ ] Settings sincronizan

### Transacciones
- [ ] Abonos simultáneos no se sobrescriben
- [ ] Ventas simultáneas no se duplican
- [ ] Totales se calculan correctamente

### Listeners en Tiempo Real
- [ ] UI se recarga automáticamente al detectar cambios
- [ ] No hay loops infinitos de actualización
- [ ] Debounce funciona (no recarga cada milisegundo)

### UX
- [ ] Botón de sincronización manual funciona
- [ ] Indicador de conexión actualiza en tiempo real
- [ ] Sin banners de error cuando todo funciona

---

## Métricas de Rendimiento

### Tiempos Esperados
- Inicialización Firebase: < 2 segundos
- Login anónimo: < 1 segundo
- Sincronización de cambio: 1-3 segundos
- Detección de reconexión: < 1 segundo
- Upload manual (botón 🔄): < 2 segundos

### Ancho de Banda
- Sincronización incremental: Solo cambios (< 1KB por operación típica)
- Sincronización completa: Variable según datos (típicamente < 100KB)

---

## Herramientas de Debugging

### Función Diagnóstico
```javascript
diagnosticoFirebase()
```
Muestra estado completo de Firebase y datos locales

### Console Logs Importantes
- `✓` = Operación exitosa
- `⚠` = Advertencia (puede funcionar pero revisar)
- `✗` = Error crítico
- `📡` = Datos recibidos de Firebase

### Firebase Console
- **Database**: Ver datos en tiempo real
- **Usage**: Monitorear operaciones y ancho de banda
- **Auth**: Ver usuarios anónimos activos

---

## Reportar Problemas

Si encuentras un problema:

1. ✅ Ejecuta `diagnosticoFirebase()` y copia resultado
2. ✅ Abre consola (F12) y copia todos los logs
3. ✅ Toma captura de pantalla
4. ✅ Describe pasos exactos para reproducir
5. ✅ Indica navegador y versión
6. ✅ Indica si es móvil o escritorio

---

**Última actualización**: Diciembre 18, 2025  
**Versión**: 2.0.0  
**Firebase SDK**: 12.7.0 (Modular)

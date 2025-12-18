# Fix: Firebase Permission Denied Error (local_undefined)

## Problema Identificado

El error que aparecía en la consola:
```
FIREBASE WARNING: set at /graciadivina_ketzy2025/apartados/local_undefined failed: permission_denied
Error uploading local data: Error: PERMISSION_DENIED: Permission denied
```

## Causa Raíz

El problema ocurría debido a un conflicto en la sincronización bidireccional entre Firebase y IndexedDB:

1. **Bajada de datos** (Firebase → IndexedDB):
   - Los apartados se descargan de Firebase con su `firebaseKey`
   - Se guardan en IndexedDB usando `store.add()`, que genera un `id` automático
   - Pero el código no capturaba este `id` generado automáticamente

2. **Subida de datos** (IndexedDB → Firebase):
   - La función `uploadLocalData()` intentaba subir **TODOS** los apartados locales
   - Para items con `firebaseKey` pero sin `id`, se generaba la clave `local_undefined`
   - Firebase rechazaba esta clave inválida con error de permisos

## Solución Implementada

### 1. Prevenir Re-subidas Innecesarias

Modificamos `uploadLocalData()` para que **solo** suba items nuevos creados localmente:

```javascript
// Antes (INCORRECTO)
const key = layaway.firebaseKey || ('local_' + layaway.id);
// Esto creaba 'local_undefined' si id era undefined

// Después (CORRECTO)
if (layaway.firebaseKey) continue; // Skip - ya está en Firebase
if (!layaway.id) continue;          // Skip - item inválido
const key = 'local_' + layaway.id;  // Solo items locales válidos
```

### 2. Rastreo de firebaseKey

Después de subir exitosamente un item local, guardamos su `firebaseKey`:

```javascript
await modules.set(layawayRef, data);

// Marcar como sincronizado
layaway.firebaseKey = key;
await db.updateLayaway(layaway);
```

Esto previene que el mismo item se intente subir nuevamente en futuras sincronizaciones.

### 3. Nuevos Métodos de Base de Datos

Agregamos métodos faltantes en `db.js`:
- `updateSale()` - Para actualizar ventas con firebaseKey
- `updateOwner()` - Para actualizar dueñas con firebaseKey

## Archivos Modificados

1. **js/firebase-sync-modular.js** - SDK modular de Firebase
   - Función `uploadLocalData()` mejorada
   - Lógica para products, sales, layaways y owners

2. **js/firebase-sync.js** - SDK legacy de Firebase
   - Mismos cambios para compatibilidad con Windows 7

3. **js/db.js** - Base de datos IndexedDB
   - Método `updateSale()` agregado
   - Método `updateOwner()` agregado

## Beneficios

✅ **Elimina errores de permisos**: No más `local_undefined`
✅ **Reduce escrituras**: No re-sube items ya sincronizados
✅ **Mejora eficiencia**: Solo sube lo que realmente necesita
✅ **Previene duplicados**: Evita conflictos de datos

## Verificación

### Antes del Fix
```
FIREBASE WARNING: set at /graciadivina_ketzy2025/apartados/local_undefined failed: permission_denied
Error uploading local data: Error: PERMISSION_DENIED: Permission denied
```
Este error aparecía cada 10 segundos en la consola.

### Después del Fix
La consola debe mostrar solo:
```
✓ Local data uploaded to Firebase
```
Sin errores de permisos.

### Cómo Probar

1. Abrir la aplicación en el navegador
2. Abrir la consola de desarrollador (F12)
3. Esperar 10-20 segundos (ciclo de auto-sync)
4. Verificar que NO aparezcan errores de `permission_denied`
5. Ejecutar `diagnosticoFirebase()` en la consola

**Resultado esperado:**
```
✓ Apartados encontrados en Firebase: X
✓ Apartados locales en IndexedDB: X
```
Sin mensajes de error.

## Detalles Técnicos

### Flujo de Sincronización Corregido

```
┌─────────────────────────────────────────────────────┐
│ Item Creado Localmente                              │
├─────────────────────────────────────────────────────┤
│ 1. Se guarda en IndexedDB con id auto-generado     │
│ 2. uploadLocalData() lo detecta (sin firebaseKey)  │
│ 3. Se sube a Firebase con clave local_${id}        │
│ 4. Se actualiza localmente con firebaseKey         │
│ 5. Próximas sincronizaciones lo SALTAN             │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Item Descargado de Firebase                         │
├─────────────────────────────────────────────────────┤
│ 1. Llega con firebaseKey desde Firebase            │
│ 2. Se guarda en IndexedDB                          │
│ 3. uploadLocalData() lo SALTA (ya tiene key)       │
│ 4. No se intenta re-subir a Firebase               │
└─────────────────────────────────────────────────────┘
```

### Validación de Items

Antes de subir, validamos:
```javascript
✓ Tiene firebaseKey? → SKIP (ya sincronizado)
✓ Tiene id válido?    → SKIP (item inválido)
✓ Es item local?      → UPLOAD (necesita sync)
```

## Impacto en Dispositivos Múltiples

### Sincronización Multi-Dispositivo

- **Dispositivo A** crea un apartado
  - Se guarda localmente con `id: 42`
  - Se sube a Firebase como `local_42`
  - Se marca con `firebaseKey: "local_42"`

- **Dispositivo B** recibe el apartado
  - Lo descarga de Firebase con `firebaseKey: "local_42"`
  - Lo guarda localmente con nuevo `id: 15` (auto-generado)
  - NO intenta re-subirlo (ya tiene firebaseKey)

Ambos dispositivos mantienen sus propios `id` locales, pero comparten el mismo `firebaseKey` para identificar el registro en Firebase.

## Notas Importantes

⚠️ **No afecta datos existentes**: Los apartados ya sincronizados seguirán funcionando normalmente.

⚠️ **Compatibilidad**: El fix funciona tanto en el SDK modular como en el legacy.

⚠️ **Sin migración**: No requiere migración de datos ni actualización de estructura.

## Contacto

Si persisten errores después de aplicar este fix, ejecuta `diagnosticoFirebase()` en la consola y comparte el resultado completo.

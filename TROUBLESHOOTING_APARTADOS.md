# Guía de Solución de Problemas: Apartados

## Problema: "No aparecen mis apartados"

Si tienes apartados registrados pero no se muestran en la sección "Apartados", sigue esta guía.

## Diagnóstico Rápido

### Paso 1: Verificar indicadores visuales

#### Banner de advertencia (parte superior)
Si ves un banner naranja con el mensaje:
```
⚠️ Sincronización en la nube no disponible. Los datos solo se guardan localmente.
```
**Causa:** Firebase no está conectado.

#### Estado de conexión (menú lateral, parte inferior)
- 🟢 **"Conectado a la nube"** = Funcionando correctamente
- 🔴 **"Sin conexión a la nube"** = Problema de conexión

### Paso 2: Ejecutar diagnóstico automático

1. Presiona `F12` para abrir Herramientas de Desarrollador
2. Ve a la pestaña **Console**
3. Escribe y ejecuta:
   ```javascript
   diagnosticoFirebase()
   ```

El diagnóstico mostrará:
```
=== DIAGNÓSTICO DE FIREBASE ===
Firebase SDK disponible: true/false
Firebase App inicializado: true/false
Usuario autenticado: true/false
✓ Apartados encontrados en Firebase: X
✓ Apartados locales en IndexedDB: X
=== FIN DEL DIAGNÓSTICO ===
```

## Soluciones por Escenario

### Escenario A: Firebase SDK no disponible
**Síntomas:**
- Banner naranja visible
- Diagnóstico muestra: `Firebase SDK disponible: false`

**Causas:**
1. Bloqueador de contenido (AdBlock, uBlock, etc.)
2. Extensiones de privacidad
3. Firewall corporativo
4. Problemas de red

**Soluciones:**
1. **Desactivar bloqueadores:**
   - Agrega el sitio a la lista blanca de tu bloqueador
   - O desactiva temporalmente el bloqueador

2. **Reintentar conexión:**
   - Haz clic en el botón "Reintentar" del banner naranja
   - O recarga la página (Ctrl+R / Cmd+R)

3. **Probar en modo incógnito:**
   - Abre el sitio en modo incógnito/privado
   - Si funciona, el problema es una extensión del navegador

4. **Cambiar de navegador:**
   - Prueba en Chrome, Edge, o Firefox
   - Algunos navegadores tienen bloqueadores integrados

### Escenario B: Firebase conectado pero sin datos
**Síntomas:**
- No hay banner naranja
- Diagnóstico muestra: `Firebase SDK disponible: true`
- Diagnóstico muestra: `Apartados encontrados en Firebase: 0`

**Causa:** No hay apartados guardados en Firebase

**Solución:**
- Los apartados se deben crear desde la aplicación
- Verifica que estás usando la cuenta correcta (ketzy@gmail.com)

### Escenario C: Datos en Firebase pero no localmente
**Síntomas:**
- Diagnóstico muestra: `Apartados encontrados en Firebase: 7`
- Diagnóstico muestra: `Apartados locales en IndexedDB: 0`

**Causa:** Sincronización no completada

**Soluciones:**
1. **Esperar sincronización automática:**
   - La sincronización ocurre cada 10 segundos
   - Espera 20-30 segundos y verifica nuevamente

2. **Forzar sincronización:**
   - Haz clic en el botón flotante morado 🔄 (esquina inferior derecha)
   - La página se recargará y sincronizará los datos

3. **Verificar autenticación:**
   - Si el diagnóstico muestra `Usuario autenticado: false`
   - Recarga la página para reintentar el login automático

### Escenario D: Error de deduplicación
**Síntomas:**
- Console muestra: "Apartado duplicado detectado y omitido"
- Menos apartados de los esperados

**Causa:** El sistema detectó apartados duplicados

**Solución:**
- Esto es un comportamiento protector normal
- Revisa los logs de la consola para ver qué apartados se marcaron como duplicados
- Si son apartados legítimos diferentes, contacta al desarrollador

## Prevención de Problemas

### Mejores Prácticas

1. **Mantén la aplicación actualizada:**
   - Haz clic en "Reintentar" cuando veas el banner naranja
   - Recarga la página periódicamente

2. **Usa el botón de sincronización:**
   - El botón morado 🔄 fuerza la sincronización
   - Úsalo después de crear/modificar apartados importantes

3. **Exporta respaldos regularmente:**
   - Ve a Configuración → Exportar Datos
   - Guarda el archivo JSON en un lugar seguro

4. **Verifica la conexión antes de trabajar:**
   - Revisa el estado de conexión en el menú lateral
   - Ejecuta `diagnosticoFirebase()` si tienes dudas

## Información Técnica

### Cómo funciona la sincronización

1. **Firebase (Nube):**
   - Almacenamiento principal en la nube
   - Accesible desde cualquier dispositivo
   - Ruta: `graciadivina_ketzy2025/apartados`

2. **IndexedDB (Local):**
   - Copia local en el navegador
   - Permite trabajar sin conexión
   - Se sincroniza automáticamente

3. **Flujo de sincronización:**
   ```
   Firebase ──sincronización──> IndexedDB ──lectura──> Interfaz
      ↑                                                    │
      └──────────────────guardado────────────────────────┘
   ```

### Logs útiles en la consola

Busca estos mensajes para diagnosticar:
- ✓ **"Apartado agregado desde Firebase"** = Sincronización exitosa
- ✗ **"Error obteniendo apartados"** = Error de lectura
- ⚠ **"Apartado duplicado detectado"** = Deduplicación activa
- 📊 **"Total de apartados en base de datos: X"** = Conteo local

## ¿Aún tienes problemas?

Si después de seguir esta guía el problema persiste:

1. Ejecuta `diagnosticoFirebase()` y copia el resultado completo
2. Abre las Herramientas de Desarrollador (F12)
3. Ve a la pestaña Console
4. Haz clic derecho → "Save as..." para guardar todos los logs
5. Toma capturas de pantalla de:
   - La sección de Apartados vacía
   - El banner de advertencia (si aparece)
   - Los logs de la consola
6. Contacta al desarrollador con esta información

## Notas Importantes

- 🔒 Los datos están seguros incluso sin Firebase
- 💾 IndexedDB guarda los datos localmente
- 🌐 Firebase es solo para sincronización entre dispositivos
- ⚡ La aplicación puede funcionar completamente offline
- 🔄 La sincronización es automática y continua

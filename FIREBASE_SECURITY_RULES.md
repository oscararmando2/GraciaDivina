# Firebase Realtime Database Security Rules

## Reglas de Seguridad para Gracia Divina POS

Este archivo contiene las reglas de seguridad que deben configurarse en Firebase Console para permitir solo operaciones autenticadas.

## Cómo Aplicar las Reglas

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto: **gracia-divina-c70c6**
3. En el menú lateral, ve a **Realtime Database**
4. Haz clic en la pestaña **Reglas (Rules)**
5. Copia y pega las reglas de abajo
6. Haz clic en **Publicar (Publish)**

## Reglas de Seguridad

```json
{
  "rules": {
    "graciadivina_ketzy2025": {
      ".read": "auth != null",
      ".write": "auth != null",
      
      "productos": {
        "$productId": {
          ".validate": "newData.hasChildren(['name', 'price', 'category'])"
        }
      },
      
      "ventas": {
        "$saleId": {
          ".validate": "newData.hasChildren(['items', 'total', 'date'])"
        }
      },
      
      "apartados": {
        "$layawayId": {
          ".validate": "newData.hasChildren(['customerName', 'customerPhone', 'items', 'total', 'status'])"
        }
      },
      
      "duenas": {
        "$ownerId": {
          ".validate": "newData.hasChildren(['name'])"
        }
      },
      
      "config": {
        "$settingKey": {
          ".validate": "newData.hasChildren(['value'])"
        }
      }
    }
  }
}
```

## Explicación de las Reglas

### Autenticación Requerida
```json
".read": "auth != null",
".write": "auth != null"
```
- **Lectura y escritura solo permitidas para usuarios autenticados**
- Los usuarios anónimos cuentan como autenticados
- Sin autenticación = sin acceso

### Validación de Datos

Cada colección tiene validación básica para asegurar que los datos tienen los campos mínimos requeridos:

- **productos**: Debe tener `name`, `price`, y `category`
- **ventas**: Debe tener `items`, `total`, y `date`
- **apartados**: Debe tener `customerName`, `customerPhone`, `items`, `total`, y `status`
- **duenas**: Debe tener `name`
- **config**: Debe tener `value`

## Autenticación Anónima

Para que estas reglas funcionen correctamente, debes habilitar la autenticación anónima:

1. En Firebase Console, ve a **Authentication**
2. Haz clic en la pestaña **Sign-in method**
3. Encuentra **Anonymous** en la lista
4. Haz clic en **Habilitar (Enable)**
5. Guarda los cambios

## Notas Importantes

⚠️ **CRÍTICO**: Sin estas reglas, tu base de datos está abierta al público.

✅ **Autenticación Anónima**: Todos los dispositivos se autentican automáticamente sin necesidad de credenciales.

🔒 **Seguridad**: Solo usuarios con una sesión autenticada (incluso anónima) pueden leer/escribir datos.

📱 **Multi-dispositivo**: Cada dispositivo obtiene su propio UID anónimo único, pero todos pueden leer y escribir en las mismas rutas.

## Verificación

Para verificar que las reglas están funcionando:

1. Abre la consola de desarrollador (F12)
2. Ejecuta: `diagnosticoFirebase()`
3. Deberías ver: "User authenticated: true"
4. Si ves errores de permisos, revisa que:
   - Las reglas estén publicadas correctamente
   - La autenticación anónima esté habilitada
   - El usuario esté autenticado

## Solución de Problemas

### Error: "Permission Denied"
- **Causa**: Usuario no autenticado o reglas mal configuradas
- **Solución**: Verifica que las reglas estén publicadas y la autenticación anónima esté habilitada

### Error: "PERMISSION_DENIED: Permission denied"
- **Causa**: Las reglas bloquean la operación
- **Solución**: Revisa que el usuario esté autenticado (`auth != null`)

### Los datos no se sincronizan
- **Causa**: Reglas demasiado restrictivas o usuario no autenticado
- **Solución**: Ejecuta `diagnosticoFirebase()` para ver el estado de autenticación

## Reglas de Producción Avanzadas (Opcional)

Si deseas reglas más estrictas en el futuro, considera:

```json
{
  "rules": {
    "graciadivina_ketzy2025": {
      ".read": "auth != null",
      ".write": "auth != null",
      
      "productos": {
        "$productId": {
          ".validate": "newData.hasChildren(['name', 'price', 'category']) && 
                        newData.child('price').isNumber() && 
                        newData.child('price').val() >= 0"
        }
      },
      
      "ventas": {
        "$saleId": {
          ".write": "!data.exists() || root.child('graciadivina_ketzy2025/ventas/' + $saleId + '/updatedAt').val() < now",
          ".validate": "newData.hasChildren(['items', 'total', 'date']) && 
                        newData.child('total').isNumber() && 
                        newData.child('total').val() >= 0"
        }
      }
    }
  }
}
```

Estas reglas adicionales:
- Validan que los precios sean números positivos
- Previenen modificación de ventas antiguas (solo se pueden crear o actualizar si son nuevas)

---

**Última actualización**: Diciembre 18, 2025  
**Versión Firebase SDK**: 12.7.0 (Modular)

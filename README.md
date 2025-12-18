# ✨ Gracia Divina - Sistema Punto de Venta

Una Progressive Web App (PWA) completa y hermosa diseñada como sistema Punto de Venta exclusivo para boutiques físicas de ropa y accesorios.

## 📱 Características

### Punto de Venta
- 🛒 Interfaz intuitiva para ventas rápidas
- 🔍 Búsqueda de productos en tiempo real
- 📦 Filtrado por categorías (Ropa, Accesorios, Zapatos, Bolsos)
- 💰 Carrito de compras con descuentos personalizables
- 💳 Múltiples métodos de pago (Efectivo, Tarjeta, Transferencia)
- 🧾 Generación automática de tickets

### Gestión de Productos
- ➕ Agregar, editar y eliminar productos
- 📊 Control de inventario y stock
- 🏷️ Sistema de categorización
- 🔖 Códigos SKU personalizables

### Historial de Ventas
- 📈 Resumen de ventas diarias y mensuales
- 🔍 Filtrado por rango de fechas
- 👁️ Vista detallada de cada venta
- 🖨️ Impresión de tickets

### Sincronización en la Nube (Multi-Dispositivo)
- 🌐 **Sincronización en tiempo real entre todos los dispositivos**
  - ✅ **Windows** (PC, laptops, tablets)
  - ✅ **Mac** (iMac, MacBook, iPad)
  - ✅ **iPhone** (todos los modelos con Safari)
  - ✅ **Android** (teléfonos y tablets con Chrome)
- 📡 Los cambios aparecen instantáneamente (1-3 segundos)
- 🔄 Sincronización bidireccional: cualquier dispositivo puede agregar/editar
- 🛡️ Sin conflictos al usar múltiples dispositivos simultáneamente
- 💾 Funciona offline y sincroniza automáticamente al reconectar

#### Ejemplo de Uso Multi-Dispositivo:
1. **Haces una venta en tu PC con Windows** → Se guarda localmente
2. **Aparece automáticamente en tu iPhone** → En 1-3 segundos
3. **También se ve en tu Mac** → Sin necesidad de hacer nada
4. **Agregas un producto desde el iPhone** → Todos los dispositivos lo verán

### Funcionalidades PWA
- 📴 Funciona sin conexión a internet
- 📲 Instalable en cualquier dispositivo (Windows, Mac, iPhone, Android)
- 💾 Almacenamiento local con IndexedDB
- 📤 Exportación e importación de datos

## 🚀 Instalación

### Como PWA (Recomendado)
1. Abre la aplicación en Chrome, Edge, Safari o Firefox
2. Busca la opción "Instalar" o "Agregar a pantalla de inicio"
3. ¡Listo! La app estará disponible como aplicación nativa

### Despliegue Local
```bash
# Clonar el repositorio
git clone https://github.com/oscararmando2/GraciaDivina.git

# Navegar al directorio
cd GraciaDivina

# Servir con cualquier servidor HTTP
# Ejemplo con Python:
python -m http.server 8080

# Ejemplo con Node.js:
npx serve
```

## 📁 Estructura del Proyecto

```
GraciaDivina/
├── index.html                    # Página principal
├── manifest.json                 # Configuración PWA
├── sw.js                         # Service Worker
├── css/
│   └── styles.css               # Estilos de la aplicación
├── js/
│   ├── app.js                   # Lógica principal de la aplicación
│   ├── db.js                    # Módulo de base de datos (IndexedDB)
│   └── firebase-sync-modular.js # Sincronización con Firebase (multi-dispositivo)
├── icons/
│   └── *.png                    # Iconos de la aplicación
├── LEEME_PRIMERO.md             # Guía de configuración de Firebase
├── FIREBASE_SECURITY_RULES.md   # Reglas de seguridad
├── PRUEBAS_FIREBASE.md          # Guía de pruebas
└── README.md                    # Este archivo
```

## 🎨 Diseño

La aplicación cuenta con un diseño elegante y moderno:
- Paleta de colores púrpura y rosa (acorde a boutiques de moda)
- Tipografía Playfair Display (títulos) y Poppins (cuerpo)
- Interfaz responsive para móviles, tablets y escritorio
- Animaciones suaves y transiciones elegantes
- Emojis categorizados para identificación visual de productos

## 💾 Almacenamiento y Sincronización de Datos

### Almacenamiento Local
Todos los datos se almacenan localmente en cada dispositivo usando IndexedDB:
- **Productos**: Catálogo completo con precios, stock y categorías
- **Ventas**: Historial completo de transacciones
- **Apartados**: Seguimiento de pagos parciales y saldos
- **Configuración**: Datos del negocio y preferencias

### Sincronización en la Nube con Firebase
La aplicación utiliza **Firebase Realtime Database** para sincronizar automáticamente todos los datos entre dispositivos:

#### ¿Cómo Funciona?
1. **Cada dispositivo guarda localmente** (funciona offline)
2. **Firebase sincroniza automáticamente** cuando hay internet
3. **Todos los dispositivos reciben los cambios** en tiempo real
4. **No importa el sistema operativo**: Windows, Mac, iPhone, Android

#### ¿Qué se Sincroniza?
- ✅ Productos (agregar, editar, eliminar)
- ✅ Ventas (todas las transacciones)
- ✅ Apartados (pagos y seguimiento)
- ✅ Dueñas (consignación)
- ✅ Configuración del negocio

#### Ventajas de la Sincronización
- 🚀 **Inmediata**: Los cambios aparecen en 1-3 segundos
- 🔒 **Segura**: Autenticación automática y reglas de seguridad
- 🌍 **Universal**: Funciona en cualquier dispositivo moderno
- 💪 **Confiable**: Transacciones atómicas previenen conflictos
- 📱 **Offline-first**: Funciona sin internet y sincroniza después

### Indicador de Conexión
- 🟢 **Verde "En línea"**: Conectado y sincronizando
- 🔴 **Rojo "Sin conexión"**: Sin internet (funciona localmente)
- 🔄 **Botón morado**: Sincronizar manualmente en cualquier momento

### Respaldo de Datos
Aunque la sincronización en la nube es automática, puedes crear respaldos adicionales:
- Exporta tus datos a un archivo JSON desde Configuración
- Importa datos de respaldo cuando lo necesites
- Recomendación: Realiza respaldos regulares como precaución

## 🔧 Requisitos

- Navegador moderno con soporte para:
  - Service Workers
  - IndexedDB
  - CSS Grid/Flexbox
  - ES6+ JavaScript

### Navegadores Compatibles
- ✅ Google Chrome 60+
- ✅ Mozilla Firefox 60+
- ✅ Microsoft Edge 79+
- ✅ Safari 11.1+
- ✅ Opera 47+

## 📝 Licencia

Este proyecto está bajo la Licencia MIT.

## ❓ Preguntas Frecuentes (FAQ)

### ¿Puedo usar la aplicación en varios dispositivos al mismo tiempo?
**Sí, totalmente.** Puedes tener la aplicación abierta en tu computadora con Windows, tu MacBook, tu iPhone y una tablet Android simultáneamente. Todos verán los mismos datos en tiempo real.

### ¿Si hago una venta en Windows, aparecerá en mi iPhone?
**Sí, automáticamente.** En cuanto completas la venta en Windows, aparecerá en tu iPhone en 1-3 segundos (si ambos tienen internet). Si el iPhone está sin internet, se sincronizará cuando se conecte.

### ¿Puedo agregar productos desde cualquier dispositivo?
**Sí.** Cualquier dispositivo puede agregar, editar o eliminar productos, ventas, apartados, etc. Todos los cambios se sincronizan automáticamente con los demás dispositivos.

### ¿Qué pasa si dos personas hacen cambios al mismo tiempo?
La aplicación usa **transacciones atómicas** de Firebase para prevenir conflictos. Los cambios se procesan de forma segura y todos los dispositivos quedan sincronizados correctamente.

### ¿Funciona sin internet?
**Sí.** Cada dispositivo guarda todos los datos localmente usando IndexedDB. Puedes seguir trabajando normalmente sin internet. Cuando se reconecte, sincronizará automáticamente todos los cambios pendientes.

### ¿Necesito iniciar sesión en cada dispositivo?
**No.** La aplicación usa autenticación anónima de Firebase. Solo necesitas abrir la aplicación en tu navegador y funciona automáticamente en todos los dispositivos.

### ¿Los datos están seguros?
**Sí.** Firebase tiene reglas de seguridad configuradas para proteger tus datos. Solo los dispositivos autenticados (los que tú abras) pueden acceder a la información del negocio.

### ¿Cuántos dispositivos puedo conectar?
**Ilimitados.** Puedes usar tantos dispositivos como necesites: PCs, Macs, iPhones, iPads, tablets Android, etc.

## 👤 Autor

Desarrollado con ❤️ para boutiques y emprendedores de moda.

---

**Nota**: Esta aplicación está diseñada exclusivamente como sistema POS para mostrador y ferias. No incluye funcionalidades de tienda en línea.

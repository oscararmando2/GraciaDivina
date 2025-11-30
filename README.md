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

### Funcionalidades PWA
- 📴 Funciona sin conexión a internet
- 📲 Instalable en cualquier dispositivo
- 🔄 Sincronización automática
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
├── index.html          # Página principal
├── manifest.json       # Configuración PWA
├── sw.js              # Service Worker
├── css/
│   └── styles.css     # Estilos de la aplicación
├── js/
│   ├── app.js         # Lógica principal
│   └── db.js          # Módulo de base de datos (IndexedDB)
├── icons/
│   └── *.png          # Iconos de la aplicación
└── README.md
```

## 🎨 Diseño

La aplicación cuenta con un diseño elegante y moderno:
- Paleta de colores púrpura y rosa (acorde a boutiques de moda)
- Tipografía Playfair Display (títulos) y Poppins (cuerpo)
- Interfaz responsive para móviles, tablets y escritorio
- Animaciones suaves y transiciones elegantes
- Emojis categorizados para identificación visual de productos

## 💾 Almacenamiento de Datos

Todos los datos se almacenan localmente en el navegador usando IndexedDB:
- **Productos**: Catálogo completo con precios, stock y categorías
- **Ventas**: Historial completo de transacciones
- **Configuración**: Datos del negocio y preferencias

### Respaldo de Datos
- Exporta tus datos a un archivo JSON desde Configuración
- Importa datos de respaldo cuando lo necesites
- Recomendación: Realiza respaldos regulares

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

## 👤 Autor

Desarrollado con ❤️ para boutiques y emprendedores de moda.

---

**Nota**: Esta aplicación está diseñada exclusivamente como sistema POS para mostrador y ferias. No incluye funcionalidades de tienda en línea.

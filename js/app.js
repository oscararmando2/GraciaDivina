/**
 * Gracia Divina POS - Main Application
 */

// ========================================
// APP STATE
// ========================================
const state = {
    cart: [],
    currentPage: 'pos',
    selectedProduct: null,
    editingProduct: null,
    currentSale: null,
    settings: {
        businessName: 'Gracia Divina',
        businessPhone: '',
        businessAddress: '',
        ticketFooter: '¡Gracias por su compra!'
    }
};

// Product emoji mapping by category
const categoryEmojis = {
    ropa: ['👗', '👚', '👕', '👖', '🧥'],
    accesorios: ['💍', '📿', '👒', '🧣', '🎀'],
    zapatos: ['👠', '👡', '👢', '👟', '🥿'],
    bolsos: ['👜', '👝', '🎒', '💼', '🛍️']
};

// ========================================
// INITIALIZATION
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize database
        await db.init();
        
        // Seed sample data
        await db.seedSampleProducts();
        
        // Load settings
        await loadSettings();
        
        // Initialize UI
        initializeUI();
        
        // Load initial data
        await loadProducts();
        await updateSalesSummary();
        
        // Hide splash screen
        setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            splash.classList.add('fade-out');
            document.getElementById('app').classList.remove('hidden');
            
            setTimeout(() => {
                splash.style.display = 'none';
            }, 500);
        }, 1500);
        
        // Check online status
        updateOnlineStatus();
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        
    } catch (error) {
        console.error('Error initializing app:', error);
        showToast('Error al inicializar la aplicación', 'error');
    }
});

// ========================================
// UI INITIALIZATION
// ========================================
function initializeUI() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => navigateTo(item.dataset.page));
    });
    
    // Sidebar toggle (mobile)
    const sidebarToggle = document.getElementById('sidebar-toggle');
    sidebarToggle.addEventListener('click', toggleSidebar);
    
    // Product search
    document.getElementById('product-search').addEventListener('input', debounce(handleProductSearch, 300));
    
    // Category tabs
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', () => handleCategoryFilter(tab.dataset.category));
    });
    
    // Cart controls
    document.getElementById('clear-cart').addEventListener('click', clearCart);
    document.getElementById('discount-input').addEventListener('input', updateCartTotals);
    document.getElementById('btn-checkout').addEventListener('click', openCheckoutModal);
    
    // Product management
    document.getElementById('btn-add-product').addEventListener('click', () => openProductModal());
    document.getElementById('save-product').addEventListener('click', saveProduct);
    document.getElementById('products-filter').addEventListener('input', debounce(filterProductsTable, 300));
    document.getElementById('category-filter').addEventListener('change', filterProductsTable);
    
    // Checkout
    document.querySelectorAll('.payment-option').forEach(option => {
        option.addEventListener('click', handlePaymentMethodChange);
    });
    document.getElementById('amount-received').addEventListener('input', calculateChange);
    document.getElementById('complete-sale').addEventListener('click', completeSale);
    
    // Quantity modal
    document.getElementById('qty-increase').addEventListener('click', () => changeQuantity(1));
    document.getElementById('qty-decrease').addEventListener('click', () => changeQuantity(-1));
    document.getElementById('confirm-quantity').addEventListener('click', confirmAddToCart);
    
    // Sales page
    document.getElementById('filter-sales').addEventListener('click', filterSales);
    document.getElementById('print-ticket').addEventListener('click', printTicket);
    
    // Settings
    document.getElementById('save-settings').addEventListener('click', saveSettings);
    document.getElementById('export-data').addEventListener('click', exportData);
    document.getElementById('import-data').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', importData);
    document.getElementById('reset-data').addEventListener('click', resetData);
    
    // Modal close buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });
    
    // Close modal on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeAllModals();
        });
    });
    
    // Initialize date filters
    initializeDateFilters();
}

// ========================================
// NAVIGATION
// ========================================
function navigateTo(page) {
    state.currentPage = page;
    
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
    
    // Update pages
    document.querySelectorAll('.page').forEach(p => {
        p.classList.toggle('active', p.id === `page-${page}`);
    });
    
    // Load page-specific data
    switch (page) {
        case 'products':
            loadProductsTable();
            break;
        case 'sales':
            loadSalesHistory();
            break;
        case 'settings':
            loadSettingsForm();
            break;
    }
    
    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
    }
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ========================================
// PRODUCTS - POS VIEW
// ========================================
async function loadProducts(category = 'all', searchQuery = '') {
    const grid = document.getElementById('pos-products-grid');
    
    let products = await db.getAllProducts();
    
    // Filter by category
    if (category !== 'all') {
        products = products.filter(p => p.category === category);
    }
    
    // Filter by search
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        products = products.filter(p => 
            p.name.toLowerCase().includes(query) ||
            (p.sku && p.sku.toLowerCase().includes(query))
        );
    }
    
    if (products.length === 0) {
        grid.innerHTML = `
            <div class="cart-empty" style="grid-column: 1/-1;">
                <span class="empty-icon">📦</span>
                <p>No se encontraron productos</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = products.map(product => {
        const emoji = getProductEmoji(product.category, product.id);
        const stockClass = product.stock <= 0 ? 'out' : product.stock <= 5 ? 'low' : '';
        const stockText = product.stock <= 0 ? 'Agotado' : `Stock: ${product.stock}`;
        
        return `
            <div class="product-card" data-product-id="${product.id}" ${product.stock <= 0 ? 'style="opacity: 0.5;"' : ''}>
                <div class="product-emoji">${emoji}</div>
                <div class="product-name">${escapeHtml(product.name)}</div>
                <div class="product-price">${formatCurrency(product.price)}</div>
                <div class="product-stock ${stockClass}">${stockText}</div>
            </div>
        `;
    }).join('');
    
    // Add click handlers
    grid.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', () => handleProductClick(parseInt(card.dataset.productId)));
    });
}

function getProductEmoji(category, productId) {
    const emojis = categoryEmojis[category] || ['🛍️'];
    return emojis[productId % emojis.length];
}

async function handleProductClick(productId) {
    const product = await db.getProduct(productId);
    
    if (!product || product.stock <= 0) {
        showToast('Producto no disponible', 'warning');
        return;
    }
    
    state.selectedProduct = product;
    
    // Check if already in cart
    const cartItem = state.cart.find(item => item.productId === productId);
    const maxQty = product.stock - (cartItem ? cartItem.quantity : 0);
    
    if (maxQty <= 0) {
        showToast('No hay más stock disponible', 'warning');
        return;
    }
    
    // Open quantity modal
    document.getElementById('qty-input').value = 1;
    document.getElementById('qty-input').max = maxQty;
    document.getElementById('qty-product-name').textContent = product.name;
    openModal('quantity-modal');
}

function changeQuantity(delta) {
    const input = document.getElementById('qty-input');
    const newValue = Math.max(1, Math.min(parseInt(input.max) || 99, parseInt(input.value) + delta));
    input.value = newValue;
}

function confirmAddToCart() {
    const quantity = parseInt(document.getElementById('qty-input').value);
    addToCart(state.selectedProduct, quantity);
    closeAllModals();
}

function handleProductSearch(e) {
    const query = e.target.value;
    const activeCategory = document.querySelector('.category-tab.active').dataset.category;
    loadProducts(activeCategory, query);
}

function handleCategoryFilter(category) {
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.category === category);
    });
    
    const searchQuery = document.getElementById('product-search').value;
    loadProducts(category, searchQuery);
}

// ========================================
// CART OPERATIONS
// ========================================
function addToCart(product, quantity = 1) {
    const existingItem = state.cart.find(item => item.productId === product.id);
    
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        state.cart.push({
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity: quantity
        });
    }
    
    updateCartUI();
    showToast(`${product.name} agregado`, 'success');
}

function updateCartItemQuantity(productId, delta) {
    const item = state.cart.find(i => i.productId === productId);
    if (!item) return;
    
    item.quantity += delta;
    
    if (item.quantity <= 0) {
        removeFromCart(productId);
    } else {
        updateCartUI();
    }
}

function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.productId !== productId);
    updateCartUI();
}

function clearCart() {
    if (state.cart.length === 0) return;
    
    if (confirm('¿Deseas limpiar la venta actual?')) {
        state.cart = [];
        document.getElementById('discount-input').value = 0;
        updateCartUI();
    }
}

function updateCartUI() {
    const container = document.getElementById('cart-items');
    const checkoutBtn = document.getElementById('btn-checkout');
    
    if (state.cart.length === 0) {
        container.innerHTML = `
            <div class="cart-empty">
                <span class="empty-icon">🛍️</span>
                <p>Agrega productos a la venta</p>
            </div>
        `;
        checkoutBtn.disabled = true;
    } else {
        container.innerHTML = state.cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name">${escapeHtml(item.name)}</div>
                    <div class="cart-item-price">${formatCurrency(item.price)} c/u</div>
                </div>
                <div class="cart-item-qty">
                    <button onclick="updateCartItemQuantity(${item.productId}, -1)">−</button>
                    <span>${item.quantity}</span>
                    <button onclick="updateCartItemQuantity(${item.productId}, 1)">+</button>
                </div>
                <div class="cart-item-total">${formatCurrency(item.price * item.quantity)}</div>
                <button class="cart-item-remove" onclick="removeFromCart(${item.productId})">×</button>
            </div>
        `).join('');
        checkoutBtn.disabled = false;
    }
    
    updateCartTotals();
}

function updateCartTotals() {
    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountPercent = parseFloat(document.getElementById('discount-input').value) || 0;
    const discount = subtotal * (discountPercent / 100);
    const total = subtotal - discount;
    
    document.getElementById('cart-subtotal').textContent = formatCurrency(subtotal);
    document.getElementById('cart-total').textContent = formatCurrency(total);
}

// ========================================
// CHECKOUT
// ========================================
function openCheckoutModal() {
    if (state.cart.length === 0) return;
    
    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountPercent = parseFloat(document.getElementById('discount-input').value) || 0;
    const discount = subtotal * (discountPercent / 100);
    const total = subtotal - discount;
    
    // Populate checkout items
    document.getElementById('checkout-items').innerHTML = state.cart.map(item => `
        <div class="checkout-item">
            <span class="checkout-item-name">${escapeHtml(item.name)}</span>
            <span class="checkout-item-qty">x${item.quantity}</span>
            <span>${formatCurrency(item.price * item.quantity)}</span>
        </div>
    `).join('');
    
    document.getElementById('checkout-subtotal').textContent = formatCurrency(subtotal);
    document.getElementById('checkout-discount').textContent = formatCurrency(discount);
    document.getElementById('checkout-total').textContent = formatCurrency(total);
    
    // Reset payment section
    document.querySelectorAll('.payment-option').forEach(opt => opt.classList.remove('selected'));
    document.querySelector('.payment-option').classList.add('selected');
    document.querySelector('input[name="payment-method"][value="efectivo"]').checked = true;
    document.getElementById('cash-payment').style.display = 'block';
    document.getElementById('amount-received').value = '';
    document.getElementById('change-amount').textContent = '$0.00';
    
    openModal('checkout-modal');
}

function handlePaymentMethodChange(e) {
    const option = e.currentTarget;
    
    document.querySelectorAll('.payment-option').forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');
    option.querySelector('input').checked = true;
    
    const method = option.querySelector('input').value;
    document.getElementById('cash-payment').style.display = method === 'efectivo' ? 'block' : 'none';
}

function calculateChange() {
    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountPercent = parseFloat(document.getElementById('discount-input').value) || 0;
    const total = subtotal - (subtotal * (discountPercent / 100));
    
    const received = parseFloat(document.getElementById('amount-received').value) || 0;
    const change = Math.max(0, received - total);
    
    document.getElementById('change-amount').textContent = formatCurrency(change);
}

async function completeSale() {
    const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;
    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountPercent = parseFloat(document.getElementById('discount-input').value) || 0;
    const discount = subtotal * (discountPercent / 100);
    const total = subtotal - discount;
    
    // Validate cash payment
    if (paymentMethod === 'efectivo') {
        const received = parseFloat(document.getElementById('amount-received').value) || 0;
        if (received < total) {
            showToast('El monto recibido es menor al total', 'error');
            return;
        }
    }
    
    try {
        const sale = {
            items: state.cart.map(item => ({
                productId: item.productId,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                subtotal: item.price * item.quantity
            })),
            subtotal,
            discountPercent,
            discount,
            total,
            paymentMethod,
            amountReceived: paymentMethod === 'efectivo' ? parseFloat(document.getElementById('amount-received').value) : total,
            change: paymentMethod === 'efectivo' ? parseFloat(document.getElementById('amount-received').value) - total : 0
        };
        
        const savedSale = await db.addSale(sale);
        
        // Clear cart and reset
        state.cart = [];
        document.getElementById('discount-input').value = 0;
        updateCartUI();
        
        closeAllModals();
        
        // Refresh products to show updated stock
        const activeCategory = document.querySelector('.category-tab.active').dataset.category;
        const searchQuery = document.getElementById('product-search').value;
        await loadProducts(activeCategory, searchQuery);
        
        // Update sales summary
        await updateSalesSummary();
        
        showToast(`Venta completada - Ticket #${savedSale.ticketNumber}`, 'success');
        
        // Store current sale for potential printing
        state.currentSale = savedSale;
        
    } catch (error) {
        console.error('Error completing sale:', error);
        showToast('Error al procesar la venta', 'error');
    }
}

// ========================================
// PRODUCTS MANAGEMENT
// ========================================
async function loadProductsTable() {
    const tbody = document.getElementById('products-table-body');
    const products = await db.getAllProducts();
    
    if (products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px;">
                    No hay productos registrados
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = products.map(product => {
        const emoji = getProductEmoji(product.category, product.id);
        const stockClass = product.stock <= 0 ? 'out-of-stock' : product.stock <= 5 ? 'low-stock' : 'in-stock';
        
        return `
            <tr>
                <td>
                    <div class="product-info">
                        <span class="product-info-emoji">${emoji}</span>
                        <div class="product-info-details">
                            <h4>${escapeHtml(product.name)}</h4>
                            <small>${product.sku || 'Sin SKU'}</small>
                        </div>
                    </div>
                </td>
                <td><span class="category-badge">${product.category}</span></td>
                <td><strong>${formatCurrency(product.price)}</strong></td>
                <td><span class="stock-badge ${stockClass}">${product.stock}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon edit" onclick="editProduct(${product.id})" title="Editar">✏️</button>
                        <button class="btn-icon delete" onclick="deleteProduct(${product.id})" title="Eliminar">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filterProductsTable() {
    const query = document.getElementById('products-filter').value.toLowerCase();
    const category = document.getElementById('category-filter').value;
    
    document.querySelectorAll('#products-table-body tr').forEach(row => {
        const name = row.querySelector('.product-info-details h4')?.textContent.toLowerCase() || '';
        const sku = row.querySelector('.product-info-details small')?.textContent.toLowerCase() || '';
        const rowCategory = row.querySelector('.category-badge')?.textContent.toLowerCase() || '';
        
        const matchesQuery = name.includes(query) || sku.includes(query);
        const matchesCategory = category === 'all' || rowCategory === category;
        
        row.style.display = matchesQuery && matchesCategory ? '' : 'none';
    });
}

function openProductModal(product = null) {
    state.editingProduct = product;
    
    document.getElementById('product-modal-title').textContent = product ? 'Editar Producto' : 'Nuevo Producto';
    document.getElementById('product-form').reset();
    
    if (product) {
        document.getElementById('product-id').value = product.id;
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-category').value = product.category;
        document.getElementById('product-price').value = product.price;
        document.getElementById('product-stock').value = product.stock;
        document.getElementById('product-sku').value = product.sku || '';
        document.getElementById('product-description').value = product.description || '';
    }
    
    openModal('product-modal');
}

async function editProduct(productId) {
    const product = await db.getProduct(productId);
    if (product) {
        openProductModal(product);
    }
}

async function saveProduct() {
    const form = document.getElementById('product-form');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const product = {
        name: document.getElementById('product-name').value.trim(),
        category: document.getElementById('product-category').value,
        price: parseFloat(document.getElementById('product-price').value),
        stock: parseInt(document.getElementById('product-stock').value) || 0,
        sku: document.getElementById('product-sku').value.trim(),
        description: document.getElementById('product-description').value.trim()
    };
    
    try {
        if (state.editingProduct) {
            product.id = state.editingProduct.id;
            product.createdAt = state.editingProduct.createdAt;
            await db.updateProduct(product);
            showToast('Producto actualizado', 'success');
        } else {
            await db.addProduct(product);
            showToast('Producto creado', 'success');
        }
        
        closeAllModals();
        await loadProductsTable();
        await loadProducts();
        
    } catch (error) {
        console.error('Error saving product:', error);
        showToast('Error al guardar el producto', 'error');
    }
}

async function deleteProduct(productId) {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;
    
    try {
        await db.deleteProduct(productId);
        showToast('Producto eliminado', 'success');
        await loadProductsTable();
        await loadProducts();
    } catch (error) {
        console.error('Error deleting product:', error);
        showToast('Error al eliminar el producto', 'error');
    }
}

// ========================================
// SALES HISTORY
// ========================================
function initializeDateFilters() {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    document.getElementById('sales-date-from').value = formatDateForInput(firstDayOfMonth);
    document.getElementById('sales-date-to').value = formatDateForInput(today);
}

async function loadSalesHistory() {
    const fromDate = new Date(document.getElementById('sales-date-from').value);
    const toDate = new Date(document.getElementById('sales-date-to').value);
    toDate.setHours(23, 59, 59, 999);
    
    const sales = await db.getSalesByDateRange(fromDate, toDate);
    const tbody = document.getElementById('sales-table-body');
    
    if (sales.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px;">
                    No hay ventas en este período
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = sales.map(sale => {
            const paymentIcons = { efectivo: '💵', tarjeta: '💳', transferencia: '📱' };
            return `
                <tr>
                    <td>${formatDateTime(sale.date)}</td>
                    <td><strong>${sale.ticketNumber}</strong></td>
                    <td>${sale.items.length} producto(s)</td>
                    <td><strong>${formatCurrency(sale.total)}</strong></td>
                    <td>
                        <span class="payment-badge">
                            ${paymentIcons[sale.paymentMethod] || '💰'}
                            ${sale.paymentMethod}
                        </span>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon" onclick="viewSaleDetails(${sale.id})" title="Ver detalles">👁️</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    await updateSalesSummary();
}

async function filterSales() {
    await loadSalesHistory();
}

async function updateSalesSummary() {
    const todaySales = await db.getTodaySales();
    const monthSales = await db.getMonthSales();
    
    const todayTotal = db.calculateSalesTotals(todaySales);
    const monthTotal = db.calculateSalesTotals(monthSales);
    
    document.getElementById('today-sales').textContent = formatCurrency(todayTotal);
    document.getElementById('month-sales').textContent = formatCurrency(monthTotal);
    document.getElementById('today-transactions').textContent = todaySales.length;
}

async function viewSaleDetails(saleId) {
    const sale = await db.getSale(saleId);
    if (!sale) return;
    
    state.currentSale = sale;
    
    const content = document.getElementById('sale-detail-content');
    content.innerHTML = `
        <div class="ticket-print">
            <div class="ticket-header">
                <h2>${state.settings.businessName}</h2>
                ${state.settings.businessPhone ? `<p>Tel: ${state.settings.businessPhone}</p>` : ''}
                ${state.settings.businessAddress ? `<p>${state.settings.businessAddress}</p>` : ''}
            </div>
            <div class="ticket-info">
                <p>Ticket: <strong>${sale.ticketNumber}</strong></p>
                <p>Fecha: ${formatDateTime(sale.date)}</p>
                <p>Pago: ${sale.paymentMethod}</p>
            </div>
            <div class="ticket-items">
                ${sale.items.map(item => `
                    <div class="ticket-item">
                        <span>${item.quantity}x ${escapeHtml(item.name)}</span>
                        <span>${formatCurrency(item.subtotal)}</span>
                    </div>
                `).join('')}
            </div>
            <div class="ticket-totals">
                <div class="ticket-total-row">
                    <span>Subtotal:</span>
                    <span>${formatCurrency(sale.subtotal)}</span>
                </div>
                ${sale.discount > 0 ? `
                    <div class="ticket-total-row">
                        <span>Descuento (${sale.discountPercent}%):</span>
                        <span>-${formatCurrency(sale.discount)}</span>
                    </div>
                ` : ''}
                <div class="ticket-total-row final">
                    <span>TOTAL:</span>
                    <span>${formatCurrency(sale.total)}</span>
                </div>
                ${sale.paymentMethod === 'efectivo' ? `
                    <div class="ticket-total-row">
                        <span>Recibido:</span>
                        <span>${formatCurrency(sale.amountReceived)}</span>
                    </div>
                    <div class="ticket-total-row">
                        <span>Cambio:</span>
                        <span>${formatCurrency(sale.change)}</span>
                    </div>
                ` : ''}
            </div>
            <div class="ticket-footer">
                <p>${state.settings.ticketFooter}</p>
            </div>
        </div>
    `;
    
    openModal('sale-detail-modal');
}

function printTicket() {
    if (!state.currentSale) return;
    
    const printContent = document.getElementById('sale-detail-content').innerHTML;
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Ticket - ${state.currentSale.ticketNumber}</title>
            <style>
                body { font-family: 'Courier New', monospace; font-size: 12px; max-width: 300px; margin: 0 auto; padding: 20px; }
                .ticket-header { text-align: center; margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
                .ticket-header h2 { margin: 0; font-size: 18px; }
                .ticket-info { margin-bottom: 15px; font-size: 11px; }
                .ticket-items { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 10px 0; }
                .ticket-item { display: flex; justify-content: space-between; margin-bottom: 5px; }
                .ticket-totals { padding: 10px 0; }
                .ticket-total-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
                .ticket-total-row.final { font-weight: bold; font-size: 14px; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; }
                .ticket-footer { text-align: center; margin-top: 15px; font-size: 10px; }
            </style>
        </head>
        <body>
            ${printContent}
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.onload = () => {
        printWindow.print();
        printWindow.close();
    };
}

// ========================================
// SETTINGS
// ========================================
async function loadSettings() {
    const settings = await db.getAllSettings();
    state.settings = { ...state.settings, ...settings };
}

function loadSettingsForm() {
    document.getElementById('business-name').value = state.settings.businessName || '';
    document.getElementById('business-phone').value = state.settings.businessPhone || '';
    document.getElementById('business-address').value = state.settings.businessAddress || '';
    document.getElementById('ticket-footer').value = state.settings.ticketFooter || '';
}

async function saveSettings() {
    const settings = {
        businessName: document.getElementById('business-name').value.trim(),
        businessPhone: document.getElementById('business-phone').value.trim(),
        businessAddress: document.getElementById('business-address').value.trim(),
        ticketFooter: document.getElementById('ticket-footer').value.trim()
    };
    
    try {
        for (const [key, value] of Object.entries(settings)) {
            await db.saveSetting(key, value);
        }
        
        state.settings = settings;
        showToast('Configuración guardada', 'success');
    } catch (error) {
        console.error('Error saving settings:', error);
        showToast('Error al guardar la configuración', 'error');
    }
}

async function exportData() {
    try {
        const data = await db.exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `gracia-divina-backup-${formatDateForInput(new Date())}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('Datos exportados correctamente', 'success');
    } catch (error) {
        console.error('Error exporting data:', error);
        showToast('Error al exportar los datos', 'error');
    }
}

async function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (!data.data || !data.data.products || !data.data.sales) {
            throw new Error('Invalid data format');
        }
        
        if (!confirm('¿Estás seguro? Esto reemplazará todos los datos actuales.')) {
            return;
        }
        
        await db.importData(data);
        await loadSettings();
        await loadProducts();
        await loadProductsTable();
        await loadSalesHistory();
        
        showToast('Datos importados correctamente', 'success');
    } catch (error) {
        console.error('Error importing data:', error);
        showToast('Error al importar los datos', 'error');
    }
    
    e.target.value = '';
}

async function resetData() {
    if (!confirm('⚠️ ¿Estás seguro? Esta acción eliminará TODOS los datos y no se puede deshacer.')) {
        return;
    }
    
    if (!confirm('Esta es tu última oportunidad. ¿Realmente quieres eliminar todos los datos?')) {
        return;
    }
    
    try {
        await db.resetAllData();
        await db.seedSampleProducts();
        
        state.cart = [];
        updateCartUI();
        await loadProducts();
        await loadProductsTable();
        await loadSalesHistory();
        
        showToast('Datos restablecidos', 'success');
    } catch (error) {
        console.error('Error resetting data:', error);
        showToast('Error al restablecer los datos', 'error');
    }
}

// ========================================
// MODAL MANAGEMENT
// ========================================
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeAllModals() {
    document.querySelectorAll('.modal.active').forEach(modal => {
        modal.classList.remove('active');
    });
    document.body.style.overflow = '';
}

// ========================================
// TOAST NOTIFICATIONS
// ========================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ========================================
// UTILITY FUNCTIONS
// ========================================
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(amount);
}

function formatDateTime(dateString) {
    return new Intl.DateTimeFormat('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(dateString));
}

function formatDateForInput(date) {
    return date.toISOString().split('T')[0];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function updateOnlineStatus() {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    
    if (navigator.onLine) {
        statusDot.classList.add('online');
        statusDot.classList.remove('offline');
        statusText.textContent = 'En línea';
    } else {
        statusDot.classList.remove('online');
        statusDot.classList.add('offline');
        statusText.textContent = 'Sin conexión';
    }
}

// Make functions available globally for inline event handlers
window.updateCartItemQuantity = updateCartItemQuantity;
window.removeFromCart = removeFromCart;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.viewSaleDetails = viewSaleDetails;

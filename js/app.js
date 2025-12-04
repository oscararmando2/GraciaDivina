/**
 * Gracia Divina POS - Main Application
 */

// ========================================
// CONSTANTS
// ========================================
const MOBILE_BREAKPOINT = 768;

// ========================================
// APP STATE
// ========================================
const state = {
    cart: [],
    currentPage: 'pos',
    selectedProduct: null,
    editingProduct: null,
    currentSale: null,
    currentLayaway: null,
    owners: [],
    settings: {
        businessName: 'Gracia Divina',
        businessPhone: '',
        businessAddress: '',
        ticketFooter: '¡Gracias por elegir Gracia Divina!',
        whatsappNumber: ''
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
        
        // Seed default owners
        await db.seedDefaultOwners();
        
        // Seed sample data
        await db.seedSampleProducts();
        
        // Load settings
        await loadSettings();
        
        // Load owners
        await loadOwners();
        
        // Initialize UI
        initializeUI();
        
        // On mobile, navigate to a visible page (sales) since POS is hidden
        if (window.innerWidth <= MOBILE_BREAKPOINT) {
            navigateTo('sales');
        }
        
        // Load initial data (products will load when navigating to Products page)
        await updateSalesSummary();
        await updateLayawayBadge();
        
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
        
        // Handle viewport resize to switch pages when going from desktop to mobile
        window.addEventListener('resize', handleViewportResize);
        
        // Set report date to today
        document.getElementById('report-date').value = formatDateForInput(new Date());
        
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
    
    // Sidebar toggle (in sidebar header for desktop)
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }
    
    // Mobile header hamburger menu - opens sidebar
    const mobileSidebarToggle = document.getElementById('mobile-sidebar-toggle');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    if (mobileSidebarToggle) {
        mobileSidebarToggle.addEventListener('click', toggleSidebar);
    }
    
    // Close sidebar when clicking overlay
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }
    
    // Mobile hamburger menu for POS page (legacy - now hidden via CSS)
    const mobileHamburgerBtn = document.getElementById('mobile-hamburger-btn');
    const mobileDropdownMenu = document.getElementById('mobile-dropdown-menu');
    
    if (mobileHamburgerBtn && mobileDropdownMenu) {
        mobileHamburgerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            mobileHamburgerBtn.classList.toggle('active');
            mobileDropdownMenu.classList.toggle('active');
        });
        
        // Handle mobile menu item clicks
        document.querySelectorAll('.mobile-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const page = item.dataset.page;
                navigateTo(page);
                mobileHamburgerBtn.classList.remove('active');
                mobileDropdownMenu.classList.remove('active');
            });
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!mobileHamburgerBtn.contains(e.target) && !mobileDropdownMenu.contains(e.target)) {
                mobileHamburgerBtn.classList.remove('active');
                mobileDropdownMenu.classList.remove('active');
            }
        });
    }
    
    // Product search (now in Products page)
    document.getElementById('product-search').addEventListener('input', debounce(handleProductSearch, 300));
    
    // UPC Scanner input
    document.getElementById('upc-scanner-input').addEventListener('keypress', handleUPCScan);
    
    // Camera scan button
    document.getElementById('btn-camera-scan').addEventListener('click', openCameraScanner);
    
    // Category tabs (now in Products page)
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', () => handleCategoryFilter(tab.dataset.category));
    });
    
    // Cart controls
    document.getElementById('clear-cart').addEventListener('click', clearCart);
    document.getElementById('discount-input').addEventListener('input', updateCartTotals);
    document.getElementById('discount-type').addEventListener('change', updateCartTotals);
    
    // Two checkout buttons
    document.getElementById('btn-vender').addEventListener('click', openCheckoutModal);
    document.getElementById('btn-apartado').addEventListener('click', openLayawayModal);
    
    // Product management
    document.getElementById('btn-add-product').addEventListener('click', () => openProductModal());
    document.getElementById('save-product').addEventListener('click', saveProduct);
    document.getElementById('owner-filter').addEventListener('change', handleOwnerFilter);
    
    // Product image handling
    document.getElementById('product-image-url').addEventListener('input', handleImageUrlInput);
    document.getElementById('product-image-file').addEventListener('change', handleImageFileInput);
    
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
    
    // Layaway
    document.getElementById('layaway-initial-payment').addEventListener('input', updateLayawayPending);
    document.getElementById('create-layaway').addEventListener('click', createLayaway);
    document.getElementById('layaway-search').addEventListener('input', debounce(searchLayaways, 300));
    document.getElementById('add-layaway-payment').addEventListener('click', openPaymentModal);
    document.getElementById('confirm-payment').addEventListener('click', confirmLayawayPayment);
    document.getElementById('complete-layaway-btn').addEventListener('click', completeLayaway);
    document.getElementById('delete-layaway-btn').addEventListener('click', deleteLayaway);
    document.getElementById('export-layaway-pdf').addEventListener('click', exportLayawayPDF);
    document.getElementById('add-products-to-layaway').addEventListener('click', openAddProductsToLayawayModal);
    document.getElementById('add-another-product-btn').addEventListener('click', addAnotherProductToLayaway);
    document.getElementById('confirm-add-products-layaway').addEventListener('click', confirmAddProductsToLayaway);
    
    // Manual Layaway
    document.getElementById('btn-add-manual-layaway').addEventListener('click', openManualLayawayModal);
    document.getElementById('add-manual-product-btn').addEventListener('click', addManualProductRow);
    document.getElementById('manual-layaway-initial-payment').addEventListener('input', updateManualLayawayPending);
    document.getElementById('create-manual-layaway').addEventListener('click', createManualLayaway);
    
    // Sales page
    document.getElementById('filter-sales').addEventListener('click', filterSales);
    document.getElementById('print-ticket').addEventListener('click', printTicket);
    
    // Reports
    document.getElementById('generate-report').addEventListener('click', generateReport);
    document.getElementById('print-report').addEventListener('click', printReport);
    
    // Settings - Owner management
    document.getElementById('add-owner-btn').addEventListener('click', addNewOwner);
    
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
    
    // Scroll main content to top when navigating to a new page
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.scrollTop = 0;
    }
    
    // Also scroll the page itself to top
    const activePage = document.getElementById(`page-${page}`);
    if (activePage) {
        activePage.scrollTop = 0;
    }
    
    // Load page-specific data
    switch (page) {
        case 'products':
            loadProducts();
            loadOwnerFilter();
            break;
        case 'layaways':
            loadLayaways();
            break;
        case 'sales':
            loadSalesHistory();
            break;
        case 'reports':
            generateReport();
            break;
        case 'settings':
            loadSettingsForm();
            loadOwnersSettings();
            break;
    }
    
    // Close sidebar on mobile
    if (window.innerWidth <= MOBILE_BREAKPOINT) {
        closeSidebar();
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    sidebar.classList.toggle('open');
    
    if (overlay) {
        overlay.classList.toggle('active', sidebar.classList.contains('open'));
    }
    
    // Prevent body scroll when sidebar is open on mobile
    if (sidebar.classList.contains('open') && window.innerWidth <= MOBILE_BREAKPOINT) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    sidebar.classList.remove('open');
    
    if (overlay) {
        overlay.classList.remove('active');
    }
    
    document.body.style.overflow = '';
}

// Pages that are hidden on mobile (only Ventas, Reportes, Apartados are visible)
const MOBILE_HIDDEN_PAGES = ['pos', 'products', 'settings'];

function handleViewportResize() {
    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    
    // If switching to mobile and current page is hidden on mobile, navigate to sales
    if (isMobile && MOBILE_HIDDEN_PAGES.includes(state.currentPage)) {
        navigateTo('sales');
    }
}

// ========================================
// PRODUCTS - GRID VIEW (Products Page)
// ========================================
async function loadProducts(category = 'all', searchQuery = '', owner = 'all') {
    const grid = document.getElementById('pos-products-grid');
    
    if (!grid) {
        console.warn('Products grid element not found - skipping product load');
        return;
    }
    
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
    
    // Filter by owner
    if (owner !== 'all') {
        products = products.filter(p => p.owner === owner);
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
        const hasImage = product.image || product.imageUrl;
        
        return `
            <div class="product-card" data-product-id="${product.id}" ${product.stock <= 0 ? 'style="opacity: 0.5;"' : ''}>
                ${hasImage 
                    ? `<img src="${product.image || product.imageUrl}" alt="${escapeHtml(product.name)}" class="product-image" onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
                       <div class="product-emoji" style="display:none;">${emoji}</div>`
                    : `<div class="product-emoji">${emoji}</div>`
                }
                <div class="product-name">${escapeHtml(product.name)}</div>
                <div class="product-price">${formatCurrency(product.price)}</div>
                <div class="product-stock ${stockClass}">${stockText}</div>
                ${product.owner ? `<div class="product-owner">${escapeHtml(product.owner)}</div>` : ''}
                <div class="product-actions">
                    <button class="btn-icon edit" data-action="edit" data-product-id="${product.id}" title="Editar">✏️</button>
                    <button class="btn-icon delete" data-action="delete" data-product-id="${product.id}" title="Eliminar">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
    
    // Add click handlers for adding to cart
    grid.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', () => handleProductClick(parseInt(card.dataset.productId)));
    });
    
    // Add event delegation for product action buttons (edit/delete)
    grid.querySelectorAll('.product-actions button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the card click
            const productId = parseInt(btn.dataset.productId);
            if (btn.dataset.action === 'edit') {
                editProduct(productId);
            } else if (btn.dataset.action === 'delete') {
                deleteProduct(productId);
            }
        });
    });
}

function getProductEmoji(category, productId) {
    const emojis = categoryEmojis[category] || ['🛍️'];
    return emojis[productId % emojis.length];
}

// Handle owner filter in products page
function handleOwnerFilter() {
    const owner = document.getElementById('owner-filter').value;
    const searchQuery = document.getElementById('product-search').value;
    const activeCategory = document.querySelector('.category-tab.active')?.dataset.category || 'all';
    loadProducts(activeCategory, searchQuery, owner);
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
    const activeCategory = document.querySelector('.category-tab.active')?.dataset.category || 'all';
    const owner = document.getElementById('owner-filter')?.value || 'all';
    loadProducts(activeCategory, query, owner);
}

async function handleUPCScan(e) {
    // Only process on Enter key
    if (e.key !== 'Enter') return;
    
    const input = document.getElementById('upc-scanner-input');
    const upcCode = input.value.trim();
    
    if (!upcCode) return;
    
    // Search for product by SKU/UPC or by name
    const products = await db.getAllProducts();
    const product = products.find(p => 
        (p.sku && p.sku.toLowerCase() === upcCode.toLowerCase()) ||
        p.name.toLowerCase().includes(upcCode.toLowerCase())
    );
    
    if (product) {
        if (product.stock <= 0) {
            showToast('Producto sin stock disponible', 'warning');
        } else {
            // Check if already in cart
            const cartItem = state.cart.find(item => item.productId === product.id);
            const maxQty = product.stock - (cartItem ? cartItem.quantity : 0);
            
            if (maxQty <= 0) {
                showToast('No hay más stock disponible', 'warning');
            } else {
                addToCart(product, 1);
            }
        }
    } else {
        showToast(`Producto no encontrado: ${upcCode}`, 'error');
    }
    
    // Clear the input for next scan
    input.value = '';
    input.focus();
}

function handleCategoryFilter(category) {
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.category === category);
    });
    
    const searchQuery = document.getElementById('product-search')?.value || '';
    const owner = document.getElementById('owner-filter')?.value || 'all';
    loadProducts(category, searchQuery, owner);
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
            cost: product.cost || 0,
            price: product.price,
            quantity: quantity,
            owner: product.owner || ''
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
        document.getElementById('discount-type').value = 'percent';
        updateCartUI();
    }
}

function updateCartUI() {
    const container = document.getElementById('cart-items');
    const venderBtn = document.getElementById('btn-vender');
    const apartadoBtn = document.getElementById('btn-apartado');
    
    if (state.cart.length === 0) {
        container.innerHTML = `
            <div class="cart-empty">
                <span class="empty-icon">🛍️</span>
                <p>Agrega productos a la venta</p>
            </div>
        `;
        venderBtn.disabled = true;
        apartadoBtn.disabled = true;
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
        venderBtn.disabled = false;
        apartadoBtn.disabled = false;
    }
    
    updateCartTotals();
}

function updateCartTotals() {
    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountValue = parseFloat(document.getElementById('discount-input').value) || 0;
    const discountType = document.getElementById('discount-type').value;
    
    const { discount } = calculateDiscountAmount(subtotal, discountValue, discountType);
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
    const discountValue = parseFloat(document.getElementById('discount-input').value) || 0;
    const discountType = document.getElementById('discount-type').value;
    
    const { discount } = calculateDiscountAmount(subtotal, discountValue, discountType);
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
    const discountValue = parseFloat(document.getElementById('discount-input').value) || 0;
    const discountType = document.getElementById('discount-type').value;
    
    const { discount } = calculateDiscountAmount(subtotal, discountValue, discountType);
    const total = subtotal - discount;
    
    const received = parseFloat(document.getElementById('amount-received').value) || 0;
    const change = Math.max(0, received - total);
    
    document.getElementById('change-amount').textContent = formatCurrency(change);
}

async function completeSale() {
    const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;
    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountValue = parseFloat(document.getElementById('discount-input').value) || 0;
    const discountType = document.getElementById('discount-type').value;
    
    const { discount, discountPercent } = calculateDiscountAmount(subtotal, discountValue, discountType);
    const total = subtotal - discount;
    
    // Calculate total cost and profit
    const totalCost = state.cart.reduce((sum, item) => sum + ((item.cost || 0) * item.quantity), 0);
    const totalProfit = total - totalCost;
    
    // Validate cash payment
    if (paymentMethod === 'efectivo') {
        const received = parseFloat(document.getElementById('amount-received').value) || 0;
        if (received < total) {
            showToast('El monto recibido es menor al total', 'error');
            return;
        }
    }
    
    try {
        const amountReceived = paymentMethod === 'efectivo'
            ? parseFloat(document.getElementById('amount-received').value) 
            : total;
        
        const sale = {
            items: state.cart.map(item => ({
                productId: item.productId,
                name: item.name,
                cost: item.cost || 0,
                price: item.price,
                quantity: item.quantity,
                subtotal: item.price * item.quantity,
                costSubtotal: (item.cost || 0) * item.quantity,
                profit: (item.price - (item.cost || 0)) * item.quantity,
                owner: item.owner || ''
            })),
            subtotal,
            discountType,
            discountValue,
            discountPercent,
            discount,
            total,
            totalCost,
            totalProfit,
            paymentMethod,
            amountReceived: amountReceived,
            change: paymentMethod === 'efectivo' ? amountReceived - total : 0
        };
        
        const savedSale = await db.addSale(sale);
        
        // Clear cart and reset
        state.cart = [];
        document.getElementById('discount-input').value = 0;
        document.getElementById('discount-type').value = 'percent';
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

async function loadOwnerFilter() {
    const select = document.getElementById('owner-filter');
    if (!select) return;
    
    const owners = await db.getAllOwners();
    
    select.innerHTML = '<option value="all">Todas las dueñas</option>' +
        owners.map(o => `<option value="${escapeHtml(o.name)}">${escapeHtml(o.name)}</option>`).join('');
}

async function openProductModal(product = null) {
    state.editingProduct = product;
    
    // Load owners into select
    await loadProductOwnerSelect();
    
    document.getElementById('product-modal-title').textContent = product ? 'Editar Producto' : 'Nuevo Producto';
    document.getElementById('product-form').reset();
    
    // Reset checkboxes
    document.querySelectorAll('input[name="sizes"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('input[name="colors"]').forEach(cb => cb.checked = false);
    
    // Reset custom size field
    document.getElementById('product-custom-size').value = '';
    
    // Reset image preview
    document.getElementById('product-image-preview').classList.add('hidden');
    document.getElementById('product-image-data').value = '';
    
    if (product) {
        document.getElementById('product-id').value = product.id;
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-category').value = product.category;
        document.getElementById('product-cost').value = product.cost || 0;
        document.getElementById('product-price').value = product.price;
        document.getElementById('product-stock').value = product.stock;
        document.getElementById('product-sku').value = product.sku || '';
        document.getElementById('product-description').value = product.description || '';
        document.getElementById('product-owner').value = product.owner || '';
        
        // Standard sizes that are in checkboxes
        const standardSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
        
        // Set sizes checkboxes and collect custom sizes
        const customSizes = [];
        if (product.sizes && Array.isArray(product.sizes)) {
            product.sizes.forEach(size => {
                const checkbox = document.querySelector(`input[name="sizes"][value="${size}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                } else if (!standardSizes.includes(size)) {
                    customSizes.push(size);
                }
            });
        }
        
        // Set custom sizes (join multiple custom sizes with comma)
        if (customSizes.length > 0) {
            document.getElementById('product-custom-size').value = customSizes.join(', ');
        }
        
        // Set colors checkboxes
        if (product.colors && Array.isArray(product.colors)) {
            product.colors.forEach(color => {
                const checkbox = document.querySelector(`input[name="colors"][value="${color}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }
        
        // Set image preview
        const imageUrl = product.image || product.imageUrl;
        if (imageUrl) {
            document.getElementById('product-image-url').value = product.imageUrl || '';
            document.getElementById('product-image-preview').src = imageUrl;
            document.getElementById('product-image-preview').classList.remove('hidden');
            if (product.image) {
                document.getElementById('product-image-data').value = product.image;
            }
        }
    }
    
    openModal('product-modal');
}

async function loadProductOwnerSelect() {
    const select = document.getElementById('product-owner');
    const owners = await db.getAllOwners();
    
    select.innerHTML = '<option value="">Seleccionar dueña...</option>' +
        owners.map(o => `<option value="${escapeHtml(o.name)}">${escapeHtml(o.name)}</option>`).join('');
}

function handleImageUrlInput(e) {
    const url = e.target.value.trim();
    const preview = document.getElementById('product-image-preview');
    
    if (url) {
        preview.src = url;
        preview.classList.remove('hidden');
        preview.onerror = () => preview.classList.add('hidden');
    } else {
        preview.classList.add('hidden');
    }
}

function handleImageFileInput(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const base64 = event.target.result;
        document.getElementById('product-image-data').value = base64;
        document.getElementById('product-image-preview').src = base64;
        document.getElementById('product-image-preview').classList.remove('hidden');
        document.getElementById('product-image-url').value = '';
    };
    reader.readAsDataURL(file);
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
    
    // Get selected sizes
    const sizes = Array.from(document.querySelectorAll('input[name="sizes"]:checked'))
        .map(cb => cb.value);
    
    // Add custom sizes if provided (supports comma-separated values)
    const customSize = document.getElementById('product-custom-size').value.trim();
    if (customSize) {
        const customSizes = customSize.split(',').map(s => s.trim()).filter(s => s);
        sizes.push(...customSizes);
    }
    
    // Get selected colors
    const colors = Array.from(document.querySelectorAll('input[name="colors"]:checked'))
        .map(cb => cb.value);
    
    // Get image (prioritize uploaded file, then URL)
    const imageData = document.getElementById('product-image-data').value;
    const imageUrl = document.getElementById('product-image-url').value.trim();
    
    const product = {
        name: document.getElementById('product-name').value.trim(),
        category: document.getElementById('product-category').value,
        cost: parseFloat(document.getElementById('product-cost').value) || 0,
        price: parseFloat(document.getElementById('product-price').value),
        stock: parseInt(document.getElementById('product-stock').value) || 0,
        sku: document.getElementById('product-sku').value.trim(),
        description: document.getElementById('product-description').value.trim(),
        owner: document.getElementById('product-owner').value,
        sizes,
        colors,
        image: imageData || null,
        imageUrl: imageUrl || null
    };
    
    try {
        let savedProduct;
        if (state.editingProduct) {
            product.id = state.editingProduct.id;
            product.createdAt = state.editingProduct.createdAt;
            product.firebaseKey = state.editingProduct.firebaseKey; // Preserve firebaseKey
            await db.updateProduct(product);
            savedProduct = product;
            showToast('Producto actualizado', 'success');
        } else {
            const productId = await db.addProduct(product);
            savedProduct = await db.getProduct(productId);
            showToast('Producto creado', 'success');
        }
        
        // Sync to Firebase for cross-device synchronization
        if (typeof firebaseSync !== 'undefined' && firebaseSync.isUserAuthenticated() && savedProduct) {
            try {
                await firebaseSync.uploadSingle('products', savedProduct);
            } catch (syncError) {
                console.warn('Firebase sync failed, product saved locally:', syncError);
            }
        }
        
        closeAllModals();
        await loadProducts();
        
    } catch (error) {
        console.error('Error saving product:', error);
        showToast('Error al guardar el producto', 'error');
    }
}

async function deleteProduct(productId) {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;
    
    try {
        // Get the product first to retrieve its firebaseKey
        const product = await db.getProduct(productId);
        const firebaseKey = product ? product.firebaseKey : null;
        
        // Delete from local IndexedDB
        await db.deleteProduct(productId);
        
        // Sync deletion to Firebase if authenticated
        if (typeof firebaseSync !== 'undefined' && firebaseSync.isUserAuthenticated()) {
            try {
                await firebaseSync.deleteSingle('products', productId, firebaseKey);
            } catch (syncError) {
                console.warn('Firebase sync failed, product deleted locally:', syncError);
            }
        }
        
        showToast('Producto eliminado', 'success');
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
                <td colspan="7" style="text-align: center; padding: 40px;">
                    No hay ventas en este período
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = sales.map(sale => {
            const paymentIcons = { efectivo: '💵', tarjeta: '💳', transferencia: '📱', apartado: '📋' };
            const profit = sale.totalProfit || 0;
            return `
                <tr>
                    <td data-label="Fecha/Hora">${formatDateTime(sale.date)}</td>
                    <td data-label="Ticket"><strong>${sale.ticketNumber}</strong></td>
                    <td data-label="Productos">${sale.items.length} producto(s)</td>
                    <td data-label="Total"><strong>${formatCurrency(sale.total)}</strong></td>
                    <td data-label="Ganancia" style="color: ${profit >= 0 ? '#10B981' : '#EF4444'}; font-weight: 600;">${formatCurrency(profit)}</td>
                    <td data-label="Método">
                        <span class="payment-badge">
                            ${paymentIcons[sale.paymentMethod] || '💰'}
                            ${sale.paymentMethod}
                        </span>
                    </td>
                    <td data-label="Acciones">
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
    
    // Calculate profit for today
    const todayProfit = todaySales.reduce((sum, sale) => sum + (sale.totalProfit || 0), 0);
    
    document.getElementById('today-sales').textContent = formatCurrency(todayTotal);
    document.getElementById('month-sales').textContent = formatCurrency(monthTotal);
    document.getElementById('today-transactions').textContent = todaySales.length;
    document.getElementById('today-profit').textContent = formatCurrency(todayProfit);
}

async function viewSaleDetails(saleId) {
    const sale = await db.getSale(saleId);
    if (!sale) return;
    
    state.currentSale = sale;
    
    // Note: Ticket NEVER shows owner information - only shows: logo, products, total, thank you message
    const content = document.getElementById('sale-detail-content');
    content.innerHTML = `
        <div class="ticket-print">
            <div class="ticket-header">
                <div style="font-size: 2rem; margin-bottom: 10px;">✨</div>
                <h2>${state.settings.businessName}</h2>
                ${state.settings.businessPhone ? `<p>Tel: ${state.settings.businessPhone}</p>` : ''}
                ${state.settings.businessAddress ? `<p>${state.settings.businessAddress}</p>` : ''}
            </div>
            <div class="ticket-info">
                <p>Ticket: <strong>${sale.ticketNumber}</strong></p>
                <p>Fecha: ${formatDateTime(sale.date)}</p>
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
                ${sale.discount > 0 ? `
                    <div class="ticket-total-row">
                        <span>Subtotal:</span>
                        <span>${formatCurrency(sale.subtotal)}</span>
                    </div>
                    <div class="ticket-total-row">
                        <span>Descuento ${sale.discountType === 'amount' ? `($${sale.discountValue})` : `(${sale.discountPercent}%)`}:</span>
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
                <p>${state.settings.ticketFooter || '¡Gracias por elegir Gracia Divina!'}</p>
            </div>
        </div>
    `;
    
    openModal('sale-detail-modal');
}

function printTicket() {
    if (!state.currentSale) return;
    
    // Print ticket - NEVER includes owner information
    const sale = state.currentSale;
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Ticket - ${sale.ticketNumber}</title>
            <style>
                body { font-family: 'Courier New', monospace; font-size: 12px; max-width: 300px; margin: 0 auto; padding: 20px; }
                .ticket-logo { text-align: center; font-size: 2rem; margin-bottom: 10px; }
                .ticket-header { text-align: center; margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
                .ticket-header h2 { margin: 0; font-size: 18px; }
                .ticket-info { margin-bottom: 15px; font-size: 11px; }
                .ticket-items { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 10px 0; }
                .ticket-item { display: flex; justify-content: space-between; margin-bottom: 5px; }
                .ticket-totals { padding: 10px 0; }
                .ticket-total-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
                .ticket-total-row.final { font-weight: bold; font-size: 14px; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; }
                .ticket-footer { text-align: center; margin-top: 15px; font-size: 11px; font-style: italic; }
            </style>
        </head>
        <body>
            <div class="ticket-logo">✨</div>
            <div class="ticket-header">
                <h2>${state.settings.businessName}</h2>
            </div>
            <div class="ticket-info">
                <p>Ticket: ${sale.ticketNumber}</p>
                <p>Fecha: ${formatDateTime(sale.date)}</p>
            </div>
            <div class="ticket-items">
                ${sale.items.map(item => `
                    <div class="ticket-item">
                        <span>${item.quantity}x ${item.name}</span>
                        <span>${formatCurrency(item.subtotal)}</span>
                    </div>
                `).join('')}
            </div>
            <div class="ticket-totals">
                <div class="ticket-total-row final">
                    <span>TOTAL:</span>
                    <span>${formatCurrency(sale.total)}</span>
                </div>
            </div>
            <div class="ticket-footer">
                <p>${state.settings.ticketFooter || '¡Gracias por elegir Gracia Divina!'}</p>
            </div>
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
        await db.seedDefaultOwners();
        await db.seedSampleProducts();
        
        state.cart = [];
        updateCartUI();
        await loadOwners();
        await loadProducts();
        await loadSalesHistory();
        await updateLayawayBadge();
        
        showToast('Datos restablecidos', 'success');
    } catch (error) {
        console.error('Error resetting data:', error);
        showToast('Error al restablecer los datos', 'error');
    }
}

// ========================================
// OWNERS MANAGEMENT
// ========================================
async function loadOwners() {
    state.owners = await db.getAllOwners();
}

async function loadOwnersSettings() {
    const owners = await db.getAllOwners();
    const container = document.getElementById('owners-list');
    
    container.innerHTML = owners.map(owner => `
        <div class="owner-tag">
            <span>${escapeHtml(owner.name)}</span>
            <button class="delete-owner" onclick="deleteOwner(${owner.id})" title="Eliminar">×</button>
        </div>
    `).join('');
}

async function addNewOwner() {
    const input = document.getElementById('new-owner-name');
    const name = input.value.trim();
    
    if (!name) {
        showToast('Ingresa un nombre', 'warning');
        return;
    }
    
    try {
        await db.addOwner(name);
        input.value = '';
        await loadOwners();
        await loadOwnersSettings();
        showToast('Dueña agregada', 'success');
    } catch (error) {
        console.error('Error adding owner:', error);
        showToast('Error al agregar dueña', 'error');
    }
}

async function deleteOwner(ownerId) {
    if (!confirm('¿Estás seguro de eliminar esta dueña?')) return;
    
    try {
        await db.deleteOwner(ownerId);
        await loadOwners();
        await loadOwnersSettings();
        showToast('Dueña eliminada', 'success');
    } catch (error) {
        console.error('Error deleting owner:', error);
        showToast('Error al eliminar dueña', 'error');
    }
}

// ========================================
// LAYAWAY (APARTADO) SYSTEM
// ========================================
async function updateLayawayBadge() {
    const pending = await db.getPendingLayaways();
    const badge = document.getElementById('layaway-count-badge');
    badge.textContent = pending.length > 0 ? pending.length : '';
    
    // Also update mobile menu badge
    const mobileBadge = document.getElementById('mobile-layaway-badge');
    if (mobileBadge) {
        mobileBadge.textContent = pending.length > 0 ? pending.length : '';
    }
}

function openLayawayModal() {
    if (state.cart.length === 0) return;
    
    const total = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Populate items
    document.getElementById('layaway-items').innerHTML = state.cart.map(item => `
        <div class="checkout-item">
            <span class="checkout-item-name">${escapeHtml(item.name)}</span>
            <span class="checkout-item-qty">x${item.quantity}</span>
            <span>${formatCurrency(item.price * item.quantity)}</span>
        </div>
    `).join('');
    
    document.getElementById('layaway-total').textContent = formatCurrency(total);
    document.getElementById('layaway-customer-name').value = '';
    document.getElementById('layaway-customer-phone').value = '';
    document.getElementById('layaway-initial-payment').value = '';
    document.getElementById('layaway-pending').textContent = formatCurrency(total);
    
    openModal('layaway-modal');
}

function updateLayawayPending() {
    const total = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const initial = parseFloat(document.getElementById('layaway-initial-payment').value) || 0;
    const pending = Math.max(0, total - initial);
    document.getElementById('layaway-pending').textContent = formatCurrency(pending);
}

async function createLayaway() {
    const customerName = document.getElementById('layaway-customer-name').value.trim();
    const customerPhone = document.getElementById('layaway-customer-phone').value.trim();
    const initialPayment = parseFloat(document.getElementById('layaway-initial-payment').value) || 0;
    
    if (!customerName || !customerPhone) {
        showToast('Completa nombre y teléfono', 'warning');
        return;
    }
    
    if (initialPayment <= 0) {
        showToast('Ingresa un monto inicial', 'warning');
        return;
    }
    
    const total = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalCost = state.cart.reduce((sum, item) => sum + ((item.cost || 0) * item.quantity), 0);
    
    const layaway = {
        customerName,
        customerPhone,
        items: state.cart.map(item => ({
            productId: item.productId,
            name: item.name,
            cost: item.cost || 0,
            price: item.price,
            quantity: item.quantity,
            subtotal: item.price * item.quantity,
            costSubtotal: (item.cost || 0) * item.quantity,
            profit: (item.price - (item.cost || 0)) * item.quantity,
            owner: item.owner || ''
        })),
        subtotal: total,
        total,
        totalCost,
        totalProfit: total - totalCost,
        totalPaid: initialPayment,
        pendingAmount: total - initialPayment,
        payments: [{
            amount: initialPayment,
            paymentMethod: 'efectivo',
            date: new Date().toISOString()
        }]
    };
    
    try {
        const savedLayaway = await db.addLayaway(layaway);
        
        // Sync to Firebase for cross-device synchronization
        if (typeof firebaseSync !== 'undefined' && firebaseSync.isUserAuthenticated()) {
            try {
                await firebaseSync.uploadSingle('layaways', savedLayaway);
            } catch (syncError) {
                console.warn('Firebase sync failed, layaway saved locally:', syncError);
            }
        }
        
        // Clear cart
        state.cart = [];
        document.getElementById('discount-input').value = 0;
        updateCartUI();
        
        closeAllModals();
        
        // Refresh products and update badge
        const activeCategory = document.querySelector('.category-tab.active').dataset.category;
        const searchQuery = document.getElementById('product-search').value;
        await loadProducts(activeCategory, searchQuery);
        await updateLayawayBadge();
        
        showToast('Apartado creado exitosamente', 'success');
    } catch (error) {
        console.error('Error creating layaway:', error);
        showToast('Error al crear apartado', 'error');
    }
}

// Helper function to remove duplicate layaways
function deduplicateLayaways(layaways) {
    const uniqueLayaways = [];
    const seen = new Set();
    
    for (const layaway of layaways) {
        // Crear clave única basada en firebaseKey o en datos del cliente
        let uniqueKey;
        if (layaway.firebaseKey) {
            // Usar firebaseKey como identificador principal
            uniqueKey = `fb_${layaway.firebaseKey}`;
        } else if (layaway.customerName && layaway.customerPhone && layaway.date) {
            // Solo deduplicar si tenemos datos completos
            const dateStr = new Date(layaway.date).toISOString();
            uniqueKey = `local_${layaway.customerName}_${layaway.customerPhone}_${dateStr}`;
        } else {
            // Si faltan datos, usar el ID local para mantener el registro
            // Esto evita eliminar registros válidos con datos incompletos
            uniqueKey = `id_${layaway.id}`;
        }
        
        if (!seen.has(uniqueKey)) {
            seen.add(uniqueKey);
            uniqueLayaways.push(layaway);
        } else {
            console.warn('Apartado duplicado detectado y omitido:', layaway.customerName || 'Unknown');
        }
    }
    
    return uniqueLayaways;
}

async function loadLayaways() {
    let layaways = await db.getAllLayaways();
    
    // Filtrar duplicados defensivamente
    layaways = deduplicateLayaways(layaways);
    const pending = layaways.filter(l => l.status === 'pending');
    const completed = layaways.filter(l => l.status === 'completed');
    
    // Update summary
    const pendingAmount = pending.reduce((sum, l) => sum + l.pendingAmount, 0);
    document.getElementById('pending-layaways-count').textContent = pending.length;
    document.getElementById('pending-layaways-amount').textContent = formatCurrency(pendingAmount);
    
    // Render list
    const container = document.getElementById('layaways-list');
    
    if (layaways.length === 0) {
        container.innerHTML = `
            <div class="cart-empty" style="padding: 60px;">
                <span class="empty-icon">📋</span>
                <p>No hay apartados registrados</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = layaways.map(layaway => `
        <div class="layaway-card ${layaway.status}" onclick="viewLayawayDetails(${layaway.id})">
            <div class="layaway-info">
                <h4>
                    <span class="layaway-customer-name">${escapeHtml(layaway.customerName)}</span>
                    <span class="layaway-status ${layaway.status}">
                        ${layaway.status === 'pending' ? 'Pendiente' : 'Completado'}
                    </span>
                </h4>
                <p>📞 ${escapeHtml(layaway.customerPhone)}</p>
                <p>📅 ${formatDateTime(layaway.date)}</p>
                <p>${layaway.items.length} producto(s)</p>
            </div>
            <div class="layaway-amounts">
                <div class="layaway-total">${formatCurrency(layaway.total)}</div>
                ${layaway.status === 'pending' 
                    ? `<div class="layaway-pending-amount">Pendiente: ${formatCurrency(layaway.pendingAmount)}</div>` 
                    : ''}
            </div>
        </div>
    `).join('');
}

async function searchLayaways() {
    const query = document.getElementById('layaway-search').value.trim();
    
    if (!query) {
        await loadLayaways();
        return;
    }
    
    let layaways = await db.searchLayaways(query);
    
    // Aplicar el mismo filtro de deduplicación
    layaways = deduplicateLayaways(layaways);
    const container = document.getElementById('layaways-list');
    
    if (layaways.length === 0) {
        container.innerHTML = `
            <div class="cart-empty" style="padding: 60px;">
                <span class="empty-icon">🔍</span>
                <p>No se encontraron apartados</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = layaways.map(layaway => `
        <div class="layaway-card ${layaway.status}" onclick="viewLayawayDetails(${layaway.id})">
            <div class="layaway-info">
                <h4>
                    <span class="layaway-customer-name">${escapeHtml(layaway.customerName)}</span>
                    <span class="layaway-status ${layaway.status}">
                        ${layaway.status === 'pending' ? 'Pendiente' : 'Completado'}
                    </span>
                </h4>
                <p>📞 ${escapeHtml(layaway.customerPhone)}</p>
                <p>📅 ${formatDateTime(layaway.date)}</p>
            </div>
            <div class="layaway-amounts">
                <div class="layaway-total">${formatCurrency(layaway.total)}</div>
                ${layaway.status === 'pending' 
                    ? `<div class="layaway-pending-amount">Pendiente: ${formatCurrency(layaway.pendingAmount)}</div>` 
                    : ''}
            </div>
        </div>
    `).join('');
}

async function viewLayawayDetails(layawayId) {
    const layaway = await db.getLayaway(layawayId);
    if (!layaway) return;
    
    state.currentLayaway = layaway;
    
    const content = document.getElementById('layaway-detail-content');
    content.innerHTML = `
        <div class="layaway-detail-section">
            <h4>👤 Cliente</h4>
            <p><strong>${escapeHtml(layaway.customerName)}</strong></p>
            <p>📞 ${escapeHtml(layaway.customerPhone)}</p>
            <p>📅 Creado: ${formatDateTime(layaway.date)}</p>
        </div>
        
        <div class="layaway-detail-section">
            <h4>🛍️ Productos</h4>
            <div class="checkout-items">
                ${layaway.items.map(item => `
                    <div class="checkout-item">
                        <div style="flex: 1;">
                            <div class="checkout-item-name">${escapeHtml(item.name)}</div>
                            ${item.isManual && item.upc ? `<small style="color: #666;">UPC: ${escapeHtml(item.upc)}</small>` : ''}
                        </div>
                        <span class="checkout-item-qty">x${item.quantity}</span>
                        <span>${formatCurrency(item.subtotal)}</span>
                    </div>
                `).join('')}
            </div>
            <div class="checkout-totals">
                <div class="checkout-row total">
                    <span>Total:</span>
                    <span>${formatCurrency(layaway.total)}</span>
                </div>
            </div>
        </div>
        
        <div class="layaway-detail-section">
            <h4>💵 Abonos</h4>
            <div class="payments-list">
                ${layaway.payments.map(payment => `
                    <div class="payment-item">
                        <div>
                            <span class="payment-item-date">${formatDateTime(payment.date)}</span>
                            <small>(${payment.paymentMethod})</small>
                        </div>
                        <span class="payment-item-amount">${formatCurrency(payment.amount)}</span>
                    </div>
                `).join('')}
            </div>
            <div class="layaway-balance">
                <span>Total Pagado:</span>
                <span style="color: var(--success); font-size: 1.25rem; font-weight: 700;">${formatCurrency(layaway.totalPaid)}</span>
            </div>
            <div class="layaway-balance">
                <span>Saldo Pendiente:</span>
                <span class="pending-amount">${formatCurrency(layaway.pendingAmount)}</span>
            </div>
        </div>
    `;
    
    // Update buttons
    document.getElementById('add-products-to-layaway').style.display = layaway.status === 'pending' ? '' : 'none';
    document.getElementById('add-layaway-payment').style.display = layaway.status === 'pending' ? '' : 'none';
    document.getElementById('complete-layaway-btn').disabled = layaway.pendingAmount > 0;
    document.getElementById('complete-layaway-btn').style.display = layaway.status === 'pending' ? '' : 'none';
    document.getElementById('delete-layaway-btn').style.display = layaway.status === 'pending' ? '' : 'none';
    // Export PDF is always visible
    document.getElementById('export-layaway-pdf').style.display = '';
    
    openModal('layaway-detail-modal');
}

function openPaymentModal() {
    if (!state.currentLayaway) return;
    
    document.getElementById('payment-amount').value = '';
    document.getElementById('payment-pending').textContent = formatCurrency(state.currentLayaway.pendingAmount);
    document.getElementById('payment-method-select').value = 'efectivo';
    
    openModal('payment-modal');
}

async function confirmLayawayPayment() {
    const amount = parseFloat(document.getElementById('payment-amount').value) || 0;
    const method = document.getElementById('payment-method-select').value;
    
    if (amount <= 0) {
        showToast('Ingresa un monto válido', 'warning');
        return;
    }
    
    if (amount > state.currentLayaway.pendingAmount) {
        showToast('El monto excede el saldo pendiente', 'warning');
        return;
    }
    
    try {
        await db.addLayawayPayment(state.currentLayaway.id, amount, method);
        
        // Sync updated layaway to Firebase for cross-device synchronization
        const updatedLayaway = await db.getLayaway(state.currentLayaway.id);
        if (typeof firebaseSync !== 'undefined' && firebaseSync.isUserAuthenticated() && updatedLayaway) {
            try {
                await firebaseSync.uploadSingle('layaways', updatedLayaway);
            } catch (syncError) {
                console.warn('Firebase sync failed, payment saved locally:', syncError);
            }
        }
        
        closeAllModals();
        await loadLayaways();
        await updateLayawayBadge();
        
        // Reopen layaway details with updated info
        await viewLayawayDetails(state.currentLayaway.id);
        
        showToast('Abono registrado', 'success');
    } catch (error) {
        console.error('Error adding payment:', error);
        showToast('Error al registrar abono', 'error');
    }
}

async function completeLayaway() {
    if (!state.currentLayaway || state.currentLayaway.pendingAmount > 0) {
        showToast('Aún hay saldo pendiente', 'warning');
        return;
    }
    
    if (!confirm('¿Confirmas liquidar este apartado?')) return;
    
    try {
        const sale = await db.completeLayaway(state.currentLayaway.id);
        
        // Sync completed layaway and sale to Firebase for cross-device synchronization
        if (typeof firebaseSync !== 'undefined' && firebaseSync.isUserAuthenticated()) {
            try {
                const completedLayaway = await db.getLayaway(state.currentLayaway.id);
                if (completedLayaway) {
                    await firebaseSync.uploadSingle('layaways', completedLayaway);
                }
                if (sale) {
                    await firebaseSync.uploadSingle('sales', sale);
                }
            } catch (syncError) {
                console.warn('Firebase sync failed, layaway completed locally:', syncError);
            }
        }
        
        closeAllModals();
        await loadLayaways();
        await updateLayawayBadge();
        await updateSalesSummary();
        
        showToast(`Apartado liquidado - Ticket #${sale.ticketNumber}`, 'success');
    } catch (error) {
        console.error('Error completing layaway:', error);
        showToast('Error al liquidar apartado', 'error');
    }
}

async function deleteLayaway() {
    if (!state.currentLayaway) return;
    
    // Only allow deletion of pending layaways
    if (state.currentLayaway.status === 'completed') {
        showToast('No se puede eliminar un apartado completado', 'warning');
        return;
    }
    
    if (!confirm('⚠️ ¿Estás seguro de eliminar este apartado?\n\nEsta acción eliminará el apartado y devolverá los productos al inventario.')) return;
    
    if (!confirm('Esta es tu última oportunidad. ¿Realmente deseas eliminar este apartado?')) return;
    
    try {
        await db.deleteLayaway(state.currentLayaway.id);
        
        // Sync deletion to Firebase if authenticated
        if (typeof firebaseSync !== 'undefined' && firebaseSync.isUserAuthenticated()) {
            try {
                await firebaseSync.deleteSingle('layaways', state.currentLayaway.id);
            } catch (syncError) {
                console.warn('Firebase sync failed, layaway deleted locally:', syncError);
            }
        }
        
        closeAllModals();
        await loadLayaways();
        await updateLayawayBadge();
        
        // Refresh products to show restored stock
        const activeCategory = document.querySelector('.category-tab.active')?.dataset.category || 'all';
        const searchQuery = document.getElementById('product-search')?.value || '';
        await loadProducts(activeCategory, searchQuery);
        
        showToast('Apartado eliminado correctamente', 'success');
    } catch (error) {
        console.error('Error deleting layaway:', error);
        showToast('Error al eliminar apartado', 'error');
    }
}

function exportLayawayPDF() {
    if (!state.currentLayaway) return;
    
    const layaway = state.currentLayaway;
    
    // Create PDF content using a new window for printing
    const printWindow = window.open('', '_blank');
    
    // Check if popup was blocked
    if (!printWindow || printWindow.closed || typeof printWindow.closed === 'undefined') {
        showToast('Por favor, permite las ventanas emergentes para exportar el PDF', 'warning');
        return;
    }
    
    // Generate payments history HTML
    const paymentsHTML = layaway.payments.map(payment => `
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${formatDateTime(payment.date)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${payment.paymentMethod}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; color: #10B981; font-weight: bold;">${formatCurrency(payment.amount)}</td>
        </tr>
    `).join('');
    
    // Generate products HTML
    const productsHTML = layaway.items.map(item => `
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">
                ${escapeHtml(item.name)}
                ${item.isManual && item.upc ? `<br><small style="color: #666;">UPC: ${escapeHtml(item.upc)}</small>` : ''}
            </td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatCurrency(item.price)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatCurrency(item.subtotal)}</td>
        </tr>
    `).join('');
    
    const statusText = layaway.status === 'pending' ? 'Pendiente' : 'Completado';
    const statusColor = layaway.status === 'pending' ? '#F59E0B' : '#10B981';
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Apartado - ${escapeHtml(layaway.customerName)}</title>
            <meta charset="UTF-8">
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    padding: 20px; 
                    max-width: 800px; 
                    margin: 0 auto;
                    color: #333;
                }
                .header { 
                    text-align: center; 
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid #8B5CF6;
                }
                .header h1 { 
                    color: #8B5CF6; 
                    margin: 0 0 10px 0;
                    font-size: 28px;
                }
                .header .logo {
                    font-size: 3rem;
                    margin-bottom: 10px;
                }
                .header p { 
                    color: #666; 
                    margin: 5px 0;
                }
                .customer-info { 
                    background: #f5f5f5; 
                    padding: 20px; 
                    border-radius: 10px;
                    margin-bottom: 20px;
                }
                .customer-info h3 { 
                    margin-top: 0; 
                    color: #8B5CF6;
                }
                .status-badge {
                    display: inline-block;
                    padding: 5px 15px;
                    border-radius: 20px;
                    font-weight: bold;
                    color: white;
                    background: ${statusColor};
                    margin-left: 10px;
                }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin: 20px 0;
                }
                th { 
                    background: #8B5CF6; 
                    color: white; 
                    padding: 12px 8px; 
                    text-align: left;
                }
                .section { 
                    margin-bottom: 30px; 
                }
                .section h3 { 
                    color: #8B5CF6;
                    border-bottom: 2px solid #8B5CF6;
                    padding-bottom: 10px;
                    margin-bottom: 15px;
                }
                .totals { 
                    background: #f9f9f9; 
                    padding: 20px; 
                    border-radius: 10px;
                }
                .totals-row { 
                    display: flex; 
                    justify-content: space-between; 
                    padding: 10px 0;
                    border-bottom: 1px solid #eee;
                }
                .totals-row.final { 
                    font-weight: bold; 
                    font-size: 1.3em;
                    border-bottom: none;
                    padding-top: 15px;
                    margin-top: 10px;
                    border-top: 2px solid #8B5CF6;
                }
                .pending-amount {
                    color: ${layaway.pendingAmount > 0 ? '#EF4444' : '#10B981'};
                    font-weight: bold;
                }
                .footer { 
                    margin-top: 40px; 
                    text-align: center; 
                    color: #666;
                    font-size: 12px;
                    padding-top: 20px;
                    border-top: 1px solid #ddd;
                }
                @media print {
                    body { padding: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="logo">✨</div>
                <h1>${state.settings.businessName || 'Gracia Divina'}</h1>
                ${state.settings.businessPhone ? `<p>📞 ${state.settings.businessPhone}</p>` : ''}
                ${state.settings.businessAddress ? `<p>📍 ${state.settings.businessAddress}</p>` : ''}
                <p style="margin-top: 15px; font-size: 1.2em; font-weight: bold;">Detalle de Apartado</p>
            </div>
            
            <div class="customer-info">
                <h3>👤 Información del Cliente <span class="status-badge">${statusText}</span></h3>
                <p><strong>Nombre:</strong> ${escapeHtml(layaway.customerName)}</p>
                <p><strong>Teléfono:</strong> ${escapeHtml(layaway.customerPhone)}</p>
                <p><strong>Fecha de Creación:</strong> ${formatDateTime(layaway.date)}</p>
            </div>
            
            <div class="section">
                <h3>🛍️ Productos Apartados</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th style="text-align: center;">Cantidad</th>
                            <th style="text-align: right;">Precio Unitario</th>
                            <th style="text-align: right;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${productsHTML}
                    </tbody>
                </table>
            </div>
            
            <div class="section">
                <h3>💵 Historial de Abonos</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Método de Pago</th>
                            <th style="text-align: right;">Monto</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paymentsHTML}
                    </tbody>
                </table>
            </div>
            
            <div class="totals">
                <div class="totals-row">
                    <span>Total del Apartado:</span>
                    <span>${formatCurrency(layaway.total)}</span>
                </div>
                <div class="totals-row">
                    <span>Total Abonado:</span>
                    <span style="color: #10B981;">${formatCurrency(layaway.totalPaid)}</span>
                </div>
                <div class="totals-row final">
                    <span>Saldo Pendiente:</span>
                    <span class="pending-amount">${formatCurrency(layaway.pendingAmount)}</span>
                </div>
            </div>
            
            <div class="footer">
                <p>${state.settings.ticketFooter || '¡Gracias por elegir Gracia Divina!'}</p>
                <p style="margin-top: 10px;">Documento generado el ${formatDateTime(new Date().toISOString())}</p>
            </div>
            
            <div class="no-print" style="margin-top: 30px; text-align: center;">
                <button onclick="window.print()" style="
                    background: #8B5CF6; 
                    color: white; 
                    border: none; 
                    padding: 15px 30px; 
                    font-size: 16px; 
                    border-radius: 8px; 
                    cursor: pointer;
                    margin-right: 10px;
                ">🖨️ Imprimir / Guardar PDF</button>
                <button onclick="window.close()" style="
                    background: #6B7280; 
                    color: white; 
                    border: none; 
                    padding: 15px 30px; 
                    font-size: 16px; 
                    border-radius: 8px; 
                    cursor: pointer;
                ">Cerrar</button>
            </div>
        </body>
        </html>
    `);
    
    printWindow.document.close();
    
    showToast('PDF generado - Usa "Guardar como PDF" en el diálogo de impresión', 'info');
}

// ========================================
// MANUAL LAYAWAY SYSTEM
// ========================================
let manualProductCounter = 0;

function openManualLayawayModal() {
    // Reset the form
    document.getElementById('manual-layaway-customer-name').value = '';
    document.getElementById('manual-layaway-customer-phone').value = '';
    document.getElementById('manual-layaway-initial-payment').value = '';
    document.getElementById('manual-layaway-products').innerHTML = '';
    document.getElementById('manual-layaway-total').textContent = '$0.00';
    document.getElementById('manual-layaway-pending').textContent = '$0.00';
    manualProductCounter = 0;
    
    // Add first product row
    addManualProductRow();
    
    openModal('manual-layaway-modal');
}

function addManualProductRow() {
    const container = document.getElementById('manual-layaway-products');
    const rowId = ++manualProductCounter;
    
    const row = document.createElement('div');
    row.className = 'manual-product-row';
    row.dataset.rowId = rowId;
    row.innerHTML = `
        <div class="form-row" style="align-items: flex-end; gap: 10px; margin-bottom: 15px; padding: 15px; background: #f9f9f9; border-radius: 8px;">
            <div class="form-group" style="flex: 2; margin: 0;">
                <label>Nombre del Producto *</label>
                <input type="text" class="form-input manual-product-name" required placeholder="Nombre del producto">
            </div>
            <div class="form-group" style="flex: 1; margin: 0;">
                <label>Código/UPC</label>
                <input type="text" class="form-input manual-product-upc" placeholder="Código o UPC">
            </div>
            <div class="form-group" style="flex: 1; margin: 0;">
                <label>Precio *</label>
                <input type="number" class="form-input manual-product-price" required min="0" step="0.01" placeholder="0.00">
            </div>
            <div class="form-group" style="flex: 0 0 80px; margin: 0;">
                <label>Cantidad *</label>
                <input type="number" class="form-input manual-product-quantity" required min="1" value="1" placeholder="1">
            </div>
            <button type="button" class="btn-icon delete" onclick="removeManualProductRow(${rowId})" title="Eliminar" style="align-self: center; margin-bottom: 0;">🗑️</button>
        </div>
    `;
    
    container.appendChild(row);
    
    // Add event listeners to update total
    row.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', updateManualLayawayTotal);
    });
}

function removeManualProductRow(rowId) {
    const row = document.querySelector(`[data-row-id="${rowId}"]`);
    if (row) {
        row.remove();
        updateManualLayawayTotal();
    }
}

let manualLayawayTotal = 0;

function updateManualLayawayTotal() {
    const rows = document.querySelectorAll('.manual-product-row');
    manualLayawayTotal = 0;
    
    rows.forEach(row => {
        const price = parseFloat(row.querySelector('.manual-product-price').value) || 0;
        const quantity = parseInt(row.querySelector('.manual-product-quantity').value) || 0;
        manualLayawayTotal += price * quantity;
    });
    
    document.getElementById('manual-layaway-total').textContent = formatCurrency(manualLayawayTotal);
    updateManualLayawayPending();
}

function updateManualLayawayPending() {
    const initial = parseFloat(document.getElementById('manual-layaway-initial-payment').value) || 0;
    const pending = Math.max(0, manualLayawayTotal - initial);
    document.getElementById('manual-layaway-pending').textContent = formatCurrency(pending);
}

async function createManualLayaway() {
    const customerName = document.getElementById('manual-layaway-customer-name').value.trim();
    const customerPhone = document.getElementById('manual-layaway-customer-phone').value.trim();
    const initialPayment = parseFloat(document.getElementById('manual-layaway-initial-payment').value) || 0;
    
    if (!customerName || !customerPhone) {
        showToast('Completa nombre y teléfono', 'warning');
        return;
    }
    
    // Get all products
    const rows = document.querySelectorAll('.manual-product-row');
    const items = [];
    let hasEmptyFields = false;
    
    rows.forEach(row => {
        const name = row.querySelector('.manual-product-name').value.trim();
        const upc = row.querySelector('.manual-product-upc').value.trim();
        const price = parseFloat(row.querySelector('.manual-product-price').value) || 0;
        const quantity = parseInt(row.querySelector('.manual-product-quantity').value) || 0;
        
        if (!name || price <= 0 || quantity <= 0) {
            hasEmptyFields = true;
            return;
        }
        
        items.push({
            productId: null, // Manual products don't have a productId
            name: name,
            upc: upc || '',
            cost: 0, // Manual products don't track cost
            price: price,
            quantity: quantity,
            subtotal: price * quantity,
            costSubtotal: 0,
            profit: 0,
            owner: '',
            isManual: true
        });
    });
    
    if (hasEmptyFields) {
        showToast('Completa todos los campos de productos', 'warning');
        return;
    }
    
    if (items.length === 0) {
        showToast('Agrega al menos un producto', 'warning');
        return;
    }
    
    if (initialPayment <= 0) {
        showToast('Ingresa un monto inicial', 'warning');
        return;
    }
    
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    
    const layaway = {
        customerName,
        customerPhone,
        items,
        subtotal: total,
        total,
        totalCost: 0,
        totalProfit: 0,
        totalPaid: initialPayment,
        pendingAmount: total - initialPayment,
        payments: [{
            amount: initialPayment,
            paymentMethod: 'efectivo',
            date: new Date().toISOString()
        }],
        isManual: true // Mark as manual layaway
    };
    
    try {
        const savedLayaway = await db.addLayaway(layaway);
        
        // Sync to Firebase for cross-device synchronization
        if (typeof firebaseSync !== 'undefined' && firebaseSync.isUserAuthenticated()) {
            try {
                await firebaseSync.uploadSingle('layaways', savedLayaway);
            } catch (syncError) {
                console.warn('Firebase sync failed, layaway saved locally:', syncError);
            }
        }
        
        closeAllModals();
        await loadLayaways();
        await updateLayawayBadge();
        
        showToast('Apartado manual creado exitosamente', 'success');
    } catch (error) {
        console.error('Error creating manual layaway:', error);
        showToast('Error al crear apartado manual', 'error');
    }
}

// ========================================
// ADD PRODUCTS TO EXISTING LAYAWAY
// ========================================
let addProductsCounter = 0;
let addProductsTotal = 0;

function openAddProductsToLayawayModal() {
    if (!state.currentLayaway) return;
    
    // Reset the form
    document.getElementById('add-products-layaway-container').innerHTML = '';
    addProductsCounter = 0;
    addProductsTotal = 0;
    
    // Display current layaway total
    document.getElementById('current-layaway-total').textContent = formatCurrency(state.currentLayaway.total);
    document.getElementById('new-products-total').textContent = '$0.00';
    document.getElementById('updated-layaway-total').textContent = formatCurrency(state.currentLayaway.total);
    
    // Add first product row
    addAnotherProductToLayaway();
    
    openModal('add-products-layaway-modal');
}

function addAnotherProductToLayaway() {
    const container = document.getElementById('add-products-layaway-container');
    const rowId = ++addProductsCounter;
    
    const row = document.createElement('div');
    row.className = 'manual-product-row';
    row.dataset.rowId = rowId;
    row.innerHTML = `
        <div class="form-row" style="align-items: flex-end; gap: 10px; margin-bottom: 15px; padding: 15px; background: #f9f9f9; border-radius: 8px;">
            <div class="form-group" style="flex: 2; margin: 0;">
                <label>Nombre del Producto *</label>
                <input type="text" class="form-input add-product-name" required placeholder="Nombre del producto">
            </div>
            <div class="form-group" style="flex: 1; margin: 0;">
                <label>Código/UPC</label>
                <input type="text" class="form-input add-product-upc" placeholder="Código o UPC">
            </div>
            <div class="form-group" style="flex: 1; margin: 0;">
                <label>Precio *</label>
                <input type="number" class="form-input add-product-price" required min="0" step="0.01" placeholder="0.00">
            </div>
            <div class="form-group" style="flex: 0 0 80px; margin: 0;">
                <label>Cantidad *</label>
                <input type="number" class="form-input add-product-quantity" required min="1" value="1" placeholder="1">
            </div>
            <button type="button" class="btn-icon delete" onclick="removeAddProductRow(${rowId})" title="Eliminar" style="align-self: center; margin-bottom: 0;">🗑️</button>
        </div>
    `;
    
    container.appendChild(row);
    
    // Add event listeners to update total
    row.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', updateAddProductsTotal);
    });
}

function removeAddProductRow(rowId) {
    const row = document.querySelector(`[data-row-id="${rowId}"]`);
    if (row) {
        row.remove();
        updateAddProductsTotal();
    }
}

function updateAddProductsTotal() {
    const rows = document.querySelectorAll('#add-products-layaway-container .manual-product-row');
    addProductsTotal = 0;
    
    rows.forEach(row => {
        const price = parseFloat(row.querySelector('.add-product-price').value) || 0;
        const quantity = parseInt(row.querySelector('.add-product-quantity').value) || 0;
        addProductsTotal += price * quantity;
    });
    
    document.getElementById('new-products-total').textContent = formatCurrency(addProductsTotal);
    
    const currentTotal = state.currentLayaway ? state.currentLayaway.total : 0;
    const updatedTotal = currentTotal + addProductsTotal;
    document.getElementById('updated-layaway-total').textContent = formatCurrency(updatedTotal);
}

async function confirmAddProductsToLayaway() {
    if (!state.currentLayaway) return;
    
    // Get all products
    const rows = document.querySelectorAll('#add-products-layaway-container .manual-product-row');
    const newItems = [];
    let hasEmptyFields = false;
    
    rows.forEach(row => {
        const name = row.querySelector('.add-product-name').value.trim();
        const upc = row.querySelector('.add-product-upc').value.trim();
        const price = parseFloat(row.querySelector('.add-product-price').value) || 0;
        const quantity = parseInt(row.querySelector('.add-product-quantity').value) || 0;
        
        if (!name || price <= 0 || quantity <= 0) {
            hasEmptyFields = true;
            return;
        }
        
        newItems.push({
            productId: null, // Manual products don't have a productId
            name: name,
            upc: upc || '',
            cost: 0, // Manual products don't track cost
            price: price,
            quantity: quantity,
            subtotal: price * quantity,
            costSubtotal: 0,
            profit: 0,
            owner: '',
            isManual: true
        });
    });
    
    if (hasEmptyFields) {
        showToast('Completa todos los campos de productos', 'warning');
        return;
    }
    
    if (newItems.length === 0) {
        showToast('Agrega al menos un producto', 'warning');
        return;
    }
    
    try {
        const updatedLayaway = await db.addProductsToLayaway(state.currentLayaway.id, newItems);
        
        // Sync to Firebase for cross-device synchronization
        if (typeof firebaseSync !== 'undefined' && firebaseSync.isUserAuthenticated() && updatedLayaway) {
            try {
                await firebaseSync.uploadSingle('layaways', updatedLayaway);
            } catch (syncError) {
                console.warn('Firebase sync failed, products added locally:', syncError);
            }
        }
        
        closeAllModals();
        await loadLayaways();
        await updateLayawayBadge();
        
        // Reopen layaway details with updated info
        await viewLayawayDetails(state.currentLayaway.id);
        
        showToast('Productos agregados al apartado exitosamente', 'success');
    } catch (error) {
        console.error('Error adding products to layaway:', error);
        showToast('Error al agregar productos al apartado', 'error');
    }
}

// ========================================
// REPORTS (CIERRE DE CAJA)
// ========================================
async function generateReport() {
    const reportDate = document.getElementById('report-date').value;
    const date = reportDate ? new Date(reportDate) : new Date();
    
    // Set date range for the selected day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const sales = await db.getSalesByDateRange(startOfDay, endOfDay);
    const layaways = await db.getPendingLayaways();
    
    // Total sold and profit
    const totalSold = sales.reduce((sum, sale) => sum + sale.total, 0);
    const totalProfit = sales.reduce((sum, sale) => sum + (sale.totalProfit || 0), 0);
    document.getElementById('report-total-sold').textContent = formatCurrency(totalSold);
    document.getElementById('report-transactions').textContent = sales.length;
    document.getElementById('report-total-profit').textContent = formatCurrency(totalProfit);
    
    // Payment method breakdown
    const paymentBreakdown = {};
    sales.forEach(sale => {
        const method = sale.paymentMethod || 'efectivo';
        paymentBreakdown[method] = (paymentBreakdown[method] || 0) + sale.total;
    });
    
    const paymentIcons = { efectivo: '💵', tarjeta: '💳', transferencia: '📱', apartado: '📋' };
    document.getElementById('payment-breakdown').innerHTML = Object.entries(paymentBreakdown).map(([method, amount]) => `
        <div class="breakdown-row">
            <span class="breakdown-label">
                <span>${paymentIcons[method] || '💰'}</span>
                <span>${method.charAt(0).toUpperCase() + method.slice(1)}</span>
            </span>
            <span class="breakdown-value">${formatCurrency(amount)}</span>
        </div>
    `).join('') || '<p style="color: var(--gray-400);">Sin ventas este día</p>';
    
    // Owner breakdown (sales)
    const ownerBreakdown = {};
    sales.forEach(sale => {
        sale.items.forEach(item => {
            const owner = item.owner || 'Sin asignar';
            ownerBreakdown[owner] = (ownerBreakdown[owner] || 0) + item.subtotal;
        });
    });
    
    document.getElementById('owner-breakdown').innerHTML = Object.entries(ownerBreakdown).map(([owner, amount]) => `
        <div class="breakdown-row">
            <span class="breakdown-label">
                <span>👩</span>
                <span>Vendido de ${owner}:</span>
            </span>
            <span class="breakdown-value">${formatCurrency(amount)}</span>
        </div>
    `).join('') || '<p style="color: var(--gray-400);">Sin ventas este día</p>';
    
    // Owner breakdown (profits)
    const ownerProfitBreakdown = {};
    sales.forEach(sale => {
        sale.items.forEach(item => {
            const owner = item.owner || 'Sin asignar';
            const itemProfit = item.profit || ((item.price - (item.cost || 0)) * item.quantity);
            ownerProfitBreakdown[owner] = (ownerProfitBreakdown[owner] || 0) + itemProfit;
        });
    });
    
    document.getElementById('owner-profit-breakdown').innerHTML = Object.entries(ownerProfitBreakdown).map(([owner, amount]) => `
        <div class="breakdown-row">
            <span class="breakdown-label">
                <span>💵</span>
                <span>Ganancia de ${owner}:</span>
            </span>
            <span class="breakdown-value" style="color: ${amount >= 0 ? '#10B981' : '#EF4444'};">${formatCurrency(amount)}</span>
        </div>
    `).join('') || '<p style="color: var(--gray-400);">Sin ventas este día</p>';
    
    // Pending layaways
    const pendingAmount = layaways.reduce((sum, l) => sum + l.pendingAmount, 0);
    document.getElementById('report-pending-layaways').textContent = layaways.length;
    document.getElementById('report-pending-amount').textContent = formatCurrency(pendingAmount);
}

function printReport() {
    const reportContent = document.getElementById('report-container').innerHTML;
    const reportDate = document.getElementById('report-date').value;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Cierre de Caja - ${reportDate}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; }
                h2 { text-align: center; margin-bottom: 20px; }
                .report-section { margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
                .report-section h3 { margin-bottom: 10px; }
                .report-grid { display: flex; gap: 20px; }
                .report-card { flex: 1; padding: 15px; background: #f5f5f5; border-radius: 8px; text-align: center; }
                .report-card.total { background: #8B5CF6; color: white; }
                .report-card.warning { background: #FEF3C7; }
                .report-label { display: block; font-size: 12px; margin-bottom: 5px; }
                .report-value { font-size: 20px; font-weight: bold; }
                .breakdown-row { display: flex; justify-content: space-between; padding: 8px; background: #f5f5f5; margin-bottom: 5px; border-radius: 4px; }
                .report-actions { display: none; }
            </style>
        </head>
        <body>
            <h2>✨ Gracia Divina - Cierre de Caja</h2>
            <p style="text-align: center;">Fecha: ${reportDate}</p>
            ${reportContent}
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
// CAMERA SCANNER
// ========================================
let cameraStream = null;

function openCameraScanner() {
    const video = document.getElementById('camera-video');
    
    navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
    })
    .then(stream => {
        cameraStream = stream;
        video.srcObject = stream;
        openModal('camera-modal');
        
        // Note: For actual barcode scanning, you'd need a library like QuaggaJS
        showToast('Escaneo de códigos próximamente', 'info');
    })
    .catch(error => {
        console.error('Camera error:', error);
        showToast('No se pudo acceder a la cámara', 'error');
    });
}

function stopCameraScanner() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
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
    
    // Stop camera if open
    stopCameraScanner();
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

/**
 * Calculate discount based on type (percent or amount)
 * @param {number} subtotal - The subtotal amount
 * @param {number} discountValue - The discount value entered by user
 * @param {string} discountType - 'percent' or 'amount'
 * @returns {object} - { discount, discountPercent }
 */
function calculateDiscountAmount(subtotal, discountValue, discountType) {
    let discount;
    let discountPercent;
    
    if (discountType === 'percent') {
        // Cap percentage at 100
        const cappedValue = Math.min(discountValue, 100);
        discountPercent = cappedValue;
        discount = subtotal * (cappedValue / 100);
    } else {
        // Fixed amount - cannot exceed subtotal
        discount = Math.min(discountValue, subtotal);
        discountPercent = subtotal > 0 ? (discount / subtotal) * 100 : 0;
    }
    
    return { discount, discountPercent };
}

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

// WhatsApp helper function
function openWhatsApp(event) {
    event.preventDefault();
    const phone = state.settings.businessPhone ? state.settings.businessPhone.replace(/\D/g, '') : '';
    const url = phone ? `https://wa.me/${phone}` : 'https://wa.me/';
    window.open(url, '_blank');
}

// Make functions available globally for inline event handlers
window.updateCartItemQuantity = updateCartItemQuantity;
window.removeFromCart = removeFromCart;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.viewSaleDetails = viewSaleDetails;
window.viewLayawayDetails = viewLayawayDetails;
window.deleteOwner = deleteOwner;
window.openWhatsApp = openWhatsApp;
window.removeManualProductRow = removeManualProductRow;
window.removeAddProductRow = removeAddProductRow;

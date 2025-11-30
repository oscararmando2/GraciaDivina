/**
 * Gracia Divina POS - Database Module
 * Uses IndexedDB for offline-first data storage
 */

const DB_NAME = 'GraciaDivinaDB';
const DB_VERSION = 2;

class Database {
    constructor() {
        this.db = null;
        this.isReady = false;
    }

    /**
     * Initialize the database
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('Error opening database:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.isReady = true;
                console.log('Database initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Products Store
                if (!db.objectStoreNames.contains('products')) {
                    const productStore = db.createObjectStore('products', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    productStore.createIndex('name', 'name', { unique: false });
                    productStore.createIndex('category', 'category', { unique: false });
                    productStore.createIndex('sku', 'sku', { unique: false });
                    productStore.createIndex('owner', 'owner', { unique: false });
                }

                // Sales Store
                if (!db.objectStoreNames.contains('sales')) {
                    const salesStore = db.createObjectStore('sales', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    salesStore.createIndex('date', 'date', { unique: false });
                    salesStore.createIndex('ticketNumber', 'ticketNumber', { unique: true });
                }

                // Layaways (Apartados) Store
                if (!db.objectStoreNames.contains('layaways')) {
                    const layawayStore = db.createObjectStore('layaways', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    layawayStore.createIndex('customerName', 'customerName', { unique: false });
                    layawayStore.createIndex('customerPhone', 'customerPhone', { unique: false });
                    layawayStore.createIndex('status', 'status', { unique: false });
                    layawayStore.createIndex('date', 'date', { unique: false });
                }

                // Owners Store
                if (!db.objectStoreNames.contains('owners')) {
                    const ownerStore = db.createObjectStore('owners', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    ownerStore.createIndex('name', 'name', { unique: true });
                }

                // Settings Store
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }

                console.log('Database schema created/updated');
            };
        });
    }

    /**
     * Generic method to get a transaction
     */
    getTransaction(storeName, mode = 'readonly') {
        return this.db.transaction(storeName, mode);
    }

    /**
     * Generic method to get an object store
     */
    getStore(storeName, mode = 'readonly') {
        const transaction = this.getTransaction(storeName, mode);
        return transaction.objectStore(storeName);
    }

    // ========================================
    // PRODUCTS OPERATIONS
    // ========================================

    /**
     * Add a new product
     */
    async addProduct(product) {
        return new Promise((resolve, reject) => {
            const store = this.getStore('products', 'readwrite');
            product.createdAt = new Date().toISOString();
            product.updatedAt = new Date().toISOString();
            
            const request = store.add(product);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update an existing product
     */
    async updateProduct(product) {
        return new Promise((resolve, reject) => {
            const store = this.getStore('products', 'readwrite');
            product.updatedAt = new Date().toISOString();
            
            const request = store.put(product);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete a product
     */
    async deleteProduct(id) {
        return new Promise((resolve, reject) => {
            const store = this.getStore('products', 'readwrite');
            const request = store.delete(id);
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get a product by ID
     */
    async getProduct(id) {
        return new Promise((resolve, reject) => {
            const store = this.getStore('products');
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all products
     */
    async getAllProducts() {
        return new Promise((resolve, reject) => {
            const store = this.getStore('products');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get products by category
     */
    async getProductsByCategory(category) {
        return new Promise((resolve, reject) => {
            const store = this.getStore('products');
            const index = store.index('category');
            const request = index.getAll(category);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Search products
     */
    async searchProducts(query) {
        const products = await this.getAllProducts();
        const lowerQuery = query.toLowerCase();
        
        return products.filter(product => 
            product.name.toLowerCase().includes(lowerQuery) ||
            (product.sku && product.sku.toLowerCase().includes(lowerQuery)) ||
            (product.description && product.description.toLowerCase().includes(lowerQuery))
        );
    }

    /**
     * Update product stock
     */
    async updateStock(productId, quantity) {
        const product = await this.getProduct(productId);
        if (product) {
            product.stock = Math.max(0, (product.stock || 0) + quantity);
            return this.updateProduct(product);
        }
        return null;
    }

    // ========================================
    // SALES OPERATIONS
    // ========================================

    /**
     * Generate a unique ticket number
     */
    async generateTicketNumber() {
        const today = new Date();
        const datePrefix = today.getFullYear().toString().slice(-2) +
                          (today.getMonth() + 1).toString().padStart(2, '0') +
                          today.getDate().toString().padStart(2, '0');
        
        const sales = await this.getSalesByDateRange(
            new Date(today.setHours(0, 0, 0, 0)),
            new Date(today.setHours(23, 59, 59, 999))
        );
        
        const todayCount = sales.length + 1;
        return `${datePrefix}-${todayCount.toString().padStart(4, '0')}`;
    }

    /**
     * Add a new sale
     */
    async addSale(sale) {
        return new Promise(async (resolve, reject) => {
            const store = this.getStore('sales', 'readwrite');
            
            sale.ticketNumber = await this.generateTicketNumber();
            sale.date = new Date().toISOString();
            
            const request = store.add(sale);
            
            request.onsuccess = async () => {
                // Update stock for each item
                for (const item of sale.items) {
                    await this.updateStock(item.productId, -item.quantity);
                }
                resolve({ ...sale, id: request.result });
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get a sale by ID
     */
    async getSale(id) {
        return new Promise((resolve, reject) => {
            const store = this.getStore('sales');
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all sales
     */
    async getAllSales() {
        return new Promise((resolve, reject) => {
            const store = this.getStore('sales');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const sales = request.result;
                // Sort by date descending
                sales.sort((a, b) => new Date(b.date) - new Date(a.date));
                resolve(sales);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get sales by date range
     */
    async getSalesByDateRange(startDate, endDate) {
        const sales = await this.getAllSales();
        
        return sales.filter(sale => {
            const saleDate = new Date(sale.date);
            return saleDate >= startDate && saleDate <= endDate;
        });
    }

    /**
     * Get today's sales
     */
    async getTodaySales() {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        
        return this.getSalesByDateRange(startOfDay, endOfDay);
    }

    /**
     * Get this month's sales
     */
    async getMonthSales() {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
        
        return this.getSalesByDateRange(startOfMonth, endOfMonth);
    }

    /**
     * Calculate sales totals
     */
    calculateSalesTotals(sales) {
        return sales.reduce((acc, sale) => acc + sale.total, 0);
    }

    // ========================================
    // LAYAWAY (APARTADO) OPERATIONS
    // ========================================

    /**
     * Add a new layaway
     */
    async addLayaway(layaway) {
        return new Promise((resolve, reject) => {
            const store = this.getStore('layaways', 'readwrite');
            layaway.date = new Date().toISOString();
            layaway.status = 'pending'; // pending, completed, cancelled
            layaway.payments = layaway.payments || [];
            
            const request = store.add(layaway);
            
            request.onsuccess = async () => {
                // Update stock for each item
                for (const item of layaway.items) {
                    await this.updateStock(item.productId, -item.quantity);
                }
                resolve({ ...layaway, id: request.result });
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get a layaway by ID
     */
    async getLayaway(id) {
        return new Promise((resolve, reject) => {
            const store = this.getStore('layaways');
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update a layaway
     */
    async updateLayaway(layaway) {
        return new Promise((resolve, reject) => {
            const store = this.getStore('layaways', 'readwrite');
            layaway.updatedAt = new Date().toISOString();
            
            const request = store.put(layaway);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Add payment to layaway
     */
    async addLayawayPayment(layawayId, amount, paymentMethod) {
        const layaway = await this.getLayaway(layawayId);
        if (!layaway) return null;

        const payment = {
            amount,
            paymentMethod,
            date: new Date().toISOString()
        };
        
        layaway.payments.push(payment);
        layaway.totalPaid = layaway.payments.reduce((sum, p) => sum + p.amount, 0);
        layaway.pendingAmount = layaway.total - layaway.totalPaid;
        
        return this.updateLayaway(layaway);
    }

    /**
     * Complete layaway (convert to sale)
     */
    async completeLayaway(layawayId) {
        const layaway = await this.getLayaway(layawayId);
        if (!layaway) return null;

        layaway.status = 'completed';
        layaway.completedAt = new Date().toISOString();
        await this.updateLayaway(layaway);

        // Create a sale record from the layaway
        const sale = {
            items: layaway.items,
            subtotal: layaway.subtotal,
            discountPercent: layaway.discountPercent || 0,
            discount: layaway.discount || 0,
            total: layaway.total,
            paymentMethod: 'apartado',
            amountReceived: layaway.total,
            change: 0,
            layawayId: layawayId,
            customerName: layaway.customerName,
            customerPhone: layaway.customerPhone
        };

        return this.addSale(sale);
    }

    /**
     * Get all layaways
     */
    async getAllLayaways() {
        return new Promise((resolve, reject) => {
            const store = this.getStore('layaways');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const layaways = request.result;
                layaways.sort((a, b) => new Date(b.date) - new Date(a.date));
                resolve(layaways);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get pending layaways
     */
    async getPendingLayaways() {
        const layaways = await this.getAllLayaways();
        return layaways.filter(l => l.status === 'pending');
    }

    /**
     * Search layaways by customer name or phone
     */
    async searchLayaways(query) {
        const layaways = await this.getAllLayaways();
        const lowerQuery = query.toLowerCase();
        
        return layaways.filter(layaway => 
            layaway.customerName.toLowerCase().includes(lowerQuery) ||
            layaway.customerPhone.includes(query)
        );
    }

    // ========================================
    // OWNER (DUEÑA) OPERATIONS
    // ========================================

    /**
     * Add a new owner
     */
    async addOwner(name) {
        return new Promise((resolve, reject) => {
            const store = this.getStore('owners', 'readwrite');
            const owner = {
                name,
                createdAt: new Date().toISOString()
            };
            
            const request = store.add(owner);
            
            request.onsuccess = () => resolve({ ...owner, id: request.result });
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all owners
     */
    async getAllOwners() {
        return new Promise((resolve, reject) => {
            const store = this.getStore('owners');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete an owner
     */
    async deleteOwner(id) {
        return new Promise((resolve, reject) => {
            const store = this.getStore('owners', 'readwrite');
            const request = store.delete(id);
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Seed default owners
     */
    async seedDefaultOwners() {
        const existingOwners = await this.getAllOwners();
        if (existingOwners.length === 0) {
            const defaultOwners = ['Ketzy', 'Stefanny', 'Chela'];
            for (const name of defaultOwners) {
                await this.addOwner(name);
            }
            console.log('Default owners seeded');
        }
    }

    // ========================================
    // SETTINGS OPERATIONS
    // ========================================

    /**
     * Save a setting
     */
    async saveSetting(key, value) {
        return new Promise((resolve, reject) => {
            const store = this.getStore('settings', 'readwrite');
            const request = store.put({ key, value, updatedAt: new Date().toISOString() });
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get a setting
     */
    async getSetting(key) {
        return new Promise((resolve, reject) => {
            const store = this.getStore('settings');
            const request = store.get(key);
            
            request.onsuccess = () => resolve(request.result ? request.result.value : null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all settings
     */
    async getAllSettings() {
        return new Promise((resolve, reject) => {
            const store = this.getStore('settings');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const settings = {};
                request.result.forEach(item => {
                    settings[item.key] = item.value;
                });
                resolve(settings);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // ========================================
    // DATA MANAGEMENT
    // ========================================

    /**
     * Export all data
     */
    async exportData() {
        const products = await this.getAllProducts();
        const sales = await this.getAllSales();
        const layaways = await this.getAllLayaways();
        const owners = await this.getAllOwners();
        const settings = await this.getAllSettings();

        return {
            exportDate: new Date().toISOString(),
            version: DB_VERSION,
            data: {
                products,
                sales,
                layaways,
                owners,
                settings
            }
        };
    }

    /**
     * Import data
     */
    async importData(importedData) {
        try {
            const { products, sales, layaways, owners, settings } = importedData.data;

            // Clear existing data
            await this.clearStore('products');
            await this.clearStore('sales');
            await this.clearStore('layaways');
            await this.clearStore('owners');
            await this.clearStore('settings');

            // Import products
            for (const product of products) {
                delete product.id; // Remove ID to let auto-increment work
                await this.addProduct(product);
            }

            // Import sales (keeping original ticket numbers)
            for (const sale of sales) {
                delete sale.id;
                const store = this.getStore('sales', 'readwrite');
                await new Promise((resolve, reject) => {
                    const request = store.add(sale);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }

            // Import layaways
            if (layaways) {
                for (const layaway of layaways) {
                    delete layaway.id;
                    const store = this.getStore('layaways', 'readwrite');
                    await new Promise((resolve, reject) => {
                        const request = store.add(layaway);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    });
                }
            }

            // Import owners
            if (owners) {
                for (const owner of owners) {
                    delete owner.id;
                    const store = this.getStore('owners', 'readwrite');
                    await new Promise((resolve, reject) => {
                        const request = store.add(owner);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    });
                }
            }

            // Import settings
            for (const [key, value] of Object.entries(settings)) {
                await this.saveSetting(key, value);
            }

            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            throw error;
        }
    }

    /**
     * Clear an object store
     */
    async clearStore(storeName) {
        return new Promise((resolve, reject) => {
            try {
                const store = this.getStore(storeName, 'readwrite');
                const request = store.clear();
                
                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(request.error);
            } catch (error) {
                // Store might not exist yet
                resolve(true);
            }
        });
    }

    /**
     * Reset all data
     */
    async resetAllData() {
        await this.clearStore('products');
        await this.clearStore('sales');
        await this.clearStore('layaways');
        await this.clearStore('owners');
        await this.clearStore('settings');
        return true;
    }

    /**
     * Seed initial products (sample data)
     */
    async seedSampleProducts() {
        const owners = ['Ketzy', 'Stefanny', 'Chela'];
        const sampleProducts = [
            // Ropa
            { name: 'Blusa Elegante Floral', category: 'ropa', price: 45.99, stock: 15, sku: 'BLU-001', description: 'Blusa con estampado floral elegante', owner: 'Ketzy', sizes: ['S', 'M', 'L'], colors: ['Rosa', 'Blanco'] },
            { name: 'Vestido Cocktail Negro', category: 'ropa', price: 89.99, stock: 8, sku: 'VES-001', description: 'Vestido negro para ocasiones especiales', owner: 'Stefanny', sizes: ['S', 'M'], colors: ['Negro'] },
            { name: 'Falda Midi Plisada', category: 'ropa', price: 55.00, stock: 12, sku: 'FAL-001', description: 'Falda midi plisada elegante', owner: 'Chela', sizes: ['S', 'M', 'L', 'XL'], colors: ['Beige', 'Negro'] },
            { name: 'Pantalón Palazzo', category: 'ropa', price: 65.00, stock: 10, sku: 'PAN-001', description: 'Pantalón palazzo de talle alto', owner: 'Ketzy', sizes: ['M', 'L'], colors: ['Negro', 'Blanco'] },
            { name: 'Camisa Satinada', category: 'ropa', price: 52.00, stock: 18, sku: 'CAM-001', description: 'Camisa de satén con cuello', owner: 'Stefanny', sizes: ['S', 'M', 'L'], colors: ['Champagne', 'Rosa'] },
            { name: 'Top Crop Encaje', category: 'ropa', price: 32.00, stock: 20, sku: 'TOP-001', description: 'Top crop con detalles de encaje', owner: 'Chela', sizes: ['XS', 'S', 'M'], colors: ['Blanco', 'Negro'] },
            
            // Accesorios
            { name: 'Collar Perlas Clásico', category: 'accesorios', price: 28.00, stock: 25, sku: 'COL-001', description: 'Collar de perlas sintéticas clásico', owner: 'Ketzy', sizes: [], colors: ['Perla', 'Dorado'] },
            { name: 'Aretes Dorados Largos', category: 'accesorios', price: 18.00, stock: 30, sku: 'ARE-001', description: 'Aretes dorados colgantes', owner: 'Stefanny', sizes: [], colors: ['Dorado'] },
            { name: 'Pulsera Charm', category: 'accesorios', price: 22.00, stock: 35, sku: 'PUL-001', description: 'Pulsera con dijes intercambiables', owner: 'Chela', sizes: [], colors: ['Plateado', 'Dorado'] },
            { name: 'Cinturón Cuero Café', category: 'accesorios', price: 35.00, stock: 15, sku: 'CIN-001', description: 'Cinturón de cuero sintético', owner: 'Ketzy', sizes: ['S', 'M', 'L'], colors: ['Café', 'Negro'] },
            { name: 'Pañuelo Seda Estampado', category: 'accesorios', price: 25.00, stock: 20, sku: 'PAÑ-001', description: 'Pañuelo de seda con estampado', owner: 'Stefanny', sizes: [], colors: ['Multicolor'] },
            
            // Zapatos
            { name: 'Tacones Nude Classic', category: 'zapatos', price: 75.00, stock: 10, sku: 'TAC-001', description: 'Tacones nude de 8cm', owner: 'Chela', sizes: ['35', '36', '37', '38'], colors: ['Nude'] },
            { name: 'Sandalias Plataforma', category: 'zapatos', price: 68.00, stock: 12, sku: 'SAN-001', description: 'Sandalias con plataforma', owner: 'Ketzy', sizes: ['36', '37', '38', '39'], colors: ['Negro', 'Café'] },
            { name: 'Botines Negros', category: 'zapatos', price: 85.00, stock: 8, sku: 'BOT-001', description: 'Botines negros con tacón medio', owner: 'Stefanny', sizes: ['36', '37', '38'], colors: ['Negro'] },
            { name: 'Flats Bailarina', category: 'zapatos', price: 42.00, stock: 15, sku: 'FLA-001', description: 'Flats estilo bailarina', owner: 'Chela', sizes: ['35', '36', '37', '38', '39'], colors: ['Rosa', 'Negro', 'Nude'] },
            
            // Bolsos
            { name: 'Bolso Tote Grande', category: 'bolsos', price: 95.00, stock: 8, sku: 'BOL-001', description: 'Bolso tote espacioso', owner: 'Ketzy', sizes: [], colors: ['Café', 'Negro'] },
            { name: 'Clutch Fiesta Dorado', category: 'bolsos', price: 45.00, stock: 12, sku: 'CLU-001', description: 'Clutch para eventos', owner: 'Stefanny', sizes: [], colors: ['Dorado', 'Plateado'] },
            { name: 'Bolso Crossbody', category: 'bolsos', price: 55.00, stock: 15, sku: 'CRO-001', description: 'Bolso cruzado casual', owner: 'Chela', sizes: [], colors: ['Rosa', 'Beige'] },
            { name: 'Mochila Mini', category: 'bolsos', price: 48.00, stock: 10, sku: 'MOC-001', description: 'Mini mochila de piel sintética', owner: 'Ketzy', sizes: [], colors: ['Negro', 'Blanco'] }
        ];

        const existingProducts = await this.getAllProducts();
        if (existingProducts.length === 0) {
            for (const product of sampleProducts) {
                await this.addProduct(product);
            }
            console.log('Sample products seeded');
        }
    }
}

// Create and export a singleton instance
const db = new Database();

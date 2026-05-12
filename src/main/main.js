const { app, BrowserWindow, ipcMain, dialog, Notification, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

// --- Register secure protocols BEFORE app is ready ---
protocol.registerSchemesAsPrivileged([
    { scheme: 'prefak-img', privileges: { bypassCSP: true, secure: true, supportFetchAPI: true } },
    { scheme: 'prefak-asset', privileges: { bypassCSP: true, secure: true, supportFetchAPI: true } }
]);

// --- Settings Management ---
const settingsPath = path.join(app.getPath('userData'), 'settings.json');
let settings = { dataPath: path.join(app.getPath('userData'), 'data') };
if (fs.existsSync(settingsPath)) {
    try { settings = JSON.parse(fs.readFileSync(settingsPath)); } catch (e) {}
}
const dataPath = settings.dataPath;
const uploadsPath = path.join(dataPath, 'uploads');
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });

// --- Load DB (after settings are resolved) ---
const db = require('../database/db');

let mainWindow;

function createWindow() {
    // Handle local image requests
    protocol.handle('prefak-img', (request) => {
        const file = request.url.replace('prefak-img://', '');
        return net.fetch('file://' + path.join(uploadsPath, file));
    });
    protocol.handle('prefak-asset', (request) => {
        const file = request.url.replace('prefak-asset://', '');
        return net.fetch('file://' + path.join(app.getAppPath(), file));
    });

    mainWindow = new BrowserWindow({
        width: 1280, height: 800,
        minWidth: 1024, minHeight: 600,
        backgroundColor: '#f3f4f6',
        show: false,
        autoHideMenuBar: true,
        icon: path.join(__dirname, '../../assets/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        }
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    mainWindow.once('ready-to-show', () => mainWindow.show());
    mainWindow.on('closed', () => mainWindow = null);
}

app.on('ready', createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!mainWindow) createWindow(); });

// ============================================================
// IPC HANDLERS
// ============================================================

// --- MATERIALS ---
ipcMain.handle('get-materials', () => {
    return db.prepare('SELECT * FROM materials ORDER BY name ASC').all();
});

ipcMain.handle('add-material', (e, data) => {
    const { name, quantity, unit, unit_price, low_stock_threshold, image_path } = data;
    const result = db.prepare(
        'INSERT INTO materials (name, quantity, unit, unit_price, low_stock_threshold, image_path) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(name, quantity || 0, unit, unit_price || 0, low_stock_threshold || 10, image_path || null);

    if (quantity > 0) {
        db.prepare(
            'INSERT INTO stock_history (material_id, material_name, type, quantity, remaining_stock, description) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(result.lastInsertRowid, name, 'IN', quantity, quantity, 'Stock initial');
    }
    return result;
});

ipcMain.handle('update-material', (e, data) => {
    const { id, name, unit, unit_price, low_stock_threshold, image_path } = data;
    return db.prepare(
        'UPDATE materials SET name=?, unit=?, unit_price=?, low_stock_threshold=?, image_path=? WHERE id=?'
    ).run(name, unit, unit_price || 0, low_stock_threshold || 10, image_path || null, id);
});

ipcMain.handle('delete-material', (e, id) => {
    const used = db.prepare('SELECT COUNT(*) as c FROM production_items WHERE material_id=?').get(id);
    if (used.c > 0) return { error: 'Ce matériau est utilisé dans des productions et ne peut pas être supprimé.' };
    db.prepare('DELETE FROM stock_history WHERE material_id=?').run(id);
    return db.prepare('DELETE FROM materials WHERE id=?').run(id);
});

ipcMain.handle('move-stock', (e, data) => {
    const { material_id, type, quantity, description } = data;
    const mat = db.prepare('SELECT * FROM materials WHERE id=?').get(material_id);
    if (!mat) return { error: 'Matériau introuvable.' };

    let newQty;
    if (type === 'IN') newQty = mat.quantity + quantity;
    else if (type === 'OUT') {
        if (mat.quantity < quantity) return { error: 'Stock insuffisant.' };
        newQty = mat.quantity - quantity;
    } else newQty = quantity; // ADJUST

    db.prepare('UPDATE materials SET quantity=? WHERE id=?').run(newQty, material_id);
    db.prepare(
        'INSERT INTO stock_history (material_id, material_name, type, quantity, remaining_stock, description) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(material_id, mat.name, type, quantity, newQty, description || '');

    // Low stock notification
    if (newQty <= mat.low_stock_threshold) {
        new Notification({ title: 'PREFAK — Stock Faible', body: `${mat.name}: ${newQty} ${mat.unit} restant(s)` }).show();
    }
    return { success: true, newQty };
});

ipcMain.handle('select-image', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Sélectionner une image',
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
        properties: ['openFile']
    });
    if (result.canceled) return null;
    const src = result.filePaths[0];
    const fileName = `${Date.now()}_${path.basename(src)}`;
    const dest = path.join(uploadsPath, fileName);
    fs.copyFileSync(src, dest);
    return fileName;
});

// --- STOCK HISTORY ---
ipcMain.handle('get-history', (e, limit = 200) => {
    return db.prepare('SELECT * FROM stock_history ORDER BY created_at DESC LIMIT ?').all(limit);
});

// --- PRODUCTIONS ---
ipcMain.handle('get-productions', () => {
    return db.prepare(`
        SELECT p.*, 
            (SELECT COUNT(*) FROM production_items pi WHERE pi.production_id = p.id) as item_count,
            (SELECT COUNT(*) FROM sales s WHERE s.production_id = p.id) as is_sold
        FROM productions p ORDER BY p.created_at DESC
    `).all();
});

ipcMain.handle('get-production-items', (e, production_id) => {
    return db.prepare('SELECT * FROM production_items WHERE production_id=?').all(production_id);
});

ipcMain.handle('add-production', (e, data) => {
    const { product_name, quantity, notes, items } = data;
    const addProd = db.transaction(() => {
        const prod = db.prepare(
            'INSERT INTO productions (product_name, quantity, notes) VALUES (?, ?, ?)'
        ).run(product_name, quantity || 1, notes || '');
        const prodId = prod.lastInsertRowid;

        for (const item of items) {
            const mat = db.prepare('SELECT * FROM materials WHERE id=?').get(item.material_id);
            if (!mat) throw new Error(`Matériau ID ${item.material_id} introuvable.`);
            if (mat.quantity < item.quantity) throw new Error(`Stock insuffisant pour: ${mat.name}`);

            const newQty = mat.quantity - item.quantity;
            db.prepare('UPDATE materials SET quantity=? WHERE id=?').run(newQty, mat.id);
            db.prepare(
                'INSERT INTO production_items (production_id, material_id, material_name, quantity, unit) VALUES (?, ?, ?, ?, ?)'
            ).run(prodId, mat.id, mat.name, item.quantity, mat.unit);
            db.prepare(
                'INSERT INTO stock_history (material_id, material_name, type, quantity, remaining_stock, description) VALUES (?, ?, ?, ?, ?, ?)'
            ).run(mat.id, mat.name, 'OUT', item.quantity, newQty, `Production: ${product_name}`);
        }
        return { success: true, id: prodId };
    });
    try { return addProd(); } catch (err) { return { error: err.message }; }
});

ipcMain.handle('update-production', (e, data) => {
    const { id, product_name, quantity, notes } = data;
    return db.prepare('UPDATE productions SET product_name=?, quantity=?, notes=? WHERE id=?').run(product_name, quantity, notes || '', id);
});

ipcMain.handle('delete-production', (e, id) => {
    const sold = db.prepare('SELECT COUNT(*) as c FROM sales WHERE production_id=?').get(id);
    if (sold.c > 0) return { error: 'Cette production est liée à une vente et ne peut pas être supprimée.' };

    const restore = db.transaction(() => {
        const items = db.prepare('SELECT * FROM production_items WHERE production_id=?').all(id);
        for (const item of items) {
            const mat = db.prepare('SELECT * FROM materials WHERE id=?').get(item.material_id);
            if (mat) {
                const newQty = mat.quantity + item.quantity;
                db.prepare('UPDATE materials SET quantity=? WHERE id=?').run(newQty, mat.id);
                db.prepare(
                    'INSERT INTO stock_history (material_id, material_name, type, quantity, remaining_stock, description) VALUES (?, ?, ?, ?, ?, ?)'
                ).run(mat.id, mat.name, 'IN', item.quantity, newQty, 'Annulation production');
            }
        }
        db.prepare('DELETE FROM production_items WHERE production_id=?').run(id);
        db.prepare('DELETE FROM productions WHERE id=?').run(id);
        return { success: true };
    });
    try { return restore(); } catch (err) { return { error: err.message }; }
});

// --- CLIENTS ---
ipcMain.handle('get-clients', () => {
    return db.prepare(`
        SELECT c.*, (SELECT COUNT(*) FROM sales s WHERE s.client_id=c.id) as sale_count
        FROM clients c ORDER BY c.name ASC
    `).all();
});

ipcMain.handle('add-client', (e, data) => {
    const { name, phone, email, address } = data;
    return db.prepare('INSERT INTO clients (name, phone, email, address) VALUES (?, ?, ?, ?)').run(name, phone || '', email || '', address || '');
});

ipcMain.handle('update-client', (e, data) => {
    const { id, name, phone, email, address } = data;
    return db.prepare('UPDATE clients SET name=?, phone=?, email=?, address=? WHERE id=?').run(name, phone || '', email || '', address || '', id);
});

ipcMain.handle('delete-client', (e, id) => {
    const used = db.prepare('SELECT COUNT(*) as c FROM sales WHERE client_id=?').get(id);
    if (used.c > 0) return { error: 'Ce client a des ventes associées et ne peut pas être supprimé.' };
    return db.prepare('DELETE FROM clients WHERE id=?').run(id);
});

// --- SALES ---
ipcMain.handle('get-sales', () => {
    return db.prepare(`
        SELECT s.*, c.name as client_name, p.product_name as production_name
        FROM sales s
        JOIN clients c ON s.client_id = c.id
        LEFT JOIN productions p ON s.production_id = p.id
        ORDER BY s.sale_date DESC
    `).all();
});

ipcMain.handle('add-sale', (e, data) => {
    const { client_id, production_id, product_description, final_sale_price, tax_rate, status, sale_date, notes } = data;
    return db.prepare(
        'INSERT INTO sales (client_id, production_id, product_description, final_sale_price, tax_rate, status, sale_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(client_id, production_id || null, product_description, final_sale_price, tax_rate || 20, status || 'PAID', sale_date || new Date().toISOString().split('T')[0], notes || '');
});

ipcMain.handle('update-sale', (e, data) => {
    const { id, client_id, product_description, final_sale_price, tax_rate, status, sale_date, notes } = data;
    return db.prepare(
        'UPDATE sales SET client_id=?, product_description=?, final_sale_price=?, tax_rate=?, status=?, sale_date=?, notes=? WHERE id=?'
    ).run(client_id, product_description, final_sale_price, tax_rate || 20, status, sale_date, notes || '', id);
});

ipcMain.handle('delete-sale', (e, id) => {
    return db.prepare('DELETE FROM sales WHERE id=?').run(id);
});

// --- EXPENSES ---
ipcMain.handle('get-expenses', () => {
    return db.prepare('SELECT * FROM expenses ORDER BY expense_date DESC').all();
});

ipcMain.handle('add-expense', (e, data) => {
    const { category, amount, description, expense_date } = data;
    return db.prepare('INSERT INTO expenses (category, amount, description, expense_date) VALUES (?, ?, ?, ?)').run(category, amount, description || '', expense_date || new Date().toISOString().split('T')[0]);
});

ipcMain.handle('update-expense', (e, data) => {
    const { id, category, amount, description, expense_date } = data;
    return db.prepare('UPDATE expenses SET category=?, amount=?, description=?, expense_date=? WHERE id=?').run(category, amount, description || '', expense_date, id);
});

ipcMain.handle('delete-expense', (e, id) => {
    return db.prepare('DELETE FROM expenses WHERE id=?').run(id);
});

// --- FINANCIAL ANALYTICS ---
ipcMain.handle('get-financial-report', () => {
    const revenue = db.prepare("SELECT COALESCE(SUM(final_sale_price), 0) as total FROM sales WHERE status='PAID'").get().total;
    const expenseTotal = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses').get().total;

    const cogs = db.prepare(`
        SELECT COALESCE(SUM(pi.quantity * m.unit_price), 0) as total
        FROM sales s
        JOIN production_items pi ON s.production_id = pi.production_id
        JOIN materials m ON pi.material_id = m.id
        WHERE s.status = 'PAID'
    `).get().total;

    const monthlyRevenue = db.prepare(`
        SELECT strftime('%Y-%m', sale_date) as month, SUM(final_sale_price) as total
        FROM sales WHERE status='PAID'
        GROUP BY month ORDER BY month ASC
    `).all();

    const monthlyExpenses = db.prepare(`
        SELECT strftime('%Y-%m', expense_date) as month, SUM(amount) as total
        FROM expenses GROUP BY month ORDER BY month ASC
    `).all();

    const salesByStatus = db.prepare(`
        SELECT status, COUNT(*) as count, SUM(final_sale_price) as total
        FROM sales GROUP BY status
    `).all();

    return { revenue, expenseTotal, cogs, monthlyRevenue, monthlyExpenses, salesByStatus };
});

// --- STOCK ANALYTICS ---
ipcMain.handle('get-stock-analytics', () => {
    const byValue = db.prepare('SELECT name, quantity * unit_price as value FROM materials WHERE quantity > 0 ORDER BY value DESC LIMIT 10').all();
    const lowStock = db.prepare('SELECT name, quantity, low_stock_threshold, unit FROM materials WHERE quantity <= low_stock_threshold').all();
    return { byValue, lowStock };
});

// --- SETTINGS & PATH MANAGEMENT ---
ipcMain.handle('get-current-path', () => settings.dataPath);

ipcMain.handle('change-data-path', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    if (result.canceled) return { canceled: true };

    const newBase = result.filePaths[0];
    const newDataPath = path.join(newBase, 'prefak-data');

    try {
        // Close DB before moving
        db.close();
        fs.cpSync(dataPath, newDataPath, { recursive: true });
        settings.dataPath = newDataPath;
        fs.writeFileSync(settingsPath, JSON.stringify(settings));
        fs.rmSync(dataPath, { recursive: true, force: true });
        app.relaunch();
        app.exit(0);
    } catch (err) {
        return { error: err.message };
    }
});

// --- INTERNAL SEEDER ---
ipcMain.handle('seed-demo-data', () => {
    try {
        // Clear all tables
        db.exec(`
            DELETE FROM sales; DELETE FROM expenses;
            DELETE FROM production_items; DELETE FROM productions;
            DELETE FROM stock_history; DELETE FROM materials; DELETE FROM clients;
        `);

        // Seed Materials
        const addMat = db.prepare('INSERT INTO materials (name, quantity, unit, unit_price, low_stock_threshold) VALUES (?, ?, ?, ?, ?)');
        const addHistory = db.prepare('INSERT INTO stock_history (material_id, material_name, type, quantity, remaining_stock, description) VALUES (?, ?, ?, ?, ?, ?)');

        const m1 = addMat.run('Poutre bois 4m', 200, 'Unité', 450, 25);
        const m2 = addMat.run('Panneau isolation (m²)', 800, 'm²', 85, 50);
        const m3 = addMat.run('Vis inox (boîte 200)', 150, 'Boîte', 12, 20);
        const m4 = addMat.run('Ciment (sac 25kg)', 400, 'Sac', 65, 30);
        const m5 = addMat.run('Peinture blanc 10L', 35, 'Bidon', 120, 5);

        [[m1, 200], [m2, 800], [m3, 150], [m4, 400], [m5, 35]].forEach(([r, q]) => {
            addHistory.run(r.lastInsertRowid, db.prepare('SELECT name FROM materials WHERE id=?').get(r.lastInsertRowid).name, 'IN', q, q, 'Stock initial');
        });

        // Seed Clients
        const addClient = db.prepare('INSERT INTO clients (name, phone, email, address) VALUES (?, ?, ?, ?)');
        const c1 = addClient.run('Immobilier Sud SARL', '0522-334455', 'contact@immosud.ma', 'Casablanca, Maroc');
        const c2 = addClient.run('M. Driss Alaoui', '0677-889900', 'driss@gmail.com', 'Rabat, Maroc');
        const c3 = addClient.run('Groupe Bâti Atlas', '0535-112233', 'info@batiatlas.ma', 'Fès, Maroc');

        // Seed Productions
        const addProd = db.prepare('INSERT INTO productions (product_name, quantity, notes) VALUES (?, ?, ?)');
        const addProdItem = db.prepare('INSERT INTO production_items (production_id, material_id, material_name, quantity, unit) VALUES (?, ?, ?, ?, ?)');

        const p1 = addProd.run('Maison Modèle A', 1, 'Livraison Casablanca');
        addProdItem.run(p1.lastInsertRowid, m1.lastInsertRowid, 'Poutre bois 4m', 20, 'Unité');
        addProdItem.run(p1.lastInsertRowid, m2.lastInsertRowid, 'Panneau isolation (m²)', 100, 'm²');
        addProdItem.run(p1.lastInsertRowid, m4.lastInsertRowid, 'Ciment (sac 25kg)', 30, 'Sac');
        db.prepare('UPDATE materials SET quantity=quantity-20 WHERE id=?').run(m1.lastInsertRowid);
        db.prepare('UPDATE materials SET quantity=quantity-100 WHERE id=?').run(m2.lastInsertRowid);
        db.prepare('UPDATE materials SET quantity=quantity-30 WHERE id=?').run(m4.lastInsertRowid);

        const p2 = addProd.run('Maison Modèle B', 1, 'Chantier Rabat');
        addProdItem.run(p2.lastInsertRowid, m1.lastInsertRowid, 'Poutre bois 4m', 35, 'Unité');
        addProdItem.run(p2.lastInsertRowid, m3.lastInsertRowid, 'Vis inox (boîte 200)', 15, 'Boîte');
        addProdItem.run(p2.lastInsertRowid, m5.lastInsertRowid, 'Peinture blanc 10L', 8, 'Bidon');
        db.prepare('UPDATE materials SET quantity=quantity-35 WHERE id=?').run(m1.lastInsertRowid);
        db.prepare('UPDATE materials SET quantity=quantity-15 WHERE id=?').run(m3.lastInsertRowid);
        db.prepare('UPDATE materials SET quantity=quantity-8 WHERE id=?').run(m5.lastInsertRowid);

        // Seed Sales
        const addSale = db.prepare('INSERT INTO sales (client_id, production_id, product_description, final_sale_price, tax_rate, status, sale_date) VALUES (?, ?, ?, ?, ?, ?, ?)');
        addSale.run(c1.lastInsertRowid, p1.lastInsertRowid, 'Maison Modèle A — Livraison Casablanca', 450000, 20, 'PAID', '2026-04-15');
        addSale.run(c2.lastInsertRowid, p2.lastInsertRowid, 'Maison Modèle B — Chantier Rabat', 620000, 20, 'PAID', '2026-05-02');
        addSale.run(c3.lastInsertRowid, null, 'Maison Modèle C (en cours)', 580000, 20, 'PENDING', '2026-05-10');

        // Seed Expenses
        const addExp = db.prepare('INSERT INTO expenses (category, amount, description, expense_date) VALUES (?, ?, ?, ?)');
        addExp.run('Loyer', 15000, 'Loyer entrepôt — Avril', '2026-04-01');
        addExp.run('Salaires', 48000, 'Équipe production (6 personnes)', '2026-04-30');
        addExp.run('Électricité', 3200, 'Consommation Avril', '2026-04-28');
        addExp.run('Loyer', 15000, 'Loyer entrepôt — Mai', '2026-05-01');
        addExp.run('Salaires', 48000, 'Équipe production (6 personnes)', '2026-05-31');
        addExp.run('Carburant', 4500, 'Transport livraisons', '2026-05-05');

        return { success: true };
    } catch (err) {
        return { error: err.message };
    }
});

// --- QR CODE ---
ipcMain.handle('generate-qr', async (e, text) => {
    return await QRCode.toDataURL(text, { width: 256, margin: 2 });
});

// --- SAVE FILE ---
ipcMain.handle('save-file', async (e, { data, fileName }) => {
    const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: fileName,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (result.canceled) return;
    fs.writeFileSync(result.filePath, Buffer.from(data));
    return { success: true };
});

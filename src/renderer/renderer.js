/* =============================================
   PREFAK renderer.js — Part 1: Core + Dashboard + Inventory + Production
   ============================================= */

// --- STATE ---
let currentPage = 'dashboard';
let activeCharts = [];
let prodItems = []; // items being built in production modal

// --- DOM REFS ---
const content = document.getElementById('content');
const pageTitle = document.getElementById('page-title');

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    setupNav();
    setupModalCloseButtons();
    setupForms();
    navigate('dashboard');
});

// --- NAVIGATION ---
function setupNav() {
    document.querySelectorAll('.nav-item').forEach(el => {
        el.addEventListener('click', () => navigate(el.dataset.page));
    });
}

function navigate(page) {
    activeCharts.forEach(c => c.destroy());
    activeCharts = [];
    currentPage = page;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
    const titles = { dashboard: 'Tableau de bord', inventory: 'Inventaire', production: 'Production', history: 'Historique Stock', clients: 'Clients', sales: 'Ventes', expenses: 'Dépenses', analytics: 'Analyses Financières', settings: 'Paramètres' };
    pageTitle.textContent = titles[page] || page;
    const pages = { dashboard: renderDashboard, inventory: renderInventory, production: renderProduction, history: renderHistory, clients: renderClients, sales: renderSales, expenses: renderExpenses, analytics: renderAnalytics, settings: renderSettings };
    if (pages[page]) pages[page]();
}

// --- MODAL HELPERS ---
function setupModalCloseButtons() {
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.close;
            if (id === 'modal-scanner' && scanner) {
                scanner.clear().then(() => { scanner = null; closeModal(id); });
            } else {
                closeModal(id);
            }
        });
    });
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', e => { 
            if (e.target === backdrop) {
                if (backdrop.id === 'modal-scanner' && scanner) {
                    scanner.clear().then(() => { scanner = null; closeModal(backdrop.id); });
                } else {
                    closeModal(backdrop.id); 
                }
            }
        });
    });
}
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// Attach to window for onclick handlers
window.navigate = navigate;
window.openModal = openModal;
window.closeModal = closeModal;
window.openMatModal = openMatModal;
window.deleteMat = deleteMat;
window.openStockModal = openStockModal;
window.exportMatExcel = exportMatExcel;
window.openProdModal = openProdModal;
window.viewProd = viewProd;
window.editProd = editProd;
window.deleteProd = deleteProd;
window.removeProdItem = removeProdItem;
window.openClientModal = openClientModal;
window.deleteClient = deleteClient;
window.openSaleModal = openSaleModal;
window.deleteSale = deleteSale;
window.generateInvoice = generateInvoice;
window.exportSalesExcel = exportSalesExcel;
window.openExpenseModal = openExpenseModal;
window.deleteExpense = deleteExpense;
window.changePath = changePath;
window.seedData = seedData;

window.exportMatPDF = exportMatPDF;
window.exportHistoryExcel = exportHistoryExcel;
window.exportHistoryPDF = exportHistoryPDF;
window.exportClientsExcel = exportClientsExcel;
window.exportClientsPDF = exportClientsPDF;
window.exportExpensesExcel = exportExpensesExcel;
window.exportExpensesPDF = exportExpensesPDF;
window.showQR = showQR;
window.startScanner = startScanner;
window.printQR = printQR;

// --- FORM HELPERS ---
function setupForms() {
    document.getElementById('form-material').addEventListener('submit', saveMaterial);
    document.getElementById('form-stock').addEventListener('submit', saveStockMove);
    document.getElementById('form-client').addEventListener('submit', saveClient);
    document.getElementById('form-sale').addEventListener('submit', saveSale);
    document.getElementById('form-expense').addEventListener('submit', saveExpense);
    document.getElementById('btn-pick-image').addEventListener('click', pickImage);
    document.getElementById('btn-add-prod-item').addEventListener('click', addProdItem);
    document.getElementById('btn-save-production').addEventListener('click', saveProduction);
}

// --- UTILS ---
function fmt(n) { return Number(n || 0).toLocaleString('fr-FR'); }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('fr-FR') : '-'; }
function confirm2(msg) { return confirm(msg); }
function showError(msg) { alert('⚠️ ' + msg); }

function statusBadge(status) {
    const map = { PAID: ['badge-green', 'Payée'], PENDING: ['badge-yellow', 'En attente'], CANCELLED: ['badge-red', 'Annulée'] };
    const [cls, label] = map[status] || ['badge-gray', status];
    return `<span class="badge ${cls}">${label}</span>`;
}

// =============================================
// DASHBOARD
// =============================================
async function renderDashboard() {
    const [mats, prods, sales, expenses] = await Promise.all([
        window.api.getMaterials(), window.api.getProductions(), window.api.getSales(), window.api.getExpenses()
    ]);
    const stockValue = mats.reduce((s, m) => s + (m.quantity * m.unit_price), 0);
    const lowStock = mats.filter(m => m.quantity <= m.low_stock_threshold).length;
    const paidRevenue = sales.filter(s => s.status === 'PAID').reduce((s, x) => s + x.final_sale_price, 0);
    const totalExp = expenses.reduce((s, e) => s + e.amount, 0);

    content.innerHTML = `
        <div class="stat-grid">
            <div class="stat-card">
                <div class="stat-label">Valeur du Stock</div>
                <div class="stat-value">${fmt(stockValue)} <small style="font-size:.9rem">MAD</small></div>
                <div class="stat-sub">${mats.length} matériaux</div>
            </div>
            <div class="stat-card danger">
                <div class="stat-label">Stock Critique</div>
                <div class="stat-value">${lowStock}</div>
                <div class="stat-sub">matériaux sous le seuil</div>
            </div>
            <div class="stat-card info">
                <div class="stat-label">Chiffre d'Affaires</div>
                <div class="stat-value">${fmt(paidRevenue)} <small style="font-size:.9rem">MAD</small></div>
                <div class="stat-sub">${sales.filter(s => s.status === 'PAID').length} ventes payées</div>
            </div>
            <div class="stat-card warning">
                <div class="stat-label">Productions</div>
                <div class="stat-value">${prods.length}</div>
                <div class="stat-sub">enregistrées</div>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div class="card">
                <div class="card-title">Stock Faible — Action Requise</div>
                <table class="table">
                    <thead><tr><th>Matériau</th><th>Stock</th><th>Seuil</th></tr></thead>
                    <tbody>${lowStock === 0 ? '<tr><td colspan="3" class="table-empty">✅ Tous les stocks sont bons</td></tr>' : mats.filter(m => m.quantity <= m.low_stock_threshold).map(m => `<tr class="stock-low"><td>${m.name}</td><td>${m.quantity} ${m.unit}</td><td>${m.low_stock_threshold} ${m.unit}</td></tr>`).join('')}</tbody>
                </table>
            </div>
            <div class="card">
                <div class="card-title">Dernières Ventes</div>
                <table class="table">
                    <thead><tr><th>Client</th><th>Produit</th><th>Montant</th></tr></thead>
                    <tbody>${sales.slice(0, 5).map(s => `<tr><td>${s.client_name}</td><td>${s.product_description.substring(0, 30)}...</td><td class="text-green">${fmt(s.final_sale_price)} MAD</td></tr>`).join('') || '<tr><td colspan="3" class="table-empty">Aucune vente</td></tr>'}</tbody>
                </table>
            </div>
        </div>`;
}

// =============================================
// INVENTORY
// =============================================
async function renderInventory() {
    const mats = await window.api.getMaterials();
    content.innerHTML = `
        <div class="page-header">
            <h3>Matières Premières (${mats.length})</h3>
            <div class="page-header-actions">
                <button class="btn btn-secondary btn-sm" onclick="exportMatExcel()">📊 Excel</button>
                <button class="btn btn-secondary btn-sm" onclick="exportMatPDF()">📄 PDF</button>
                <button class="btn btn-secondary btn-sm" onclick="startScanner()">🔍 Scan QR</button>
                <button class="btn btn-primary" onclick="openMatModal()">+ Nouveau Matériau</button>
            </div>
        </div>
        <div class="table-card">
            <table class="table">
                <thead><tr><th>Image</th><th>Nom</th><th>Code QR</th><th>Stock</th><th>Prix/Unité</th><th>Valeur</th><th>Statut</th><th>Actions</th></tr></thead>
                <tbody>${mats.length ? mats.map(m => {
                    const isLow = m.quantity <= m.low_stock_threshold;
                    const img = m.image_path ? `<img src="prefak-img://${m.image_path}" class="mat-thumb">` : `<div class="mat-thumb-placeholder">📦</div>`;
                    return `<tr class="${isLow ? 'stock-low' : ''}">
                        <td>${img}</td>
                        <td class="fw-600">${m.name}</td>
                        <td><button class="btn btn-secondary btn-sm" onclick="showQR(${m.id},'${m.name.replace(/'/g,"\\'")}')">🔍 Voir QR</button></td>
                        <td>${m.quantity} <span class="text-muted">${m.unit}</span></td>
                        <td>${fmt(m.unit_price)} MAD</td>
                        <td class="text-green">${fmt(m.quantity * m.unit_price)} MAD</td>
                        <td>${isLow ? '<span class="badge badge-red">⚠ Faible</span>' : '<span class="badge badge-green">OK</span>'}</td>
                        <td><div class="actions-cell">
                            <button class="btn btn-secondary btn-sm" onclick="openStockModal(${m.id},'IN','${m.name}','${m.unit}')">+IN</button>
                            <button class="btn btn-secondary btn-sm" onclick="openStockModal(${m.id},'OUT','${m.name}','${m.unit}')">−OUT</button>
                            <button class="btn btn-secondary btn-icon" onclick="openMatModal(${m.id})" title="Modifier">✏️</button>
                            <button class="btn btn-danger btn-icon" onclick="deleteMat(${m.id})" title="Supprimer">🗑️</button>
                        </div></td>
                    </tr>`;
                }).join('') : '<tr><td colspan="7" class="table-empty">Aucun matériau. Cliquez sur "+ Nouveau Matériau".</td></tr>'}</tbody>
            </table>
        </div>`;
}

async function openMatModal(id = null) {
    document.getElementById('form-material').reset();
    document.getElementById('mat-image').value = '';
    document.getElementById('image-filename').textContent = 'Aucune image';
    document.getElementById('mat-qty').disabled = !!id;
    if (id) {
        const mats = await window.api.getMaterials();
        const m = mats.find(x => x.id === id);
        if (!m) return;
        document.getElementById('modal-material-title').textContent = 'Modifier Matériau';
        document.getElementById('mat-id').value = m.id;
        document.getElementById('mat-name').value = m.name;
        document.getElementById('mat-qty').value = m.quantity;
        document.getElementById('mat-unit').value = m.unit;
        document.getElementById('mat-price').value = m.unit_price;
        document.getElementById('mat-threshold').value = m.low_stock_threshold;
        if (m.image_path) { document.getElementById('mat-image').value = m.image_path; document.getElementById('image-filename').textContent = m.image_path; }
    } else {
        document.getElementById('modal-material-title').textContent = 'Nouveau Matériau';
        document.getElementById('mat-id').value = '';
    }
    openModal('modal-material');
}

async function saveMaterial(e) {
    e.preventDefault();
    const id = document.getElementById('mat-id').value;
    const data = { name: document.getElementById('mat-name').value, quantity: parseFloat(document.getElementById('mat-qty').value) || 0, unit: document.getElementById('mat-unit').value, unit_price: parseFloat(document.getElementById('mat-price').value) || 0, low_stock_threshold: parseFloat(document.getElementById('mat-threshold').value) || 10, image_path: document.getElementById('mat-image').value || null };
    if (id) { data.id = parseInt(id); await window.api.updateMaterial(data); }
    else { await window.api.addMaterial(data); }
    closeModal('modal-material');
    renderInventory();
}

async function deleteMat(id) {
    if (!confirm2('Supprimer ce matériau ? Cette action est irréversible.')) return;
    const res = await window.api.deleteMaterial(id);
    if (res?.error) return showError(res.error);
    renderInventory();
}

async function pickImage() {
    const file = await window.api.selectImage();
    if (file) { document.getElementById('mat-image').value = file; document.getElementById('image-filename').textContent = file; }
}

function openStockModal(id, type, name, unit) {
    document.getElementById('stock-mat-id').value = id;
    document.getElementById('stock-type').value = type;
    document.getElementById('stock-mat-name').value = name;
    document.getElementById('stock-unit').value = unit;
    document.getElementById('modal-stock-title').textContent = type === 'IN' ? '📥 Entrée de Stock' : '📤 Sortie de Stock';
    document.getElementById('form-stock').reset();
    document.getElementById('stock-mat-name').value = name;
    document.getElementById('stock-unit').value = unit;
    document.getElementById('stock-mat-id').value = id;
    document.getElementById('stock-type').value = type;
    openModal('modal-stock');
}

async function saveStockMove(e) {
    e.preventDefault();
    const res = await window.api.moveStock({
        material_id: parseInt(document.getElementById('stock-mat-id').value),
        type: document.getElementById('stock-type').value,
        quantity: parseFloat(document.getElementById('stock-qty').value),
        description: document.getElementById('stock-desc').value
    });
    if (res?.error) return showError(res.error);
    closeModal('modal-stock');
    renderInventory();
}

function exportMatExcel() {
    window.api.getMaterials().then(mats => {
        const data = mats.map(m => ({ Nom: m.name, Stock: m.quantity, Unité: m.unit, 'Prix MAD': m.unit_price, 'Valeur MAD': m.quantity * m.unit_price, Seuil: m.low_stock_threshold }));
        const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Inventaire');
        XLSX.writeFile(wb, 'Inventaire_PREFAK.xlsx');
    });
}

// =============================================
// PRODUCTION
// =============================================
let prodItemsList = [];

async function renderProduction() {
    const prods = await window.api.getProductions();
    content.innerHTML = `
        <div class="page-header">
            <h3>Productions (${prods.length})</h3>
            <button class="btn btn-primary" onclick="openProdModal()">+ Nouvelle Production</button>
        </div>
        <div class="table-card">
            <table class="table">
                <thead><tr><th>Date</th><th>Produit</th><th>Quantité</th><th>Matériaux</th><th>Statut Vente</th><th>Notes</th><th>Actions</th></tr></thead>
                <tbody>${prods.length ? prods.map(p => `<tr>
                    <td>${fmtDate(p.created_at)}</td>
                    <td class="fw-600">${p.product_name}</td>
                    <td>${p.quantity}</td>
                    <td><span class="badge badge-blue">${p.item_count} types</span></td>
                    <td>${p.is_sold ? '<span class="badge badge-green">Vendu</span>' : '<span class="badge badge-gray">En stock</span>'}</td>
                    <td class="text-muted">${p.notes || '-'}</td>
                    <td><div class="actions-cell">
                        <button class="btn btn-secondary btn-icon" onclick="viewProd(${p.id},'${p.product_name.replace(/'/g,"\\'")}')">👁️</button>
                        <button class="btn btn-secondary btn-icon" onclick="editProd(${p.id})" title="Modifier">✏️</button>
                        <button class="btn btn-danger btn-icon" onclick="deleteProd(${p.id})" title="Supprimer">🗑️</button>
                    </div></td>
                </tr>`).join('') : '<tr><td colspan="7" class="table-empty">Aucune production enregistrée.</td></tr>'}</tbody>
            </table>
        </div>`;
}

async function openProdModal(editData = null) {
    prodItemsList = [];
    document.getElementById('prod-id').value = editData ? editData.id : '';
    document.getElementById('prod-name').value = editData ? editData.product_name : '';
    document.getElementById('prod-qty').value = editData ? editData.quantity : 1;
    document.getElementById('prod-notes').value = editData ? editData.notes : '';
    document.getElementById('modal-prod-title').textContent = editData ? 'Modifier Production' : 'Nouvelle Production';
    document.getElementById('prod-items-section').style.display = editData ? 'none' : 'block';
    renderProdItems();

    const mats = await window.api.getMaterials();
    const sel = document.getElementById('prod-mat-select');
    sel.innerHTML = '<option value="">-- Choisir un matériau --</option>' + mats.map(m => `<option value="${m.id}" data-unit="${m.unit}" data-name="${m.name}">${m.name} (${m.quantity} ${m.unit})</option>`).join('');
    openModal('modal-production');
}

function addProdItem() {
    const sel = document.getElementById('prod-mat-select');
    const qty = parseFloat(document.getElementById('prod-mat-qty').value);
    if (!sel.value || !qty || qty <= 0) return showError('Sélectionnez un matériau et une quantité valide.');
    const opt = sel.options[sel.selectedIndex];
    prodItemsList.push({ material_id: parseInt(sel.value), name: opt.dataset.name, unit: opt.dataset.unit, quantity: qty });
    document.getElementById('prod-mat-qty').value = '';
    renderProdItems();
}

function renderProdItems() {
    document.getElementById('prod-items-body').innerHTML = prodItemsList.length
        ? prodItemsList.map((item, i) => `<tr><td>${item.name}</td><td>${item.quantity}</td><td>${item.unit}</td><td><button class="btn btn-danger btn-sm" onclick="removeProdItem(${i})">✕</button></td></tr>`).join('')
        : '<tr><td colspan="4" class="table-empty">Aucun matériau ajouté</td></tr>';
}

function removeProdItem(i) { prodItemsList.splice(i, 1); renderProdItems(); }

async function saveProduction() {
    const id = document.getElementById('prod-id').value;
    const data = { product_name: document.getElementById('prod-name').value, quantity: parseInt(document.getElementById('prod-qty').value) || 1, notes: document.getElementById('prod-notes').value };
    if (!data.product_name) return showError('Le nom du produit est requis.');
    if (id) {
        data.id = parseInt(id);
        await window.api.updateProduction(data);
    } else {
        if (prodItemsList.length === 0) return showError('Ajoutez au moins un matériau consommé.');
        data.items = prodItemsList;
        const res = await window.api.addProduction(data);
        if (res?.error) return showError(res.error);
    }
    closeModal('modal-production');
    renderProduction();
}

async function editProd(id) {
    const prods = await window.api.getProductions();
    const p = prods.find(x => x.id === id);
    if (p) openProdModal(p);
}

async function viewProd(id, name) {
    const items = await window.api.getProductionItems(id);
    document.getElementById('modal-prod-detail-title').textContent = `📋 ${name}`;
    document.getElementById('modal-prod-detail-body').innerHTML = `
        <table class="table">
            <thead><tr><th>Matériau</th><th>Quantité</th><th>Unité</th></tr></thead>
            <tbody>${items.length ? items.map(i => `<tr><td>${i.material_name}</td><td>${i.quantity}</td><td>${i.unit}</td></tr>`).join('') : '<tr><td colspan="3" class="table-empty">Aucun détail enregistré</td></tr>'}</tbody>
        </table>`;
    openModal('modal-prod-detail');
}

async function deleteProd(id) {
    if (!confirm2('Supprimer cette production ? Le stock des matériaux sera restauré.')) return;
    const res = await window.api.deleteProduction(id);
    if (res?.error) return showError(res.error);
    renderProduction();
}

// =============================================
// CLIENTS
// =============================================
async function renderClients() {
    const clients = await window.api.getClients();
    content.innerHTML = `
        <div class="page-header">
            <h3>Clients (${clients.length})</h3>
            <div class="page-header-actions">
                <button class="btn btn-secondary btn-sm" onclick="exportClientsExcel()">📊 Excel</button>
                <button class="btn btn-secondary btn-sm" onclick="exportClientsPDF()">📄 PDF</button>
                <button class="btn btn-primary" onclick="openClientModal()">+ Nouveau Client</button>
            </div>
        </div>
        <div class="table-card">
            <table class="table">
                <thead><tr><th>Nom</th><th>Téléphone</th><th>Email</th><th>Adresse</th><th>Ventes</th><th>Actions</th></tr></thead>
                <tbody>${clients.length ? clients.map(c => `<tr>
                    <td class="fw-600">${c.name}</td>
                    <td>${c.phone || '-'}</td>
                    <td>${c.email || '-'}</td>
                    <td class="text-muted">${c.address || '-'}</td>
                    <td><span class="badge badge-blue">${c.sale_count}</span></td>
                    <td><div class="actions-cell">
                        <button class="btn btn-secondary btn-icon" onclick="openClientModal(${JSON.stringify(c).replace(/"/g,'&quot;')})">✏️</button>
                        <button class="btn btn-danger btn-icon" onclick="deleteClient(${c.id})">🗑️</button>
                    </div></td>
                </tr>`).join('') : '<tr><td colspan="6" class="table-empty">Aucun client enregistré.</td></tr>'}</tbody>
            </table>
        </div>`;
}

function openClientModal(c = null) {
    document.getElementById('form-client').reset();
    document.getElementById('cli-id').value = c ? c.id : '';
    document.getElementById('modal-client-title').textContent = c ? 'Modifier Client' : 'Nouveau Client';
    if (c) {
        document.getElementById('cli-name').value = c.name;
        document.getElementById('cli-phone').value = c.phone || '';
        document.getElementById('cli-email').value = c.email || '';
        document.getElementById('cli-address').value = c.address || '';
    }
    openModal('modal-client');
}

async function saveClient(e) {
    e.preventDefault();
    const id = document.getElementById('cli-id').value;
    const data = { name: document.getElementById('cli-name').value, phone: document.getElementById('cli-phone').value, email: document.getElementById('cli-email').value, address: document.getElementById('cli-address').value };
    if (id) { data.id = parseInt(id); await window.api.updateClient(data); }
    else await window.api.addClient(data);
    closeModal('modal-client');
    renderClients();
}

async function deleteClient(id) {
    if (!confirm2('Supprimer ce client ?')) return;
    const res = await window.api.deleteClient(id);
    if (res?.error) return showError(res.error);
    renderClients();
}

// =============================================
// SALES
// =============================================
async function renderSales() {
    const sales = await window.api.getSales();
    const totalPaid = sales.filter(s => s.status === 'PAID').reduce((s, x) => s + x.final_sale_price, 0);
    content.innerHTML = `
        <div class="page-header">
            <h3>Ventes — CA: <span class="text-green">${fmt(totalPaid)} MAD</span></h3>
            <div class="page-header-actions">
                <button class="btn btn-secondary btn-sm" onclick="exportSalesExcel()">📊 Excel</button>
                <button class="btn btn-primary" onclick="openSaleModal()">+ Nouvelle Vente</button>
            </div>
        </div>
        <div class="table-card">
            <table class="table">
                <thead><tr><th>Date</th><th>Client</th><th>Description</th><th>HT</th><th>TVA</th><th>TTC</th><th>Statut</th><th>Actions</th></tr></thead>
                <tbody>${sales.length ? sales.map(s => {
                    const ttc = s.final_sale_price * (1 + s.tax_rate / 100);
                    return `<tr>
                        <td>${fmtDate(s.sale_date)}</td>
                        <td class="fw-600">${s.client_name}</td>
                        <td>${s.product_description}</td>
                        <td>${fmt(s.final_sale_price)} MAD</td>
                        <td>${s.tax_rate}%</td>
                        <td class="text-green fw-600">${fmt(ttc)} MAD</td>
                        <td>${statusBadge(s.status)}</td>
                        <td><div class="actions-cell">
                            <button class="btn btn-secondary btn-sm" onclick="generateInvoice(${JSON.stringify(s).replace(/"/g,'&quot;')})">🧾 Facture</button>
                            <button class="btn btn-secondary btn-icon" onclick="openSaleModal(${JSON.stringify(s).replace(/"/g,'&quot;')})">✏️</button>
                            <button class="btn btn-danger btn-icon" onclick="deleteSale(${s.id})">🗑️</button>
                        </div></td>
                    </tr>`;
                }).join('') : '<tr><td colspan="8" class="table-empty">Aucune vente enregistrée.</td></tr>'}</tbody>
            </table>
        </div>`;
}

async function openSaleModal(s = null) {
    document.getElementById('form-sale').reset();
    document.getElementById('sale-id').value = s ? s.id : '';
    document.getElementById('modal-sale-title').textContent = s ? 'Modifier Vente' : 'Nouvelle Vente';
    document.getElementById('sale-date').value = s ? s.sale_date : new Date().toISOString().split('T')[0];

    const [clients, prods] = await Promise.all([window.api.getClients(), window.api.getProductions()]);
    document.getElementById('sale-client').innerHTML = clients.map(c => `<option value="${c.id}" ${s && s.client_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('');
    document.getElementById('sale-production').innerHTML = '<option value="">-- Aucune production liée --</option>' + prods.map(p => `<option value="${p.id}" ${s && s.production_id === p.id ? 'selected' : ''}>${p.product_name} (${fmtDate(p.created_at)})</option>`).join('');

    if (s) {
        document.getElementById('sale-desc').value = s.product_description;
        document.getElementById('sale-price').value = s.final_sale_price;
        document.getElementById('sale-tax').value = s.tax_rate;
        document.getElementById('sale-status').value = s.status;
        document.getElementById('sale-notes').value = s.notes || '';
    }
    openModal('modal-sale');
}

async function saveSale(e) {
    e.preventDefault();
    const id = document.getElementById('sale-id').value;
    const data = {
        client_id: parseInt(document.getElementById('sale-client').value),
        product_description: document.getElementById('sale-desc').value,
        production_id: document.getElementById('sale-production').value || null,
        final_sale_price: parseFloat(document.getElementById('sale-price').value),
        tax_rate: parseFloat(document.getElementById('sale-tax').value) || 20,
        status: document.getElementById('sale-status').value,
        sale_date: document.getElementById('sale-date').value,
        notes: document.getElementById('sale-notes').value
    };
    if (id) { data.id = parseInt(id); await window.api.updateSale(data); }
    else await window.api.addSale(data);
    closeModal('modal-sale');
    renderSales();
}

async function deleteSale(id) {
    if (!confirm2('Supprimer cette vente ?')) return;
    await window.api.deleteSale(id);
    renderSales();
}

async function generateInvoice(s) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const ttc = s.final_sale_price * (1 + s.tax_rate / 100);
    doc.setFontSize(22); doc.setTextColor(26, 127, 75); doc.text('PREFAK LOGISTICS', 20, 25);
    doc.setFontSize(30); doc.setTextColor(0); doc.text('FACTURE', 150, 25);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`Date: ${fmtDate(s.sale_date)}`, 150, 35);
    doc.text(`Réf: FAC-${String(s.id).padStart(4, '0')}`, 150, 41);
    doc.setTextColor(0); doc.setFontSize(11);
    doc.text('FACTURER À:', 20, 50);
    doc.setFontSize(13); doc.setFont(undefined, 'bold');
    doc.text(s.client_name, 20, 58);
    doc.setFont(undefined, 'normal'); doc.setFontSize(10);
    doc.autoTable({
        head: [['Description', 'Prix HT', 'TVA', 'Total TTC']],
        body: [[s.product_description, `${fmt(s.final_sale_price)} MAD`, `${s.tax_rate}%`, `${fmt(ttc)} MAD`]],
        startY: 75, headStyles: { fillColor: [26, 127, 75] }, styles: { fontSize: 11 }
    });
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(14); doc.setFont(undefined, 'bold');
    doc.text(`TOTAL TTC: ${fmt(ttc)} MAD`, 130, finalY);
    const buf = doc.output('arraybuffer');
    await window.api.saveFile({ data: new Uint8Array(buf), fileName: `Facture_${s.client_name}_${s.id}.pdf` });
}

function exportSalesExcel() {
    window.api.getSales().then(sales => {
        const data = sales.map(s => ({ Date: fmtDate(s.sale_date), Client: s.client_name, Description: s.product_description, 'HT MAD': s.final_sale_price, 'TVA %': s.tax_rate, 'TTC MAD': s.final_sale_price * (1 + s.tax_rate / 100), Statut: s.status }));
        const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Ventes');
        XLSX.writeFile(wb, 'Ventes_PREFAK.xlsx');
    });
}

// =============================================
// EXPENSES
// =============================================
async function renderExpenses() {
    const expenses = await window.api.getExpenses();
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    content.innerHTML = `
        <div class="page-header">
            <h3>Dépenses — Total: <span class="text-danger">${fmt(total)} MAD</span></h3>
            <div class="page-header-actions">
                <button class="btn btn-secondary btn-sm" onclick="exportExpensesExcel()">📊 Excel</button>
                <button class="btn btn-secondary btn-sm" onclick="exportExpensesPDF()">📄 PDF</button>
                <button class="btn btn-primary" onclick="openExpenseModal()">+ Nouvelle Dépense</button>
            </div>
        </div>
        <div class="table-card">
            <table class="table">
                <thead><tr><th>Date</th><th>Catégorie</th><th>Montant</th><th>Description</th><th>Actions</th></tr></thead>
                <tbody>${expenses.length ? expenses.map(ex => `<tr>
                    <td>${fmtDate(ex.expense_date)}</td>
                    <td><span class="badge badge-yellow">${ex.category}</span></td>
                    <td class="text-danger fw-600">${fmt(ex.amount)} MAD</td>
                    <td class="text-muted">${ex.description || '-'}</td>
                    <td><div class="actions-cell">
                        <button class="btn btn-secondary btn-icon" onclick="openExpenseModal(${JSON.stringify(ex).replace(/"/g,'&quot;')})">✏️</button>
                        <button class="btn btn-danger btn-icon" onclick="deleteExpense(${ex.id})">🗑️</button>
                    </div></td>
                </tr>`).join('') : '<tr><td colspan="5" class="table-empty">Aucune dépense enregistrée.</td></tr>'}</tbody>
            </table>
        </div>`;
}

function openExpenseModal(ex = null) {
    document.getElementById('form-expense').reset();
    document.getElementById('exp-id').value = ex ? ex.id : '';
    document.getElementById('modal-expense-title').textContent = ex ? 'Modifier Dépense' : 'Nouvelle Dépense';
    document.getElementById('exp-date').value = ex ? ex.expense_date : new Date().toISOString().split('T')[0];
    if (ex) { document.getElementById('exp-category').value = ex.category; document.getElementById('exp-amount').value = ex.amount; document.getElementById('exp-desc').value = ex.description || ''; }
    openModal('modal-expense');
}

async function saveExpense(e) {
    e.preventDefault();
    const id = document.getElementById('exp-id').value;
    const data = { category: document.getElementById('exp-category').value, amount: parseFloat(document.getElementById('exp-amount').value), description: document.getElementById('exp-desc').value, expense_date: document.getElementById('exp-date').value };
    if (id) { data.id = parseInt(id); await window.api.updateExpense(data); }
    else await window.api.addExpense(data);
    closeModal('modal-expense');
    renderExpenses();
}

async function deleteExpense(id) {
    if (!confirm2('Supprimer cette dépense ?')) return;
    await window.api.deleteExpense(id);
    renderExpenses();
}

// =============================================
// ANALYTICS
// =============================================
async function renderAnalytics() {
    const [report, stock] = await Promise.all([window.api.getFinancialReport(), window.api.getStockAnalytics()]);
    const grossProfit = report.revenue - report.cogs;
    const netProfit = grossProfit - report.expenseTotal;
    const margin = report.revenue > 0 ? ((netProfit / report.revenue) * 100).toFixed(1) : 0;

    content.innerHTML = `
        <div class="finance-kpi-grid">
            <div class="stat-card info"><div class="stat-label">Chiffre d'Affaires</div><div class="stat-value">${fmt(report.revenue)}</div><div class="stat-sub">MAD (ventes payées)</div></div>
            <div class="stat-card warning"><div class="stat-label">Coût Matériaux</div><div class="stat-value">${fmt(report.cogs)}</div><div class="stat-sub">MAD (COGS)</div></div>
            <div class="stat-card danger"><div class="stat-label">Charges Fixes</div><div class="stat-value">${fmt(report.expenseTotal)}</div><div class="stat-sub">MAD dépenses</div></div>
            <div class="stat-card ${netProfit >= 0 ? '' : 'danger'}"><div class="stat-label">Bénéfice Net</div><div class="stat-value" style="color:${netProfit >= 0 ? 'var(--green)' : 'var(--danger)'}">${fmt(netProfit)}</div><div class="stat-sub">MAD (marge ${margin}%)</div></div>
        </div>
        <div class="chart-grid">
            <div class="chart-card"><h4>Revenus Mensuels (MAD)</h4><div class="chart-wrap"><canvas id="chart-revenue"></canvas></div></div>
            <div class="chart-card"><h4>Structure des Coûts</h4><div class="chart-wrap"><canvas id="chart-costs"></canvas></div></div>
            <div class="chart-card"><h4>Top 10 — Valeur en Stock</h4><div class="chart-wrap"><canvas id="chart-stock"></canvas></div></div>
            <div class="chart-card"><h4>Dépenses par Mois (MAD)</h4><div class="chart-wrap"><canvas id="chart-expenses"></canvas></div></div>
        </div>`;

    const green = '#1a7f4b', red = '#dc2626', yellow = '#d97706', blue = '#2563eb';
    const chartOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };

    // Revenue line chart
    activeCharts.push(new Chart(document.getElementById('chart-revenue'), {
        type: 'bar',
        data: { labels: report.monthlyRevenue.map(r => r.month), datasets: [{ label: 'Revenus', data: report.monthlyRevenue.map(r => r.total), backgroundColor: green + 'cc', borderColor: green, borderWidth: 1 }] },
        options: { ...chartOpts, plugins: { legend: { display: true } } }
    }));

    // Cost pie
    activeCharts.push(new Chart(document.getElementById('chart-costs'), {
        type: 'doughnut',
        data: { labels: ['Matériaux (COGS)', 'Charges Fixes', 'Bénéfice Net'], datasets: [{ data: [Math.max(0, report.cogs), Math.max(0, report.expenseTotal), Math.max(0, netProfit)], backgroundColor: [yellow, red, green], borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    }));

    // Stock value bar
    activeCharts.push(new Chart(document.getElementById('chart-stock'), {
        type: 'bar',
        data: { labels: stock.byValue.map(s => s.name.substring(0, 15)), datasets: [{ data: stock.byValue.map(s => s.value), backgroundColor: blue + 'aa', borderColor: blue, borderWidth: 1 }] },
        options: { ...chartOpts, indexAxis: 'y' }
    }));

    // Expenses line
    activeCharts.push(new Chart(document.getElementById('chart-expenses'), {
        type: 'line',
        data: { labels: report.monthlyExpenses.map(e => e.month), datasets: [{ label: 'Dépenses', data: report.monthlyExpenses.map(e => e.total), borderColor: red, backgroundColor: red + '22', fill: true, tension: 0.3 }] },
        options: { ...chartOpts, plugins: { legend: { display: true } } }
    }));
}

// =============================================
// SETTINGS
// =============================================
async function renderSettings() {
    const currentPath = await window.api.getCurrentPath();
    content.innerHTML = `
        <div class="card">
            <div class="card-title">📁 Chemin de stockage des données</div>
            <p style="font-family:monospace;background:#f3f4f6;padding:10px;border-radius:6px;margin:10px 0;font-size:12px;">${currentPath}</p>
            <button class="btn btn-secondary" onclick="changePath()">Changer le dossier de données</button>
        </div>
        <div class="card" style="border-left: 4px solid var(--warning);">
            <div class="card-title">🌱 Données de Démonstration</div>
            <p class="text-muted" style="margin-bottom:14px;">Remplit l'application avec des données réalistes pour tester toutes les fonctionnalités. <strong>Attention : efface toutes les données existantes.</strong></p>
            <button class="btn btn-secondary" onclick="seedData()" style="border-color:var(--warning);color:var(--warning)">⚠️ Charger les données de démonstration</button>
        </div>`;
}

async function changePath() {
    if (!confirm2('Changer le dossier de données ? L\'application redémarrera automatiquement.')) return;
    const res = await window.api.changeDataPath();
    if (res?.error) showError(res.error);
}

async function seedData() {
    if (!confirm2('Cette action va EFFACER toutes les données existantes et les remplacer par des données de démonstration. Continuer ?')) return;
    const res = await window.api.seedDemoData();
    if (res?.error) return showError(res.error);
    alert('✅ Données de démonstration chargées avec succès !');
    navigate('dashboard');
}
async function renderHistory() {
    const history = await window.api.getHistory(300);
    content.innerHTML = `
        <div class="page-header">
            <h3>Historique Mouvements Stock</h3>
            <div class="page-header-actions">
                <button class="btn btn-secondary btn-sm" onclick="exportHistoryExcel()">📊 Excel</button>
                <button class="btn btn-secondary btn-sm" onclick="exportHistoryPDF()">📄 PDF</button>
            </div>
        </div>
        <div class="table-card">
            <table class="table">
                <thead><tr><th>Date</th><th>Matériau</th><th>Type</th><th>Quantité</th><th>Stock après</th><th>Note</th></tr></thead>
                <tbody>${history.length ? history.map(h => `<tr>
                    <td>${fmtDate(h.created_at)}</td>
                    <td>${h.material_name}</td>
                    <td>${h.type === 'IN' ? '<span class="badge badge-green">IN</span>' : h.type === 'OUT' ? '<span class="badge badge-red">OUT</span>' : '<span class="badge badge-blue">ADJUST</span>'}</td>
                    <td class="fw-600">${h.quantity}</td>
                    <td>${h.remaining_stock}</td>
                    <td class="text-muted">${h.description || '-'}</td>
                </tr>`).join('') : '<tr><td colspan="6" class="table-empty">Aucun mouvement enregistré.</td></tr>'}</tbody>
            </table>
        </div>`;
}

async function exportMatPDF() {
    const mats = await window.api.getMaterials();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text('Inventaire des Matières Premières', 14, 20);
    doc.setFontSize(10); doc.text(`Généré le: ${new Date().toLocaleString()}`, 14, 28);
    const body = mats.map(m => [m.name, `${m.quantity} ${m.unit}`, `${fmt(m.unit_price)} MAD`, `${fmt(m.quantity * m.unit_price)} MAD`]);
    doc.autoTable({
        head: [['Désignation', 'Stock', 'Prix Unit.', 'Valeur Total']],
        body: body,
        startY: 35, headStyles: { fillColor: [26, 127, 75] }
    });
    const buf = doc.output('arraybuffer');
    await window.api.saveFile({ data: new Uint8Array(buf), fileName: 'Inventaire_PREFAK.pdf' });
}

async function exportHistoryExcel() {
    const history = await window.api.getHistory(1000);
    const data = history.map(h => ({ Date: fmtDate(h.created_at), Matériau: h.material_name, Type: h.type, Quantité: h.quantity, 'Stock Après': h.remaining_stock, Note: h.description }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Historique');
    XLSX.writeFile(wb, 'Historique_Stock_PREFAK.xlsx');
}

async function exportHistoryPDF() {
    const history = await window.api.getHistory(500);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text('Historique des Mouvements Stock', 14, 20);
    doc.autoTable({
        head: [['Date', 'Matériau', 'Type', 'Qté', 'Stock']],
        body: history.map(h => [fmtDate(h.created_at), h.material_name, h.type, h.quantity, h.remaining_stock]),
        startY: 30, headStyles: { fillColor: [37, 99, 235] }
    });
    const buf = doc.output('arraybuffer');
    await window.api.saveFile({ data: new Uint8Array(buf), fileName: 'Historique_Stock_PREFAK.pdf' });
}

async function exportClientsExcel() {
    const clients = await window.api.getClients();
    const data = clients.map(c => ({ Nom: c.name, Téléphone: c.phone, Email: c.email, Adresse: c.address, Ventes: c.sale_count }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Clients');
    XLSX.writeFile(wb, 'Clients_PREFAK.xlsx');
}

async function exportClientsPDF() {
    const clients = await window.api.getClients();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text('Liste des Clients', 14, 20);
    doc.autoTable({
        head: [['Nom', 'Téléphone', 'Email', 'Adresse']],
        body: clients.map(c => [c.name, c.phone || '-', c.email || '-', c.address || '-']),
        startY: 30, headStyles: { fillColor: [37, 99, 235] }
    });
    const buf = doc.output('arraybuffer');
    await window.api.saveFile({ data: new Uint8Array(buf), fileName: 'Clients_PREFAK.pdf' });
}

async function exportExpensesExcel() {
    const expenses = await window.api.getExpenses();
    const data = expenses.map(e => ({ Date: fmtDate(e.expense_date), Catégorie: e.category, Montant: e.amount, Description: e.description }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Dépenses');
    XLSX.writeFile(wb, 'Depenses_PREFAK.xlsx');
}

async function exportExpensesPDF() {
    const expenses = await window.api.getExpenses();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text('Journal des Dépenses', 14, 20);
    doc.autoTable({
        head: [['Date', 'Catégorie', 'Montant', 'Description']],
        body: expenses.map(e => [fmtDate(e.expense_date), e.category, `${fmt(e.amount)} MAD`, e.description || '-']),
        startY: 30, headStyles: { fillColor: [220, 38, 38] }
    });
    const buf = doc.output('arraybuffer');
    await window.api.saveFile({ data: new Uint8Array(buf), fileName: 'Depenses_PREFAK.pdf' });
}

// =============================================
// QR CODE & SCANNER
// =============================================
let scanner = null;

async function showQR(id, name) {
    const qrData = await window.api.generateQR(`PREFAK-MAT-${id}`);
    document.getElementById('qr-img').src = qrData;
    document.getElementById('qr-label').textContent = name;
    openModal('modal-qr');
}

function printQR() {
    const win = window.open('', '_blank');
    const img = document.getElementById('qr-img').src;
    const name = document.getElementById('qr-label').textContent;
    win.document.write(`
        <html><body style="text-align:center;font-family:sans-serif;padding:40px;">
            <img src="${img}" style="width:300px;">
            <h2>${name}</h2>
            <script>setTimeout(() => { window.print(); window.close(); }, 500);</script>
        </body></html>
    `);
}

function startScanner() {
    openModal('modal-scanner');
    if (!scanner) {
        scanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 250 });
        scanner.render(onScanSuccess);
    }
}

async function onScanSuccess(decodedText) {
    if (decodedText.startsWith('PREFAK-MAT-')) {
        const id = parseInt(decodedText.split('-').pop());
        const mats = await window.api.getMaterials();
        const m = mats.find(x => x.id === id);
        if (m) {
            if (scanner) {
                await scanner.clear();
                scanner = null;
            }
            closeModal('modal-scanner');
            
            // Show Choice Modal
            document.getElementById('choice-mat-name').textContent = m.name;
            openModal('modal-scan-choice');
            
            document.getElementById('btn-choice-in').onclick = () => {
                closeModal('modal-scan-choice');
                openStockModal(m.id, 'IN', m.name, m.unit);
            };
            document.getElementById('btn-choice-out').onclick = () => {
                closeModal('modal-scan-choice');
                openStockModal(m.id, 'OUT', m.name, m.unit);
            };
        } else {
            alert("Matériau introuvable dans la base de données.");
        }
    }
}

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// --- Resolve dynamic data path from settings ---
const settingsPath = path.join(app.getPath('userData'), 'settings.json');
let dataPath = path.join(app.getPath('userData'), 'data');

if (fs.existsSync(settingsPath)) {
    try {
        const s = JSON.parse(fs.readFileSync(settingsPath));
        if (s.dataPath) dataPath = s.dataPath;
    } catch (e) {}
}

const dbPath = path.join(dataPath, 'db', 'prefak.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// --- Schema ---
db.exec(`
  CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    quantity REAL DEFAULT 0,
    unit TEXT NOT NULL,
    unit_price REAL DEFAULT 0,
    image_path TEXT,
    low_stock_threshold REAL DEFAULT 10,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS stock_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL,
    material_name TEXT NOT NULL,
    type TEXT NOT NULL,
    quantity REAL NOT NULL,
    remaining_stock REAL NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS productions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS production_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    production_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL,
    material_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    FOREIGN KEY(production_id) REFERENCES productions(id) ON DELETE CASCADE,
    FOREIGN KEY(material_id) REFERENCES materials(id)
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    production_id INTEGER,
    product_description TEXT NOT NULL,
    final_sale_price REAL NOT NULL,
    tax_rate REAL DEFAULT 20,
    status TEXT DEFAULT 'PAID',
    sale_date DATE DEFAULT (date('now')),
    notes TEXT,
    FOREIGN KEY(client_id) REFERENCES clients(id),
    FOREIGN KEY(production_id) REFERENCES productions(id)
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    expense_date DATE DEFAULT (date('now'))
  );
`);

module.exports = db;

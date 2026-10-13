import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password, stored) {
  if (!stored?.includes(':')) return false;
  const [salt, expected] = stored.split(':');
  const actual = scryptSync(password, salt, 64);
  const bytes = Buffer.from(expected, 'hex');
  return actual.length === bytes.length && timingSafeEqual(actual, bytes);
}

const seedProducts = [
  ['Velocity Runner', 'A lightweight daily trainer built for every mile.', 'Running', 'AeroStep', 1299900, 24, 'New', '#d4f547', '#292d17'],
  ['Court Classic', 'A timeless court silhouette with everyday comfort.', 'Lifestyle', 'Northline', 899900, 31, 'Bestseller', '#eee7dc', '#5e4439'],
  ['Skyline High', 'High-top attitude with cushioned street-ready support.', 'Basketball', 'Elevation', 1599900, 17, 'Limited', '#d4c5ff', '#382957'],
  ['Terra Trek', 'Confident grip for routes beyond the pavement.', 'Outdoor', 'AeroStep', 1399900, 20, 'New', '#bedfbd', '#234b39'],
  ['Pulse Knit', 'Breathable knit that moves with your day.', 'Running', 'Flux', 1099900, 28, '', '#c9e8f3', '#194f60'],
  ['Retro Wave', 'Vintage lines, modern cloud-soft cushioning.', 'Lifestyle', 'Northline', 949900, 26, 'Bestseller', '#f7d9c6', '#703d36'],
  ['Jump Pro', 'Explosive court energy with a secure fit.', 'Basketball', 'Elevation', 1699900, 16, '', '#f9b5a7', '#702c39'],
  ['Trail Nova', 'All-terrain traction without the extra weight.', 'Outdoor', 'Flux', 1499900, 19, 'Limited', '#d8e0a4', '#4d5525'],
  ['City Glide', 'Minimal form, maximum versatility.', 'Lifestyle', 'AeroStep', 799900, 35, '', '#d7dff0', '#324c76'],
  ['Tempo Shift', 'Responsive foam for faster training sessions.', 'Running', 'Northline', 1199900, 21, 'New', '#f4d7e7', '#703456'],
  ['Hoop Heritage', 'Classic hardwood styling for off-court wear.', 'Basketball', 'Flux', 1299900, 23, '', '#e9d8bb', '#624825'],
  ['Ridge Runner', 'Stable comfort for the long way home.', 'Outdoor', 'Elevation', 1199900, 18, '', '#cad5cc', '#355249']
];

export function openDatabase(path = process.env.DB_PATH || './data/sneaker-shop.db', options = {}) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
      category TEXT NOT NULL, brand TEXT NOT NULL, price INTEGER NOT NULL CHECK(price > 0),
      stock INTEGER NOT NULL CHECK(stock >= 0), badge TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL, accent TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
      customer_name TEXT NOT NULL, address TEXT NOT NULL, city TEXT NOT NULL,
      postal_code TEXT NOT NULL, payment_method TEXT NOT NULL,
      subtotal INTEGER NOT NULL, shipping INTEGER NOT NULL, total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'Placed', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id), product_name TEXT NOT NULL,
      size INTEGER NOT NULL, quantity INTEGER NOT NULL, unit_price INTEGER NOT NULL
    );
  `);
  if (db.prepare('SELECT COUNT(*) AS n FROM products').get().n === 0) {
    const insert = db.prepare('INSERT INTO products (name, description, category, brand, price, stock, badge, color, accent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const product of seedProducts) insert.run(...product);
  }
  // Upgrade the initial development seed (which stored prices at 1/100 scale)
  // without touching customer accounts, orders, or later catalog edits.
  const legacySeedCount = db.prepare('SELECT COUNT(*) AS n FROM products WHERE id BETWEEN 1 AND 12 AND price BETWEEN 1 AND 20000').get().n;
  if (legacySeedCount === 12) db.exec('UPDATE products SET price=price*100 WHERE id BETWEEN 1 AND 12');
  const adminEmail = options.adminEmail ?? process.env.ADMIN_EMAIL;
  const adminPassword = options.adminPassword ?? process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword && !db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail.toLowerCase())) {
    db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')")
      .run('Shop Administrator', adminEmail.toLowerCase(), hashPassword(adminPassword));
  }
  return db;
}

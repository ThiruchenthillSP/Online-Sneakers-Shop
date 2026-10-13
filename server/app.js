import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import { hashPassword, verifyPassword } from './db.js';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const allowedStatuses = new Set(['Placed', 'Packed', 'Shipped', 'Delivered', 'Cancelled']);
const maxBodyBytes = 100_000;

function send(res, status, value, extraHeaders = {}) {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders });
  res.end(body);
}

function bad(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function clean(value, max = 120) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > maxBodyBytes) bad('Request is too large', 413);
  }
  try { return raw ? JSON.parse(raw) : {}; } catch { bad('Invalid JSON'); }
}

function getUser(db, req) {
  const token = /(?:^|;\s*)shop_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
  if (!token) return null;
  return db.prepare(`SELECT u.id, u.name, u.email, u.role FROM sessions s
    JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>?`).get(createHash('sha256').update(token).digest('hex'), Date.now()) || null;
}

function requireUser(user) { if (!user) bad('Please sign in to continue', 401); return user; }
function requireAdmin(user) { if (!user || user.role !== 'admin') bad('Administrator access required', 403); }

function createSession(db, user, res) {
  const token = randomBytes(32).toString('hex');
  const digest = createHash('sha256').update(token).digest('hex');
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(digest, user.id, Date.now() + 7 * 86400000);
  res.setHeader('Set-Cookie', `shop_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800`);
}

function productInput(body) {
  const name = clean(body.name, 90), description = clean(body.description, 600);
  const category = clean(body.category, 40), brand = clean(body.brand, 40);
  const badge = clean(body.badge, 30), color = clean(body.color, 7), accent = clean(body.accent, 7);
  const price = Number(body.price), stock = Number(body.stock);
  if (!name || !description || !category || !brand) bad('Complete all required product fields');
  if (!Number.isInteger(price) || price < 1 || price > 1_000_000) bad('Price must be a positive amount in paise');
  if (!Number.isInteger(stock) || stock < 0 || stock > 100_000) bad('Stock must be a non-negative whole number');
  if (!/^#[0-9a-fA-F]{6}$/.test(color) || !/^#[0-9a-fA-F]{6}$/.test(accent)) bad('Choose valid product colors');
  return [name, description, category, brand, price, stock, badge, color, accent];
}

export function createApp(db) {
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'");
    const url = new URL(req.url || '/', 'http://localhost');
    const path = url.pathname;
    try {
      if (req.method === 'GET' && path === '/api/health') return send(res, 200, { status: 'ok', service: 'online-sneakers-shop' });
      if (req.method === 'GET' && path === '/api/products') {
        let products = db.prepare('SELECT * FROM products WHERE active=1 ORDER BY id').all();
        const q = clean(url.searchParams.get('q'), 100).toLowerCase();
        const category = clean(url.searchParams.get('category'), 40);
        if (q) products = products.filter(p => `${p.name} ${p.description} ${p.brand} ${p.category}`.toLowerCase().includes(q));
        if (category && category !== 'All') products = products.filter(p => p.category === category);
        const sort = url.searchParams.get('sort');
        if (sort === 'price-asc') products.sort((a, b) => a.price - b.price);
        if (sort === 'price-desc') products.sort((a, b) => b.price - a.price);
        if (sort === 'name') products.sort((a, b) => a.name.localeCompare(b.name));
        return send(res, 200, { products });
      }
      if (req.method === 'GET' && /^\/api\/products\/\d+$/.test(path)) {
        const product = db.prepare('SELECT * FROM products WHERE id=? AND active=1').get(Number(path.split('/')[3]));
        if (!product) bad('Product not found', 404);
        return send(res, 200, { product });
      }
      if (req.method === 'GET' && path === '/api/me') return send(res, 200, { user: getUser(db, req) });
      if (req.method === 'POST' && path === '/api/register') {
        const body = await readJson(req);
        const name = clean(body.name, 80), email = clean(body.email, 120).toLowerCase();
        if (name.length < 2 || !validEmail(email) || typeof body.password !== 'string' || body.password.length < 8) bad('Enter a name, valid email, and password of at least 8 characters');
        if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) bad('Email is already registered', 409);
        const id = Number(db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name, email, hashPassword(body.password)).lastInsertRowid);
        const user = { id, name, email, role: 'customer' };
        createSession(db, user, res);
        return send(res, 201, { user });
      }
      if (req.method === 'POST' && path === '/api/login') {
        const body = await readJson(req);
        const email = clean(body.email, 120).toLowerCase();
        const record = db.prepare('SELECT * FROM users WHERE email=?').get(email);
        if (!record || !verifyPassword(String(body.password || ''), record.password_hash)) bad('Incorrect email or password', 401);
        const user = { id: record.id, name: record.name, email: record.email, role: record.role };
        createSession(db, user, res);
        return send(res, 200, { user });
      }
      if (req.method === 'POST' && path === '/api/logout') {
        const token = /(?:^|;\s*)shop_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
        if (token) db.prepare('DELETE FROM sessions WHERE token=?').run(createHash('sha256').update(token).digest('hex'));
        res.setHeader('Set-Cookie', 'shop_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
        return send(res, 200, { ok: true });
      }
      if (req.method === 'POST' && path === '/api/orders') {
        const user = requireUser(getUser(db, req));
        const body = await readJson(req);
        const customerName = clean(body.customerName, 90), address = clean(body.address, 200), city = clean(body.city, 80), postalCode = clean(body.postalCode, 12);
        const paymentMethod = clean(body.paymentMethod, 30);
        if (!customerName || !address || !city || !/^[0-9]{5,6}$/.test(postalCode)) bad('Enter a complete shipping address and valid postal code');
        if (paymentMethod !== 'Cash on delivery') bad('Only cash on delivery is available; no online payments are collected');
        if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) bad('Cart is empty or too large');
        const lines = body.items.map(item => {
          const id = Number(item.productId), size = Number(item.size), quantity = Number(item.quantity);
          if (!Number.isInteger(id) || !Number.isInteger(size) || size < 6 || size > 12 || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) bad('Invalid item, size or quantity');
          const product = db.prepare('SELECT * FROM products WHERE id=? AND active=1').get(id);
          if (!product) bad('A product is no longer available', 409);
          return { product, size, quantity };
        });
        const quantityByProduct = new Map();
        for (const line of lines) quantityByProduct.set(line.product.id, (quantityByProduct.get(line.product.id) || 0) + line.quantity);
        for (const [id, count] of quantityByProduct) {
          const stock = db.prepare('SELECT stock FROM products WHERE id=?').get(id).stock;
          if (count > stock) bad('Not enough stock for one or more items', 409);
        }
        const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
        const shipping = subtotal >= 1000000 ? 0 : 49900;
        db.exec('BEGIN IMMEDIATE');
        try {
          for (const [id, count] of quantityByProduct) {
            const result = db.prepare('UPDATE products SET stock=stock-? WHERE id=? AND stock>=?').run(count, id, count);
            if (!result.changes) bad('Stock changed during checkout; please retry', 409);
          }
          const result = db.prepare('INSERT INTO orders (user_id, customer_name, address, city, postal_code, payment_method, subtotal, shipping, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(user.id, customerName, address, city, postalCode, paymentMethod, subtotal, shipping, subtotal + shipping);
          const orderId = Number(result.lastInsertRowid);
          const insert = db.prepare('INSERT INTO order_items (order_id, product_id, product_name, size, quantity, unit_price) VALUES (?, ?, ?, ?, ?, ?)');
          for (const line of lines) insert.run(orderId, line.product.id, line.product.name, line.size, line.quantity, line.product.price);
          db.exec('COMMIT');
          return send(res, 201, { orderId, total: subtotal + shipping });
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      }
      if (req.method === 'GET' && path === '/api/orders') {
        const user = requireUser(getUser(db, req));
        const orders = db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC').all(user.id);
        for (const order of orders) order.items = db.prepare('SELECT product_id, product_name, size, quantity, unit_price FROM order_items WHERE order_id=?').all(order.id);
        return send(res, 200, { orders });
      }
      if (path.startsWith('/api/admin/')) {
        requireAdmin(getUser(db, req));
        if (req.method === 'GET' && path === '/api/admin/summary') {
          const products = db.prepare('SELECT COUNT(*) AS n FROM products WHERE active=1').get().n;
          const orders = db.prepare('SELECT COUNT(*) AS n FROM orders').get().n;
          const revenue = db.prepare("SELECT COALESCE(SUM(total),0) AS n FROM orders WHERE status!='Cancelled'").get().n;
          const lowStock = db.prepare('SELECT COUNT(*) AS n FROM products WHERE active=1 AND stock<5').get().n;
          return send(res, 200, { products, orders, revenue, lowStock });
        }
        if (req.method === 'GET' && path === '/api/admin/products') return send(res, 200, { products: db.prepare('SELECT * FROM products ORDER BY id DESC').all() });
        if (req.method === 'POST' && path === '/api/admin/products') {
          const fields = productInput(await readJson(req));
          const result = db.prepare('INSERT INTO products (name, description, category, brand, price, stock, badge, color, accent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(...fields);
          return send(res, 201, { id: Number(result.lastInsertRowid) });
        }
        if (/^\/api\/admin\/products\/\d+$/.test(path)) {
          const id = Number(path.split('/')[4]);
          if (!db.prepare('SELECT id FROM products WHERE id=?').get(id)) bad('Product not found', 404);
          if (req.method === 'PUT') {
            const fields = productInput(await readJson(req));
            db.prepare('UPDATE products SET name=?, description=?, category=?, brand=?, price=?, stock=?, badge=?, color=?, accent=? WHERE id=?').run(...fields, id);
            return send(res, 200, { ok: true });
          }
          if (req.method === 'DELETE') {
            db.prepare('UPDATE products SET active=0 WHERE id=?').run(id);
            return send(res, 200, { ok: true });
          }
        }
        if (req.method === 'GET' && path === '/api/admin/orders') {
          const orders = db.prepare('SELECT o.*, u.email FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC').all();
          for (const order of orders) order.items = db.prepare('SELECT product_name, size, quantity, unit_price FROM order_items WHERE order_id=?').all(order.id);
          return send(res, 200, { orders });
        }
        if (req.method === 'PATCH' && /^\/api\/admin\/orders\/\d+$/.test(path)) {
          const id = Number(path.split('/')[4]);
          const status = clean((await readJson(req)).status, 20);
          if (!allowedStatuses.has(status)) bad('Invalid order status');
          if (!db.prepare('UPDATE orders SET status=? WHERE id=?').run(status, id).changes) bad('Order not found', 404);
          return send(res, 200, { ok: true });
        }
      }
      if (path.startsWith('/api/')) bad('Endpoint not found', 404);
      if (req.method !== 'GET' && req.method !== 'HEAD') bad('Method not allowed', 405);
      const requested = path === '/' ? '/index.html' : path;
      const filePath = normalize(join(publicDir, requested));
      if (!filePath.startsWith(publicDir) || !mime[extname(filePath)]) bad('Page not found', 404);
      try {
        const content = await readFile(filePath);
        res.writeHead(200, { 'Content-Type': `${mime[extname(filePath)]}; charset=utf-8`, 'Cache-Control': 'public, max-age=300' });
        res.end(req.method === 'HEAD' ? undefined : content);
      } catch { bad('Page not found', 404); }
    } catch (error) {
      send(res, error.status || 500, { error: error.status ? error.message : 'Internal server error' });
    }
  });
}

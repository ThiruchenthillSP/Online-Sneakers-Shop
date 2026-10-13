import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.js';
import { createApp } from '../server/app.js';

let db, server, base, customerCookie, adminCookie;
before(async () => {
  db = openDatabase(':memory:', { adminEmail: 'admin@example.test', adminPassword: 'StrongAdminPassword123!' });
  server = createApp(db);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });

async function request(path, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(base + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

test('health endpoint and seeded catalog', async () => {
  const health = await request('/api/health'); assert.equal(health.status, 200); assert.equal(health.body.status, 'ok');
  const catalog = await request('/api/products'); assert.equal(catalog.body.products.length, 12);
});
test('search, filter, sort and product detail', async () => {
  const running = await request('/api/products?category=Running&sort=price-asc');
  assert.equal(running.body.products.length, 3);
  assert.ok(running.body.products[0].price <= running.body.products[1].price);
  const search = await request('/api/products?q=Velocity'); assert.equal(search.body.products[0].name, 'Velocity Runner');
  const detail = await request('/api/products/1'); assert.equal(detail.body.product.id, 1);
  assert.equal((await request('/api/products/999')).status, 404);
});
test('register, duplicate registration and session', async () => {
  const result = await request('/api/register', { method: 'POST', body: { name: 'Sample Customer', email: 'buyer@example.test', password: 'SecurePass123!' } });
  assert.equal(result.status, 201); assert.equal(result.body.user.role, 'customer'); customerCookie = result.cookie;
  assert.equal((await request('/api/me', { cookie: customerCookie })).body.user.email, 'buyer@example.test');
  assert.equal((await request('/api/register', { method: 'POST', body: { name: 'Other Customer', email: 'buyer@example.test', password: 'SecurePass123!' } })).status, 409);
});
test('login rejects invalid password and allows valid password', async () => {
  assert.equal((await request('/api/login', { method: 'POST', body: { email: 'buyer@example.test', password: 'wrong' } })).status, 401);
  const result = await request('/api/login', { method: 'POST', body: { email: 'buyer@example.test', password: 'SecurePass123!' } });
  assert.equal(result.status, 200); customerCookie = result.cookie;
});
test('checkout requires login, validates quantities and does not trust client prices', async () => {
  const order = { customerName: 'Sample Customer', address: '123 Market Road', city: 'Coimbatore', postalCode: '641001', paymentMethod: 'Cash on delivery', items: [{ productId: 1, size: 9, quantity: 2, price: 1 }] };
  assert.equal((await request('/api/orders', { method: 'POST', body: order })).status, 401);
  assert.equal((await request('/api/orders', { method: 'POST', cookie: customerCookie, body: { ...order, items: [{ productId: 1, size: 9, quantity: 99 }] } })).status, 400);
  const result = await request('/api/orders', { method: 'POST', cookie: customerCookie, body: order });
  assert.equal(result.status, 201); assert.equal(result.body.total, 2599800);
  assert.equal((await request('/api/products/1')).body.product.stock, 22);
});
test('order history belongs to account and logout invalidates session', async () => {
  const orders = await request('/api/orders', { cookie: customerCookie });
  assert.equal(orders.body.orders.length, 1); assert.equal(orders.body.orders[0].items[0].quantity, 2);
  assert.equal((await request('/api/logout', { method: 'POST', cookie: customerCookie })).status, 200);
  assert.equal((await request('/api/orders', { cookie: customerCookie })).status, 401);
});
test('administrator can manage catalog and order status', async () => {
  const login = await request('/api/login', { method: 'POST', body: { email: 'admin@example.test', password: 'StrongAdminPassword123!' } });
  assert.equal(login.status, 200); adminCookie = login.cookie;
  const summary = await request('/api/admin/summary', { cookie: adminCookie }); assert.equal(summary.body.orders, 1);
  const product = { name: 'Test Sprint', description: 'A product for automated tests.', category: 'Running', brand: 'Test', price: 5000, stock: 3, badge: 'New', color: '#abcdef', accent: '#123456' };
  const created = await request('/api/admin/products', { method: 'POST', cookie: adminCookie, body: product });
  assert.equal(created.status, 201);
  const id = created.body.id;
  assert.equal((await request(`/api/admin/products/${id}`, { method: 'PUT', cookie: adminCookie, body: { ...product, stock: 9 } })).status, 200);
  assert.equal((await request(`/api/products/${id}`)).body.product.stock, 9);
  assert.equal((await request('/api/admin/orders/1', { method: 'PATCH', cookie: adminCookie, body: { status: 'Shipped' } })).status, 200);
  assert.equal((await request(`/api/admin/products/${id}`, { method: 'DELETE', cookie: adminCookie })).status, 200);
  assert.equal((await request(`/api/products/${id}`)).status, 404);
});
test('administrator endpoints reject customers and guests', async () => {
  assert.equal((await request('/api/admin/summary')).status, 403);
  const login = await request('/api/login', { method: 'POST', body: { email: 'buyer@example.test', password: 'SecurePass123!' } });
  assert.equal((await request('/api/admin/summary', { cookie: login.cookie })).status, 403);
});

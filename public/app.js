const state = { products: [], category: 'All', query: '', sort: 'featured', cart: loadCart(), user: null, selectedProduct: null, selectedSize: 9, adminTab: 'products' };
const $ = selector => document.querySelector(selector);
const money = paise => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
function loadCart() { try { const value = JSON.parse(localStorage.getItem('solestreet-cart') || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
function saveCart() { localStorage.setItem('solestreet-cart', JSON.stringify(state.cart)); updateCartCount(); }
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.remove('hidden'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.add('hidden'), 3200); }
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Something went wrong');
  return body;
}
function sneakerSvg(color, accent, id = 'shoe') {
  const key = `s${String(id).replace(/[^a-zA-Z0-9]/g, '')}`;
  return `<svg viewBox="0 0 520 320" role="img" aria-label="Sneaker illustration" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="${key}upper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff" offset="0"/><stop stop-color="${accent}" offset="1"/></linearGradient><linearGradient id="${key}sole" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff" offset="0"/><stop stop-color="#d8dccf" offset="1"/></linearGradient></defs><ellipse cx="258" cy="273" rx="212" ry="19" fill="#1b2118" opacity=".12"/><path d="M37 215c27-4 53-12 80-25 33-17 58-37 78-71 10-17 16-45 34-55 13-8 30-8 43-2 13 6 27 25 44 43 20 21 44 35 78 47l72 24c21 7 35 21 35 42v23c-61 15-147 19-228 15L59 243c-16-1-28-10-22-28Z" fill="url(#${key}upper)" stroke="${accent}" stroke-width="6"/><path d="M46 210c35 0 76-20 110-43 22-16 38-42 51-69 7-16 18-34 29-39-8 51 21 94 51 121 40 37 85 52 149 66-127 20-267-2-390-36Z" fill="${color}" opacity=".95"/><path d="M70 215c29-5 54-18 77-34 32 15 59 31 96 38 36 6 63 6 94 0 40 13 85 21 124 19l21-2v17c-40 15-107 21-180 20L74 259c-20-1-31-11-32-23l2-19 26-2Z" fill="url(#${key}sole)" stroke="${accent}" stroke-width="5"/><path d="M61 247c107 13 224 21 341 16 36-1 63-5 83-11" fill="none" stroke="${accent}" stroke-width="4" opacity=".8"/><path d="M233 85c31 21 61 39 112 52" fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round"/><path d="M213 105c30 20 60 37 104 49M197 126c30 20 59 37 101 48M181 148c28 19 57 35 94 45" fill="none" stroke="#f9faf5" stroke-width="6" stroke-linecap="round"/><path d="M181 165c33 10 57 24 84 42" fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round"/><path d="M294 168c39-4 72-7 105 1" fill="none" stroke="${accent}" stroke-width="5" opacity=".7"/><path d="M377 181c25 5 46 13 61 25" fill="none" stroke="${accent}" stroke-width="5"/><path d="M66 240c28 1 55 0 77-5" fill="none" stroke="${accent}" stroke-width="4" opacity=".7"/></svg>`;
}
function updateCartCount() { const n = state.cart.reduce((sum, item) => sum + item.quantity, 0); $('#cart-count').textContent = n; $('#drawer-count').textContent = `(${n})`; }
function openPanel(which) { $('#overlay').classList.remove('hidden'); $(which).classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function closePanels() { $('#overlay').classList.add('hidden'); $('#cart-drawer').classList.add('hidden'); $('#modal').classList.add('hidden'); document.body.style.overflow = ''; }
function showModal(html) { $('#modal-content').innerHTML = html; openPanel('#modal'); }

async function loadProducts() {
  const params = new URLSearchParams({ category: state.category, q: state.query, sort: state.sort });
  try { state.products = (await api(`/api/products?${params}`)).products; renderProducts(); }
  catch (error) { $('#products-grid').innerHTML = `<div class="empty-state">${escapeHtml(error.message)}. Please refresh the page.</div>`; }
}
function renderProducts() {
  $('#products-grid').innerHTML = state.products.length ? state.products.map(product => `<article class="product-card"><button class="product-image" style="--card-bg:${escapeHtml(product.color)}" data-product="${product.id}" aria-label="View ${escapeHtml(product.name)}">${product.badge ? `<span class="badge">${escapeHtml(product.badge)}</span>` : ''}${sneakerSvg(product.color, product.accent, `p${product.id}`)}</button><div class="product-meta"><div><small>${escapeHtml(product.brand)} · ${escapeHtml(product.category)}</small><h3>${escapeHtml(product.name)}</h3></div><span class="product-price">${money(product.price)}</span></div></article>`).join('') : '<div class="empty-state">No sneakers found. Try another search or category.</div>';
  $('#result-count').textContent = `${state.products.length} styles to explore`;
  document.querySelectorAll('[data-product]').forEach(button => button.addEventListener('click', () => showProduct(Number(button.dataset.product))));
}
async function showProduct(id) {
  try {
    const { product } = await api(`/api/products/${id}`);
    state.selectedProduct = product; state.selectedSize = 9;
    showModal(`<div class="product-dialog"><div class="product-dialog-art" style="--card-bg:${escapeHtml(product.color)}">${sneakerSvg(product.color, product.accent, `detail${id}`)}</div><div><span class="modal-kicker">${escapeHtml(product.brand)} / ${escapeHtml(product.category)}</span><h2>${escapeHtml(product.name)}</h2><p>${escapeHtml(product.description)}</p><div class="product-dialog-price">${money(product.price)}</div><p>${product.stock > 0 ? `${product.stock} pairs available` : 'Out of stock'}</p><strong style="font-size:11px">SELECT SIZE (UK)</strong><div class="size-grid">${[6,7,8,9,10,11,12].map(size => `<button data-size="${size}" class="${size === 9 ? 'selected' : ''}">${size}</button>`).join('')}</div><button id="add-to-cart" class="full-button" ${product.stock < 1 ? 'disabled' : ''}>${product.stock > 0 ? 'ADD TO BAG — ' + money(product.price) : 'OUT OF STOCK'}</button><p style="margin-top:15px">Cash on delivery · Shipping calculated at checkout</p></div></div>`);
    document.querySelectorAll('[data-size]').forEach(button => button.addEventListener('click', () => { state.selectedSize = Number(button.dataset.size); document.querySelectorAll('[data-size]').forEach(b => b.classList.toggle('selected', b === button)); }));
    $('#add-to-cart').addEventListener('click', addToCart);
  } catch (error) { toast(error.message); }
}
function addToCart() {
  const product = state.selectedProduct;
  const existing = state.cart.find(item => item.productId === product.id && item.size === state.selectedSize);
  if (existing) { if (existing.quantity >= Math.min(product.stock, 10)) return toast('Maximum available quantity reached'); existing.quantity++; }
  else state.cart.push({ productId: product.id, name: product.name, price: product.price, color: product.color, accent: product.accent, size: state.selectedSize, quantity: 1, stock: product.stock });
  saveCart(); closePanels(); renderCart(); openPanel('#cart-drawer'); toast(`${product.name} added to your bag`);
}
function renderCart() {
  updateCartCount(); const total = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  $('#cart-items').innerHTML = state.cart.length ? state.cart.map((item, index) => `<div class="cart-row"><div class="cart-thumb" style="--card-bg:${escapeHtml(item.color)}">${sneakerSvg(item.color, item.accent, `cart${index}`)}</div><div class="cart-row-main"><h3>${escapeHtml(item.name)}</h3><small>UK ${item.size}</small><strong>${money(item.price * item.quantity)}</strong><div class="cart-qty"><button data-qty="-1" data-index="${index}" aria-label="Decrease quantity">−</button><span>${item.quantity}</span><button data-qty="1" data-index="${index}" aria-label="Increase quantity">+</button><button class="cart-remove" data-remove="${index}">Remove</button></div></div></div>`).join('') : '<div class="empty-state"><h3>Your bag is empty</h3><p>Find something that moves you.</p><a href="#shop" data-close>Shop sneakers →</a></div>';
  $('#cart-footer').innerHTML = state.cart.length ? `<div class="total-line"><span>Subtotal</span><span>${money(total)}</span></div><p class="hint">${total >= 1000000 ? 'You unlocked free shipping.' : `Add ${money(1000000 - total)} for free shipping.`} Taxes included. Cash on delivery only.</p><button id="checkout-button" class="full-button">CHECKOUT →</button>` : '';
  document.querySelectorAll('[data-qty]').forEach(button => button.addEventListener('click', () => { const item = state.cart[Number(button.dataset.index)]; const next = item.quantity + Number(button.dataset.qty); if (next > 0 && next <= Math.min(item.stock, 10)) item.quantity = next; renderCart(); saveCart(); }));
  document.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => { state.cart.splice(Number(button.dataset.remove), 1); renderCart(); saveCart(); }));
  $('#checkout-button')?.addEventListener('click', showCheckout);
  document.querySelectorAll('#cart-items [data-close]').forEach(a => a.addEventListener('click', closePanels));
}
function showAuth(mode = 'login') {
  const register = mode === 'register';
  showModal(`<span class="modal-kicker">WELCOME TO SOLESTREET</span><h2>${register ? 'Create your account.' : 'Good to see you again.'}</h2><p>${register ? 'Join the movement and keep track of your orders.' : 'Sign in to check out and follow your orders.'}</p><form id="auth-form">${register ? '<div class="field"><label for="auth-name">NAME</label><input id="auth-name" name="name" autocomplete="name" required minlength="2"></div>' : ''}<div class="field"><label for="auth-email">EMAIL</label><input id="auth-email" name="email" type="email" autocomplete="email" required></div><div class="field"><label for="auth-password">PASSWORD</label><input id="auth-password" name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" minlength="8" required></div><button class="full-button">${register ? 'CREATE ACCOUNT' : 'SIGN IN'}</button></form><p class="auth-switch">${register ? 'Already have an account?' : 'New here?'} <button id="switch-auth" class="link-button">${register ? 'Sign in' : 'Create account'}</button></p>`);
  $('#switch-auth').addEventListener('click', () => showAuth(register ? 'login' : 'register'));
  $('#auth-form').addEventListener('submit', async event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); try { state.user = (await api(register ? '/api/register' : '/api/login', { method: 'POST', body: JSON.stringify(data) })).user; closePanels(); toast(`Welcome, ${state.user.name}!`); updateAccountButton(); } catch (error) { toast(error.message); } });
}
function updateAccountButton() { $('#account-button').title = state.user ? `Account: ${state.user.name}` : 'Account'; }
function showCheckout() {
  closePanels(); if (!state.user) return showAuth();
  const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0), shipping = subtotal >= 1000000 ? 0 : 49900;
  showModal(`<span class="modal-kicker">ALMOST THERE</span><h2>Checkout</h2><p>Your order will be placed with cash on delivery. No card details are collected.</p><form id="checkout-form"><div class="form-grid"><div class="field"><label for="checkout-name">FULL NAME</label><input id="checkout-name" name="customerName" value="${escapeHtml(state.user.name)}" required></div><div class="field"><label for="checkout-city">CITY</label><input id="checkout-city" name="city" required></div></div><div class="field"><label for="checkout-address">ADDRESS</label><input id="checkout-address" name="address" required></div><div class="form-grid"><div class="field"><label for="checkout-postal">POSTAL CODE</label><input id="checkout-postal" name="postalCode" inputmode="numeric" pattern="[0-9]{5,6}" required></div><div class="field"><label for="checkout-payment">PAYMENT</label><select id="checkout-payment" name="paymentMethod"><option>Cash on delivery</option></select></div></div><p>Subtotal: ${money(subtotal)} &nbsp; · &nbsp; Shipping: ${money(shipping)}</p><button class="full-button">PLACE ORDER — ${money(subtotal + shipping)}</button></form>`);
  $('#checkout-form').addEventListener('submit', async event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); data.items = state.cart.map(({ productId, size, quantity }) => ({ productId, size, quantity })); try { const result = await api('/api/orders', { method: 'POST', body: JSON.stringify(data) }); state.cart = []; saveCart(); closePanels(); showModal(`<span class="modal-kicker">ORDER CONFIRMED</span><h2>You're on your way.</h2><p>Order #${result.orderId} has been placed. Total: ${money(result.total)}. Payment is due on delivery.</p><button id="view-orders" class="full-button">VIEW MY ORDERS</button>`); $('#view-orders').addEventListener('click', showOrders); loadProducts(); } catch (error) { toast(error.message); } });
}
async function showOrders() {
  if (!state.user) return showAuth();
  try { const { orders } = await api('/api/orders'); showModal(`<span class="modal-kicker">YOUR ACCOUNT</span><h2>My orders</h2><p>${escapeHtml(state.user.email)}</p>${orders.length ? orders.map(order => `<div class="order-card"><header><strong>Order #${order.id}</strong><span class="order-status">${escapeHtml(order.status)}</span></header><small>${escapeHtml(order.created_at)} · ${escapeHtml(order.city)}</small><p>${order.items.map(item => `${escapeHtml(item.product_name)} · UK ${item.size} × ${item.quantity}`).join('<br>')}</p><strong>${money(order.total)}</strong></div>`).join('') : '<p>No orders yet. Your next pair is waiting.</p>'}<button id="logout-button" class="link-button" style="margin-top:25px">Sign out</button>`); $('#logout-button').addEventListener('click', async () => { await api('/api/logout', { method: 'POST' }); state.user = null; updateAccountButton(); closePanels(); toast('Signed out'); }); } catch (error) { toast(error.message); }
}
async function showAccount() { if (!state.user) return showAuth(); if (state.user.role === 'admin') return showAdmin(); return showOrders(); }

async function showAdmin() {
  try {
    const summary = await api('/api/admin/summary');
    showModal(`<span class="modal-kicker">MANAGE THE SHOP</span><h2>Admin dashboard</h2><div class="summary-grid"><div class="summary-card"><strong>${summary.products}</strong><small>PRODUCTS</small></div><div class="summary-card"><strong>${summary.orders}</strong><small>ORDERS</small></div><div class="summary-card"><strong>${money(summary.revenue)}</strong><small>REVENUE</small></div><div class="summary-card"><strong>${summary.lowStock}</strong><small>LOW STOCK</small></div></div><div class="admin-tabs"><button data-admin-tab="products" class="active">Products</button><button data-admin-tab="orders">Orders</button><button data-admin-tab="add">Add product</button></div><div id="admin-content"></div><button id="admin-logout" class="link-button" style="margin-top:20px">Sign out</button>`);
    document.querySelectorAll('[data-admin-tab]').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('[data-admin-tab]').forEach(b => b.classList.toggle('active', b === button)); renderAdminTab(button.dataset.adminTab); }));
    $('#admin-logout').addEventListener('click', async () => { await api('/api/logout', { method: 'POST' }); state.user = null; closePanels(); updateAccountButton(); toast('Signed out'); });
    renderAdminTab('products');
  } catch (error) { toast(error.message); }
}
async function renderAdminTab(tab) {
  const target = $('#admin-content'); if (!target) return;
  try {
    if (tab === 'products') {
      const { products } = await api('/api/admin/products');
      target.innerHTML = `<div class="admin-list">${products.map(p => `<div class="admin-row"><span>${escapeHtml(p.name)} · ${money(p.price)} · ${p.stock} in stock ${p.active ? '' : '(hidden)'}</span><span><button data-edit="${p.id}">Edit</button><button data-delete="${p.id}">Hide</button></span></div>`).join('')}</div>`;
      document.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => showProductForm(products.find(p => p.id === Number(button.dataset.edit)))));
      document.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', async () => { if (!confirm('Hide this product from the storefront?')) return; try { await api(`/api/admin/products/${button.dataset.delete}`, { method: 'DELETE' }); await renderAdminTab('products'); loadProducts(); toast('Product hidden'); } catch (error) { toast(error.message); } }));
    } else if (tab === 'orders') {
      const { orders } = await api('/api/admin/orders');
      target.innerHTML = `<div class="admin-list">${orders.length ? orders.map(o => `<div class="admin-row"><span><strong>#${o.id}</strong> ${escapeHtml(o.customer_name)} · ${money(o.total)}<br><small>${o.items.map(i => `${escapeHtml(i.product_name)} × ${i.quantity}`).join(', ')}</small></span><select data-order-id="${o.id}">${['Placed','Packed','Shipped','Delivered','Cancelled'].map(status => `<option ${status === o.status ? 'selected' : ''}>${status}</option>`).join('')}</select></div>`).join('') : '<p>No orders yet.</p>'}</div>`;
      document.querySelectorAll('[data-order-id]').forEach(select => select.addEventListener('change', async () => { try { await api(`/api/admin/orders/${select.dataset.orderId}`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) }); toast('Order status updated'); } catch (error) { toast(error.message); } }));
    } else showProductForm();
  } catch (error) { target.innerHTML = `<p>${escapeHtml(error.message)}</p>`; }
}
function showProductForm(product = null) {
  const p = product || { name: '', description: '', category: 'Lifestyle', brand: '', price: 9999, stock: 10, badge: '', color: '#d5f54b', accent: '#333333' };
  $('#admin-content').innerHTML = `<form id="product-form"><div class="form-grid"><div class="field"><label>NAME</label><input name="name" required value="${escapeHtml(p.name)}"></div><div class="field"><label>BRAND</label><input name="brand" required value="${escapeHtml(p.brand)}"></div></div><div class="field"><label>DESCRIPTION</label><textarea name="description" required>${escapeHtml(p.description)}</textarea></div><div class="form-grid"><div class="field"><label>CATEGORY</label><select name="category">${['Running','Lifestyle','Basketball','Outdoor'].map(c => `<option ${p.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div><div class="field"><label>BADGE</label><input name="badge" value="${escapeHtml(p.badge)}"></div></div><div class="form-grid"><div class="field"><label>PRICE (RUPEES)</label><input name="rupees" type="number" min="1" step="0.01" required value="${(p.price / 100).toFixed(2)}"></div><div class="field"><label>STOCK</label><input name="stock" type="number" min="0" required value="${p.stock}"></div></div><div class="form-grid"><div class="field"><label>BACKGROUND COLOR</label><input name="color" type="color" value="${escapeHtml(p.color)}"></div><div class="field"><label>ACCENT COLOR</label><input name="accent" type="color" value="${escapeHtml(p.accent)}"></div></div><button class="full-button">${product ? 'SAVE CHANGES' : 'ADD PRODUCT'}</button></form>`;
  $('#product-form').addEventListener('submit', async event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); data.price = Math.round(Number(data.rupees) * 100); delete data.rupees; data.stock = Number(data.stock); try { await api(product ? `/api/admin/products/${product.id}` : '/api/admin/products', { method: product ? 'PUT' : 'POST', body: JSON.stringify(data) }); toast(product ? 'Product updated' : 'Product added'); renderAdminTab('products'); loadProducts(); } catch (error) { toast(error.message); } });
}

function wireEvents() {
  $('#hero-sneaker').innerHTML = sneakerSvg('#e4f487', '#304617', 'hero');
  $('#cart-button').addEventListener('click', () => { renderCart(); openPanel('#cart-drawer'); });
  $('#account-button').addEventListener('click', showAccount);
  $('#footer-orders').addEventListener('click', event => { event.preventDefault(); showOrders(); });
  $('#overlay').addEventListener('click', closePanels);
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', closePanels));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closePanels(); });
  document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => { state.category = button.dataset.category; document.querySelectorAll('[data-category]').forEach(b => b.classList.toggle('active', b === button)); loadProducts(); }));
  document.querySelectorAll('[data-category-link]').forEach(link => link.addEventListener('click', () => { const button = document.querySelector(`[data-category="${link.dataset.categoryLink}"]`); button?.click(); }));
  let searchTimer; $('#search-input').addEventListener('input', event => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.query = event.target.value; loadProducts(); }, 220); });
  $('#sort-select').addEventListener('change', event => { state.sort = event.target.value; loadProducts(); });
}
wireEvents(); updateCartCount(); loadProducts(); api('/api/me').then(({ user }) => { state.user = user; updateAccountButton(); }).catch(() => {});

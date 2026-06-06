/* ═══════════════════════════════════════════════
   Tiendita POS v1 — Don Fran
   Lógica de aplicación (extraída del monolito)
   + sanitización XSS (esc)
   + autenticación por PIN
   ═══════════════════════════════════════════════ */

// ── HTML entity escaping (XSS prevention) ──
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ═══════════════════════════════════════════════
// PIN AUTHENTICATION
// ═══════════════════════════════════════════════

const PIN_USERS = {
  '31468': 'Alejandro',
  '31001': 'Axel',
  '00000': 'Blanca',
  '9999': 'Willian'
};

let pinEntered = '';
let loggedUser = null;

function initPinScreen() {
  // Build PIN screen dynamically
  var ps = document.getElementById('pin-screen');
  if (!ps) return;
  ps.innerHTML =
    '<div class="pin-card">' +
      '<div class="pin-title">Tienda de Don Fran</div>' +
      '<div class="pin-subtitle">Ingrese su PIN para acceder</div>' +
      '<div class="pin-dots" id="pin-dots">' +
        '<span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="dot"></span>' +
      '</div>' +
      '<div class="pin-msg" id="pin-msg"></div>' +
      '<div class="pin-numpad">' +
        '<button onclick="pinPress(\'1\')">1</button>' +
        '<button onclick="pinPress(\'2\')">2</button>' +
        '<button onclick="pinPress(\'3\')">3</button>' +
        '<button onclick="pinPress(\'4\')">4</button>' +
        '<button onclick="pinPress(\'5\')">5</button>' +
        '<button onclick="pinPress(\'6\')">6</button>' +
        '<button onclick="pinPress(\'7\')">7</button>' +
        '<button onclick="pinPress(\'8\')">8</button>' +
        '<button onclick="pinPress(\'9\')">9</button>' +
        '<button class="pin-empty"></button>' +
        '<button onclick="pinPress(\'0\')">0</button>' +
        '<button class="pin-back" onclick="pinBack()">⌫</button>' +
      '</div>' +
    '</div>';
}

function pinPress(digit) {
  if (pinEntered.length >= 5) return;
  pinEntered += digit;
  updatePinDots();
  // Auto-validate at 4 digits only if it matches a known 4-digit PIN
  if (pinEntered.length === 4 && PIN_USERS[pinEntered]) {
    setTimeout(function() { validatePin(); }, 150);
    return;
  }
  // Auto-validate at 5 digits (all other users)
  if (pinEntered.length === 5) {
    setTimeout(function() { validatePin(); }, 150);
  }
}

function pinBack() {
  pinEntered = pinEntered.slice(0, -1);
  updatePinDots();
  var msg = document.getElementById('pin-msg');
  if (msg) msg.className = 'pin-msg';
  if (msg) msg.textContent = '';
}

function updatePinDots() {
  var dots = document.querySelectorAll('#pin-dots .dot');
  for (var i = 0; i < dots.length; i++) {
    dots[i].className = 'dot' + (i < pinEntered.length ? ' filled' : '');
  }
}

function validatePin() {
  var user = PIN_USERS[pinEntered];
  var msg = document.getElementById('pin-msg');
  if (user) {
    loggedUser = user;
    try { sessionStorage.setItem('tiendita_user', user); } catch(e) {}
    try { sessionStorage.setItem('tiendita_pin', pinEntered); } catch(e) {}
    // Success — hide PIN screen
    var ps = document.getElementById('pin-screen');
    if (ps) ps.classList.add('hidden');
    // Show main app
    var app = document.getElementById('app-main');
    if (app) app.style.display = '';
    // Update user badge
    updateUserBadge();
    // Trigger initial data load if not already loaded
    if (products.length === 0) {
      initialLoad();
    }
  } else {
    // Wrong PIN — shake + clear
    if (msg) { msg.textContent = 'PIN incorrecto'; msg.className = 'pin-msg error'; }
    var dots = document.querySelectorAll('#pin-dots .dot');
    for (var i = 0; i < dots.length; i++) {
      dots[i].className = 'dot wrong';
    }
    pinEntered = '';
    setTimeout(function() {
      updatePinDots();
      if (msg) msg.className = 'pin-msg';
    }, 500);
  }
}

function updateUserBadge() {
  var badge = document.getElementById('user-badge-name');
  var container = document.getElementById('user-badge');
  if (badge && loggedUser) {
    badge.textContent = esc(loggedUser);
    if (container) container.style.display = 'flex';
  }
}

function lockScreen() {
  loggedUser = null;
  pinEntered = '';
  try { sessionStorage.removeItem('tiendita_user'); } catch(e) {}
  try { sessionStorage.removeItem('tiendita_pin'); } catch(e) {}
  var ps = document.getElementById('pin-screen');
  if (ps) ps.classList.remove('hidden');
  var app = document.getElementById('app-main');
  if (app) app.style.display = 'none';
  updatePinDots();
  var msg = document.getElementById('pin-msg');
  if (msg) { msg.textContent = ''; msg.className = 'pin-msg'; }
}

// Check for existing session on load
function checkSession() {
  try {
    var u = sessionStorage.getItem('tiendita_user');
    var p = sessionStorage.getItem('tiendita_pin');
    if (u && p && PIN_USERS[p] === u) {
      loggedUser = u;
      pinEntered = p;
      var ps = document.getElementById('pin-screen');
      if (ps) ps.classList.add('hidden');
      var app = document.getElementById('app-main');
      if (app) app.style.display = '';
      updateUserBadge();
      return true;
    }
  } catch(e) {}
  return false;
}

// ═══════════════════════════════════════════════
// GLOBAL ERROR HANDLER
// ═══════════════════════════════════════════════

window.onerror = function(msg, url, line) {
    var errDiv = document.createElement('div');
    errDiv.id = 'hermes-error';
    errDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;padding:12px;font-family:monospace;background:#1a1d28;color:#ef4444;font-size:14px;border-bottom:3px solid #ef4444';
    errDiv.innerHTML = '🔥 <b>ERROR:</b> ' + esc(msg) + ' (línea ' + line + ')';
    document.body.prepend(errDiv);
    return true;
};

// ═══════════════════════════════════════════════
// AUDIO (Web Audio API)
// ═══════════════════════════════════════════════

var audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playSound(name) {
  try {
    var ctx = getAudioCtx();
    var now = ctx.currentTime;
    if (name === 'click') {
      var o = ctx.createOscillator(); var g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 1500;
      g.gain.setValueAtTime(0.08, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      o.connect(g); g.connect(ctx.destination); o.start(now); o.stop(now + 0.04);
    } else if (name === 'add') {
      var o = ctx.createOscillator(); var g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(600, now); o.frequency.exponentialRampToValueAtTime(1200, now + 0.06);
      g.gain.setValueAtTime(0.12, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      o.connect(g); g.connect(ctx.destination); o.start(now); o.stop(now + 0.1);
    } else if (name === 'success') {
      [800, 1200].forEach(function(freq, i) {
        var o = ctx.createOscillator(); var g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = freq;
        var t = now + i * 0.12;
        g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.15);
      });
    } else if (name === 'error') {
      var o = ctx.createOscillator(); var g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = 180;
      g.gain.setValueAtTime(0.08, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      o.connect(g); g.connect(ctx.destination); o.start(now); o.stop(now + 0.2);
    }
  } catch(e) {}
}

// ═══════════════════════════════════════════════
// STATE & CONSTANTS
// ═══════════════════════════════════════════════

var TABS = ['venta', 'catalogo', 'inventario', 'caja', 'prestamos', 'reportes'];
var TAB_LABELS = ['Venta', 'Catálogo', 'Inventario', 'Caja', 'Préstamos', 'Reportes'];
var products = [], cart = [], paymentMode = 'cash', enteredStr = '', editingId = null, cashType = 'income';
var customers = [], selectedCustomer = null, txnType = 'loan';

function fmoney(n) { return 'L ' + Number(n).toFixed(2); }

// ── Product icon: colored circle with initial ──
function productIcon(name, category) {
  var initial = (name || '?')[0].toUpperCase();
  var hue = 0;
  if (category) {
    for (var i = 0; i < category.length; i++) {
      hue = (hue * 31 + category.charCodeAt(i)) % 360;
    }
  }
  return '<span class="prod-icon" style="background:hsl(' + hue + ',40%,52%)">' + esc(initial) + '</span>';
}

// ═══════════════════════════════════════════════
// NAVIGATION & THEME
// ═══════════════════════════════════════════════

function buildNav() {
  document.getElementById('main-nav').innerHTML = TABS.map(function(t, i) {
    return '<button class="' + (i === 0 ? 'active' : '') + '" onclick="switchTab(\'' + t + '\')">' + TAB_LABELS[i] + '</button>';
  }).join('');
}

var darkMode = false;
try { darkMode = localStorage.getItem('dark') === '1'; } catch(e) {}

function toggleTheme() {
  darkMode = !darkMode;
  try { localStorage.setItem('dark', darkMode ? '1' : '0'); } catch(e) {}
  document.body.classList.toggle('dark', darkMode);
  var tl = document.querySelector('.tt-label');
  if (tl) tl.textContent = darkMode ? 'Oscuro' : 'Claro';
}
if (darkMode) document.body.classList.add('dark');
var tl = document.querySelector('.tt-label');
if (tl) tl.textContent = darkMode ? 'Oscuro' : 'Claro';

function switchTab(tab) {
  document.querySelectorAll('nav button').forEach(function(b, i) { b.classList.toggle('active', TABS[i] === tab); });
  document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
  document.getElementById('panel-' + tab).classList.add('active');
  if (tab === 'venta') renderCatalogGrid();
  if (tab === 'catalogo') renderCatalogFull();
  if (tab === 'inventario') renderInventory();
  if (tab === 'caja') renderCash();
  if (tab === 'prestamos') renderLoans();
  if (tab === 'reportes') renderReports();
}

// ═══════════════════════════════════════════════
// API HELPER
// ═══════════════════════════════════════════════

function api(u, o) {
  if (!o) o = {};
  return fetch(u, Object.assign({ headers: { 'Content-Type': 'application/json' } }, o))
    .then(function(r) {
      return r.headers.get('content-type') && r.headers.get('content-type').indexOf('json') !== -1 ? r.json() : r.text();
    });
}

// ═══════════════════════════════════════════════
// AUTO-EMOJI
// ═══════════════════════════════════════════════

function suggestEmoji(name) {
  if (!name || name.length < 2) return;
  var el = document.getElementById('mf-emoji');
  if (!el || (el.value && el.value !== '🤔')) return;
  el.value = '🤔';
  api('/api/suggest-emoji?name=' + encodeURIComponent(name)).then(function(r) {
    el.value = r.emoji || '📦';
  }).catch(function(e) {});
}

// ═══════════════════════════════════════════════
// VENTA — Catalog & Cart
// ═══════════════════════════════════════════════

function addToCart(pid) {
  var p = products.find(function(x) { return x.id === pid; });
  if (!p || p.stock <= 0) return;
  var ex = cart.find(function(i) { return i.id === pid; });
  if (ex) {
    if (ex.qty >= p.stock) return;
    ex.qty++;
  } else {
    cart.push({ id: pid, name: p.name, price: p.price, qty: 1, maxStock: p.stock });
  }
  playSound('add');
  renderCart();
}

function updateQty(pid, d) {
  var i = cart.find(function(x) { return x.id === pid; });
  if (!i) return;
  i.qty += d;
  if (i.qty <= 0) cart = cart.filter(function(x) { return x.id !== pid; });
  if (i.qty > i.maxStock) i.qty = i.maxStock;
  playSound('click');
  renderCart();
}

function clearCart() { cart = []; renderCart(); }

function renderCatalogGrid() {
  var q = (document.getElementById('venta-search') && document.getElementById('venta-search').value || '').toLowerCase();
  var filtered = q ? products.filter(function(p) { return p.name.toLowerCase().indexOf(q) !== -1; }) : products;
  document.getElementById('venta-grid').innerHTML = filtered.map(function(p) {
    return '<div class="product-card ' + (p.stock <= 0 ? 'out' : '') + '" onpointerdown="addToCart(\'' + p.id + '\')">' +
      productIcon(p.name, p.category) +
      '<div class="name">' + esc(p.name) + '</div>' +
      '<div class="price">' + fmoney(p.price) + '</div>' +
      '<div class="stock ' + (p.stock <= 5 ? 'low-stock' : '') + '">' + (p.stock > 0 ? p.stock + ' disp.' : 'Agotado') + '</div>' +
    '</div>';
  }).join('');
}

function renderCart() {
  var subtotal = cart.reduce(function(s, i) { return s + i.price * i.qty; }, 0);
  var discount = parseFloat((document.getElementById('cart-discount') && document.getElementById('cart-discount').value) || 0) || 0;
  var total = Math.max(0, subtotal - discount);
  document.getElementById('cart-side').innerHTML =
    '<div class="cart-top">Carrito</div>' +
    '<div class="cart-list">' +
      (cart.length === 0
        ? '<div class="empty-cart">Aún no hay productos en el carrito.</div>'
        : cart.map(function(i) {
            return '<div class="cart-item">' +
              '<span class="ci-name">' + esc(i.name) + '</span>' +
              '<div class="ci-qty">' +
                '<button onpointerdown="updateQty(\'' + i.id + '\',-1)">−</button>' +
                '<span>' + i.qty + '</span>' +
                '<button onpointerdown="updateQty(\'' + i.id + '\',1)">+</button>' +
              '</div>' +
              '<span class="ci-sub">' + fmoney(i.price * i.qty) + '</span>' +
            '</div>';
          }).join('')) +
    '</div>' +
    '<div class="cart-bottom">' +
      (cart.length > 0
        ? '<div class="cart-total-row"><span class="lbl">Subtotal</span><span class="amt" style="font-size:0.95rem">' + fmoney(subtotal) + '</span></div>' +
          '<div class="payment-detail" style="margin-bottom:6px"><label>Descuento (L)</label><input type="number" id="cart-discount" value="' + (discount || '') + '" placeholder="0.00" step="0.01" min="0" oninput="renderCart()" style="text-align:right"></div>' +
          '<div class="cart-total-row"><span class="lbl">Total</span><span class="amt">' + fmoney(total) + '</span></div>' +
          '<button class="btn-pagar" onclick="showPayment()" ' + (cart.length === 0 ? 'disabled' : '') + '>Pagar L' + total.toFixed(2) + '</button>'
        : '') +
    '</div>';
}

function showPayment() {
  var subtotal = cart.reduce(function(s, i) { return s + i.price * i.qty; }, 0);
  var discount = parseFloat((document.getElementById('cart-discount') && document.getElementById('cart-discount').value) || 0) || 0;
  var total = Math.max(0, subtotal - discount);
  document.getElementById('cart-side').innerHTML =
    '<div class="cart-top" style="display:flex;justify-content:space-between;align-items:center">' +
      '<span>Cobrar</span>' +
      '<button class="np-fn" style="background:none;border:none;font-size:0.85rem;font-weight:600;color:var(--muted);cursor:pointer" onclick="renderCart()">← Volver</button>' +
    '</div>' +
    '<div class="cart-list" style="display:flex;flex-direction:column;justify-content:center;padding:12px">' +
      '<div style="text-align:center;margin-bottom:12px">' +
        '<div style="font-size:0.8rem;color:var(--muted)">Total a cobrar</div>' +
        '<div style="font-size:2rem;font-weight:800;color:var(--blue)">' + fmoney(total) + '</div>' +
      '</div>' +
      '<div class="payment-toggle">' +
        '<button class="' + (paymentMode === 'cash' ? 'active' : '') + '" onclick="paymentMode=\'cash\';showPayment()">Efectivo</button>' +
        '<button class="' + (paymentMode === 'credit' ? 'active' : '') + '" onclick="paymentMode=\'credit\';showPayment()">A cuenta</button>' +
      '</div>' +
      (paymentMode === 'cash'
        ? '<div class="payment-detail"><label>Efectivo recibido</label><input type="text" value="' + (enteredStr || '0.00') + '" readonly style="text-align:center;font-size:1.2rem;font-weight:700;padding:10px"></div>' +
          '<div class="payment-detail" style="text-align:center"><span class="change ' + (Number(enteredStr || 0) >= total ? 'positive' : 'negative') + '" style="font-size:0.95rem">Vuelto: ' + (Number(enteredStr || 0) >= total ? fmoney(Number(enteredStr) - total) : '0.00') + '</span></div>' +
          '<div class="numpad">' +
            '<button onclick="np(\'7\')">7</button><button onclick="np(\'8\')">8</button><button onclick="np(\'9\')">9</button><button class="np-fn" onclick="npBack()">⌫</button>' +
            '<button onclick="np(\'4\')">4</button><button onclick="np(\'5\')">5</button><button onclick="np(\'6\')">6</button><button class="np-fn" onclick="enteredStr=\'\';showPayment()">C</button>' +
            '<button onclick="np(\'1\')">1</button><button onclick="np(\'2\')">2</button><button onclick="np(\'3\')">3</button><button onclick="np(\'00\')">00</button>' +
            '<button onclick="np(\'0\')">0</button><button onclick="np(\'.\')">.</button><button class="np-fn" onclick="enteredStr=enteredStr.slice(0,-1)">←</button>' +
            '<button class="btn-cobrar" onclick="doSale()" ' + (Number(enteredStr || 0) < total ? 'disabled' : '') + '>Cobrar L' + total.toFixed(2) + '</button>' +
          '</div>'
        : '<div class="payment-detail"><label>Cliente</label><select id="credit-customer">' +
            customers.map(function(c) {
              return '<option value="' + c.id + '">' + esc(c.name) + ' (debe ' + fmoney(c.balance) + ')</option>';
            }).join('') +
          '</select></div>' +
          '<button class="btn-registrar" onclick="doLoanSale()">Registrar a cuenta</button>') +
    '</div>';
}

function np(n) { enteredStr += n; playSound('click'); showPayment(); }
function npBack() { enteredStr = enteredStr.slice(0, -1); showPayment(); }

function doSale() {
  var subtotal = cart.reduce(function(s, i) { return s + i.price * i.qty; }, 0);
  var discount = parseFloat((document.getElementById('cart-discount') && document.getElementById('cart-discount').value) || 0) || 0;
  var total = Math.max(0, subtotal - discount);
  var received = parseFloat(enteredStr) || 0;
  if (received < total || cart.length === 0) return;
  api('/api/sales', { method: 'POST', body: JSON.stringify({ items: cart.map(function(i) { return { id: i.id, qty: i.qty }; }), subtotal: subtotal, discount: discount, total: total, payment: 'cash', change_given: received - total }) });
  cart = []; enteredStr = ''; renderCart(); refreshAll(); playSound('success'); toast('Venta realizada');
}

function doLoanSale() {
  var cid = (document.getElementById('credit-customer') && document.getElementById('credit-customer').value);
  var subtotal = cart.reduce(function(s, i) { return s + i.price * i.qty; }, 0);
  var discount = parseFloat((document.getElementById('cart-discount') && document.getElementById('cart-discount').value) || 0) || 0;
  var total = Math.max(0, subtotal - discount);
  if (!cid || cart.length === 0) return;
  api('/api/customers/' + cid + '/transactions', { method: 'POST', body: JSON.stringify({ type: 'loan', amount: total, description: 'Compra en tienda' + (discount > 0 ? ' (desc. L' + discount + ')' : '') }) });
  api('/api/sales', { method: 'POST', body: JSON.stringify({ items: cart.map(function(i) { return { id: i.id, qty: i.qty }; }), subtotal: subtotal, discount: discount, total: total, payment: 'credit', customer_id: cid }) });
  cart = []; enteredStr = ''; renderCart(); refreshAll(); toast('Registrado a cuenta');
}

// ═══════════════════════════════════════════════
// CATÁLOGO (vista full)
// ═══════════════════════════════════════════════

function renderCatalogFull() {
  var searchVal = (document.getElementById('cat-search') && document.getElementById('cat-search').value || '').toLowerCase();
  document.getElementById('panel-catalogo').innerHTML =
    '<div class="scroll-panel">' +
      '<div class="panel-header"><h2>📋 Catálogo</h2></div>' +
      '<div class="catalog-search"><input type="search" placeholder="Buscar..." oninput="renderCatalogFull()" id="cat-search"></div>' +
      '<div class="cat-grid" style="margin-top:12px">' +
        products.filter(function(p) {
          return !searchVal || p.name.toLowerCase().indexOf(searchVal) !== -1;
        }).map(function(p) {
          return '<div class="cat-card">' +
            productIcon(p.name, p.category) +
            '<div class="name">' + esc(p.name) + '</div>' +
            '<div class="price">' + fmoney(p.price) + '</div>' +
            '<div class="stock ' + (p.stock <= 5 ? 'low-stock' : '') + '">Stock: ' + p.stock + '</div>' +
            '<div class="profit">Ganancia: ' + fmoney(p.price - (p.cost || 0)) + '</div>' +
          '</div>';
        }).join('') +
      '</div>' +
    '</div>';
}

// ═══════════════════════════════════════════════
// INVENTARIO
// ═══════════════════════════════════════════════

function renderInventory() {
  document.getElementById('panel-inventario').innerHTML =
    '<div class="scroll-panel">' +
      '<div class="panel-header"><h2>📦 Inventario</h2><button class="btn btn-primary btn-sm" onclick="openProductModal()">+ Nuevo</button></div>' +
      '<table class="inv-table"><thead><tr><th>Producto</th><th>Precio</th><th>Costo</th><th>Stock</th><th>Cat.</th><th></th></tr></thead><tbody>' +
        products.map(function(p) {
          return '<tr>' +
            '<td>' + productIcon(p.name, p.category) + ' ' + esc(p.name) + '</td>' +
            '<td>' + fmoney(p.price) + '</td>' +
            '<td>' + fmoney(p.cost || 0) + '</td>' +
            '<td class="' + (p.stock <= 5 ? 'low-stock' : '') + '">' + p.stock + '</td>' +
            '<td>' + esc(p.category || '-') + '</td>' +
            '<td style="white-space:nowrap">' +
              '<button class="act-btn" onclick="editProduct(\'' + p.id + '\')">Editar</button>' +
              '<button class="act-btn" onclick="deleteProduct(\'' + p.id + '\')">Eliminar</button>' +
              '<button class="act-btn" onclick="optimizeProductPrice(\'' + p.id + '\')" title="Optimizar precio" style="background:#fef3c7;color:#b45309">Optimizar</button>' +
            '</td>' +
          '</tr>';
        }).join('') +
      '</tbody></table>' +
    '</div>';
}

// ═══════════════════════════════════════════════
// CAJA
// ═══════════════════════════════════════════════

function renderCash() {
  api('/api/cash').then(function(data) {
    return api('/api/stats').then(function(stats) {
      var rows = data.rows || [];
      document.getElementById('panel-caja').innerHTML =
        '<div class="scroll-panel">' +
          '<div class="panel-header"><h2>Caja</h2><button class="btn btn-sm" style="background:var(--gold);color:#000" onclick="openCashModal(\'adjust\')">Ajustar saldo</button></div>' +
          '<div class="cash-balance"><div class="amount">' + fmoney(stats.cashBalance || 0) + '</div><div class="label">Saldo actual</div></div>' +
          '<div class="cash-actions"><button class="btn-income" onclick="openCashModal(\'income\')">+ Ingreso</button><button class="btn-expense" onclick="openCashModal(\'expense\')">− Egreso</button></div>' +
          '<div>' + rows.map(function(r) {
            return '<div class="cash-row">' +
              '<span>' + esc(r.description || r.type) + ' <small>' + esc(r.created_at) + '</small></span>' +
              '<span class="cr-amt ' + r.type + '">' + (r.type === 'income' ? '+' : '-') + ' ' + fmoney(r.amount) + '</span>' +
            '</div>';
          }).join('') + '</div>' +
        '</div>';
    });
  });
}

function openCashModal(type) {
  cashType = type;
  var titles = { 'income': 'Ingreso', 'expense': 'Egreso', 'adjust': 'Ajustar saldo' };
  document.getElementById('cash-modal-title').textContent = titles[type] || 'Movimiento';
  document.getElementById('cash-amount').value = '';
  document.getElementById('cash-desc').value = type === 'adjust' ? 'Ajuste manual de saldo' : '';
  document.getElementById('modal-cash').classList.add('show');
}
function saveCash() {
  var a = parseFloat(document.getElementById('cash-amount').value);
  var d = document.getElementById('cash-desc').value;
  if (isNaN(a)) return;
  var body = { type: cashType === 'adjust' ? 'adjust' : cashType, amount: a, description: d };
  api('/api/cash' + (cashType === 'adjust' ? '/adjust' : ''), { method: 'POST', body: JSON.stringify(body) });
  closeModal('modal-cash'); renderCash(); refreshAll();
  toast(cashType === 'adjust' ? 'Saldo ajustado' : 'Movimiento registrado');
}

// ═══════════════════════════════════════════════
// PRÉSTAMOS / FIADOS
// ═══════════════════════════════════════════════

function renderLoans() {
  api('/api/customers').then(function(data) {
    customers = data;
    document.getElementById('panel-prestamos').innerHTML =
      '<div class="scroll-panel">' +
        '<div class="panel-header"><h2>Préstamos / Fiados</h2><button class="btn btn-primary btn-sm" onclick="openCustomerModal()">+ Nuevo Cliente</button></div>' +
        '<div class="loan-clients">' +
          customers.map(function(c) {
            return '<div class="client-card ' + (selectedCustomer === c.id ? 'selected' : '') + '" onclick="selectCustomer(\'' + c.id + '\')">' +
              '<div class="cc-top">' +
                '<span class="cc-name">' + esc(c.name) + '</span>' +
                '<span class="cc-balance ' + (c.balance > 0 ? 'owes' : 'clear') + '">' + (c.balance > 0 ? 'Debe ' + fmoney(c.balance) : 'Al día') + '</span>' +
              '</div>' +
              '<div class="cc-phone">' + esc(c.phone || 'Sin teléfono') + '</div>' +
            '</div>';
          }).join('') +
        '</div>' +
        '<div id="customer-detail"></div>' +
      '</div>';
  });
}

function selectCustomer(cid) {
  selectedCustomer = cid;
  var c = customers.find(function(x) { return x.id === cid; });
  if (!c) return;
  // Mark selected card without full re-render
  document.querySelectorAll('.client-card').forEach(function(el) { el.classList.remove('selected'); });
  var selCard = document.querySelector('.client-card[onclick*="' + cid + '"]');
  if (selCard) selCard.classList.add('selected');

  api('/api/customers/' + cid + '/transactions').then(function(data) {
    var txns = data.transactions || [];
    var cust = data.customer || c;
    document.getElementById('customer-detail').innerHTML =
      '<div class="client-transactions">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<h3>' + esc(cust.name) + ' &mdash; ' + (cust.balance > 0 ? 'Debe ' + fmoney(cust.balance) : 'Al día') + '</h3>' +
          '<button class="btn btn-ghost btn-sm" onclick="deleteCustomer(\'' + cid + '\')">Eliminar</button>' +
        '</div>' +
        '<div class="client-actions">' +
          '<button class="btn-setdebt" onclick="openTxnModal(\'' + cid + '\',\'set_debt\')">Colocar deuda</button>' +
          '<button class="btn-payment" onclick="openTxnModal(\'' + cid + '\',\'payment\')">Abono a Deuda</button>' +
          '<button class="btn-adddebt" onclick="openTxnModal(\'' + cid + '\',\'add_debt\')">Sumar Deuda</button>' +
        '</div>' +
        (txns.length === 0
          ? '<div class="empty-state" style="padding:20px">Sin movimientos</div>'
          : txns.map(function(t) {
              return '<div class="txn-row">' +
                '<span class="txn-type ' + t.type + '">' +
                  (t.type === 'loan' ? 'Fiado' : t.type === 'payment' ? 'Abono' : 'Retiro') + ' ' + esc(t.description) +
                '</span>' +
                '<span class="txn-amt">' + (t.type === 'payment' ? '−' : '+') + ' ' + fmoney(t.amount) + '</span>' +
                '<span class="txn-time">' + esc(t.created_at) + '</span>' +
              '</div>';
            }).join('')) +
      '</div>';
  });
}

function openCustomerModal(id) {
  editingId = id;
  document.getElementById('cust-modal-title').textContent = id ? 'Editar Cliente' : 'Nuevo Cliente';
  if (id) {
    var c = customers.find(function(x) { return x.id === id; });
    document.getElementById('cust-name').value = c.name;
    document.getElementById('cust-phone').value = c.phone || '';
  } else {
    ['cust-name', 'cust-phone'].forEach(function(f) { document.getElementById(f).value = ''; });
  }
  document.getElementById('modal-customer').classList.add('show');
}

function saveCustomer() {
  var d = { name: document.getElementById('cust-name').value, phone: document.getElementById('cust-phone').value };
  if (!d.name) return;
  if (editingId) {
    api('/api/customers/' + editingId, { method: 'PUT', body: JSON.stringify(d) });
  } else {
    api('/api/customers', { method: 'POST', body: JSON.stringify(d) });
  }
  closeModal('modal-customer'); renderLoans(); refreshAll();
}

function deleteCustomer(id) {
  if (!confirm('¿Eliminar cliente y todo su historial?')) return;
  api('/api/customers/' + id, { method: 'DELETE' });
  selectedCustomer = null; renderLoans(); refreshAll();
}

function openTxnModal(cid, type) {
  txnType = type; selectedCustomer = cid;
  var titles = { set_debt: 'Colocar Deuda', payment: 'Abono a Deuda', add_debt: 'Sumar Deuda' };
  document.getElementById('txn-title').textContent = titles[type];
  var descs = { set_debt: 'Deuda inicial/actualización', payment: 'Abono del cliente', add_debt: 'Vale retirado en efectivo' };
  document.getElementById('txn-amount').value = '';
  document.getElementById('txn-desc').value = descs[type] || '';
  document.getElementById('modal-txn').classList.add('show');
}
function saveTransaction() {
  var amount = parseFloat(document.getElementById('txn-amount').value);
  var desc = document.getElementById('txn-desc').value;
  if (!amount || !selectedCustomer) return;
  api('/api/customers/' + selectedCustomer + '/transactions', { method: 'POST', body: JSON.stringify({ type: txnType, amount: amount, description: desc }) });
  closeModal('modal-txn'); selectCustomer(selectedCustomer); refreshAll();
  var msgs = { set_debt: 'Deuda actualizada', payment: 'Abono registrado', add_debt: 'Deuda aumentada' };
  toast(msgs[txnType]);
}

// ═══════════════════════════════════════════════
// REPORTES
// ═══════════════════════════════════════════════

function renderReports() {
  api('/api/stats').then(function(stats) {
    return api('/api/reports/top').then(function(top) {
      var maxQty = (top[0] && top[0].qty) || 1;
      document.getElementById('panel-reportes').innerHTML =
        '<div class="scroll-panel">' +

        '<!-- Resumen Hoy -->' +
        '<div class="report-card"><h3>Resumen Hoy</h3>' +
          '<div class="report-row"><span>Ventas</span><span class="rr-amt">' + stats.today.count + '</span></div>' +
          '<div class="report-row"><span>Total</span><span class="rr-amt" style="color:var(--green)">' + fmoney(stats.today.total) + '</span></div>' +
          '<div class="report-row"><span>Fiados pendientes</span><span class="rr-amt" style="color:var(--gold)">' + fmoney(stats.totalLoans.total) + ' (' + stats.totalLoans.count + ')</span></div>' +
          '<div class="report-row"><span>Saldo caja</span><span class="rr-amt">' + fmoney(stats.cashBalance || 0) + '</span></div>' +
        '</div>' +

        '<!-- PDF -->' +
        '<div class="report-card"><h3>Reporte Diario para Imprimir</h3><a href="/api/pdf/reporte-diario" target="_blank"><button class="btn btn-primary" style="width:100%;padding:14px;font-size:1rem">Venta Blanquita &mdash; PDF letra grande para imprimir</button></a><p style="font-size:0.7rem;color:var(--muted);margin-top:6px">PDF tamaño carta. Imprímalo para que la persona del turno anote con palitos (||||) las ventas manualmente.</p></div>' +

        '<!-- Más vendidos -->' +
        '<div class="report-card"><h3>Más vendidos mes</h3>' +
          top.slice(0, 8).map(function(t) {
            return '<div class="report-row">' +
              '<span>' + esc(t.name) + '</span>' +
              '<div class="rr-bar"><div class="fill" style="width:' + ((t.qty / maxQty * 100).toFixed(0)) + '%"></div></div>' +
              '<span class="rr-amt">' + t.qty + ' uds.</span>' +
            '</div>';
          }).join('') +
        '</div>' +

        '<!-- Total del mes -->' +
        '<div class="report-card"><h3>Total del mes</h3><div style="text-align:center;font-size:2rem;font-weight:800;color:var(--green)">' + fmoney(stats.month.total) + '</div></div>' +

        '<!-- Semanal -->' +
        '<div class="report-card"><h3>Esta Semana</h3><div id="weekly-box"><button class="btn btn-sm btn-primary" style="width:100%" onclick="loadWeekly()">Ver semana</button></div></div>' +

        '<!-- Categorías -->' +
        '<div class="report-card"><h3>Ventas por Categoría</h3><div id="categories-box"><button class="btn btn-sm btn-primary" style="width:100%" onclick="loadCategories()">Ver categorías</button></div></div>' +

        '<!-- Ganancias -->' +
        '<div class="report-card"><h3>Ganancias del Mes</h3><div id="profit-box"><button class="btn btn-sm btn-primary" style="width:100%" onclick="loadProfit()">Calcular ganancias</button></div></div>' +

        '<!-- Deudores -->' +
        '<div class="report-card"><h3>Clientes con deuda</h3>' +
          (customers.filter(function(c) { return c.balance > 0; }).map(function(c) {
            return '<div class="report-row"><span>' + esc(c.name) + '</span><span class="rr-amt" style="color:var(--red)">' + fmoney(c.balance) + '</span></div>';
          }).join('') || '<div class="empty-state" style="padding:10px">Sin deudas pendientes</div>') +
        '</div>' +
      '</div>';
    });
  });
}

function loadWeekly() {
  var el = document.getElementById('weekly-box'); if (!el) return;
  el.innerHTML = 'Cargando...';
  api('/api/reports/weekly').then(function(r) {
    el.innerHTML =
      '<div style="text-align:center;font-size:1.5rem;font-weight:800;color:var(--green);margin-bottom:8px">' + fmoney(r.weekTotal) + '</div>' +
      r.days.map(function(d) {
        return '<div class="report-row"><span>' + esc(d.day) + '</span><span class="rr-amt">' + d.cnt + ' ventas</span><span class="rr-amt">' + fmoney(d.total) + '</span></div>';
      }).join('') +
      (r.paymentBreakdown && r.paymentBreakdown.length
        ? '<div style="margin-top:8px;font-size:0.75rem;color:var(--muted)">' +
            r.paymentBreakdown.map(function(p) {
              return (p.payment === 'cash' ? 'Efectivo' : 'Crédito') + ' ' + p.cnt;
            }).join(' · ') +
          '</div>'
        : '');
  }).catch(function(e) { el.innerHTML = '❌ Error'; });
}

function loadCategories() {
  var el = document.getElementById('categories-box'); if (!el) return;
  el.innerHTML = 'Cargando...';
  api('/api/reports/categories').then(function(r) {
    var maxTotal = (r[0] && r[0].total) || 1;
    el.innerHTML = r.map(function(c) {
      return '<div class="report-row">' +
        '<span>' + esc(c.category) + '</span>' +
        '<div class="rr-bar"><div class="fill" style="width:' + ((c.total / maxTotal * 100).toFixed(0)) + '%"></div></div>' +
        '<span class="rr-amt">' + fmoney(c.total) + '</span>' +
      '</div>';
    }).join('');
  }).catch(function(e) { el.innerHTML = '❌ Error'; });
}

function loadProfit() {
  var el = document.getElementById('profit-box'); if (!el) return;
  el.innerHTML = 'Calculando...';
  api('/api/reports/profit').then(function(r) {
    el.innerHTML =
      '<div style="display:flex;justify-content:space-around;text-align:center;margin-bottom:10px">' +
        '<div><div style="font-size:1.2rem;font-weight:800;color:var(--green)">' + fmoney(r.totalProfit) + '</div><small style="color:var(--muted)">Ganancia</small></div>' +
        '<div><div style="font-size:1rem;font-weight:600">' + r.margin + '%</div><small style="color:var(--muted)">Margen</small></div>' +
      '</div>' +
      r.byProduct.slice(0, 5).map(function(p) {
        return '<div class="report-row"><span>' + esc(p.name) + '</span><span class="rr-amt" style="color:var(--green)">+' + fmoney(p.profit) + '</span></div>';
      }).join('');
  }).catch(function(e) { el.innerHTML = '❌ Error'; });
}

// ═══════════════════════════════════════════════
// SHARED — Products, Modals, Toasts
// ═══════════════════════════════════════════════

function openProductModal(id) {
  editingId = id;
  document.getElementById('modal-title').textContent = id ? 'Editar Producto' : 'Nuevo Producto';
  if (id) {
    var p = products.find(function(x) { return x.id === id; });
    ['mf-emoji', 'mf-name', 'mf-price', 'mf-cost', 'mf-stock', 'mf-category'].forEach(function(f, i) {
      document.getElementById(f).value = [p.emoji, p.name, p.price, p.cost || '', p.stock, p.category || ''][i];
    });
  } else {
    ['mf-emoji', 'mf-name', 'mf-price', 'mf-cost', 'mf-stock', 'mf-category'].forEach(function(f) {
      document.getElementById(f).value = '';
    });
  }
  document.getElementById('modal-product').classList.add('show');
}

function closeModal(id) { document.getElementById(id).classList.remove('show'); }

function saveProduct() {
  var d = {
    emoji: document.getElementById('mf-emoji').value || '',
    name: document.getElementById('mf-name').value,
    price: Number(document.getElementById('mf-price').value),
    cost: Number(document.getElementById('mf-cost').value) || 0,
    stock: Number(document.getElementById('mf-stock').value) || 0,
    category: document.getElementById('mf-category').value || 'General'
  };
  if (!d.name || !d.price) return;
  if (editingId) {
    api('/api/products/' + editingId, { method: 'PUT', body: JSON.stringify(d) });
  } else {
    api('/api/products', { method: 'POST', body: JSON.stringify(d) });
  }
  closeModal('modal-product'); refreshAll();
}

function deleteProduct(id) {
  if (!confirm('Eliminar?')) return;
  api('/api/products/' + id, { method: 'DELETE' });
  refreshAll();
}

function editProduct(id) { openProductModal(id); }

// Placeholder for the AI price optimizer button
function optimizeProductPrice(id) {
  toast('Optimización no disponible en esta versión');
}

function toast(m, icon) {
  if (!icon) icon = '';
  var t = document.createElement('div');
  t.className = 'toast';
  t.textContent = icon + ' ' + m;
  document.body.appendChild(t);
  setTimeout(function() { t.remove(); }, 2200);
  for (var i = 0; i < 5; i++) {
    var s = document.createElement('div');
    s.className = 'spark';
    s.style.left = (40 + Math.random() * 20) + '%';
    s.style.bottom = '80px';
    s.textContent = ['✨', '💫', '🌟', '💰', '🎉'][i];
    document.body.appendChild(s);
    setTimeout(function() { s.remove(); }, 800);
  }
}

function refreshAll() {
  api('/api/products').then(function(data) { products = data; });
  api('/api/customers').then(function(data) { customers = data; });
  api('/api/stats').then(function(stats) {
    document.getElementById('q-stats').textContent = 'Hoy: ' + fmoney(stats.today.total);
    document.getElementById('alert-low').style.display = stats.lowStock > 0 ? 'inline-block' : 'none';
    document.getElementById('alert-low-count').textContent = stats.lowStock;
    document.getElementById('alert-loans').style.display = stats.totalLoans.count > 0 ? 'inline-block' : 'none';
    document.getElementById('alert-loans-count').textContent = stats.totalLoans.count;
    document.getElementById('alert-loans-amount').textContent = fmoney(stats.totalLoans.total);
    var active = document.querySelector('.panel.active');
    if (active && active.id === 'panel-venta') renderCatalogGrid();
    if (active && active.id === 'panel-catalogo') renderCatalogFull();
    if (active && active.id === 'panel-inventario') renderInventory();
    if (active && active.id === 'panel-caja') renderCash();
    if (active && active.id === 'panel-prestamos') renderLoans();
    if (active && active.id === 'panel-reportes') renderReports();
  });
}

// ═══════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════

document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.key === 'n') { switchTab('venta'); window.scrollTo(0, 0); }
  if (e.key === 'F8') toggleTheme();
  if (e.key === 'Escape') {
    // If PIN screen is visible, ignore Escape
    var ps = document.getElementById('pin-screen');
    if (ps && !ps.classList.contains('hidden')) return;
    cart = []; enteredStr = ''; renderCart(); document.getElementById('venta-search').focus();
  }
  if (e.key === '/' && document.querySelector('.panel.active') && document.querySelector('.panel.active').id === 'panel-venta') {
    e.preventDefault(); document.getElementById('venta-search').focus();
  }
});

// ═══════════════════════════════════════════════
// RELOJ HONDURAS
// ═══════════════════════════════════════════════

function updateClock() {
  var now = new Date();
  var hn = new Date(now.toLocaleString('en-US', { timeZone: 'America/Tegucigalpa' }));
  var h = hn.getHours();
  var ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  var m = String(hn.getMinutes()).padStart(2, '0');
  var s = String(hn.getSeconds()).padStart(2, '0');
  var el1 = document.getElementById('clock-hn');
  if (el1) el1.innerHTML = h + ':' + m + ' <span class="clock-ampm">' + ampm + '</span>';
  var el2 = document.getElementById('clock-ampm');
  if (el2) el2.textContent = s;

  // Saludo dinámico
  var hr = hn.getHours();
  var greet;
  if (hr >= 5 && hr < 12) greet = 'Buenos días';
  else if (hr >= 12 && hr < 18) greet = 'Buenas tardes';
  else greet = 'Buenas noches';
  var el3 = document.getElementById('clock-greet');
  if (el3) el3.textContent = greet;
}
setInterval(updateClock, 1000);
updateClock();

// ═══════════════════════════════════════════════
// PRINT RECEIPT (stub)
// ═══════════════════════════════════════════════

function printReceipt() {
  var content = document.getElementById('receipt-content');
  if (!content) return;
  var win = window.open('', '_blank', 'width=400,height=600');
  if (!win) return;
  win.document.write('<html><head><title>Recibo</title></head><body style="font-family:monospace;text-align:center">' + content.innerHTML + '</body></html>');
  win.document.close();
  setTimeout(function() { win.print(); }, 300);
}

// ═══════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════

function initialLoad() {
  api('/api/products').then(function(data) {
    products = data;
    return api('/api/customers');
  }).then(function(data) {
    customers = data;
    return api('/api/stats');
  }).then(function(s) {
    var al = document.getElementById('alert-low');
    if (al) { al.style.display = s.lowStock > 0 ? 'inline-block' : 'none'; document.getElementById('alert-low-count').textContent = s.lowStock; }
    var al2 = document.getElementById('alert-loans');
    if (al2) { al2.style.display = s.totalLoans.count > 0 ? 'inline-block' : 'none'; document.getElementById('alert-loans-count').textContent = s.totalLoans.count; document.getElementById('alert-loans-amount').textContent = fmoney(s.totalLoans.total); }
    renderCatalogGrid();
    renderCart();
    document.getElementById('q-stats').textContent = 'Hoy: ' + fmoney(s.today.total);
  }).catch(function(e) { console.error(e); });
}

// Build nav immediately (DOM is ready since script is at end of body)
buildNav();

// Init PIN screen
initPinScreen();

// Check for existing session (skip PIN if already logged in this tab)
if (!checkSession()) {
  // Show PIN screen, hide main app
  var app = document.getElementById('app-main');
  if (app) app.style.display = 'none';
} else {
  // Session exists — load data
  initialLoad();
}

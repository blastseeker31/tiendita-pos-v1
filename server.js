const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');
const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const db = new Database(path.join(__dirname, 'data', 'tiendita.db'));
db.pragma('journal_mode=WAL');

// Helper: fecha/hora actual en zona horaria de Honduras
function getHNNow() {
  return new Date(new Date().toLocaleString('en-US',{timeZone:'America/Tegucigalpa'}));
}

// Migración: agregar columnas si no existen
try { db.exec("ALTER TABLE sales ADD COLUMN change_given REAL DEFAULT 0"); } catch(e) {}
try { db.exec("ALTER TABLE sales ADD COLUMN subtotal REAL DEFAULT 0"); } catch(e) {}
try { db.exec("ALTER TABLE sales ADD COLUMN discount REAL DEFAULT 0"); } catch(e) {}

// Crear tablas si no existen
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    stock INTEGER DEFAULT 0,
    emoji TEXT DEFAULT '📦',
    cost REAL DEFAULT 0,
    category TEXT DEFAULT 'General'
  );
  CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    items TEXT NOT NULL,
    subtotal REAL,
    discount REAL DEFAULT 0,
    total REAL NOT NULL,
    payment TEXT DEFAULT 'cash',
    customer_id TEXT,
    change_given REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    balance REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS loan_transactions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS cash_register (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Índices para rendimiento
db.exec(`CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_loan_txns_customer ON loan_transactions(customer_id)`);

// ========== PRODUCTOS ==========

app.get('/api/products', (req,res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY name').all();
  res.json(products);
});

app.post('/api/products', (req,res) => {
  const {name,price,stock,emoji,cost,category} = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(422).json({error:'Nombre requerido'});
  }
  if (price === undefined || isNaN(Number(price))) {
    return res.status(422).json({error:'Precio requerido y debe ser número'});
  }
  const id = 'p' + crypto.randomBytes(4).toString('hex');
  db.prepare('INSERT INTO products VALUES (?,?,?,?,?,?,?)').run(id,name.trim(),Number(price),stock||0,emoji||'📦',Number(cost)||0,category||'General');
  res.json({id});
});

app.put('/api/products/:id', (req,res) => {
  const {name,price,stock,emoji,cost,category} = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(422).json({error:'Nombre requerido'});
  }
  if (price === undefined || isNaN(Number(price))) {
    return res.status(422).json({error:'Precio requerido y debe ser número'});
  }
  const result = db.prepare('UPDATE products SET name=?,price=?,stock=?,emoji=?,cost=?,category=? WHERE id=?').run(name,price,stock,emoji,cost,category,req.params.id);
  if (result.changes === 0) return res.status(404).json({error:'Producto no encontrado'});
  res.json({ok:true});
});

app.delete('/api/products/:id', (req,res) => {
  const result = db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({error:'Producto no encontrado'});
  res.json({ok:true});
});

// ========== VENTAS ==========

app.post('/api/sales', (req,res) => {
  const {items,subtotal,discount,total,payment,customer_id,change_given} = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(422).json({error:'Items requeridos'});
  }
  const id = 's' + crypto.randomBytes(4).toString('hex');
  const hnNow = getHNNow().toISOString().replace('T',' ').split('.')[0];

  try {
    db.transaction(() => {
      // Verify stock before deducting
      for (const i of items) {
        const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(i.id);
        if (!product) throw new Error('Producto no encontrado: ' + i.id);
        if (product.stock < i.qty) throw new Error('Stock insuficiente para: ' + i.id);
        db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(i.qty, i.id);
      }
      db.prepare('INSERT INTO sales (id,items,subtotal,discount,total,payment,customer_id,change_given,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(id, JSON.stringify(items), subtotal||0, discount||0, total, payment, customer_id||null, change_given||0, hnNow);
      if (payment === 'cash') {
        db.prepare('INSERT INTO cash_register (id,type,amount,description,created_at) VALUES (?,?,?,?,?)')
          .run('ch'+crypto.randomBytes(4).toString('hex'), 'income', total, 'Venta #'+id, hnNow);
      }
    })();
    res.json({id});
  } catch(e) {
    res.status(409).json({error: e.message});
  }
});

app.get('/api/sales', (req,res) => {
  const sales = db.prepare("SELECT * FROM sales ORDER BY created_at DESC LIMIT 50").all();
  // Recolectar todos los IDs de productos de todas las ventas
  const allIds = new Set();
  for (const s of sales) {
    for (const item of JSON.parse(s.items)) {
      allIds.add(item.id);
    }
  }
  // Una sola query para todos los productos
  const productMap = new Map();
  if (allIds.size > 0) {
    const placeholders = Array(allIds.size).fill('?').join(',');
    const products = db.prepare(`SELECT * FROM products WHERE id IN (${placeholders})`).all(...allIds);
    for (const p of products) {
      productMap.set(p.id, p);
    }
  }
  res.json(sales.map(s => ({
    ...s,
    items: JSON.parse(s.items).map(data => {
      const p = productMap.get(data.id);
      return {id:data.id, name:p?.name||'?', emoji:p?.emoji||'📦', qty:data.qty, total:data.total};
    })
  })));
});

// ========== CLIENTES ==========

app.get('/api/customers', (req,res) => {
  const customers = db.prepare('SELECT * FROM customers ORDER BY name').all();
  res.json(customers);
});

app.post('/api/customers', (req,res) => {
  const {name,phone} = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(422).json({error:'Nombre requerido'});
  }
  const id = 'c' + crypto.randomBytes(4).toString('hex');
  db.prepare('INSERT INTO customers (id,name,phone) VALUES (?,?,?)').run(id,name.trim(),phone||'');
  res.json({id});
});

app.put('/api/customers/:id', (req,res) => {
  const {name,phone} = req.body;
  db.prepare('UPDATE customers SET name=?,phone=? WHERE id=?').run(name,phone||'',req.params.id);
  res.json({ok:true});
});

app.delete('/api/customers/:id', (req,res) => {
  const customer = db.prepare('SELECT id FROM customers WHERE id=?').get(req.params.id);
  if (!customer) return res.status(404).json({error:'Cliente no encontrado'});
  db.transaction(() => {
    db.prepare('DELETE FROM loan_transactions WHERE customer_id=?').run(req.params.id);
    db.prepare('DELETE FROM customers WHERE id=?').run(req.params.id);
  })();
  res.json({ok:true});
});

app.get('/api/customers/:id', (req,res) => {
  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(req.params.id);
  if (!c) return res.status(404).json({error:'No encontrado'});
  res.json(c);
});

app.get('/api/customers/:id/transactions', (req,res) => {
  const txns = db.prepare("SELECT * FROM loan_transactions WHERE customer_id=? ORDER BY created_at DESC").all(req.params.id);
  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(req.params.id);
  res.json({customer: c, transactions: txns});
});

app.post('/api/customers/:id/transactions', (req,res) => {
  const {type,amount,description} = req.body;
  const validTypes = ['loan','payment','set_debt','add_debt'];
  if (!validTypes.includes(type)) {
    return res.status(422).json({error:'Tipo inválido. Use: loan, payment, set_debt, add_debt'});
  }
  const customer = db.prepare('SELECT * FROM customers WHERE id=?').get(req.params.id);
  if (!customer) return res.status(404).json({error:'Cliente no encontrado'});
  
  const id = 't' + crypto.randomBytes(4).toString('hex');
  const hnNow = getHNNow().toISOString().replace('T',' ').split('.')[0];

  db.transaction(() => {
    db.prepare('INSERT INTO loan_transactions (id,customer_id,type,amount,description,created_at) VALUES (?,?,?,?,?,?)')
      .run(id, req.params.id, type, amount, description||'', hnNow);
    
    if (type === 'loan') {
      // Préstamo: aumenta deuda del cliente
      db.prepare('UPDATE customers SET balance = balance + ? WHERE id=?').run(amount, req.params.id);
    } else if (type === 'set_debt') {
      // Setear deuda exacta
      const c = db.prepare('SELECT * FROM customers WHERE id=?').get(req.params.id);
      const diff = amount - (c.balance||0);
      db.prepare('UPDATE customers SET balance = balance + ? WHERE id=?').run(diff, req.params.id);
    } else if (type === 'add_debt') {
      // Sumar deuda + sacar de caja (vale)
      db.prepare('UPDATE customers SET balance = balance + ? WHERE id=?').run(amount, req.params.id);
      db.prepare('INSERT INTO cash_register (id,type,amount,description,created_at) VALUES (?,?,?,?,?)')
        .run('ch'+crypto.randomBytes(4).toString('hex'), 'expense', amount, 'Vale: '+description||'', hnNow);
    } else if (type === 'payment') {
      // Abono: reduce deuda y entra a caja
      db.prepare('UPDATE customers SET balance = balance - ? WHERE id=?').run(amount, req.params.id);
      db.prepare('INSERT INTO cash_register (id,type,amount,description,created_at) VALUES (?,?,?,?,?)')
        .run('ch'+crypto.randomBytes(4).toString('hex'), 'income', amount, 'Abono: '+description||'', hnNow);
    }
  })();

  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(req.params.id);
  res.json({balance: c.balance, id});
});

// ========== CAJA ==========

app.get('/api/cash', (req,res) => {
  const rows = db.prepare("SELECT * FROM cash_register ORDER BY created_at DESC LIMIT 50").all();
  const balance = db.prepare("SELECT SUM(CASE WHEN type='income' THEN amount ELSE -amount END) as balance FROM cash_register").get();
  res.json({rows, balance: balance.balance||0});
});

app.post('/api/cash', (req,res) => {
  const {type,amount,description} = req.body;
  if (!type || (type !== 'income' && type !== 'expense')) {
    return res.status(422).json({error:'Tipo requerido (income o expense)'});
  }
  if (amount === undefined || isNaN(Number(amount))) {
    return res.status(422).json({error:'Monto requerido y debe ser número'});
  }
  const id = 'ch' + crypto.randomBytes(4).toString('hex');
  const hnNow = getHNNow().toISOString().replace('T',' ').split('.')[0];
  db.prepare('INSERT INTO cash_register (id,type,amount,description,created_at) VALUES (?,?,?,?,?)')
    .run(id, type, amount, description||'', hnNow);
  res.json({id});
});

app.post('/api/cash/adjust', (req,res) => {
  const {amount,description} = req.body;
  if (amount === undefined || isNaN(Number(amount))) {
    return res.status(422).json({error:'Monto requerido y debe ser número'});
  }
  const id = 'ch' + crypto.randomBytes(4).toString('hex');
  const hnNow = getHNNow().toISOString().replace('T',' ').split('.')[0];
  
  db.transaction(() => {
    const current = db.prepare("SELECT SUM(CASE WHEN type='income' THEN amount ELSE -amount END) as balance FROM cash_register").get();
    const currBal = current.balance||0;
    const diff = amount - currBal;
    const type = diff >= 0 ? 'income' : 'expense';
    const absDiff = Math.abs(diff);
    db.prepare('INSERT INTO cash_register (id,type,amount,description,created_at) VALUES (?,?,?,?,?)')
      .run(id, type, absDiff, description||'Ajuste manual', hnNow);
    res.json({id, previousBalance: currBal, newBalance: amount, adjustment: diff});
  })();
});

// ========== STATS ==========

app.get('/api/stats', (req,res) => {
  const ts = db.prepare("SELECT COUNT(*) as cnt, SUM(total) as total FROM sales WHERE date(created_at,'-6 hours')=date('now','-6 hours')").get();
  const low = db.prepare("SELECT COUNT(*) as cnt FROM products WHERE stock <= 5").get();
  const loans = db.prepare("SELECT SUM(balance) as total, COUNT(*) as cnt FROM customers WHERE balance > 0").get();
  const cash = db.prepare("SELECT SUM(CASE WHEN type='income' THEN amount ELSE -amount END) as balance FROM cash_register").get();
  const month = db.prepare("SELECT COUNT(*) as cnt, SUM(total) as total FROM sales WHERE strftime('%Y-%m',created_at,'-6 hours')=strftime('%Y-%m','now','-6 hours')").get();

  res.json({
    today: { count: ts.cnt||0, total: ts.total||0 },
    lowStock: low.cnt||0,
    totalLoans: { count: loans.cnt||0, total: loans.total||0 },
    cashBalance: cash.balance||0,
    month: { count: month.cnt||0, total: month.total||0 }
  });
});

// ========== EMOJI SUGGESTOR (local, sin IA) ==========
const EMOJI_MAP = {
  'coca': '🥤', 'cola': '🥤', 'pepsi': '🥤', 'fresco': '🥤', 'gaseosa': '🥤', 'soda': '🥤',
  'agua': '💧', 'botellon': '🧊', 'hielo': '🧊',
  'jugo': '🧃', 'naranja': '🍊', 'manzana': '🍎', 'uva': '🍇', 'piña': '🍍', 'mango': '🥭',
  'cerveza': '🍺', 'salva vida': '🍺', 'salvavida': '🍺', 'port royal': '🍺', 'imperial': '🍺', 'barena': '🍺',
  'cafe': '☕', 'café': '☕', 'capuchino': '☕',
  'leche': '🥛', 'yogurt': '🍶',
  'energizante': '⚡', 'monster': '⚡', 'red bull': '⚡', 'volt': '⚡',
  'ron': '🥃', 'whisky': '🥃', 'guaro': '🥃', 'licor': '🥃',
  'vino': '🍷',
  'galleta': '🍪', 'galletas': '🍪', 'club social': '🍪', 'oreo': '🍪',
  'papitas': '🍟', 'papas': '🍟', 'frituras': '🍟', 'takis': '🌮',
  'yummix': '🍬', 'caramelo': '🍬', 'dulce': '🍬', 'chicle': '🍬',
  'chocolate': '🍫', 'hershey': '🍫', 'snicker': '🍫', 'kinder': '🍫',
  'palomitas': '🍿', 'poporopo': '🍿',
  'helado': '🍦', 'paleta': '🍭',
  'pan': '🍞', 'donut': '🍩', 'dona': '🍩',
  'pastel': '🍰', 'queque': '🍰',
  'sopa': '🍜', 'instantanea': '🍜', 'issima': '🍜', 'maruchan': '🍜', 'ramen': '🍜',
  'arroz': '🍚', 'frijoles': '🫘',
  'huevo': '🥚', 'huevos': '🥚',
  'carne': '🥩', 'pollo': '🍗', 'pescado': '🐟',
  'queso': '🧀', 'crema': '🥛',
  'tortilla': '🌮', 'tortillas': '🌮',
  'salsa': '🥫', 'ketchup': '🥫', 'mayonesa': '🥫',
  'cereal': '🥣',
  'pasta dental': '🪥', 'colgate': '🪥',
  'jabon': '🧼', 'jabón': '🧼', 'detergente': '🧼',
  'shampoo': '🧴', 'acondicionador': '🧴', 'gel': '🧴',
  'papel higienico': '🧻', 'papel higiénico': '🧻',
  'pañal': '👶', 'pañales': '👶',
  'desodorante': '💨', 'axe': '💨', 'rexona': '💨',
  'perfume': '✨', 'colonia': '✨',
  'cloro': '🧪', 'desinfectante': '🧪',
  'escoba': '🧹', 'trapeador': '🧹',
  'telefono': '📱', 'celular': '📱', 'recarga': '📱',
  'pila': '🔋', 'bateria': '🔋', 'batería': '🔋',
  'foco': '💡', 'bombillo': '💡',
  'candado': '🔒',
  'lapiz': '✏️', 'lápiz': '✏️', 'lapicero': '🖊️',
  'cuaderno': '📓', 'libreta': '📓',
  'cigarro': '🚬', 'cigarrillo': '🚬', 'encendedor': '🔥',
};
const DEFAULT_EMOJIS = ['📦','🎁','🛍️','✨','💫','🌟','🛒','🏷️','📌','🔖'];

function suggestEmoji(name) {
  if (!name) return '📦';
  const n = name.toLowerCase().trim();
  for (const [key, emoji] of Object.entries(EMOJI_MAP)) {
    if (n === key) return emoji;
  }
  for (const [key, emoji] of Object.entries(EMOJI_MAP)) {
    if (n.includes(key) || key.includes(n)) return emoji;
  }
  const seed = n.split('').reduce((a,c)=>a+c.charCodeAt(0),0);
  return DEFAULT_EMOJIS[seed % DEFAULT_EMOJIS.length];
}

app.get('/api/suggest-emoji', (req,res) => {
  const emoji = suggestEmoji(req.query.name || '');
  res.json({ emoji });
});

// ========== REPORTES ==========

app.get('/api/reports/weekly', (req,res) => {
  const days = db.prepare("SELECT date(created_at,'-6 hours') as day, COUNT(*) as cnt, SUM(total) as total FROM sales WHERE created_at >= datetime('now','-6 hours','-7 days') GROUP BY day ORDER BY day").all();
  const paymentBreakdown = db.prepare("SELECT payment, COUNT(*) as cnt, SUM(total) as total FROM sales WHERE created_at >= datetime('now','-6 hours','-7 days') GROUP BY payment").all();
  res.json({ days, paymentBreakdown, weekTotal: days.reduce((s,d)=>s+d.total,0) });
});

app.get('/api/reports/categories', (req,res) => {
  const products = db.prepare('SELECT * FROM products').all();
  const sales = db.prepare("SELECT items FROM sales WHERE strftime('%Y-%m',created_at,'-6 hours')=strftime('%Y-%m','now','-6 hours')").all();
  const catStats = {};
  for (const s of sales) {
    const items = JSON.parse(s.items);
    for (const i of items) {
      const p = products.find(x=>x.id===i.id);
      const cat = p?.category || 'General';
      if (!catStats[cat]) catStats[cat] = { qty:0, total:0 };
      catStats[cat].qty += i.qty;
      catStats[cat].total += i.qty * (p?.price||0);
    }
  }
  res.json(Object.entries(catStats).map(([cat,data])=>({category:cat,...data})).sort((a,b)=>b.total-a.total));
});

app.get('/api/reports/profit', (req,res) => {
  const products = db.prepare('SELECT * FROM products').all();
  const prodMap = {};
  products.forEach(p=>{prodMap[p.id]=p});

  const sales = db.prepare("SELECT items FROM sales WHERE strftime('%Y-%m',created_at,'-6 hours')=strftime('%Y-%m','now','-6 hours')").all();
  let totalRevenue = 0, totalCost = 0;
  const prodProfit = {};

  for (const s of sales) {
    const items = JSON.parse(s.items);
    for (const i of items) {
      const p = prodMap[i.id];
      if (!p) continue;
      if (!prodProfit[i.id]) prodProfit[i.id] = { name:p?.name||'?', emoji:p?.emoji||'📦', revenue:0, cost:0, profit:0 };
      prodProfit[i.id].revenue += i.qty * p.price;
      prodProfit[i.id].cost += i.qty * (p.cost||0);
      prodProfit[i.id].profit += i.qty * (p.price - (p.cost||0));
      totalRevenue += i.qty * p.price;
      totalCost += i.qty * (p.cost||0);
    }
  }

  const byProduct = Object.values(prodProfit).sort((a,b)=>b.profit-a.profit);
  const totalProfit = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? Math.round((totalProfit/totalRevenue)*100) : 0;

  res.json({ totalProfit, totalRevenue, totalCost, margin, byProduct });
});

app.get('/api/reports/top', (req,res) => {
  const sales = db.prepare("SELECT items FROM sales WHERE strftime('%Y-%m',created_at,'-6 hours')=strftime('%Y-%m','now','-6 hours')").all();
  const qty = {};
  for (const s of sales) {
    const items = JSON.parse(s.items);
    for (const i of items) {
      qty[i.id] = (qty[i.id]||0) + i.qty;
    }
  }
  const products = db.prepare('SELECT * FROM products').all();
  const result = Object.entries(qty)
    .map(([id,qty]) => {
      const p = products.find(x=>x.id===id);
      return { id, name: p?.name||'?', emoji: p?.emoji||'📦', qty, total: qty * (p?.price||0) };
    })
    .sort((a,b)=>b.qty-a.qty);
  res.json(result);
});


// ========== PDF REPORTE DIARIO (tamaño carta, para imprimir - Venta Blanquita, 1 hoja) ==========
const PDFDocument = require('pdfkit');

app.get('/api/pdf/reporte-diario', (req,res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY category, name').all();
  const hnNow = getHNNow();
  const fecha = hnNow.toLocaleDateString('es-HN', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const hora = hnNow.toLocaleTimeString('es-HN', { hour:'2-digit', minute:'2-digit' });
  const fechaCorta = hnNow.toLocaleDateString('es-HN', { day:'2-digit', month:'2-digit', year:'numeric' });
  
  // Datos del sistema para que Blanca cuadre
  const cashRow = db.prepare("SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE -amount END), 0) as balance FROM cash_register").get();
  const loansRow = db.prepare("SELECT COALESCE(SUM(balance), 0) as total FROM customers WHERE balance > 0").get();
  const sistemaEfectivo = cashRow.balance || 0;
  const sistemaPrestamos = loansRow.total || 0;
  
  const doc = new PDFDocument({ size:'LETTER', margin: 15, info:{Title:'Hoja de Blanca',Creator:'Don Fran POS'} });
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=hoja_blanca_' + hnNow.toISOString().split('T')[0] + '.pdf');
  doc.pipe(res);
  
  // LETTER = 612x792, margin=15 => usable: 582x762
  const M = 15;          // margin
  const PW = 582;        // page width usable
  const PH = 762;        // page height usable
  
  // ── BORDE DOBLE ELEGANTE ──
  doc.roundedRect(M, M, PW, PH, 0)
     .lineWidth(2).strokeColor('#000').stroke();
  doc.roundedRect(M+3, M+3, PW-6, PH-6, 0)
     .lineWidth(0.5).strokeColor('#000').stroke();
  
  // ── ENCABEZADO ──
  let y = M + 10;
  doc.fontSize(22).font('Helvetica-Bold').fillColor('#000')
     .text('HOJA DE BLANCA', M, y, { align:'center', width:PW });
  y += 26;
  
  // Línea decorativa
  doc.moveTo(M+30, y).lineTo(M+PW-30, y).lineWidth(1).strokeColor('#000').stroke();
  y += 8;
  
  // Fecha y turno
  doc.fontSize(11).font('Helvetica').fillColor('#000');
  doc.text(fecha + '  —  ' + hora, M, y, { align:'center', width:PW });
  y += 16;
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#000');
  doc.text('Turno Noche', M, y, { align:'center', width:PW });
  y += 18;
  
  // Mensajito para Blanca
  const mensajes = [
    'Doña Blanca, que Dios la bendiga hoy y siempre.',
    'Gracias por su dedicación, Doña Blanca. Usted es importante.',
    'Doña Blanca, que hoy sea un día lleno de ventas y alegría.',
    'Gracias por todo, Doña Blanca. Sin usted esto no funciona.',
    'Doña Blanca, que su sonrisa ilumine la tienda hoy.',
    'Usted es el corazón de esta tienda, Doña Blanca.',
    'Que la Virgen la acompañe en su turno, Doña Blanca.',
    'Doña Blanca, gracias por su paciencia y su esfuerzo.',
    'Hoy va a ser un día excelente, Doña Blanca. ¡Ánimo!',
    'Doña Blanca, la apreciamos muchísimo. Gracias por estar aquí.',
    'Que Dios le dé fuerzas para un turno tranquilo, Doña Blanca.',
    'Gracias por su trabajo, Doña Blanca. Usted es una bendición.'
  ];
  const mensajeHoy = mensajes[hnNow.getDate() % mensajes.length];
  doc.fontSize(9).font('Helvetica-Oblique').fillColor('#666');
  doc.text(mensajeHoy, M, y, { align:'center', width:PW });
  doc.fillColor('#000');
  y += 16;
  
  // ── DATOS DEL SISTEMA ──
  const infoBoxH = 32;
  const infoBoxY = y;
  doc.roundedRect(M + 40, infoBoxY, PW - 80, infoBoxH, 4)
     .lineWidth(0.6).strokeColor('#000').stroke();
  
  // Efectivo en sistema (izquierda)
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#000');
  doc.text('Efectivo en Sistema:', M + 55, infoBoxY + 4);
  doc.fontSize(13).font('Helvetica-Bold');
  const efText = 'L' + sistemaEfectivo.toFixed(2);
  doc.text(efText, M + 55 + doc.widthOfString('Efectivo en Sistema: ') + 4, infoBoxY + 3);
  
  // Línea divisoria vertical
  const divX = M + PW/2;
  doc.moveTo(divX, infoBoxY + 4).lineTo(divX, infoBoxY + infoBoxH - 4)
     .lineWidth(0.4).strokeColor('#000').stroke();
  
  // Préstamos (derecha)
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Préstamos Activos:', divX + 10, infoBoxY + 4);
  doc.fontSize(13).font('Helvetica-Bold');
  const loanText = 'L' + sistemaPrestamos.toFixed(2);
  doc.text(loanText, divX + 10 + doc.widthOfString('Préstamos Activos: ') + 4, infoBoxY + 3);
  
  doc.fillColor('#000');
  y += infoBoxH + 6;
  
  // ── LÍNEA SEPARADORA GRUESA ──
  doc.moveTo(M, y).lineTo(M+PW, y).lineWidth(1.5).strokeColor('#000').stroke();
  y += 6;
  
  // ── TABLA DE PRODUCTOS ──
  // Columnas: No. | Producto | Precio | Inventario | VENDIDOS (manuscrito)
  const colW = [28, 180, 55, 45, PW - 308];  // 28+180+55+45+274 = 582
  const colX = [M, M+28, M+208, M+263, M+308];
  
  // Espacio para tabla: calcular filas que caben
  const headerH = 26;
  const footerStartY = PH - 120;  // dejamos 120pt para sección fiado + totales + footer
  const tableH = footerStartY - y;
  const rowH = Math.min(52, Math.max(8, Math.floor((tableH - headerH) / Math.max(products.length, 1))));
  const fontSize = Math.max(6, Math.min(11, Math.floor(rowH * 0.72)));
  
  // Encabezados de columna con fondo oscuro
  doc.rect(M, y, PW, headerH).fillColor('#000').fill();
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#fff');
  const hdrs = ['No.', 'Producto', 'Precio', 'Inv.', 'VENDIDOS (escriba cantidad)'];
  hdrs.forEach((h, i) => {
    doc.text(h, colX[i] + 4, y + 6, { width: colW[i] - 8, align: (i === 0 || i === 2 || i === 3) ? 'center' : 'left' });
  });
  doc.fillColor('#000');
  y += headerH;
  
  // Filas de productos — sin líneas horizontales, solo guías verticales y espacio natural
  for (let idx = 0; idx < products.length; idx++) {
    const p = products[idx];
    const rowY = y;
    
    // Guías verticales entre columnas (muy sutiles, solo estructura)
    doc.moveTo(colX[1], rowY).lineTo(colX[1], rowY + rowH)
       .lineWidth(0.15).strokeColor('#ddd').stroke();
    doc.moveTo(colX[2], rowY).lineTo(colX[2], rowY + rowH)
       .lineWidth(0.15).strokeColor('#ddd').stroke();
    doc.moveTo(colX[3], rowY).lineTo(colX[3], rowY + rowH)
       .lineWidth(0.15).strokeColor('#ddd').stroke();
    doc.moveTo(colX[4], rowY).lineTo(colX[4], rowY + rowH)
       .lineWidth(0.15).strokeColor('#ddd').stroke();
    
    const vCenter = rowY + rowH * 0.5 + fontSize * 0.35;
    
    // No.
    doc.fontSize(fontSize).font('Helvetica-Bold').fillColor('#000');
    doc.text(String(idx + 1), colX[0], vCenter, { width: colW[0], align:'center' });
    
    // Producto
    doc.fontSize(fontSize).font('Helvetica-Bold').fillColor('#000');
    doc.text(p.name, colX[1] + 6, vCenter, { width: colW[1] - 10 });
    
    // Precio
    doc.fontSize(fontSize).font('Helvetica').fillColor('#000');
    doc.text('L' + Number(p.price).toFixed(2), colX[2], vCenter, { width: colW[2], align:'center' });
    
    // Inventario
    doc.fontSize(fontSize).font('Helvetica').fillColor('#555');
    doc.text(String(p.stock || 0), colX[3], vCenter, { width: colW[3], align:'center' });
    
    // VENDIDOS — espacio en blanco para escribir a mano
    // Dibujar líneas guía punteadas suaves
    const vendidosW = colW[4] - 12;
    const dotSpacing = 28;
    const nDots = Math.floor(vendidosW / dotSpacing);
    const dotFontSize = rowH >= 28 ? 5 : (rowH >= 14 ? 4 : 3);
    doc.fontSize(dotFontSize).fillColor('#999');
    for (let d = 0; d < nDots; d++) {
      doc.text('·', colX[4] + 8 + d * dotSpacing, vCenter + 2);
    }
    doc.fillColor('#000');
    
    y += rowH;
  }
  
  // ── SEPARADOR ──
  y += 4;
  doc.moveTo(M, y).lineTo(M+PW, y).lineWidth(1).strokeColor('#000').stroke();
  y += 6;
  
  // ── SECCIÓN BLANCA FIADO ──
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#000');
  doc.text('✐  BLANCA FIADO', M, y, { width: PW - 20 });
  y += 14;
  
  // 3 líneas en blanco para que ella escriba
  for (let i = 0; i < 3; i++) {
    doc.moveTo(M + 10, y + 4).lineTo(M + PW - 10, y + 4)
       .lineWidth(0.4).strokeColor('#999').stroke();
    y += 18;
  }
  
  // ── SEPARADOR ──
  y += 2;
  doc.moveTo(M, y).lineTo(M+PW, y).lineWidth(1).strokeColor('#000').stroke();
  y += 8;
  
  // ── TOTALES ──
  const totalsY = y;
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#000');
  
  // Total ventas
  doc.text('TOTAL VENTAS:', M + 10, totalsY);
  doc.moveTo(M + 130, totalsY + 14).lineTo(M + 280, totalsY + 14)
     .lineWidth(0.6).strokeColor('#000').stroke();
  
  // Efectivo en caja
  doc.fontSize(11).font('Helvetica-Bold');
  doc.text('EFECTIVO EN CAJA:', M + 300, totalsY);
  doc.moveTo(M + 440, totalsY + 14).lineTo(M + PW - 10, totalsY + 14)
     .lineWidth(0.6).strokeColor('#000').stroke();
  
  y = totalsY + 22;
  
  // ── FOOTER ──
  doc.fontSize(7.5).font('Helvetica').fillColor('#999');
  doc.text(fechaCorta + '  |  ' + hora + '  |  ' + products.length + ' productos  |  Don Fran POS', M, PH - 8, { align:'center', width:PW });
  
  doc.end();
});

const PORT = process.env.PORT || 3000;

// Global error handler — prevents stack traces leaking to client
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, '0.0.0.0', () => console.log('POS running on port ' + PORT));

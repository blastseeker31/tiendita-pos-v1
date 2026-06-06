# 🏪 Tienda de Don Fran v1 — Documentación Completa

> ⚠️ **Versión legacy.** Este repositorio contiene la primera versión del POS. Para la versión actual, ver [don-fran-pos](https://github.com/blastseeker31/don-fran-pos).

## 📋 Índice
1. [Visión General](#visión-general)
2. [Arquitectura](#arquitectura)
3. [Stack Tecnológico](#stack-tecnológico)
4. [Base de Datos](#base-de-datos)
5. [API Endpoints](#api-endpoints)
6. [Frontend](#frontend)
7. [PDF Venta Blanquita](#pdf-venta-blanquita)
8. [Sistema de Préstamos](#sistema-de-préstamos)
9. [Caja Registradora](#caja-registradora)
10. [Reportes](#reportes)
11. [Despliegue](#despliegue)
12. [Mantenimiento](#mantenimiento)
13. [Changelog de Features](#changelog-de-features)

---

## Visión General

**Tienda de Don Fran** es un POS (Point of Sale) táctil para una tienda de retail en Honduras. Optimizado para iPad y mobile, con operación solo en efectivo, sistema de fiados, y reportes en vivo.

**Acceso:** `http://100.96.203.110:8082` (solo vía Tailscale VPN)

### Características principales
- 🖐️ Interfaz táctil optimizada para iPad
- 🌙 Dark mode completo con toggle animado
- 🕐 Reloj 12h con saludo dinámico (Buenos días/tardes/noches) — timezone Honduras
- 🔊 Sonidos Web Audio API generados programáticamente
- 💰 Solo efectivo (cash only)
- 📋 Sistema de fiados (préstamos/clientes con balance)
- 📊 5 tipos de reportes en vivo
- 📄 PDF "Venta Blanquita" tamaño carta para imprimir
- 🔤 Auto-emoji para productos (~100 productos hondureños mapeados)
- 🧮 Numpad cuadrado perfecto, diseño premium
- 📱 Responsive en todas las pantallas

---

## Arquitectura

```
┌──────────────────────────────────────────┐
│  iPad / Celular (Tailscale VPN)           │
│  ↓ Navegador web                          │
└──────────────┬───────────────────────────┘
               │ http://100.96.203.110:8082
               ↓
┌──────────────────────────────────────────┐
│  VPS Ubuntu — Docker                      │
│  ┌────────────────────────────────────┐  │
│  │  Contenedor: tiendita-pos          │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │  Node.js + Express (puerto   │  │  │
│  │  │  3000 interno)               │  │  │
│  │  │  ├── server.js (backend)     │  │  │
│  │  │  ├── index.html (frontend)   │  │  │
│  │  │  └── data/tiendita.db        │  │  │
│  │  └──────────────────────────────┘  │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### Archivos del proyecto
```
~/hermes-project/lolicup-pos/
├── server.js              ← Backend Node.js/Express (524 líneas)
├── index.html             ← Frontend SPA (766 líneas, todo inline)
├── Dockerfile             ← Imagen Node 20 Alpine
├── docker-compose.yml     ← Bind mount ./data:/app/data, puerto 8082:3000
├── package.json           ← Dependencias
└── data/
    └── tiendita.db        ← Base de datos SQLite (con WAL)
```

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js 20 + Express |
| Base de datos | SQLite (better-sqlite3, WAL mode) |
| PDF | PDFKit |
| Frontend | HTML5, CSS3, Vanilla JS (SPA, sin frameworks) |
| Contenedor | Docker (Alpine) |
| VPN | Tailscale |
| Sonidos | Web Audio API (OscillatorNode) |
| Timezone | America/Tegucigalpa (UTC-6) |

---

## Base de Datos

### Schema

#### `products` — Productos
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | TEXT PK | ID único (p.ej. `p1a2b3c4d`) |
| name | TEXT | Nombre del producto |
| price | REAL | Precio de venta (Lempiras) |
| stock | INTEGER | Cantidad en inventario |
| emoji | TEXT | Emoji del producto |
| cost | REAL | Costo de compra |
| category | TEXT | Categoría (Bebidas, Snacks, Higiene, etc.) |

#### `sales` — Ventas
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | TEXT PK | ID único (`s...`) |
| items | TEXT | JSON array de {id, qty} |
| subtotal | REAL | Suma antes de descuento |
| discount | REAL | Descuento en Lempiras |
| total | REAL | Total cobrado |
| payment | TEXT | `cash` o `credit` |
| customer_id | TEXT | FK a customers (si es fiado) |
| change_given | REAL | Cambio devuelto |
| created_at | TEXT | Fecha/hora HN |

#### `customers` — Clientes (fiados)
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | TEXT PK | ID único (`c...`) |
| name | TEXT | Nombre del cliente |
| phone | TEXT | Teléfono (opcional) |
| balance | REAL | Saldo deudor actual |

#### `loan_transactions` — Movimientos de fiado
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | TEXT PK | ID único (`t...`) |
| customer_id | TEXT FK | Cliente |
| type | TEXT | `loan`, `payment`, `set_debt`, `add_debt` |
| amount | REAL | Monto del movimiento |
| description | TEXT | Descripción |
| created_at | TEXT | Fecha/hora HN |

#### `cash_register` — Caja registradora
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | TEXT PK | ID único (`ch...`) |
| type | TEXT | `income`, `expense`, `ajuste` |
| amount | REAL | Monto |
| description | TEXT | Concepto |
| created_at | TEXT | Fecha/hora HN |

---

## API Endpoints

### Productos
```
GET    /api/products              — Listar todos
POST   /api/products              — Crear {name, price, stock, emoji?, cost?, category?}
PUT    /api/products/:id          — Actualizar
DELETE /api/products/:id          — Eliminar
```

### Ventas
```
POST   /api/sales                 — Registrar venta
  Body: {items:[{id,qty}], subtotal, discount, total, payment, customer_id?, change_given?}
  Efecto: descuenta stock de products, inserta en sales
  
GET    /api/sales                 — Últimas 50 ventas con nombres de productos resueltos
```

### Clientes (Fiados)
```
GET    /api/customers                    — Listar todos con balance
POST   /api/customers                    — Crear {name, phone?}
PUT    /api/customers/:id                — Actualizar
DELETE /api/customers/:id                — Eliminar (cascada: borra transacciones)
GET    /api/customers/:id                — Obtener uno
GET    /api/customers/:id/transactions   — Historial de transacciones
POST   /api/customers/:id/transactions   — Crear movimiento
  Body: {type, amount, description?}
  Tipos:
    loan       — Compra fiada (suma deuda)
    payment    — Abono (resta deuda, suma caja)
    set_debt   — Colocar deuda exacta (setea balance)
    add_debt   — Sumar deuda + sacar de caja (vale)
```

### Caja
```
GET    /api/cash                 — Movimientos (últimos 50) + balance actual
POST   /api/cash                 — Registrar movimiento {type, amount, description?}
POST   /api/cash/adjust          — Ajustar saldo a monto exacto {amount, description?}
```

### Stats
```
GET    /api/stats                — Dashboard: ventas hoy, stock bajo, préstamos, caja, mes
```

### Emoji
```
GET    /api/suggest-emoji?name=X — Sugiere emoji para producto (~100 mapeados)
```

### Reportes
```
GET    /api/reports/weekly       — Ventas últimos 7 días + breakdown por método de pago
GET    /api/reports/categories   — Ventas del mes agrupadas por categoría
GET    /api/reports/profit       — Ganancias del mes (revenue - cost) con margen
GET    /api/reports/top          — Productos más vendidos del mes
```

### PDF
```
GET    /api/pdf/reporte-diario   — PDF "Venta Blanquita" tamaño carta, 1 hoja
```

---

## Frontend

### Estructura (SPA en un solo archivo HTML)
```
index.html (766 líneas)
├── CSS inline (~200 líneas)
│   ├── Dark mode variables (--bg: #0a0a0f, --card: #111118)
│   ├── Numpad cuadrado perfecto (aspect-ratio: 1)
│   ├── Catálogo grid responsive
│   ├── Animaciones (glow pulse, fadeInUp, scale en press)
│   └── Media queries para mobile
├── HTML
│   ├── Topbar: reloj 12h + saludo dinámico
│   ├── Quick Stats badges (ventas hoy, stock bajo, préstamos, caja)
│   ├── Catálogo (grid de productos con emoji, precio, stock)
│   ├── Carrito lateral (items, cantidades, descuento)
│   ├── Numpad (botones cuadrados, 4 columnas)
│   └── Modales (nuevo producto, nuevo cliente, ajuste caja)
└── JavaScript (~400 líneas)
    ├── renderCatalogFull() — Grid de catálogo
    ├── renderCart() — Carrito con +/- y descuento
    ├── renderCustomerList() — Lista de clientes fiados
    ├── renderCash() — Panel de caja
    ├── renderInventory() — Tabla de inventario
    ├── renderReports() — Panel de reportes
    ├── renderLoans() — Panel de préstamos
    ├── doSale() — Flujo de venta efectivo
    ├── doLoanSale() — Flujo de venta fiada
    ├── np() / npBack() — Numpad táctil
    ├── payScreen() — Pantalla de cobro
    ├── playSound() — Web Audio API (click, add, success, error)
    ├── refreshAll() — Refresca stats, caja, préstamos
    └── suggestEmoji() — Auto-emoji local
```

### Flujo de venta
1. Cliente selecciona productos del catálogo → se agregan al carrito
2. Puede ajustar cantidades (+/-) y aplicar descuento (Lempiras)
3. Botón "Pagar" → pantalla de cobro con numpad
4. Ingresa monto recibido → calcula cambio
5. Confirma → `POST /api/sales` (descuenta stock) + `POST /api/cash` (registra ingreso)
6. Sonido success + toast ✅

### Flujo de fiado
1. Igual que venta, pero selecciona "Fiado" + cliente
2. Confirma → `POST /api/customers/:id/transactions` (suma deuda) + `POST /api/sales` (registra venta)

### Sonidos (Web Audio API)
```javascript
// 4 tonos generados programáticamente
playSound('click')   — click corto (440Hz, 100ms)
playSound('add')     — tono ascendente (523→784Hz)
playSound('success') — fanfarria (3 tonos ascendentes)
playSound('error')   — buzz (150Hz, 300ms)
```

---

## PDF Venta Blanquita

PDF tamaño carta (LETTER, 612×792pt) generado con PDFKit, diseñado para imprimirse y llevar a la tienda.

### Estructura de la hoja
```
┌──────────────────────────────────┐
│       VENTA BLANQUITA            │  ← Título 18pt bold
│   lunes, 1 de junio de 2026      │  ← Fecha
│   "Gracias por su trabajo..."    │  ← Mensaje bonito rotativo (15 variantes)
├──────────────────────────────────┤
│ Papelitos:                       │
│   Efectivo en caja: L389.00      │  ← Desde cash_register (vivo)
│   Dinero en préstamos: L5,509.00 │  ← SUM(balance) de customers
├──────────────────────────────────┤
│ No.  Producto    Precio  Inv.    │  ← Tabla con filas alternadas
│  1.  Agua        L20.00  18     │     Línea punteada en columna Vendidos
│  2.  Cepillo...  L25.00  6      │     Row height dinámico (12-22pt)
│  ...                            │
├──────────────────────────────────┤
│ BLANCA FIADO: ................ │  ← Línea guía para anotar manualmente
│                                  │
│ 9 productos | fecha | hora       │  ← Footer al pie
└──────────────────────────────────┘
```

### Características
- **1 sola hoja garantizada** — row height se ajusta dinámicamente
- **Papelitos** — efectivo en caja y préstamos en vivo desde BD
- **BLANCA FIADO** — espacio con línea punteada para anotaciones
- **Mensaje bonito** rotativo (15 mensajes, cambia según día del mes)
- **Filas alternadas** gris claro para legibilidad

---

## Sistema de Préstamos

### Tipos de movimientos

| Tipo | Descripción | Efecto en balance | Efecto en caja |
|------|-------------|-------------------|----------------|
| `loan` | Compra fiada | +deuda | — |
| `payment` | Abono | −deuda | +ingreso |
| `set_debt` | Colocar deuda exacta | = monto exacto | — |
| `add_debt` | Sumar deuda (vale) | +deuda | −egreso |

### Panel de préstamos
- Lista de clientes con balance
- Al tocar cliente: 3 botones (Colocar deuda, Abono a Deuda, Sumar Deuda)
- Historial de transacciones por cliente
- Préstamos visibles en stats generales

---

## Caja Registradora

### Tipos de movimiento
- `income` — Ingreso (ventas, abonos de fiado)
- `expense` — Egreso (vales, retiros)
- `ajuste` — Ajuste manual de saldo

### Panel de caja
- Balance actual en tiempo real
- Historial de últimos 50 movimientos
- Botón "Ajustar saldo" para conciliación

---

## Reportes

### 1. Stats (dashboard)
- Ventas hoy (cantidad + total)
- Stock bajo (≤5 unidades)
- Total préstamos activos
- Balance de caja
- Ventas del mes

### 2. Reporte Semanal
- Ventas por día (últimos 7)
- Breakdown por método de pago (cash vs credit)
- Total semanal

### 3. Reporte por Categoría
- Ventas del mes agrupadas por categoría
- Cantidad y total por categoría

### 4. Reporte de Ganancias
- Revenue total, costo total, ganancia neta
- Margen de ganancia (%)
- Desglose por producto

### 5. Top Productos
- Ranking de productos más vendidos del mes
- Cantidad vendida + total generado

---

## Despliegue

### Requisitos
- Docker + Docker Compose
- Tailscale (para acceso remoto)
- VPS Ubuntu (ARM64 o x86_64)

### Comandos
```bash
# Clonar/posicionar en el directorio
cd ~/hermes-project/lolicup-pos

# Construir imagen
docker compose build

# Iniciar
docker compose up -d

# Verificar
curl http://100.96.203.110:8082/api/products

# Logs
docker logs tiendita-pos

# Reiniciar tras cambios
docker compose build && docker compose up -d
```

### docker-compose.yml
```yaml
services:
  lolicup-pos:
    container_name: tiendita-pos
    build: .
    restart: always
    ports:
      - "100.96.203.110:8082:3000"
    volumes:
      - ./data:/app/data   # Bind mount a BD local
```

### Notas importantes
- **NO eliminar el contenedor sin preguntar** — los datos están en `./data/tiendita.db`
- **NO usar volúmenes Docker** — usar bind mount a `./data`
- El contenedor DEBE llamarse `tiendita-pos`
- Puerto 8082 debe estar libre
- Tailscale IP puede cambiar — verificar con `tailscale ip -4`

---

## Mantenimiento

### Migraciones
El servidor ejecuta migraciones ALTER TABLE al iniciar:
```javascript
try { db.exec("ALTER TABLE sales ADD COLUMN change_given REAL DEFAULT 0"); } catch(e) {}
try { db.exec("ALTER TABLE sales ADD COLUMN subtotal REAL DEFAULT 0"); } catch(e) {}
try { db.exec("ALTER TABLE sales ADD COLUMN discount REAL DEFAULT 0"); } catch(e) {}
```

### Timezone
Todas las queries usan `America/Tegucigalpa` (UTC-6). Las fechas se almacenan en formato ISO sin timezone y se ajustan en queries con `-6 hours`.

### Backup
- Cron job `4600d61946b9`: backup cada 12h a Google Drive
- Archivo de BD: `data/tiendita.db` (+ `.db-wal`, `.db-shm`)

---

## Changelog de Features

### v1.0 — Core
- ✅ POS táctil con catálogo, carrito, numpad
- ✅ SQLite con WAL mode
- ✅ CRUD productos, ventas, clientes
- ✅ Sistema de fiados (préstamos)

### v1.1 — UX
- ✅ Dark mode completo
- ✅ Numpad cuadrado perfecto (aspect-ratio: 1)
- ✅ Reloj 12h + saludo dinámico
- ✅ Sonidos Web Audio API (click, add, success, error)
- ✅ `onpointerdown` unificado (elimina doble disparo táctil)
- ✅ Flujo de cobro rediseñado (carrito → pagar → numpad)
- ✅ Toggle dark mode con animación slide

### v1.2 — Reportes
- ✅ Stats dashboard (hoy, mes, stock bajo, préstamos)
- ✅ Reporte semanal
- ✅ Reporte por categoría
- ✅ Reporte de ganancias (revenue - cost)
- ✅ Top productos vendidos

### v1.3 — PDF Venta Blanquita
- ✅ PDF tamaño carta, 1 hoja
- ✅ Papelitos (efectivo en caja + préstamos)
- ✅ BLANCA FIADO con línea punteada
- ✅ Mensaje bonito rotativo diario
- ✅ Row height dinámico

### v1.4 — Fiados avanzados
- ✅ 3 botones en panel de préstamos (Colocar deuda, Abono, Sumar Deuda)
- ✅ Sumar Deuda descuenta de caja automáticamente
- ✅ Abono suma a caja automáticamente
- ✅ Historial de transacciones por cliente

### v1.5 — Caja
- ✅ Panel de caja con balance en vivo
- ✅ Ajuste de saldo manual
- ✅ Registro automático de ventas en caja
- ✅ Registro automático de abonos/vales en caja

### v1.6 — Calidad
- ✅ Auto-emoji para ~100 productos hondureños
- ✅ Migraciones automáticas de schema
- ✅ Descuento en Lempiras en carrito
- ✅ Cambio calculado en pantalla de cobro

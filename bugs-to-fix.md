# Bugs & Fixes — Tiendita POS v1 (Don Fran)

> Documento generado por análisis multi-agente — 1 de junio de 2026
> Última actualización: 2 de junio de 2026

---

## CORREGIDOS ✅

### B1. Tipo `loan` no actualiza balance del cliente
- **Fix:** Agregado `case 'loan'` en `POST /api/customers/:id/transactions` que ejecuta `UPDATE customers SET balance = balance + ?`
- **Verificado:** Balance sube correctamente al registrar compra fiada.

### B2. Falta de atomicidad venta↔caja
- **Fix:** `POST /api/sales` ahora inserta automáticamente en `cash_register` dentro de la misma transacción SQL cuando `payment='cash'`. Eliminada llamada redundante del frontend.
- **Verificado:** Una venta = un solo movimiento de caja.

### B3. `loadAnomalies()` no definida
- **Fix:** Llamada eliminada de `renderReports()`. Reemplazada por comentario `// Anomalías: no implementado aún`.

### B4. PUT /api/products sin validación
- **Fix:** Agregada validación idéntica al POST: nombre requerido, precio numérico. Retorna 422.

### B5. N+1 queries en GET /api/sales
- **Fix:** Recolecta todos los IDs de productos, una sola query `WHERE id IN (...)`, construye `Map` en memoria.
- **Verificado:** 1 sola consulta para todas las ventas, independientemente de cantidad de items.

### B6. Dependencia uuid no usada
- **Fix:** Eliminada de `package.json`. `express` actualizado de 4.21.0 a 4.22.2. 0 vulnerabilidades en npm audit.

### B7. Construcción ambigua de timestamps HN
- **Fix:** Función helper `getHNNow()`. Las 5 ocurrencias del patrón duplicado reemplazadas.

### B8. Validación insuficiente en múltiples endpoints
- **Fix:** POST /api/customers (name requerido, 422), POST /api/cash (type + amount requeridos, 422), POST /api/cash/adjust (amount requerido, 422).

### B9. Sin índices secundarios
- **Fix:** `CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at)` y `CREATE INDEX IF NOT EXISTS idx_loan_txns_customer ON loan_transactions(customer_id)`.

### B11. seed.js referenciado pero inexistente
- **Fix:** Script "seed" eliminado de `package.json`.

### N1. doSale() duplicaba registro de caja
- **Fix:** El backend ya inserta en cash_register. Eliminada la llamada redundante `POST /api/cash` del frontend.

### N2. saveCash() bloqueaba ajustes de monto 0
- **Fix:** `if(!a)return` → `if(isNaN(a))return`. Montos de 0 ahora funcionan.

### N3. Modal de caja no limpiaba campo monto
- **Fix:** `openCashModal()` ahora ejecuta `document.getElementById('cash-amount').value = ''`.

### N4. PDF: líneas divisorias solapaban texto en filas compactas
- **Fix:** Eliminadas líneas horizontales del cuerpo de la tabla. Solo guías verticales sutiles (#ddd, 0.15pt). Separación visual por espacio natural entre filas.

### N5. PDF: mínimo 36pt por fila impedía 50+ productos en 1 hoja
- **Fix:** Mínimo bajado a 8pt. Font-size dinámico: `max(6, min(11, rowH × 0.72))`. Centrado vertical adaptativo.

### N6. Códigos HTTP inconsistentes
- **Fix:** Validación → 422, conflictos de negocio → 409, recurso no encontrado en DELETE → 404.

---

## PENDIENTES

### B10. IDs de cash_register inconsistentes
- Movimientos automáticos generan IDs con patrón ligeramente distinto. Cosmético, sin impacto funcional.

### B12. README desactualizado
- IP, puerto, ruta del proyecto y conteo de líneas no reflejan el estado actual.

### P3. Sin testing automatizado
- Cero pruebas unitarias o de integración.

---

## CORREGIDOS (Run 2 — UI/UX)

### P1. Sin autenticación → CORREGIDO ✅
- **Fix:** Pantalla de login con PIN de 4-5 dígitos. Usuarios: Alejandro (31468), Axel (31001), Blanca (00000), Willian (9999).
- **Verificado:** PIN screen bloquea acceso hasta autenticación correcta. Badge muestra usuario logueado con botón de bloqueo.

### P2. XSS en frontend → CORREGIDO ✅
- **Fix:** Función `esc()` aplicada a todos los datos dinámicos en innerHTML (nombres de productos, clientes, descripciones, categorías, etc.).
- **Verificado:** Todos los template literals con datos de usuario/envío ahora pasan por `esc()`.

### Q1. Monolito HTML/CSS/JS → CORREGIDO ✅
- **Fix:** Extraídos CSS → `style.css` (370 líneas), JS → `app.js` (650 líneas), HTML → `index.html` (130 líneas shell limpio).
- **Verificado:** App carga correctamente con archivos externos. Dockerfile actualizado para copiar style.css + app.js.

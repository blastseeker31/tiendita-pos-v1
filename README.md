# Tiendita POS v1

Primera versión del sistema de punto de venta táctil para tiendas de retail. Este repositorio es legacy y se conserva como referencia histórica.

> ⚠️ **Versión legacy.** Para la versión actual, ver [don-fran-pos](https://github.com/blastseeker31/don-fran-pos).

## Stack

- **Frontend:** HTML5, CSS3, JavaScript (vanilla)
- **Backend:** Node.js + Express
- **Base de datos:** SQLite
- **Despliegue:** Docker

## Características (v1.0 — v1.6)

- Interfaz táctil responsive
- Catálogo de productos y carrito de compras
- Numpad táctil para cobro
- Sistema de fiados
- Caja registradora
- Reportes de ventas y ganancias
- Recibos PDF tamaño carta
- Modo oscuro con toggle animado
- Auto-emoji para productos hondureños

## Instalación

```bash
git clone git@github.com:blastseeker31/tiendita-pos-v1.git
cd tiendita-pos-v1
npm install
node server.js
```

## Estructura

```
tiendita-pos-v1/
├── server.js          # Backend: API REST
├── index.html         # Frontend: SPA del POS
├── app.js             # Lógica adicional de frontend
├── style.css          # Estilos
├── package.json
├── Dockerfile
├── docker-compose.yml
└── data/              # Base de datos SQLite
```

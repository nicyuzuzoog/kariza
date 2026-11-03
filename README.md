# Mrskariza

Mrskariza is a full stock management system for a school (student supplies + daily food). It tracks procurement, stock entry/exit, branch transfers, low-stock notifications, transaction history, and provides role-based dashboards and reports.

## Tech Stack

- **Frontend:** React 19, Vite, React Router, Recharts, Bootstrap 5 + Bootstrap Icons (custom design system)
- **Backend:** Node.js (ESM), Express, Mongoose
- **Database:** MongoDB Atlas
- **Deployment:** Vercel (monorepo with Express API via `api/[...path].js` and SPA fallback)

## Features

- **Roles:** `super_admin` (full access + user management), `accountant`, `storekeeper`, `principal` (read-only/audit focused). Super admin bypasses role guards.
- **Inventory:** Products with main store (`quantity`) and branch store (`branchQuantity`), reorder levels, categories, suppliers, images, and archive/restore.
- **Purchases:** PO flow `ordered → received/cancelled`. Receiving increments stock in main or branch store and writes ledger entries.
- **Issues:** Issue items to recipients (students/classes/departments/staff/other). Voiding restocks items and writes reversing ledger entries.
- **Transfers:** Move stock between main and branch `in_transit → completed/cancelled`. Source decremented on dispatch, destination incremented on completion, source restored on cancel.
- **Ledger:** Immutable audit trail of all stock movements with filters and totals.
- **Notifications:** Low-stock alerts deduplicated per product/type; auto-resolved when stock recovers. Bell with unread count and polling.
- **Reports:** Stock on hand, movement analysis (by type/day/product), and consumption by department/class/recipient.
- **Users & Audit:** User management (super admin only), audit log (super admin/principal).
- **Security:** JWT auth, bcryptjs, `tokenVersion` invalidation, login rate limiting, zod validation, role guards.

## Project Structure

```text
mrskariza/
├── api/[...path].js      # Vercel serverless catch-all for Express API
├── client/               # Vite React app
├── server/               # Express API (controllers, models, routes, utils, validators)
├── vercel.json           # Vercel routing/build config
├── package.json          # Root scripts (dev, build, seed)
└── .env.example
```

## Prerequisites

- Node.js 18+ 
- MongoDB Atlas cluster (or local MongoDB)
- npm

> On Windows PowerShell, use `npm.cmd` if `npm` is blocked.

## Environment Variables

Copy `.env.example` to `.env` in the repo root and fill values.

### Root `.env`

```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/mrskariza
JWT_SECRET=change-me-to-a-long-random-string
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
SUPER_ADMIN_EMAIL=superadmin@mrskariza.school
SUPER_ADMIN_PASSWORD=Admin@1234
SUPER_ADMIN_NAME=System Super Admin
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
LOGIN_RATE_LIMIT_WINDOW_MS=600000
LOGIN_RATE_LIMIT_MAX=10
SEED_DEMO=false
```

### Client `.env` (`client/.env`)

```env
# Leave empty to use the Vite proxy (/api) in development.
VITE_API_URL=

# Show demo-account shortcuts on the sign-in screen.
VITE_SHOW_DEMO=true
```

## Installation & Local Development

From repo root:

```bash
# Install root deps
npm install

# Install client deps
cd client
npm.cmd install  # or npm install
cd ..
```

Run both servers in dev mode (API on `:5000`, client on `:5173`):

```bash
npm run dev
```

Or run separately:

```bash
# API
npm run server:dev

# Client
npm run client:dev
```

The Vite dev server proxies `/api` to `http://localhost:5000` (configured in `client/vite.config.js`).

## Database Seeding

```bash
# Create only Super Admin (uses env vars above)
npm run seed

# Seed full demo data (products, suppliers, purchases, issues, transfers, users)
npm run seed:demo

# Wipe and rebuild demo data
npm run seed:demo:fresh
```

### Demo Credentials

When demo data is seeded:

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `superadmin@mrskariza.school` | `Admin@1234` |
| Accountant | `accountant@mrskariza.school` | `Account@1234` |
| Storekeeper | `storekeeper@mrskariza.school` | `Store@1234` |
| Principal | `principal@mrskariza.school` | `Principal@1234` |

Demo account buttons on the login page are shown when `VITE_SHOW_DEMO=true` or in dev mode.

## Build

Build the client for production:

```bash
cd client
npm.cmd run build
```

Output goes to `client/dist/`.

## Deployment (Vercel)

This repo is configured for Vercel monorepo deployment:

- `api/[...path].js` wraps the Express app as a serverless function
- `vercel.json` routes `/api/*` to the serverless function and rewrites all other routes to `/index.html` for SPA routing
- Build command: Vercel will build the client (or use `npm run build` as configured)

### Vercel Environment Variables

Set these in your Vercel project settings (Production/Preview/Development):

**Server/Root:**
- `MONGO_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN` (e.g., `7d`)
- `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `SUPER_ADMIN_NAME`
- `NODE_ENV=production`
- `CLIENT_URL` (your deployed URL, e.g., `https://your-app.vercel.app`)
- Rate limiting vars (optional, have defaults)

**Client (build-time):**
- `VITE_API_URL` (leave empty to use same-origin `/api`)
- `VITE_SHOW_DEMO` (set to `false` for production if desired)

## API Conventions

- Lists: `{ items, total, page, pages, stats/totals }`
- Single resources: `{ product }`, `{ purchase }`, `{ issue }`, `{ transfer }`, `{ user }`
- Auth: `{ token, user }`
- Pagination: `page`, `limit` (max 100)
- Auth: `Authorization: Bearer <token>`

## Notes

- Stock quantities cannot be edited directly on products — use **Adjust Stock** or procurement/issues/transfers.
- All stock changes go through `moveStock()` and write immutable `LedgerEntry` records.
- Low-stock notifications are auto-resolved when stock recovers above reorder level.
- Archived products are hidden from active inventory but preserve history.

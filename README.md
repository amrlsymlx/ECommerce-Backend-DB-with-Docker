# Mini E-Commerce Backend

A REST API for a small e-commerce system, built with Node.js, Express, and PostgreSQL, using JWT for authentication and Docker for deployment. There is **no frontend** — you interact with it purely through HTTP requests (curl, Postman, `Invoke-RestMethod`, etc.).

## Overview

The API covers the core backend of an online store:

- **Auth** — register/login customers, issue JWTs
- **Products** — public catalog browsing, admin-only create/update/delete
- **Cart** — per-user cart, add/update/remove items
- **Orders** — checkout a cart into an order (transactional, stock-safe), view order history
- **Admin** — view all orders across all users

Two roles exist: `customer` (default on registration) and `admin` (seeded manually). Role is embedded in the JWT and checked per-route.

## Flow

**Registration → Login → Browse → Cart → Checkout**

1. `POST /api/auth/register` — email + password (min 8 chars) validated, password hashed with bcrypt, user stored with role `customer`.
2. `POST /api/auth/login` — credentials checked against the stored hash; on success, a JWT (`{ id, email, role }`, 1-day expiry) is signed and returned.
3. The client stores the JWT and sends it as `Authorization: Bearer <token>` on every protected request.
4. `GET /api/products` — anyone (no token) can browse the catalog.
5. `POST /api/cart` — an authenticated user adds a product + quantity to their cart; stock is checked before the item is added.
6. `GET /api/cart` / `PUT /api/cart/:itemId` / `DELETE /api/cart/:itemId` — view or adjust the cart before checkout.
7. `POST /api/orders` — checkout. This runs as a single database transaction:
   1. Lock and read the user's cart items (`FOR UPDATE`)
   2. Reject if the cart is empty
   3. Validate stock for every item
   4. Insert the `order` (status `PENDING`) and its `order_items`
   5. Decrement product stock
   6. Clear the cart
   7. Commit — or roll back entirely if any step fails

   This guarantees there are never partial orders or oversold stock, even under concurrent checkouts.
8. `GET /api/orders` / `GET /api/orders/:id` — the user reviews their own order history.
9. `GET /api/admin/orders` — an admin can see every order in the system.

Every protected route passes through `authMiddleware` (verifies the JWT, attaches `req.user`) and, for admin-only routes, `adminMiddleware` (rejects anything but `role === 'admin'`).

## Architecture

Three containers, wired by `docker-compose.yml`:

| Container | Image | Purpose | Host port |
|---|---|---|---|
| `ecommerce-api` | built from `Dockerfile` | Express REST API | `3000` |
| `ecommerce-postgres` | `postgres:16` | database, auto-seeded on first boot from `database/schema.sql` + `database/seed.sql` | `5432` |
| `ecommerce-pgadmin` | `dpage/pgadmin4` | optional web GUI for browsing the database | `5050` |

Containers talk to each other over Docker's internal network by container name (the API connects to the DB at host `postgres`, not `localhost`). Database data lives in a named volume (`postgres_data`) so it survives restarts/rebuilds.

**Request path:** `app.js` wires routes → `middleware` (auth/admin) → `controllers` (business logic + SQL via the `pg` pool in `config/db.js`) → `utils/response.js` for a consistent error shape.

```text
ecommerce-backend/
├── src/
│   ├── config/db.js          # PostgreSQL connection pool
│   ├── controllers/          # business logic per resource
│   ├── middleware/           # JWT auth, admin role check
│   ├── routes/                # route → controller wiring
│   ├── utils/response.js     # shared error response helper
│   └── app.js                 # express app, route mounting
├── database/
│   ├── schema.sql             # table definitions
│   └── seed.sql                # admin account + sample products
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── package.json
└── server.js                   # entrypoint
```

**Data model** (`database/schema.sql`): `users` → `cart_items` → `products`; `orders` → `order_items` → `products`. Orders keep a frozen `price` per line item at time of purchase, independent of later product price changes.

## Tech Stack

- **Runtime:** Node.js (LTS) + Express.js
- **Database:** PostgreSQL 16 (via the `pg` driver, connection pooling)
- **Auth:** JSON Web Tokens (`jsonwebtoken`)
- **Password hashing:** `bcrypt`
- **Other:** `cors`, `dotenv`
- **Dev:** `nodemon`
- **Infra:** Docker + Docker Compose, pgAdmin4 (optional DB GUI)

## Input & Output

All responses are JSON. Errors follow a consistent shape:

```json
{ "success": false, "message": "Insufficient stock" }
```

Successful responses return the resource directly (no wrapper). Examples:

| Endpoint | Input | Output |
|---|---|---|
| `POST /api/auth/register` | `{ "email": "you@example.com", "password": "Password123!" }` | `201` `{ "message": "User registered successfully" }` |
| `POST /api/auth/login` | `{ "email": "...", "password": "..." }` | `200` `{ "token": "<JWT>" }` |
| `GET /api/products` | — | `200` `[{ "id", "name", "description", "price", "stock" }, ...]` |
| `POST /api/products` (admin) | `{ "name", "description", "price", "stock" }` | `201` `{ "id": 1 }` |
| `POST /api/cart` (auth) | `{ "productId": 1, "quantity": 2 }` | `201` cart item row |
| `GET /api/cart` (auth) | — | `200` `[{ "itemId", "productId", "name", "quantity", "price" }, ...]` |
| `PUT /api/cart/:itemId` (auth) | `{ "quantity": 3 }` | `200` updated cart item |
| `DELETE /api/cart/:itemId` (auth) | — | `200` `{ "message": "Item removed from cart" }` |
| `POST /api/orders` (auth) | — (uses current cart) | `201` `{ "orderId": 5, "status": "PENDING" }` |
| `GET /api/orders` (auth) | — | `200` `[{ "id", "total_amount", "status", "created_at" }, ...]` |
| `GET /api/orders/:id` (auth) | — | `200` order + `items[]` |
| `GET /api/admin/orders` (admin) | — | `200` `[{ "id", "userId", "email", "total_amount", "status", "created_at" }, ...]` |

Authenticated requests must include:
```
Authorization: Bearer <JWT_TOKEN>
```

### Full endpoint reference

**Auth**
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new customer account |
| POST | `/api/auth/login` | Login and receive a JWT |

**Products**
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/products` | Public | List products |
| GET | `/api/products/:id` | Public | Get product details |
| POST | `/api/products` | Admin | Create product |
| PUT | `/api/products/:id` | Admin | Update product |
| DELETE | `/api/products/:id` | Admin | Delete product |

**Cart**
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/cart` | User | Add item to cart |
| GET | `/api/cart` | User | View cart |
| PUT | `/api/cart/:itemId` | User | Update cart item quantity |
| DELETE | `/api/cart/:itemId` | User | Remove item from cart |

**Orders**
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/orders` | User | Place an order from cart (transactional) |
| GET | `/api/orders` | User | List own order history |
| GET | `/api/orders/:id` | User | Get order details |
| GET | `/api/admin/orders` | Admin | List all orders |

`GET /health` is a public, unauthenticated liveness check (`{ "status": "ok" }`).

## How to Set Up This Project on Another Device

You only need **Docker** on the new machine — Node.js and PostgreSQL both run inside containers.

1. **Get the code onto the machine**
   ```bash
   git clone <this-repo-url>
   cd ecommerce-backend
   ```
   (or copy the folder over directly)

2. **Install Docker Desktop** (includes Docker Compose v2) — [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)
   - **Windows:** requires the WSL 2 backend. If Docker reports WSL2 isn't enabled, run in an admin PowerShell then restart:
     ```powershell
     wsl --install --no-distribution
     ```
   - **macOS:** works out of the box (Intel or Apple Silicon)
   - **Linux:** install Docker Engine + the Compose plugin via your distro's package manager
   - Verify:
     ```bash
     docker --version
     docker compose version
     ```

3. **Create your `.env`**
   ```bash
   cp .env.example .env
   ```
   The defaults work as-is for local use. Only change `JWT_SECRET` and DB credentials before deploying somewhere shared/public.

4. **Build and start everything**
   ```bash
   docker compose up -d --build
   ```
   This starts the API, Postgres (auto-seeded from `database/schema.sql` + `seed.sql` on first boot), and pgAdmin.

5. **Confirm it's healthy**
   ```bash
   docker compose ps
   curl http://localhost:3000/health
   ```

### Seeded data

- Admin login: `admin@example.com` / `Admin123!`
- 5 sample products (Gaming Laptop, Mechanical Keyboard, Gaming Mouse, Monitor, Headset)

### Everyday commands

```bash
docker compose up -d --build   # (re)build and start everything in the background
docker compose ps              # check container status
docker compose logs -f api     # tail the API's logs
docker compose down            # stop everything (keeps the database volume)
docker compose down -v         # stop everything AND delete the database volume
docker compose restart api     # restart just one service
```

### Running locally without Docker

1. `npm install`
2. Start a PostgreSQL 16 instance and point `.env` at it
3. Apply schema + seed:
   ```bash
   psql -h localhost -U admin -d ecommerce -f database/schema.sql
   psql -h localhost -U admin -d ecommerce -f database/seed.sql
   ```
4. `npm run dev`

### Viewing the database with pgAdmin

1. Open `http://localhost:5050`, log in with `admin@example.com` / `admin`.
2. Register a server: Host `postgres` (the container name, not `localhost`), Port `5432`, Maintenance DB `ecommerce`, Username `admin`, Password `password`.
3. Browse **Servers → ecommerce → Databases → ecommerce → Schemas → public → Tables**.

### Troubleshooting

- **Port already in use (3000/5432/5050):** something else on the machine holds that port — stop it, or remap the left side of the port mapping in `docker-compose.yml`.
- **API container restart-loops with a `bcrypt` native module error:** don't bind-mount source into the `api` container — `bcrypt` is compiled per-OS, so a host-built copy can't run in the Linux container. This repo's `docker-compose.yml` intentionally avoids that mount.
- **pgAdmin login fails with a `NoneType` error:** a stale-session bug in pgAdmin, not a real auth failure — retry in a private browser window or `docker compose restart pgadmin`.

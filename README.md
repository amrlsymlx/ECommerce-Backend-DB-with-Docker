# Mini E-Commerce Backend

A production-style Mini E-Commerce Backend REST API built with Node.js, Express, PostgreSQL, JWT authentication, and Docker.

This is an **API only** project — there is no website/frontend. You interact with it by sending HTTP requests (via `curl`, PowerShell's `Invoke-RestMethod`, Postman, etc.) to `http://localhost:3000`.

## Tech Stack

- Node.js (LTS) + Express.js
- PostgreSQL 16
- JWT authentication
- bcrypt password hashing
- Docker + Docker Compose

## Architecture

Everything runs as three Docker containers, wired together by `docker-compose.yml` — nothing needs to be installed on the host besides Docker itself:

| Container | Image | Purpose | Host port |
|---|---|---|---|
| `ecommerce-api` | built from `Dockerfile` | the Express REST API | `3000` |
| `ecommerce-postgres` | `postgres:16` | the database, auto-seeded on first boot | `5432` |
| `ecommerce-pgadmin` | `dpage/pgadmin4` | optional web GUI for browsing the database | `5050` |

The containers talk to each other over Docker's internal network using their **container names** as hostnames (e.g. the API connects to the database at host `postgres`, not `localhost`). From your own machine, everything is reached via `localhost` and the ports above.

Database data is stored in a named Docker volume (`postgres_data`), so it survives container restarts and rebuilds — it's only wiped if you explicitly remove that volume.

## Prerequisites

You only need **Docker** — you do **not** need to install Node.js or PostgreSQL yourself, they run inside containers.

- **Docker Desktop** (includes Docker Compose v2) — [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)
  - **Windows**: requires the **WSL 2** backend.
    - If Docker Desktop reports WSL2 isn't enabled, run in an **admin** PowerShell, then restart your PC:
      ```powershell
      wsl --install --no-distribution
      ```
    - If it reports the `LanmanServer` (Windows Server) service is disabled, also run (as admin):
      ```powershell
      Set-Service -Name LanmanServer -StartupType Automatic
      Start-Service -Name LanmanServer
      ```
  - **macOS**: Docker Desktop works out of the box (Intel or Apple Silicon).
  - **Linux**: install Docker Engine + the Compose plugin via your distro's package manager, or Docker Desktop for Linux.
- Confirm it's working before continuing:
  ```bash
  docker --version
  docker compose version
  ```
- Optional: `git` if you're cloning this repo onto another machine.

## Running On Another Device

1. Get the project onto the machine — either copy the `ecommerce-backend` folder over, or `git clone` it if it's in a repo.
2. Make sure Docker Desktop is installed and running (see Prerequisites above), and its whale icon shows "Engine running".
3. From inside the `ecommerce-backend` folder, create your `.env`:
   ```bash
   cp .env.example .env
   ```
   The default values work as-is for local use. Only change `JWT_SECRET` and DB credentials if you're deploying somewhere shared/public.
4. Build and start everything:
   ```bash
   docker compose up -d --build
   ```
5. Confirm it's healthy:
   ```bash
   docker compose ps
   curl http://localhost:3000/health
   ```

That's it — no Node.js install, no PostgreSQL install, no manual dependency setup required on the new machine.

### Everyday commands

```bash
docker compose up -d --build   # (re)build and start everything in the background
docker compose ps              # check container status
docker compose logs -f api     # tail the API's logs
docker compose down            # stop everything (keeps the database volume)
docker compose down -v         # stop everything AND delete the database volume
docker compose restart api     # restart just one service
```

### Seeded accounts / data

- Admin login: `admin@example.com` / `Admin123!`
- 5 sample products (Gaming Laptop, Mechanical Keyboard, Gaming Mouse, Monitor, Headset)

## Trying The API

No frontend — you call the endpoints directly. Examples in PowerShell:

```powershell
# Register
Invoke-RestMethod -Method Post http://localhost:3000/api/auth/register `
  -ContentType "application/json" -Body '{"email":"you@example.com","password":"Password123!"}'

# Login (returns a JWT)
$login = Invoke-RestMethod -Method Post http://localhost:3000/api/auth/login `
  -ContentType "application/json" -Body '{"email":"you@example.com","password":"Password123!"}'

# List products (public, no token needed)
Invoke-RestMethod http://localhost:3000/api/products

# Add to cart (needs the token from login)
$headers = @{ Authorization = "Bearer $($login.token)" }
Invoke-RestMethod -Method Post http://localhost:3000/api/cart -Headers $headers `
  -ContentType "application/json" -Body '{"productId":1,"quantity":2}'

# Place an order
Invoke-RestMethod -Method Post http://localhost:3000/api/orders -Headers $headers
```

Equivalent `curl` for macOS/Linux:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"Password123!"}'
```

## Viewing the Database Schema with a GUI (pgAdmin)

1. Open **http://localhost:5050**.
2. Log in with `admin@example.com` / `admin`.
3. First time only — register the server: right-click **Servers → Register → Server...**
   - **General** tab → Name: anything (e.g. `ecommerce`)
   - **Connection** tab → Host: `postgres` (the container name, not `localhost`), Port: `5432`, Maintenance DB: `ecommerce`, Username: `admin`, Password: `password`
4. Expand **Servers → ecommerce → Databases → ecommerce → Schemas → public → Tables** to see `users`, `products`, `cart_items`, `orders`, `order_items`.

## Running Locally (without Docker)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start a PostgreSQL 16 instance and update `.env` accordingly.
3. Apply the schema and seed data:
   ```bash
   psql -h localhost -U admin -d ecommerce -f database/schema.sql
   psql -h localhost -U admin -d ecommerce -f database/seed.sql
   ```
4. Run the app:
   ```bash
   npm run dev
   ```

## API Overview

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new customer account |
| POST | `/api/auth/login` | Login and receive a JWT |

### Products
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/products` | Public | List products |
| GET | `/api/products/:id` | Public | Get product details |
| POST | `/api/products` | Admin | Create product |
| PUT | `/api/products/:id` | Admin | Update product |
| DELETE | `/api/products/:id` | Admin | Delete product |

### Cart
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/cart` | User | Add item to cart |
| GET | `/api/cart` | User | View cart |
| PUT | `/api/cart/:itemId` | User | Update cart item quantity |
| DELETE | `/api/cart/:itemId` | User | Remove item from cart |

### Orders
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/orders` | User | Place an order from cart (transactional) |
| GET | `/api/orders` | User | List own order history |
| GET | `/api/orders/:id` | User | Get order details |
| GET | `/api/admin/orders` | Admin | List all orders |

All authenticated routes require:
```
Authorization: Bearer <JWT_TOKEN>
```

## Order Placement Transaction

Placing an order runs inside a single PostgreSQL transaction:

1. Read cart items (row-locked)
2. Validate stock for every item
3. Create the order
4. Create order items
5. Deduct product stock
6. Clear the cart
7. Commit — or roll back entirely if any step fails

This guarantees no partial orders and no stock inconsistency.

## Error Format

```json
{
  "success": false,
  "message": "Insufficient stock"
}
```

## Troubleshooting

**Docker Desktop won't start / "WSL 2" or "LanmanServer" error (Windows)**
See the Prerequisites section above — this needs an admin PowerShell to enable WSL2 and the LanmanServer service, followed by a restart.

**`docker` command not found in a new terminal**
Open a fresh terminal after installing Docker Desktop so it picks up the updated PATH. If it still doesn't work, the CLI binary is at:
```
C:\Users\<you>\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe
```

**API container keeps restarting with `Error loading shared library ... bcrypt_lib.node: Exec format error`**
This happens if the API container's `node_modules` gets overwritten by a bind mount to your host's `node_modules` (e.g. if you add `volumes: - .:/usr/src/app` back into `docker-compose.yml` for live-reload). Native modules like `bcrypt` are compiled per-OS, so a Windows/macOS-built copy can't run inside the Linux container. This project's `docker-compose.yml` intentionally does **not** bind-mount source code into the `api` container for this reason.

**pgAdmin login fails with `'NoneType' object is not subscriptable`**
This is a stale-session bug in pgAdmin, not a real auth failure. Fix: open pgAdmin in a private/incognito browser window, or clear cookies for `localhost:5050`, then log in again. Restarting the container also helps: `docker compose restart pgadmin`.

**Port already in use (3000, 5432, or 5050)**
Something else on your machine is using that port. Either stop it, or change the left-hand side of the port mapping in `docker-compose.yml` (e.g. `"3001:3000"`) and adjust the URL you use accordingly.

## Project Structure

```text
ecommerce-backend/
├── src/
│   ├── config/db.js
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── utils/
│   └── app.js
├── database/
│   ├── schema.sql
│   └── seed.sql
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── package.json
└── server.js
```

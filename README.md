# Online Sneakers Shop — SOLESTREET

A responsive full-stack sneaker storefront with a seeded catalog, search and category filters, sorting, product details, size selection, persistent browser cart, customer accounts, cash-on-delivery checkout, order history and an administrator dashboard for product and order management.

This project lives in its own folder inside `Flight_Management` and uses an independent SQLite database and port. It does not modify or share AeroCadet application data.

## Technology

- Node.js 24 built-in HTTP server and SQLite (`node:sqlite`)
- HTML, CSS and JavaScript frontend with code-drawn sneaker illustrations
- Scrypt password hashing, HTTP-only same-site session cookies, server-side validation
- Docker Compose for local deployment; Jenkins pipeline for checks, tests and optional deployment
- Node's built-in test runner; no `npm install` is needed

## Start after restarting the laptop

1. Open Docker Desktop and wait for the engine to start, if you want the containerized version.
2. Open PowerShell in `C:\Users\thira\Flight_Management\Online-Sneakers-Shop`.
3. Copy `.env.example` to `.env` and set a strong `ADMIN_PASSWORD` before the first Docker start.
4. Run `docker compose up -d --build`.
5. Open <http://localhost:8091>. Check `docker compose ps` if needed.
6. When finished, run `docker compose down`. The `shop-data` volume retains your data.

For a direct local start without Docker, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` as PowerShell environment variables and run `npm start`; the app is at <http://localhost:8091>. The local database is saved under `data/sneaker-shop.db`.

## Test

```powershell
npm run check
npm test
```

## Jenkins

Create a Pipeline job pointing to `https://github.com/ThiruchenthillSP/Online-Sneakers-Shop.git` and use `Jenkinsfile` as the script path. `DEPLOY=false` runs syntax and automated tests. Set `DEPLOY=true` only when the Jenkins machine has Docker access and a local `.env` containing `ADMIN_PASSWORD`; the deployment exposes port 8091.

The source is published on the linked GitHub repository. Jenkins should use its `main` branch.

## Feature scope and limitations

- Checkout supports **cash on delivery only**. This is a project demonstration; no real payment service, shipping carrier or email integration is connected.
- Product stock is shared across sizes in this version; sizes are recorded per order, but size-specific inventory is not modeled.
- The administrator is created on first startup only when `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set. Change the password in a production deployment using a separate account-management workflow.
- Use TLS, a reverse proxy, rate limiting, backups and operational monitoring before a public deployment.

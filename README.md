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

1. Open Docker Desktop and wait for the engine to start.
2. Open PowerShell in `C:\Users\thira\Flight_Management\Online-Sneakers-Shop`.
3. The private `.env` already exists on this laptop. On a fresh clone, copy `.env.example` to `.env` and replace the example password.
4. Run `.\scripts\start-shop.ps1` and then `.\scripts\status-shop.ps1`.
5. Open <http://localhost:8091>. The shop service should be healthy.
6. When finished, run `.\scripts\stop-shop.ps1`. The `shop-data` volume retains data.

A direct start without Docker is also possible: set `ADMIN_EMAIL` and `ADMIN_PASSWORD` as private PowerShell environment variables and run `npm start`.

## Test

```powershell
npm run check
npm test
```

## Jenkins

The Pipeline job uses `https://github.com/ThiruchenthillSP/Online-Sneakers-Shop.git` and `Jenkinsfile` on `main`. CI build #1 passed all eight tests with `DEPLOY=false`. The Docker deployment below was verified locally, not through that Jenkins build. Use `DEPLOY=true` only when the Jenkins agent has Docker access and a private `.env` in its workspace.

## Docker and Ansible verification

The built image is `online-sneakers-shop-shop:latest`, the running Compose container is `online-sneakers-shop-shop-1`, and the persistent SQLite volume is `online-sneakers-shop_shop-data`. Docker reports the container healthy; `GET /api/health` returns `status: ok` on port 8091.

From Ubuntu/WSL:

```bash
cd /mnt/c/Users/thira/Flight_Management/Online-Sneakers-Shop
ansible-playbook -i ansible/inventory ansible/playbook.yml
ansible-playbook -i ansible/inventory ansible/playbook.yml
```

The first playbook run started a stopped container (`changed=1`); the second run made no changes (`changed=0`). To force a rebuild, add `-e force_build=true`.

## Feature scope and limitations

- Checkout supports **cash on delivery only**. No real payment service, shipping carrier or email integration is connected.
- Product stock is shared across sizes; sizes are recorded per order, but size-specific inventory is not modeled.
- The administrator is created on first startup only when `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set. Keep the private `.env` out of Git.
- Add TLS, a reverse proxy, rate limiting, backups and monitoring before public deployment.

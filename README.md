
# Shopify Reviews

The root Git repository owns all source files in this project.

- `apps/shopify-remix-app`: active reviews app (Remix, React, MongoDB, Prisma sessions).
- `apps/shopify-node-app`: preserved Node/Express experiment; not the reviews backend.
- `test-data`: Shopify theme used for compatibility testing.

Use `develop` for integration and `main` for stable releases. Run Git commands from this repository; do not initialize another repository inside an app.

## Development

Use Node.js 24 and npm. From `apps/shopify-remix-app`:

```sh
npm ci
cp .env.example .env
npm run setup
npm run dev
```

Set the MongoDB connection in `.env`. Shopify CLI supplies Shopify credentials and the development URL during `npm run dev`; an authenticated development store is required. Install Shopify CLI on the host separately. Never commit `.env`, SQLite databases, or credentials.

Before opening a pull request:

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Tests use a unique disposable MongoDB database on `127.0.0.1:27017` and delete it afterward. To use a dedicated test server, set `MONGODB_TEST_URI`. Tests never inherit the app's `MONGODB_URI`. The root GitHub Actions workflow runs these checks with a MongoDB service; nested `.github` directories are preserved template material, not active repository workflows.

## Deployment

Build from `apps/shopify-remix-app` using its Dockerfile. Supply Shopify credentials, `SHOPIFY_APP_URL`, `SCOPES=write_products,write_app_proxy`, and MongoDB configuration at runtime. Use the actual HTTPS hosting URL and callback URL in `shopify.app.toml` before a production release. The proxy destination `/proxy` follows that app URL.

Persist `/app/prisma` using a Docker named volume for the current SQLite session store. Without persistence, container replacement loses sessions. This setup supports one app instance; choose shared session storage before scaling to multiple instances. MongoDB review storage must also be durable and backed up. Shopify configuration deployment and web-server hosting are separate steps.

## Original Git history

The former nested Git directories are preserved locally in `.repo-backups/shopify-remix-app.git` and `.repo-backups/shopify-node-app.git`. They are ignored and are not needed for a fresh checkout. Inspect an original history with:

```sh
git --git-dir=.repo-backups/shopify-remix-app.git --work-tree=apps/shopify-remix-app log --oneline
```

The root preservation commit captures the existing source before stabilization. Backups, local secrets, installed dependencies, and generated builds are deliberately excluded from commits.

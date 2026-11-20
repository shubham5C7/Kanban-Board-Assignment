# Collaborative Kanban

Multi-organization Kanban app with a React/Vite client, Express/Socket.IO API, and MongoDB via Mongoose.

## Run locally

1. Start MongoDB.
2. In `Backend`, copy `.env.example` to `.env`, set a long `JWT_SECRET` and `MONGODB_URI`, then run `npm install` and `npm run dev`.
3. Optionally run `npm run seed:demo` in `Backend` to add the demo personas and example boards (all use `Password123!`).
4. In `Frontend`, set `VITE_API_URL=http://localhost:5000` (and optionally `VITE_SOCKET_URL`), then run `npm install` and `npm run dev`.

For production, set `CLIENT_URL` to a comma separated allowlist of client origins, configure SMTP for password reset mail, and use a long random `JWT_SECRET`. The login limiter is in-memory for this single-process assignment setup; use a shared store when scaling to multiple instances.

## Architecture and tenancy

An organization owns branches (called tenants in the API). A user can have one organization-level `ORG_ADMIN` membership or branch memberships with `TENANT_ADMIN` / `MEMBER` roles. Organization admins can access all branches in that organization; branch members only see branches where they have membership. Every board, column, task, activity record, and sync event stores `tenantId`. Controllers derive the active tenant from the authorized route and include it in data queries; client-supplied IDs are never treated as proof of access. Cross-tenant misses return 404 to reduce identifier enumeration. The ER diagram with key fields and tenant isolation indexes is in [docs/ERD.md](docs/ERD.md).

MongoDB is used here for a compact assignment deployment. Compound indexes begin with `tenantId` for tenant data and task ordering. Task/column/board versions support optimistic concurrency, and fractional position keys keep reorder writes compact. Tenant event sequence allocation uses an atomic increment on the tenant document. The event feed is retained in MongoDB for reconnect replay (currently limited to 500 events per request and 100 in the socket join response).

## API and real-time

All REST routes use `/api/v1`; authenticated routes require `Authorization: Bearer <JWT>`. Branch operations use `/tenants/:tenantId/...`. See [docs/API.md](docs/API.md).

Socket.IO runs on the API origin. Authenticate with `{ auth: { token } }`, then emit `join` with `{ tenantId, boardId?, lastSeq? }`. The server verifies membership before joining `tenant:<tenantId>`. Events are tenant scoped and include `seq`, `type`, `actorId`, `data`, and timestamp. Presence uses `presence.snapshot`; clients heartbeat and may identify a focused task. On reconnect the client rejoins and requests events after its last sequence.

## Trade-offs / next scaling step

This assignment uses a single MongoDB counter per tenant to provide clear, ordered sync events. Very high write rates can contend on that tenant document; a production deployment can partition the event stream or use a dedicated ordered log. Socket.IO presence is process local; multi-instance deployments need the Redis adapter and shared presence storage. Configure allowed client origins explicitly in production.

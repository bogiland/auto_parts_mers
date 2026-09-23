# NAA.md API boundary

The frontend is deliberately separated from the API through typed models in `src/domain/catalog.ts` and `src/lib/catalog-gateway.ts`.

## Public endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/homepage` | Contacts, enabled slides, categories and home content for a locale. |
| `POST` | `/api/v1/vin-requests` | Saves a VIN request with customer contact details. |
| `POST` | `/api/v1/orders` | Saves a guest or authenticated cart order. |

## Owner-only endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/admin/auth/login` | Starts an owner session after password, MFA and rate-limit checks. |
| `POST` | `/api/v1/admin/auth/logout` | Revokes the current session. |
| `GET` | `/api/v1/admin/sessions` | Lists the owner’s active devices. |
| `DELETE` | `/api/v1/admin/sessions/{sessionId}` | Revokes a chosen device session. |

## Required ASP.NET Core security rules

- Use ASP.NET Core Identity password hashing and server-side session records.
- Send only `HttpOnly`, `Secure`, `SameSite=Lax` cookies to the browser. Never use `localStorage` for an access token.
- Enforce a maximum of two non-revoked owner sessions before creating a new session.
- Require MFA for the owner account and throttle login, password-reset and public form routes.
- Validate every request model, use parameterized database access, enable anti-forgery protection for cookie-authenticated writes, and allow only the production frontend origins through CORS.
- Store media in object storage through restricted signed upload URLs; validate MIME type, byte size and ownership before issuing an upload URL.
- Keep an audit log for login, logout, session revocation, product edits, banner edits and order state changes without recording passwords or raw session values.

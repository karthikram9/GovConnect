# GovConnect — Authentication Foundation Implementation Specification (Phase 4A)

> **Project:** GovConnect  
> **SIH Problem Statement:** SIH26129 — *“System integration and interoperability among government digital platforms, resulting in fragmented service delivery”*  
> **Engineering Cycle:** Security Hardening Cycle #01 — Phase 4A Authentication Foundation  
> **Date:** September 15, 2026  
> **Status:** IMPLEMENTATION COMPLETE & VERIFIED  

---

## 1. Architectural Overview

Phase 4A introduces a production-grade, zero-external-dependency authentication foundation across all GovConnect administrative tiers:
- **Revenue Department** (`revenue-dept` — Port 4001, CommonJS)
- **Social Welfare Department** (`social-welfare-dept` — Port 4002, CommonJS)
- **Domicile Certificate Office** (`domicile-office/backend` — Port 5000, TypeScript ESM)

The architecture establishes a strict separation between **Human/Operator Authentication** and **Machine-to-Machine Service Authentication**, ensuring existing automated flows (e.g. Wallet proxying credential fetch calls) remain intact while eliminating unauthenticated administrative attack surfaces.

```
                  ┌─────────────────────────────────────────┐
                  │          OPERATOR LOGIN FLOW            │
                  └────────────────────┬────────────────────┘
                                       │
                      POST /auth/login { username, password }
                                       │
                                       ▼
                         [ Login Rate Limiter Guard ]
                      (Max 5 failed attempts / 5 mins)
                                       │
                                       ▼
                       [ Account Lookup & scrypt Check ]
                        - Native node:crypto.scrypt
                        - N=16384, r=8, p=1, keylen=64
                        - crypto.timingSafeEqual comparison
                        - Synthetic hash dummy on 404 user
                                       │
                                       ▼
                       [ Issue HMAC-SHA256 Bearer Token ]
                        - Header: { alg: "HS256", typ: "JWT" }
                        - Claims: sub, role, dept, jti, iat, exp
                        - Lifetime: 7200s (2 hours)
                        - Secret: process.env.AUTH_TOKEN_SECRET
                                       │
                                       ▼
                     Response 200 OK: { token, expiresIn: 7200 }
```

---

## 2. Password Hashing Architecture

- **Cryptographic Primitive:** Native `node:crypto.scryptSync` (RFC 7914 compliant, memory-hard).
- **Parameters:**
  - `N = 16384` ($2^{14}$, CPU/memory cost)
  - `r = 8` (block size)
  - `p = 1` (parallelization factor)
  - Output Key Length: 64 bytes (512 bits)
  - Salt: 16 cryptographically random bytes generated via `crypto.randomBytes(16).toString('hex')`.
- **Stored Format:** `scrypt$16384$8$1$<saltHex>$<derivedKeyHex>`.
- **Constant-Time Verification:** Compares the derived candidate key against the stored key buffer using `crypto.timingSafeEqual`.
- **Synthetic Dummy Verification:** When a requested username does not exist in the database, `dummyVerification(candidatePassword)` executes against a fixed synthetic hash to ensure identical execution latency, eliminating account enumeration via timing side-channels.

---

## 3. Token & Session Architecture

- **Token Scheme:** HTTP Bearer Token (`Authorization: Bearer <token>`).
- **Structure:** `${base64url(header)}.${base64url(payload)}.${base64url(signature)}`.
- **Fixed Algorithm:** `HS256` (HMAC-SHA256). The verification engine strictly enforces `header.alg === 'HS256'` and ignores client-requested algorithms, completely mitigating `alg: none` and algorithm-confusion vulnerabilities.
- **Secret Management:** Loaded strictly from `process.env.AUTH_TOKEN_SECRET`. Never hardcoded, never committed to git, never logged, and never returned in API responses.
- **Claims Schema:**
  - `sub`: Username / Subject identity (string)
  - `role`: Target operational role (string, e.g. `ISSUER_OFFICER`, `ADMIN`, `REVIEW_OFFICER`)
  - `dept`: Department identifier (string, e.g. `revenue`, `social_welfare`, `domicile`)
  - `jti`: Cryptographically random UUID (`crypto.randomUUID()`)
  - `iat`: Issuance timestamp (Unix seconds)
  - `exp`: Expiration timestamp (Unix seconds, set to `iat + 7200` for 2 hours)
- **Clock Skew Tolerance:** 60 seconds clock skew is tolerated when validating `exp` and `iat`.

---

## 4. Logout & JTI Revocation

- **Logout Endpoint:** `POST /auth/logout` (protected by `authenticateToken`).
- **Mechanism:** Extracts `req.user.jti` and `req.user.exp`, and inserts `jti` into an in-memory revocation map (`revokedTokens`).
- **Revocation Enforcement:** On every incoming authenticated request, `verifyToken` checks `isTokenRevoked(payload.jti)`. If true, the token is rejected with `401 Unauthorized` (`TOKEN_REVOKED`).
- **TTL Eviction:** Expired JTIs are automatically pruned from memory when `Date.now() / 1000 > exp + 60`.

### Prototype Scope Limitation:
This in-memory revocation store operates strictly within the current Node.js process. It does **not** survive process restarts and does **not** synchronize across multiple server instances. Distributed deployments in future cycles will integrate a distributed store (e.g., Redis).

---

## 5. Login Brute-Force Rate Limiting

- **Policy:** Maximum 5 failed login attempts per IP within a 5-minute sliding window (300,000 ms).
- **Mechanism:** In-memory sliding-window tracker recording failure timestamps per client IP.
- **Threshold Action:** Returns HTTP `429 Too Many Requests` with header `Retry-After: 300` and message `"Too many failed login attempts. Please try again in 5 minutes."`.
- **Reset:** Successful authentication resets the failure count for that IP.

---

## 6. Endpoints & Reusable Middleware

### 6.1 Authentication Routes (`/auth/*`)
- `POST /auth/login`: Public endpoint. Accepts `{ username, password }`, returns `{ token, tokenType: "Bearer", expiresIn: 7200, user: { username, role, department } }`.
- `POST /auth/logout`: Protected by `authenticateToken`. Revokes the active token JTI.
- `GET /auth/me`: Protected by `authenticateToken`. Returns `{ username, role, department }`.

### 6.2 Reusable Middleware: `authenticateToken`
Mounted as Express middleware:
1. Validates `Authorization` header presence and `Bearer` scheme.
2. Calls `verifyToken(tokenString)`.
3. Verifies header algorithm is `HS256`.
4. Verifies HMAC-SHA256 signature using `AUTH_TOKEN_SECRET` with `crypto.timingSafeEqual`.
5. Validates `exp` and `iat` timestamps.
6. Checks whether `jti` exists in the revocation store.
7. Attaches decoded payload to `req.user` and sets `req.authType = 'BEARER_TOKEN'`.
8. Rejects missing, malformed, expired, revoked, or tampered tokens with HTTP 401.

### 6.3 Service Authentication Preservation
The existing `requireIssuerApiKey` middleware is preserved intact on `POST /issue-credential/:citizenId`. Automated service calls from the Wallet proxy sending `X-API-Key` continue to execute without disruption.

---

## 7. Account Models & Seed Data

### 7.1 PostgreSQL Schemas (`revenue-dept`, `social-welfare-dept`)
An additive `users` table was added to `init.sql`:
```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  department TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 7.2 Seed Prototype Accounts (Scrypt Pre-Hashed, Dev Only)
| Department | Username | Role | Default Dev Password | Hash Format |
|:---|:---|:---|:---|:---|
| **Revenue** | `rev_officer_01` | `ISSUER_OFFICER` | `Password#2026!` | `scrypt$16384$8$1$...` |
| **Revenue** | `rev_admin_01` | `ADMIN` | `AdminPassword#2026!` | `scrypt$16384$8$1$...` |
| **Social Welfare** | `swd_officer_01` | `ISSUER_OFFICER` | `Password#2026!` | `scrypt$16384$8$1$...` |
| **Social Welfare** | `swd_admin_01` | `ADMIN` | `AdminPassword#2026!` | `scrypt$16384$8$1$...` |
| **Domicile Office**| `dom_officer_01` | `REVIEW_OFFICER` | `Password#2026!` | `scrypt$16384$8$1$...` |
| **Domicile Office**| `dom_admin_01` | `ADMIN` | `AdminPassword#2026!` | `scrypt$16384$8$1$...` |

*Note: All passwords are pre-hashed. No plaintext passwords exist in databases or code.*

---

## 8. Environment Variables

| Variable | Scope | Description |
|:---|:---|:---|
| `AUTH_TOKEN_SECRET` | All backends | High-entropy secret (at least 32 bytes) used for HMAC-SHA256 Bearer token signing. Documented in `.env.example`. |
| `ISSUER_API_KEY` | Revenue, SWD, Wallet | Master service secret for machine-to-machine calls (preserved intact). |

---

## 9. Security Considerations & Boundary Protection

1. **Role Scope Separation:** In Phase 4A, tokens include `role` and `dept` claims to establish the data contract for Phase 4B. **No role authorization logic is enforced in Phase 4A.**
2. **Public Endpoint Invariant:** `/health`, `/public-key`, `/api/trust-registry`, `/api/verification-requests`, and `/api/presentations/verify` remain public and accessible without authentication.
3. **Cryptographic Signatures Untouched:** Ed25519 issuance and verification logic remain completely unmodified.

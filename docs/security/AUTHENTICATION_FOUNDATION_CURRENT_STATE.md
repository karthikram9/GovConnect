# GovConnect — Authentication Foundation Current State Audit (Phase 4A)

> **Project:** GovConnect  
> **SIH Problem Statement:** SIH26129 — *“System integration and interoperability among government digital platforms, resulting in fragmented service delivery”*  
> **Engineering Cycle:** Security Hardening Cycle #01 — Phase 4A Authentication Foundation  
> **Audit Date:** September 15, 2026  
> **Status:** AUDIT COMPLETE — BASELINE ESTABLISHED  
> **Scope:** Audit of existing authentication, accounts, secrets, and endpoint protections prior to implementing the Authentication Foundation.  

---

## 1. Executive Summary

This audit establishes the pre-implementation baseline across the GovConnect codebase for Phase 4A (Authentication Foundation). 

The goal of Phase 4A is strictly defined:
- **Remediate Drawback #1:** Lack of production-grade human/admin authentication.
- **Establish the Authentication Foundation:** User/account models, memory-hard password hashing (`scrypt`), login endpoint (`POST /auth/login`), HMAC-SHA256 signed Bearer tokens with JTI and expiration, logout with in-memory revocation, brute-force rate-limiting, and reusable `authenticateToken` middleware.
- **Preserve:** Existing `X-API-Key` machine-to-machine service authentication for `Wallet` → `Revenue` and `Wallet` → `Social Welfare`.
- **Strictly Out of Scope for Phase 4A:** Role-Based Access Control (RBAC) policy enforcement, role middleware, and fine-grained department authorization (deferred to Phase 4B).

---

## 2. Current Authentication Mechanisms

| Service | Mechanism | Current Nature | Location in Code | Finding |
|:---|:---|:---|:---|:---|
| **Revenue Department** | `X-API-Key` Header | Service-to-Service Secret | `revenue-dept/src/middleware/auth.js` (`requireIssuerApiKey`) | **PARTIAL**: Validates constant-time equality against `ISSUER_API_KEY`. Used only on `POST /issue-credential/:citizenId`. No human login exists. |
| **Revenue Department** | Browser `prompt()` | Client UI Secret Entry | `revenue-dept/public/js/admin.js` (lines 259–266) | **INSECURE**: Prompts operator for `ISSUER_API_KEY`, persists in unencrypted `sessionStorage`. |
| **Social Welfare Dept** | `X-API-Key` Header | Service-to-Service Secret | `social-welfare-dept/src/middleware/auth.js` (`requireIssuerApiKey`) | **PARTIAL**: Identical to Revenue. Used only on `POST /issue-credential/:citizenId`. No human login exists. |
| **Social Welfare Dept** | Browser `prompt()` | Client UI Secret Entry | `social-welfare-dept/public/js/admin.js` (lines 259–266) | **INSECURE**: Prompts operator for `ISSUER_API_KEY`, persists in unencrypted `sessionStorage`. |
| **Domicile Office (Backend)** | None | Completely Anonymous | `domicile-office/backend/src/app.ts` | **MISSING**: Zero authentication middleware mounted on any route. |
| **GovConnect Wallet (Backend)** | Service `X-API-Key` Proxy | Outbound Machine Client | `wallet/backend/src/services/issuerClient.ts` | **OPERATIONAL**: Sends `X-API-Key` to Revenue (:4001) and Social Welfare (:4002) to fetch credentials. |

---

## 3. Current Endpoint Protection Inventory

### 3.1 Revenue Department (`revenue-dept` — Port 4001)
- `GET /health` — **Unprotected (Public by design)**.
- `GET /public-key` — **Unprotected (Public by design)**.
- `GET /admin` — **Unprotected (Vulnerability)**: Serves `admin.html` without session or authentication check.
- `GET /citizens` — **Unprotected (Vulnerability)**: Returns minimal list (`id`, `name`, `dateOfBirth`).
- `GET /citizens/:citizenId` — **Unprotected (Critical Vulnerability)**: Returns sensitive citizen PII (`annual_income`, `pan_number`, `address`).
- `POST /issue-credential/:citizenId` — **Protected by `requireIssuerApiKey`**: Requires `X-API-Key: ISSUER_API_KEY`.
- `GET /issued-credentials` — **Unprotected (Critical Vulnerability)**: Returns all historical issued credentials and signatures.

### 3.2 Social Welfare Department (`social-welfare-dept` — Port 4002)
- `GET /health` — **Unprotected (Public by design)**.
- `GET /public-key` — **Unprotected (Public by design)**.
- `GET /admin` — **Unprotected (Vulnerability)**: Serves `admin.html` without session or authentication check.
- `GET /citizens` — **Unprotected (Vulnerability)**: Returns minimal list (`id`, `name`, `dateOfBirth`).
- `GET /citizens/:citizenId` — **Unprotected (Critical Vulnerability)**: Returns sensitive citizen PII (`caste_category`, `caste_name`, `certificate_number`, `address`).
- `POST /issue-credential/:citizenId` — **Protected by `requireIssuerApiKey`**: Requires `X-API-Key: ISSUER_API_KEY`.
- `GET /issued-credentials` — **Unprotected (Critical Vulnerability)**: Returns all historical issued credentials and signatures.

### 3.3 Domicile Certificate Office (`domicile-office/backend` — Port 5000)
- `GET /health` — **Unprotected (Public by design)**.
- `GET /api/trust-registry` — **Unprotected (Public by design)**.
- `POST /api/verification-requests` — **Unprotected (Public presentation challenge)**.
- `GET /api/verification-requests/:id` — **Unprotected (Public presentation challenge)**.
- `POST /api/presentations/verify` — **Unprotected (Public citizen presentation submission)**.
- `POST /api/applications` — **Unprotected (Public citizen application intake)**.
- `GET /api/applications` — **Unprotected (Critical Vulnerability)**: Leaks entire application queue.
- `GET /api/applications/:id` — **Unprotected (Vulnerability)**: Leaks individual application details.
- `POST /api/applications/:id/review` — **Unprotected (Critical Vulnerability)**: Allows anonymous callers to approve applications and issue official Domicile Certificates.
- `GET /api/certificates` — **Unprotected (Vulnerability)**: Leaks all issued certificates.
- `GET /api/certificates/:id` — **Unprotected (Public credential verification lookup)**.

---

## 4. Current Database Schemas & Account Representations

### 4.1 Revenue Department (`revenue-dept/init.sql`)
- Tables: `citizens`, `issued_credentials`.
- **Status:** **NO user or account table exists.**
- In-memory mock store in `tests/api.test.js` also has no user representation.

### 4.2 Social Welfare Department (`social-welfare-dept/init.sql`)
- Tables: `citizens`, `issued_credentials`.
- **Status:** **NO user or account table exists.**
- In-memory mock store in `tests/api.test.js` also has no user representation.

### 4.3 Domicile Office (`domicile-office/backend`)
- In-memory repositories: `applications`, `verificationRequests`, `verificationResults`, `issuedCertificates`.
- **Status:** **NO user or account repository exists.**

---

## 5. Existing Security Utilities, Dependencies & Configurations

1. **Cryptography:**
   - Standard Node.js `node:crypto` is available across all services.
   - Ed25519 signing and verification (`crypto.sign`, `crypto.verify`) are implemented and active.
   - `crypto.timingSafeEqual` is used in `requireIssuerApiKey`.
2. **Serialization:**
   - `fast-json-stable-stringify` is installed and used across all services for deterministic canonical JSON serialization.
3. **Environment Configuration:**
   - `revenue-dept/.env`: Contains `PORT=4001`, `ISSUER_API_KEY`, `DATABASE_URL`.
   - `social-welfare-dept/.env`: Contains `PORT=4002`, `ISSUER_API_KEY`, `DATABASE_URL`.
   - `domicile-office/backend/.env.example`: Mentions `RATE_LIMIT_MAX=60`, `RATE_LIMIT_WINDOW_MS=60000`, but **no rate limiting code exists** in `app.ts`.
   - `wallet/backend/.env`: Contains `PORT=3001`, `REVENUE_API_KEY`, `SOCIAL_WELFARE_API_KEY`.
4. **Rate Limiting:**
   - Currently **0% implemented** at runtime across all backends.

---

## 6. Compatibility & Regression Concerns for Phase 4A

1. **Wallet Backend Proxy Integration:**
   - `wallet/backend/src/services/issuerClient.ts` calls `POST /issue-credential/:citizenId` with `X-API-Key: config.revenueApiKey`.
   - **Requirement:** This service-to-service communication MUST NOT be broken. Issuance endpoints must accept either `X-API-Key` (service) OR `Bearer <token>` (human operator).
2. **Automated Test Suites:**
   - `revenue-dept/tests/api.test.js` tests `POST /issue-credential/1` with and without `X-API-Key`.
   - `social-welfare-dept/tests/api.test.js` tests `POST /issue-credential/1` with and without `X-API-Key`.
   - `tests/e2e-integration.test.mjs` runs the full cross-service flow using `X-API-Key` via the Wallet.
   - All existing tests must continue to pass without regression.
3. **Database Migration Safety:**
   - Adding a `users` table to PostgreSQL databases must be **strictly additive**:
     - `CREATE TABLE IF NOT EXISTS users (...)`
     - Must NOT modify or drop `citizens` or `issued_credentials`.
   - Test suites that run without a live PostgreSQL database (via `setQueryHandler` mock) must support mock user lookup and authentication seamlessly.

---

## 7. Files Inspected During Audit

1. `revenue-dept/src/server.js`
2. `revenue-dept/src/middleware/auth.js`
3. `revenue-dept/src/routes/credentials.js`
4. `revenue-dept/src/routes/citizens.js`
5. `revenue-dept/src/routes/health.js`
6. `revenue-dept/src/routes/publicKey.js`
7. `revenue-dept/src/db.js`
8. `revenue-dept/init.sql`
9. `revenue-dept/.env.example`
10. `revenue-dept/package.json`
11. `revenue-dept/tests/api.test.js`
12. `social-welfare-dept/src/server.js`
13. `social-welfare-dept/src/middleware/auth.js`
14. `social-welfare-dept/src/routes/credentials.js`
15. `social-welfare-dept/src/routes/citizens.js`
16. `social-welfare-dept/src/routes/health.js`
17. `social-welfare-dept/src/routes/publicKey.js`
18. `social-welfare-dept/src/db.js`
19. `social-welfare-dept/init.sql`
20. `social-welfare-dept/.env.example`
21. `social-welfare-dept/package.json`
22. `social-welfare-dept/tests/api.test.js`
23. `domicile-office/backend/src/app.ts`
24. `domicile-office/backend/src/server.ts`
25. `domicile-office/backend/src/config/index.ts`
26. `domicile-office/backend/src/routes/applications.ts`
27. `domicile-office/backend/src/routes/certificates.ts`
28. `domicile-office/backend/src/routes/health.ts`
29. `domicile-office/backend/src/routes/presentations.ts`
30. `domicile-office/backend/src/routes/trustRegistry.ts`
31. `domicile-office/backend/src/routes/verificationRequests.ts`
32. `domicile-office/backend/src/services/applicationService.ts`
33. `domicile-office/backend/tests/verifier.test.ts`
34. `domicile-office/backend/tests/frontend-states.test.ts`
35. `wallet/backend/src/services/issuerClient.ts`
36. `wallet/backend/src/routes/credentials.ts`
37. `tests/e2e-integration.test.mjs`

---

## 8. Conclusion & Clearance to Proceed to Implementation

The audit confirms that the codebase currently possesses **zero human authentication infrastructure**. 

We now proceed to the concrete implementation of the Authentication Foundation following the strict specifications in Phase 4A.

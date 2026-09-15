# GovConnect — Authentication & RBAC Current State Audit Report

> **Project:** GovConnect  
> **SIH Problem Statement:** SIH26129 — *“System integration and interoperability among government digital platforms, resulting in fragmented service delivery”*  
> **Engineering Cycle:** Security Hardening SOP #01 — Phase 1 Audit  
> **Audit Date:** September 15, 2026  
> **Auditor:** Lead Security & Presentation Architect (Antigravity)  
> **Status:** AUDIT COMPLETE — PHASE 1 SIGN-OFF  

---

## Executive Summary

This document establishes the authoritative baseline audit of the current authentication and authorization posture across all services in the GovConnect repository.

### Classification Key:
- **`IMPLEMENTED`**: Fully present and executing in running repository code.
- **`PARTIALLY IMPLEMENTED`**: Some mechanisms exist (e.g. static service secret, timing protection), but incomplete or lacking essential capabilities (e.g. no roles, no sessions).
- **`MISSING`**: Absent from code, endpoints, or data models.
- **`DOCUMENTED DESIGN`**: Specified in contracts or configuration files, but not implemented in runtime logic.
- **`PRODUCTION ROADMAP`**: Explicitly deferred to future production hardening phases in design documents.

### Drawback Validation Verdict:
1. **DRAWBACK #1 (Production-grade admin authentication is incomplete):** **`VALID & CONFIRMED`**.
   - Admin pages (`/admin`) on Revenue and Social Welfare and the administrative queue on Domicile Office are exposed without authentication.
   - Issuance endpoints rely on a static service secret prompted via browser `prompt()` and saved in `sessionStorage`.
   - Domicile manual review and certificate issuance endpoints (`/api/applications/:id/review`) have zero authentication.
2. **DRAWBACK #2 (Fine-grained RBAC needs strengthening):** **`VALID & CONFIRMED`**.
   - Zero roles exist across the entire codebase (no `ADMIN`, `ISSUER_OFFICER`, or `REVIEW_OFFICER`).
   - Coarse-grained service keys grant blanket access to all citizen records; any anonymous caller can trigger manual review decisions on Domicile.

---

## 1. Existing Authentication

| Service / Tier | Mechanism | Target / Scope | Implementation Location | Classification |
|:---|:---|:---|:---|:---:|
| **Revenue Department** | Service `X-API-Key` | Protects `POST /issue-credential/:citizenId` | `revenue-dept/src/middleware/auth.js` (`requireIssuerApiKey`) | **PARTIALLY IMPLEMENTED** |
| **Revenue Department** | Browser `prompt()` key input | Admin UI issuance confirmation | `revenue-dept/public/js/admin.js` (lines 259–266) | **PARTIALLY IMPLEMENTED** |
| **Revenue Department** | Admin Dashboard Auth | Console access (`/admin`) | `revenue-dept/src/server.js` (line 31) | **MISSING** |
| **Social Welfare Dept** | Service `X-API-Key` | Protects `POST /issue-credential/:citizenId` | `social-welfare-dept/src/middleware/auth.js` (`requireIssuerApiKey`) | **PARTIALLY IMPLEMENTED** |
| **Social Welfare Dept** | Browser `prompt()` key input | Admin UI issuance confirmation | `social-welfare-dept/public/js/admin.js` (lines 259–266) | **PARTIALLY IMPLEMENTED** |
| **Social Welfare Dept** | Admin Dashboard Auth | Console access (`/admin`) | `social-welfare-dept/src/server.js` (line 31) | **MISSING** |
| **Domicile Office (Backend)** | Officer / Admin Auth | Manual review, application view, cert issuance | `domicile-office/backend/src/app.ts` | **MISSING** |
| **Domicile Office (Frontend)** | Login / Session Guard | Verifier console, review page | `domicile-office/frontend/src/App.tsx` | **MISSING** |
| **GovConnect Wallet (Backend)** | Service-to-Service Proxy Auth | Outbound calls to Revenue & Social Welfare | `wallet/backend/src/services/issuerClient.ts` (lines 32, 73) | **IMPLEMENTED** |
| **GovConnect Wallet (Frontend)** | Citizen Authentication | Holder wallet access | `wallet/frontend/src/App.tsx` | **DOCUMENTED DESIGN** |

### Detailed Findings:
1. **Service-to-Service API Key (`IMPLEMENTED`)**:
   - `revenue-dept/src/middleware/auth.js` and `social-welfare-dept/src/middleware/auth.js` define `requireIssuerApiKey`. It inspects the `X-API-Key` HTTP header and performs a constant-time comparison against `process.env.ISSUER_API_KEY` using `crypto.timingSafeEqual`.
2. **Admin Console Authentication (`MISSING`)**:
   - Both Revenue (`revenue-dept/src/server.js:31`) and Social Welfare (`social-welfare-dept/src/server.js:31`) serve `public/admin.html` statically via `app.get('/admin', ...)` with no session or credential check.
   - In `public/js/admin.js`, staff credentials are not managed via user login. Instead, clicking "Issue and Sign Credential" invokes `prompt('Admin Authorization Required: Please enter the Issuer API Key:')`. The entered value is stored in unencrypted browser `sessionStorage`.
3. **Domicile Verifier Authentication (`MISSING`)**:
   - The Domicile Office backend mounts routes in `domicile-office/backend/src/app.ts` with zero authentication middleware. Anyone on the internet can invoke `POST /api/applications/:applicationId/review` to approve/reject applications or query `GET /api/applications`.
4. **Citizen Wallet Boundaries (`DOCUMENTED DESIGN`)**:
   - Per Section 36 of `SECURITY_INTEROPERABILITY_CONTRACT.md`, citizen login is intentionally simplified as a client-side demo profile switcher stored in IndexedDB. Department officer RBAC must not be applied to the citizen wallet.

---

## 2. Existing Authorization

| Scope | Mechanism | Current Enforcement | Relevant Files | Classification |
|:---|:---|:---|:---|:---:|
| **Department Authority** | Issuer ID matching | Private keys match registered issuer IDs | `revenue-dept/src/credentials/incomeCertificate.js` | **IMPLEMENTED** |
| **Role-Based Access (RBAC)** | Role claims & checks | None | None | **MISSING** |
| **Object-Level Authorization** | Citizen ID / Application ID ownership | Any valid key holder can issue for any citizen; any caller can review any application | `revenue-dept/src/routes/credentials.js`, `domicile-office/backend/src/routes/applications.ts` | **MISSING** |
| **Operation Authorization** | Restricting read vs write vs review | Binary: key holder has full issuance power; non-key holder has zero issuance power | Issuer `src/routes/credentials.js` | **PARTIALLY IMPLEMENTED** |

### Detailed Findings:
- There is no authorization differentiation between an administrative officer, an issuance clerk, an auditor, or a general user.
- Any client holding `ISSUER_API_KEY` can issue credentials for *any* citizen in the database.
- On Domicile Office, any anonymous client can review and issue certificates for *any* application.

---

## 3. Protected Endpoints

The following endpoints currently enforce server-side access control:

| Service | Endpoint | HTTP Method | Protection Mechanism | Enforcement File |
|:---|:---|:---:|:---|:---|
| **Revenue Department** | `/issue-credential/:citizenId` | `POST` | `requireIssuerApiKey` (`X-API-Key` constant-time equal to `ISSUER_API_KEY`) | `revenue-dept/src/routes/credentials.js#L12` |
| **Social Welfare Dept** | `/issue-credential/:citizenId` | `POST` | `requireIssuerApiKey` (`X-API-Key` constant-time equal to `ISSUER_API_KEY`) | `social-welfare-dept/src/routes/credentials.js#L12` |

*No other endpoints in the entire GovConnect ecosystem are currently protected by authentication middleware.*

---

## 4. Unprotected Endpoints

The following endpoints are currently exposed without authentication or authorization:

### Revenue Department (`revenue-dept`):
| Endpoint | HTTP Method | Intended Nature | Current Status | Risk / Finding |
|:---|:---:|:---|:---|:---|
| `/health` | `GET` | Public | Unprotected | Safe by design (health check) |
| `/public-key` | `GET` | Public | Unprotected | Safe by design (public cryptographic transparency) |
| `/admin` | `GET` | Internal Admin | **Unprotected** | **Vulnerability**: Exposes admin console UI to any internet user |
| `/citizens` | `GET` | Internal / Picker | **Unprotected** | **Vulnerability**: Leaks citizen IDs, names, dates of birth |
| `/citizens/:citizenId` | `GET` | Internal Review | **Unprotected** | **Critical Vulnerability**: Leaks PAN, annual income, residential address |
| `/issued-credentials` | `GET` | Internal Audit | **Unprotected** | **Critical Vulnerability**: Leaks full issued credentials, signatures, and timestamps |

### Social Welfare Department (`social-welfare-dept`):
| Endpoint | HTTP Method | Intended Nature | Current Status | Risk / Finding |
|:---|:---:|:---|:---|:---|
| `/health` | `GET` | Public | Unprotected | Safe by design (health check) |
| `/public-key` | `GET` | Public | Unprotected | Safe by design (public cryptographic transparency) |
| `/admin` | `GET` | Internal Admin | **Unprotected** | **Vulnerability**: Exposes admin console UI to any internet user |
| `/citizens` | `GET` | Internal / Picker | **Unprotected** | **Vulnerability**: Leaks citizen IDs, names, dates of birth |
| `/citizens/:citizenId` | `GET` | Internal Review | **Unprotected** | **Critical Vulnerability**: Leaks caste category, caste name, cert #, address |
| `/issued-credentials` | `GET` | Internal Audit | **Unprotected** | **Critical Vulnerability**: Leaks full issued caste credentials and signatures |

### Domicile Certificate Office (`domicile-office/backend`):
| Endpoint | HTTP Method | Intended Nature | Current Status | Risk / Finding |
|:---|:---:|:---|:---|:---|
| `/health` | `GET` | Public | Unprotected | Safe by design (health check) |
| `/api/trust-registry` | `GET` | Public | Unprotected | Safe by design (public key transparency) |
| `/api/verification-requests` | `POST` | Public / Wallet | Unprotected | Generates fresh challenge nonce; safe for wallet presentation |
| `/api/verification-requests/:id`| `GET` | Public / Wallet | Unprotected | Verifier request details |
| `/api/presentations/verify` | `POST` | Public / Wallet | Unprotected | Verifies presented proofs; safe for citizen wallet submission |
| `/api/applications` | `GET` | Officer Console | **Unprotected** | **Vulnerability**: Leaks all domicile applications and applicant PII |
| `/api/applications/:id` | `GET` | Officer Console | **Unprotected** | **Vulnerability**: Leaks individual application details |
| `/api/applications` | `POST` | Citizen Portal | Unprotected | Creates new application; intended for citizen submission |
| `/api/applications/:id/review` | `POST` | Officer Review | **Unprotected** | **Critical Vulnerability**: Allows anyone to approve/reject and issue certificates |
| `/api/certificates` | `GET` | Officer / Audit | **Unprotected** | **Vulnerability**: Leaks all issued certificates |
| `/api/certificates/:id` | `GET` | Citizen / Verifier | Unprotected | Certificate retrieval by ID |

### GovConnect Wallet Backend (`wallet/backend`):
| Endpoint | HTTP Method | Intended Nature | Current Status | Risk / Finding |
|:---|:---:|:---|:---|:---|
| `/health` | `GET` | Public | Unprotected | Safe by design |
| `/api/credentials` | `GET` | Informational | Unprotected | Returns static note regarding IndexedDB |
| `/api/credentials/fetch/income` | `POST` | Citizen Wallet | Unprotected | Proxies call to Revenue using internal API key |
| `/api/credentials/fetch/caste` | `POST` | Citizen Wallet | Unprotected | Proxies call to Social Welfare using internal API key |

---

## 5. Existing Roles

- **System-Wide Status:** **`MISSING`**.
- There are no role entities, definitions, schemas, or enums in any database, TypeScript type definition, or route handler across the repository.
- There is no concept of `ADMIN`, `ISSUER_OFFICER`, `REVIEW_OFFICER`, or `AUDITOR`.
- All administrative and review actions execute under implicit anonymous or single-secret authority.

---

## 6. Existing Sessions / Tokens

- **System-Wide Status:** **`MISSING`**.
- No JSON Web Tokens (JWT), session cookies, OAuth 2.0 access tokens, or server-side session stores (e.g. Redis, database sessions) exist in any service.
- The only token-like object is the static string in `X-API-Key`, which represents a service secret rather than a temporal user session.
- No session timeout or renewal mechanism exists.

---

## 7. Existing Password Handling

- **System-Wide Status:** **`MISSING`**.
- No database table stores user credentials:
  - `revenue-dept/init.sql`: Tables `citizens`, `issued_credentials`. (No `users` table).
  - `social-welfare-dept/init.sql`: Tables `citizens`, `issued_credentials`. (No `users` table).
  - `domicile-office/backend`: In-memory maps for `applications`, `issuedCertificates`, `verificationRequests`. (No user store).
- No password hashing libraries (`bcrypt`, `argon2`, `scrypt`, `pbkdf2`) are installed in `package.json` for any service.

---

## 8. Existing Rate Limiting

- **System-Wide Status:** **`DOCUMENTED DESIGN` / `MISSING` in implementation**.
- Configuration parameters exist in `domicile-office/backend/.env.example` and `src/config/index.ts`:
  ```typescript
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '60', 10),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  ```
- **Finding:** No rate-limiting middleware (e.g., `express-rate-limit` or token-bucket implementation) is imported, registered, or executed in `domicile-office/backend/src/app.ts` or any other service.
- Endpoints can be called repeatedly without throttling.

---

## 9. Existing Logout / Session Invalidation

- **System-Wide Status:** **`MISSING`**.
- `revenue-dept/public/js/admin.js` (line 282) and `social-welfare-dept/public/js/admin.js` (line 282) execute:
  ```javascript
  if (res.status === 401) {
    sessionStorage.removeItem('issuer_api_key');
  }
  ```
  This is purely an error-handling cleanup when the server rejects a key. There is no logout UI control, no logout API endpoint, and no server-side token invalidation or blocklist.
- In Domicile Office, logout is completely absent because authentication does not exist.

---

## 10. Existing Frontend Protection

- **Revenue & Social Welfare Admin Consoles:**
  - `admin.html` loads unconditionally in any browser.
  - Metrics, citizen lists (`/citizens`), and issued credentials (`/issued-credentials`) load automatically upon page load via `loadCitizens()` and `loadIssuedCredentials()`.
  - Only the final button click for credential issuance triggers a JavaScript `prompt()` dialog.
- **Domicile Office React Frontend:**
  - `domicile-office/frontend/src/App.tsx` contains 4 navigation tabs: `verification`, `applications`, `manual-review`, `trust-registry`.
  - There are no route guards, no auth context, no login form, and no role-based view filtering. Any visitor can view all pending applications and submit review decisions.
- **Classification:** **`MISSING`**.

---

## 11. Existing Backend Protection

The backend currently maintains several genuine and effective security measures:

1. **Constant-Time Key Comparison (`IMPLEMENTED`)**:
   - `revenue-dept/src/middleware/auth.js` uses `crypto.timingSafeEqual` with a length-check dummy comparison to prevent side-channel timing attacks on `X-API-Key`.
2. **Cryptographic Proof Independence (`IMPLEMENTED`)**:
   - Ed25519 digital signatures (RFC 8032) and deterministic canonical JSON serialization (`fast-json-stable-stringify`) ensure that credential tampering is cryptographically impossible without the private key.
3. **Replay Protection (`IMPLEMENTED`)**:
   - `domicile-office/backend/src/services/replayService.ts` maintains a registry of single-use challenge nonces and enforces a strict 15-minute validity window.
4. **Data Minimization on Public Pickers (`IMPLEMENTED`)**:
   - `GET /citizens` on Revenue and Social Welfare only returns `id`, `name`, and `dateOfBirth`. It specifically excludes sensitive fields like `pan_number`, `annual_income`, and `caste_category`.
5. **Centralized Error Masking (`IMPLEMENTED`)**:
   - Central error handlers in all backends prevent database errors and stack traces from leaking to clients.
6. **Key Isolation (`IMPLEMENTED`)**:
   - Issuer private keys reside strictly in `keys/` on the issuer servers and are never returned over API endpoints or exposed in client bundles.

---

## 12. Security Weaknesses

1. **Vulnerability 1: Unauthenticated Admin & PII Endpoints (CWE-306)**
   - `GET /citizens/:citizenId` on Revenue leaks PAN number, income, and home address.
   - `GET /citizens/:citizenId` on Social Welfare leaks caste category, sub-caste, certificate number, and home address.
   - `GET /issued-credentials` leaks all historical issued credentials and signatures.
   - Any external user or automated scraper can harvest this data without credentials.
2. **Vulnerability 2: Unauthenticated Adjudication & Certificate Generation (CWE-306 / CWE-862)**
   - `POST /api/applications/:applicationId/review` on Domicile Office allows an unauthenticated attacker to unilaterally approve applications and trigger official Domicile Certificate generation.
3. **Vulnerability 3: Lack of Role-Based Access Control (CWE-285)**
   - No distinction between administrative, issuance, or review privileges. Possession of a single API key confers total administrative control over that department.
4. **Vulnerability 4: Plaintext Shared Secret in Browser Storage (CWE-312 / CWE-522)**
   - Staff enter the raw `ISSUER_API_KEY` into a browser prompt, storing it in `sessionStorage`. Any cross-site scripting (XSS) vulnerability or unauthorized browser extension could extract the key.
5. **Vulnerability 5: No Session Expiration or Revocation (CWE-613)**
   - Because static API keys are used, access cannot be expired or revoked on a per-user basis.
6. **Vulnerability 6: Absence of Rate Limiting (CWE-799 / CWE-307)**
   - Authentication and sensitive endpoints can be hammered by brute-force or denial-of-service scripts without throttling.

---

## 13. False Positives / Things That Are Already Secure

To ensure engineering effort is focused strictly on real gaps, the following areas have been verified as secure and **MUST NOT** be altered or refactored:

1. **Asymmetric Cryptography:**
   - The Ed25519 signing implementation in `src/crypto/signer.js` and `credentialVerifier.ts` conforms strictly to RFC 8032. It correctly signs canonical UTF-8 JSON representations.
2. **Zero Live Calls Invariant:**
   - Domicile Office verifies credentials 100% offline using registered public keys. No database connections exist between Domicile and the issuers. This core invariant is fully tested and functioning.
3. **Timing-Safe Service Authentication:**
   - The service-to-service key check in `requireIssuerApiKey` is properly hardened against timing leaks.
4. **Challenge-Response Replay Defense:**
   - The presentation verification pipeline validates nonce freshness and burns nonces upon verification.
5. **Wallet Private Key Isolation:**
   - The wallet backend does not leak issuer API keys to the browser, acting as an isolated proxy.

---

## 14. Recommended Target Architecture

To resolve Drawbacks #1 and #2 without introducing bloated enterprise infrastructure (e.g. Keycloak, external OAuth servers, or heavy relational user migrations), GovConnect should implement a **Lightweight, Token-Based Authentication & Reusable RBAC Middleware Layer**:

### Architecture Components:
1. **Authentication Mechanism:**
   - Signed, tamper-evident HTTP Bearer tokens (or HMAC-SHA256 signed session tokens) with short expiration (e.g., 2 hours).
   - Secure login endpoint (`POST /auth/login`) accepting username and password.
   - Secure password verification using constant-time hash comparisons or standard cryptographic password hashing (e.g., `crypto.scrypt` / `pbkdf2` using native Node.js `node:crypto` to avoid heavy external dependencies).
2. **Minimum Role Model:**
   - **For Issuers (Revenue & Social Welfare):**
     - `ADMIN`: Access to audit logs (`/issued-credentials`), user management, and system metrics.
     - `ISSUER_OFFICER`: Access to citizen records (`/citizens`, `/citizens/:id`) and credential issuance (`/issue-credential/:id`).
   - **For Verifier (Domicile Office):**
     - `ADMIN`: Trust registry inspection, audit logs, system status.
     - `REVIEW_OFFICER`: Application queue (`/api/applications`), manual review adjudication (`/api/applications/:id/review`), and certificate inspection.
3. **Reusable Middleware:**
   - `authenticateToken`: Validates session token signature, structure, and expiration. Attaches `req.user = { username, role, department }`.
   - `requireRole(allowedRoles)`: Reusable authorization guard returning `403 Forbidden` if `req.user.role` is not permitted.
   - `requireIssuerApiKey`: Preserved for automated service-to-service calls (e.g. Wallet proxy and automated test suites).
4. **Rate Limiting Middleware:**
   - Implement an in-memory sliding window or token-bucket rate limiter on `/auth/login` (max 5 failed attempts/minute) and sensitive issuance/review endpoints.
5. **Frontend Integration:**
   - Clean, lightweight login screens on Revenue Admin, Social Welfare Admin, and Domicile Officer Console.
   - Session storage of tokens with explicit "Sign Out" functionality.

---

## Conclusion & Next Steps

Phase 1 Audit conclusively proves that **Drawback #1** and **Drawback #2** are genuine architectural gaps in the current implementation. 

Proceed immediately to **Phase 2 — Threat Model** and **Phase 3 — Target Architecture** upon user review.

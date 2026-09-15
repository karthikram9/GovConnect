# GovConnect — Authentication & RBAC Target Architecture Design (Phase 3)

> **Project:** GovConnect  
> **SIH Problem Statement:** SIH26129 — *“System integration and interoperability among government digital platforms, resulting in fragmented service delivery”*  
> **Engineering Cycle:** Security Hardening Cycle #01 — Phase 3 Target Design  
> **Status:** COMPLETE — READY FOR ARCHITECTURAL REVIEW  
> **Baseline Audit Reference:** `docs/security/AUTH_RBAC_CURRENT_STATE.md`  
> **Threat Model Reference:** `docs/security/AUTH_RBAC_THREAT_MODEL.md`  
> **Architecture Invariant Reference:** `docs/SECURITY_INTEROPERABILITY_CONTRACT.md`  

---

## 1. Executive Summary & Design Principles

This document defines the authoritative, production-grade target design for Authentication, Role-Based Access Control (RBAC), and Object-Level Authorization across the GovConnect ecosystem.

### Core Architectural Philosophy: The Smallest Secure Architecture
In accordance with engineering guidelines, this design:
- **Introduces ZERO bloated enterprise infrastructure:** No Keycloak, no external OAuth/OIDC servers, no Redis, no Kafka, no Kubernetes, and no microservice splits.
- **Relies on existing platforms & native capabilities:** Built strictly on Node.js, Express, TypeScript/JavaScript, and the native Node.js cryptographic engine (`node:crypto`).
- **Eliminates third-party runtime dependencies:** Utilizes native `node:crypto.scrypt` for memory-hard password hashing and native `node:crypto.createHmac` for compact signed session tokens.
- **Maintains 100% backward compatibility:** Preserves the existing `X-API-Key` service authentication for the GovConnect Wallet backend proxy and automated end-to-end integration test suites.
- **Respects Frozen Invariants:** Preserves Ed25519 credential signatures, offline verification, edge-held citizen custody in IndexedDB, and the presentation replay cache.

---

## 2. System Actors & User Types

GovConnect distinguishes three human user categories and one automated service category:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GOVCONNECT USER TYPES                             │
├──────────────────────────┬──────────────────────────────────────────────────┤
│ User Type                │ Description & Operational Scope                  │
├──────────────────────────┼──────────────────────────────────────────────────┤
│ 1. Administrative        │ Department IT / System Admin (Revenue, Social    │
│    Officer (`ADMIN`)     │ Welfare, Domicile). Inspects audit logs, system  │
│                          │ status, trust registry, and service telemetry.   │
├──────────────────────────┼──────────────────────────────────────────────────┤
│ 2. Issuance Officer      │ Department operational clerk (Revenue or Social  │
│    (`ISSUER_OFFICER`)    │ Welfare). Searches citizens, views PII, and      │
│                          │ triggers Ed25519 credential signing.             │
├──────────────────────────┼──────────────────────────────────────────────────┤
│ 3. Review Officer        │ Domicile Office verifier staff. Inspects the     │
│    (`REVIEW_OFFICER`)    │ manual review queue and adjudicates ambiguous    │
│                          │ demographic matches (Approve/Reject).            │
├──────────────────────────┼──────────────────────────────────────────────────┤
│ 4. Citizen Holder        │ Public applicant using GovConnect Wallet. Edge-  │
│    (Citizen / Public)    │ held credentials in IndexedDB. Does NOT have an  │
│                          │ officer login. Submits presentations via consent.│
├──────────────────────────┼──────────────────────────────────────────────────┤
│ 5. Automated Service     │ Machine-to-machine client (Wallet Backend proxy).│
│    (`SERVICE_ACCOUNT`)   │ Authenticates using high-entropy X-API-Key.      │
└──────────────────────────┴──────────────────────────────────────────────────┘
```

---

## 3. Human Authentication Design

### 3.1 Login Endpoint (`POST /auth/login`)
Every server tier (Revenue `:4001`, Social Welfare `:4002`, Domicile `:5000`) exposes a standardized authentication endpoint:

- **Endpoint:** `POST /auth/login`
- **Request Body:**
  ```json
  {
    "username": "rev_officer_01",
    "password": "SecurePassword#2026!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "token": "header.payload.signature",
    "tokenType": "Bearer",
    "expiresIn": 7200,
    "user": {
      "username": "rev_officer_01",
      "role": "ISSUER_OFFICER",
      "department": "revenue"
    }
  }
  ```
- **Failure Response (401 Unauthorized):**
  ```json
  {
    "error": "UNAUTHORIZED",
    "message": "Invalid username or password."
  }
  ```

### 3.2 Password Storage & Hashing Architecture
To avoid unmaintained npm packages or native build issues (e.g. `node-gyp` with `bcrypt`), password hashing uses the **native `node:crypto.scrypt`** primitive (RFC 7914 compliant):

1. **Parameters:**
   - Memory/CPU Cost (`N`): `16384` ($2^{14}$)
   - Block Size (`r`): `8`
   - Parallelization (`p`): `1`
   - Key Length: `64` bytes (512 bits)
   - Salt: `16` cryptographically secure random bytes generated via `crypto.randomBytes(16).toString('hex')`.
2. **Hash Storage Format:**
   ```text
   scrypt$16384$8$1$<salt_hex>$<derived_key_hex>
   ```
3. **Verification Process:**
   - Extract `salt` and `derived_key` from stored record.
   - Recompute scrypt hash on candidate password using stored parameters and salt.
   - Compare derived candidate key against stored key using **`crypto.timingSafeEqual`** to prevent side-channel timing leaks.
4. **Account Enumeration Defense:**
   - If username does not exist in database, execute a dummy `scrypt` computation against a fixed synthetic salt before returning HTTP 401. This guarantees execution time parity between existing and non-existing accounts.

### 3.3 Password Policy & Governance
- Minimum length: 12 characters.
- Character diversity: At least one uppercase letter, one lowercase letter, one number, and one symbol.
- Plaintext passwords must **NEVER** be logged, cached in memory longer than the verification cycle, or returned in API responses.
- Default passwords must be forced to rotate upon initial startup.

### 3.4 Rate Limiting & Brute-Force Throttling
- An in-memory sliding-window rate limiter is mounted on `/auth/login`.
- **Policy:** Maximum 5 failed login attempts per 5-minute window per IP address.
- **Action on Breach:** HTTP `429 Too Many Requests` with `Retry-After: 300` header.

---

## 4. Token & Session Architecture

### 4.1 Token Selection: Native Compact Signed Bearer Tokens
Rather than importing external JWT packages with history of `alg: none` or verification bypass vulnerabilities, GovConnect implements a lightweight, native signed token using `node:crypto`:

```text
[ Base64URL(Header) ] . [ Base64URL(Payload) ] . [ Base64URL(Signature) ]
```

### Why Native HMAC-SHA256 Signed Tokens?
1. **Zero External Dependencies:** Built entirely with standard Node.js libraries (`node:crypto`).
2. **Immunity to Algorithm Confusion:** The server hardcodes the verification algorithm to HMAC-SHA256 (`HS256`). Incoming token headers are ignored for algorithm negotiation; `alg: none` attacks are impossible.
3. **Cross-Service Compatibility:** Runs identically across CommonJS (`revenue-dept`, `social-welfare-dept`) and TypeScript ESM (`domicile-office`).
4. **Deterministic Performance:** Sub-millisecond signature creation and constant-time verification.

### 4.2 Token Payload & Claims
```json
{
  "sub": "rev_officer_01",
  "role": "ISSUER_OFFICER",
  "dept": "revenue",
  "jti": "550e8400-e29b-41d4-a716-446655440000",
  "iat": 1773570000,
  "exp": 1773577200
}
```

| Claim | Key | Type | Description |
|:---|:---:|:---:|:---|
| **Subject** | `sub` | String | Unique username of authenticated officer |
| **Role** | `role` | String | Authorized operational role (`ADMIN`, `ISSUER_OFFICER`, `REVIEW_OFFICER`) |
| **Department** | `dept` | String | Department identifier (`revenue`, `social_welfare`, `domicile`) |
| **Token ID** | `jti` | UUID | Unique cryptographically random identifier for revocation |
| **Issued At** | `iat` | Integer | Epoch timestamp in seconds |
| **Expiration** | `exp` | Integer | Epoch timestamp in seconds (Lifetime: 2 hours) |

### 4.3 Token Verification & Clock Handling
- Verification parses the token into `${encodedHeader}.${encodedPayload}` and `${signature}`.
- Server recomputes `HMAC-SHA256(${encodedHeader}.${encodedPayload}, AUTH_TOKEN_SECRET)`.
- Validates signature equality using `crypto.timingSafeEqual`.
- Validates clock expiration: `currentTime <= exp + 60` (allowing a 60-second clock skew buffer).
- If expired, returns HTTP `401 Unauthorized` with `{ "error": "TOKEN_EXPIRED" }`.

### 4.4 Logout & Session Invalidation
- **Client Side:** The frontend clears the token from browser memory/sessionStorage.
- **Server Side:** `POST /auth/logout` takes the current token, extracts its `jti` and `exp`, and records `jti` in a lightweight in-memory blocklist (`Set<string>`).
- The blocklist automatically evicts entries once their original `exp` timestamp has passed, preventing unbounded memory growth.
- Any request presenting a blacklisted `jti` is rejected with HTTP `401 Unauthorized`.

---

## 5. Role-Based Access Control (RBAC) Design

### 5.1 Minimum Necessary Roles
GovConnect intentionally defines only the minimum necessary roles to satisfy least privilege:

```
                       ┌─────────────────────────┐
                       │     GOVCONNECT RBAC     │
                       └────────────┬────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
   ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
   │    ADMIN     │          │ISSUER_OFFICER│          │REVIEW_OFFICER│
   └──────────────┘          └──────────────┘          └──────────────┘
   - Audit Logs              - Citizen Search          - Review Queue
   - System Telemetry        - Citizen PII View        - Adjudication
   - User Management         - VC Issuance             - Cert Inspection
```

### 5.2 Role Definitions
1. **Role: `ADMIN`**
   - **Purpose:** System supervision, security audit inspection, trust configuration.
   - **Allowed Operations:** Read system health, read historical audit logs (`GET /issued-credentials`), inspect Trust Registry, manage department users.
   - **Forbidden Operations:** Issuing individual citizen credentials; adjudicating manual review cases.
2. **Role: `ISSUER_OFFICER`**
   - **Purpose:** Operational processing of citizen credentials within Revenue or Social Welfare.
   - **Allowed Operations:** Search citizens (`GET /citizens`), inspect citizen PII (`GET /citizens/:citizenId`), trigger credential signing (`POST /issue-credential/:citizenId`).
   - **Forbidden Operations:** Viewing historical audit logs (`GET /issued-credentials`); reviewing Domicile applications.
3. **Role: `REVIEW_OFFICER`**
   - **Purpose:** Adjudication of ambiguous demographic matches in Domicile Office.
   - **Allowed Operations:** View application queue (`GET /api/applications`), view application details (`GET /api/applications/:id`), submit review decisions (`POST /api/applications/:id/review`), view issued certificates (`GET /api/certificates`).
   - **Forbidden Operations:** Modifying Trust Registry; issuing foundational Income or Caste credentials.
4. **Citizen Holder (Wallet)**
   - **Purpose:** Personal credential custody and consent-based presentation.
   - **Access Model:** Completely outside officer RBAC. Citizen access to the Wallet is local (IndexedDB). Citizen submits presentations via explicit consent (`[ Share and consent ]`).

---

## 6. Comprehensive Authorization Matrix

### 6.1 Revenue Department (`revenue-dept` — Port 4001)

| Route / Asset | Verb | Unauth / Public | ISSUER_OFFICER | ADMIN | SERVICE (`X-API-Key`) | Enforcement Mechanism |
|:---|:---:|:---:|:---:|:---:|:---:|:---|
| `/health` | GET | ALLOW | ALLOW | ALLOW | ALLOW | Public |
| `/public-key` | GET | ALLOW | ALLOW | ALLOW | ALLOW | Public Transparency |
| `/admin` (UI) | GET | REDIRECT `/login` | ALLOW | ALLOW | DENY | Static Guard / Session |
| `/auth/login` | POST | ALLOW | N/A | N/A | DENY | Public Auth |
| `/auth/logout` | POST | DENY | ALLOW | ALLOW | DENY | `authenticateToken` |
| `/citizens` | GET | DENY | ALLOW | ALLOW | DENY | `authenticateToken` + `requireRole(['ISSUER_OFFICER','ADMIN'])` |
| `/citizens/:citizenId` | GET | DENY | ALLOW | DENY | DENY | `authenticateToken` + `requireRole(['ISSUER_OFFICER'])` |
| `/issue-credential/:citizenId` | POST | DENY | ALLOW | DENY | ALLOW | `authenticateTokenOrApiKey` + `requireRole(['ISSUER_OFFICER'])` |
| `/issued-credentials` | GET | DENY | DENY | ALLOW | DENY | `authenticateToken` + `requireRole(['ADMIN'])` |

---

### 6.2 Social Welfare Department (`social-welfare-dept` — Port 4002)

| Route / Asset | Verb | Unauth / Public | ISSUER_OFFICER | ADMIN | SERVICE (`X-API-Key`) | Enforcement Mechanism |
|:---|:---:|:---:|:---:|:---:|:---:|:---|
| `/health` | GET | ALLOW | ALLOW | ALLOW | ALLOW | Public |
| `/public-key` | GET | ALLOW | ALLOW | ALLOW | ALLOW | Public Transparency |
| `/admin` (UI) | GET | REDIRECT `/login` | ALLOW | ALLOW | DENY | Static Guard / Session |
| `/auth/login` | POST | ALLOW | N/A | N/A | DENY | Public Auth |
| `/auth/logout` | POST | DENY | ALLOW | ALLOW | DENY | `authenticateToken` |
| `/citizens` | GET | DENY | ALLOW | ALLOW | DENY | `authenticateToken` + `requireRole(['ISSUER_OFFICER','ADMIN'])` |
| `/citizens/:citizenId` | GET | DENY | ALLOW | DENY | DENY | `authenticateToken` + `requireRole(['ISSUER_OFFICER'])` |
| `/issue-credential/:citizenId` | POST | DENY | ALLOW | DENY | ALLOW | `authenticateTokenOrApiKey` + `requireRole(['ISSUER_OFFICER'])` |
| `/issued-credentials` | GET | DENY | DENY | ALLOW | DENY | `authenticateToken` + `requireRole(['ADMIN'])` |

---

### 6.3 Domicile Certificate Office (`domicile-office` — Port 5000 / UI 5001)

| Route / Asset | Verb | Unauth / Public | REVIEW_OFFICER | ADMIN | SERVICE | Enforcement Mechanism |
|:---|:---:|:---:|:---:|:---:|:---:|:---|
| `/health` | GET | ALLOW | ALLOW | ALLOW | N/A | Public |
| `/api/trust-registry` | GET | ALLOW | ALLOW | ALLOW | N/A | Public Transparency |
| `/api/verification-requests` | POST | ALLOW | ALLOW | ALLOW | N/A | Public Presentation Challenge |
| `/api/verification-requests/:id` | GET | ALLOW | ALLOW | ALLOW | N/A | Public Challenge Inspection |
| `/api/presentations/verify` | POST | ALLOW | ALLOW | ALLOW | N/A | Citizen Presentation Exchange |
| `/api/applications` | POST | ALLOW | ALLOW | ALLOW | N/A | Citizen Application Intake |
| `/auth/login` | POST | ALLOW | N/A | N/A | N/A | Public Auth |
| `/auth/logout` | POST | DENY | ALLOW | ALLOW | N/A | `authenticateToken` |
| `/api/applications` | GET | DENY | ALLOW | ALLOW | N/A | `authenticateToken` + `requireRole(['REVIEW_OFFICER','ADMIN'])` |
| `/api/applications/:id` | GET | DENY | ALLOW | ALLOW | N/A | `authenticateToken` + `requireRole(['REVIEW_OFFICER','ADMIN'])` |
| `/api/applications/:id/review`| POST | DENY | ALLOW | DENY | N/A | `authenticateToken` + `requireRole(['REVIEW_OFFICER'])` + State Guard |
| `/api/certificates` | GET | DENY | ALLOW | ALLOW | N/A | `authenticateToken` + `requireRole(['REVIEW_OFFICER','ADMIN'])` |
| `/api/certificates/:id` | GET | ALLOW | ALLOW | ALLOW | N/A | Public Credential Verification |

---

### 6.4 Citizen Wallet Access Model
- The Citizen Wallet does **NOT** enforce officer RBAC.
- The Wallet is citizen-controlled software running in the citizen's browser.
- All stored credentials live in `IndexedDB` on the citizen's device.
- Citizen authorization is granted solely via explicit consent: clicking `[ Share and consent ]` signs the presentation envelope.
- When the Wallet backend proxies credential fetch requests to Revenue and Social Welfare, it acts as an authorized service using the `X-API-Key` service key.

---

## 7. Object-Level & Resource Authorization Decision

### 7.1 Analysis of Authorization Scopes
We evaluated three potential object-authorization models:
1. **Officer-to-Case Assignment (Case-Level):** Every application is assigned to a single officer ID (`assignedOfficerId = 104`). Only that officer can review the case.
2. **Citizen-to-Officer Assignment:** Every citizen record is locked to a specific case manager.
3. **Department-Level Authorization with State Lifecycle Guard:** Authorized officers of a department access all records under their department's jurisdiction, but state-transition rules restrict what actions can be performed on the record.

### 7.2 The Final Decision: Department-Level Authorization + State Lifecycle Guard
GovConnect adopts **Department-Level Authorization combined with State Lifecycle Guards**.

#### Rationale:
- **No Over-Engineering:** Municipal departments operate on shared operational pools where any duty officer adjudicates pending items in the queue. Introducing individual ticket assignment, load-balancing, and reassignment logic adds significant bloat with zero hackathon security value.
- **Strict Perimeter Defense:** Unauthenticated public access is completely eliminated. Only an officer carrying a cryptographically verified token bound to that specific department (`dept: 'domicile'`) can read applications or submit reviews.
- **Cross-Department Isolation:** A Revenue officer token cannot access Social Welfare citizen records or Domicile applications.
- **State Lifecycle Enforcement:** `POST /api/applications/:id/review` strictly validates that the application status is currently **`NEEDS_MANUAL_REVIEW`**. If the application is already `APPROVED`, `REJECTED`, or `PENDING_CREDENTIALS`, the action is rejected with `409 Conflict`.

---

## 8. Backend Security Pipeline & Middleware Design

The backend enforcement follows a strict fail-closed pipeline:

```
                         INCOMING HTTP REQUEST
                                   │
                                   ▼
                       [ Rate Limiter Middleware ]
                                   │
                                   ▼
                  [ Dual-Mode Authentication Guard ]
               (authenticateTokenOrApiKey Middleware)
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         │                                                   │
   X-API-Key present?                             Bearer Token present?
         │                                                   │
         ▼                                                   ▼
crypto.timingSafeEqual                          Verify HMAC-SHA256 Signature
against process.env.ISSUER_API_KEY              Check Exp > Now
         │                                      Check JTI not in blocklist
         ▼                                                   ▼
req.authType = 'SERVICE'                        req.authType = 'OFFICER'
req.isService = true                            req.user = { sub, role, dept }
         │                                                   │
         └─────────────────────────┬─────────────────────────┘
                                   │
                                   ▼
                    [ Role Authorization Guard ]
                     (requireRole Middleware)
         Matches allowedRoles? (or req.isService permitted)
                                   │
                                   ▼
                 [ Department Authorization Guard ]
                  (requireDepartment Middleware)
                 Matches target department?
                                   │
                                   ▼
                    [ Object State Validation ]
                 (Application in correct state?)
                                   │
                                   ▼
                        ROUTE CONTROLLER ACTION
```

### Authoritative Backend Principle
- Frontend controls (e.g. hiding a button or tab) are **strictly UX enhancements**.
- Backend middleware enforcement is **authoritative**.
- A direct HTTP request using `curl` or `Postman` without valid credentials receives `401 Unauthorized` or `403 Forbidden`, identical to the browser.

---

## 9. Service-to-Service Security Preservation

The existing service-to-service authentication model between the GovConnect Wallet and the Issuers is an essential component of the decentralized architecture:

```
┌─────────────────────────┐                     ┌─────────────────────────┐
│    GovConnect Wallet    │                     │   Revenue Department    │
│     Backend Proxy       ├─[ POST /issue-... ]─►        (Port 4001)      │
│  (port 3001)            │  Header: X-API-Key  │                         │
└─────────────────────────┘                     └─────────────────────────┘
```

### Strict Coexistence Invariant:
1. The `requireIssuerApiKey` middleware logic is preserved intact in `revenue-dept` and `social-welfare-dept`.
2. Issuance routes accept **EITHER** a valid human `Bearer <token>` with role `ISSUER_OFFICER` **OR** a valid `X-API-Key` matching `ISSUER_API_KEY`.
3. This guarantees that:
   - Automated end-to-end integration tests (`tests/e2e-integration.test.mjs`) continue passing without modification.
   - The Wallet backend proxy (`wallet/backend/src/services/issuerClient.ts`) continues fetching Income and Caste credentials cleanly.
   - Human officers can log in through the admin UI and issue credentials manually without sharing or prompting for raw API keys.

---

## 10. Frontend Authentication & UX Workflow

### 10.1 Issuer Consoles (Revenue & Social Welfare)
1. **Initial Access:** Visiting `/admin` checks for a valid session token in `sessionStorage`. If absent, user is redirected to `/admin/login.html`.
2. **Login Screen:** Clean institutional login form collecting Username and Password. Upon successful authentication, the Bearer token and user details are stored in `sessionStorage`.
3. **Admin Dashboard:**
   - Displays logged-in officer badge: `Officer: rev_officer_01 | Role: ISSUER_OFFICER`.
   - UI elements are rendered based on role (e.g., `ADMIN` sees the Issued Credentials Audit Log tab; `ISSUER_OFFICER` sees the Citizen Review and Issuance tools).
   - Prompts for `ISSUER_API_KEY` are **completely removed**. The stored Bearer token is automatically attached to API calls in the `Authorization: Bearer <token>` header.
4. **Logout Button:** Placed prominently in the navigation header. Clicking triggers `POST /auth/logout`, clears `sessionStorage`, and redirects to login.

### 10.2 Domicile Office Verifier (React SPA)
1. **Auth Context:** A lightweight React Context (`AuthContext`) manages login state, active token, and current role.
2. **Tab Access Control:**
   - `Verification` (Challenge generation & presentation exchange): Accessible to all staff.
   - `Applications` & `Manual Review`: Accessible only to `REVIEW_OFFICER` and `ADMIN`.
   - `Trust Registry`: Accessible to all staff (read-only); editing restricted to `ADMIN`.
3. **Session Interceptor:** Axios/Fetch interceptor automatically injects `Authorization: Bearer <token>` and redirects to `/login` on HTTP 401.

---

## 11. Secret Management & Environment Security

1. **New Environment Variables:**
   - `AUTH_TOKEN_SECRET`: 256-bit cryptographically random hexadecimal string used for HMAC-SHA256 token signing.
   - `ADMIN_INITIAL_PASSWORD`: Initial bootstrap password for the seeded administrator account.
2. **Storage Rules:**
   - Secrets reside strictly in `.env` with `0600` permissions.
   - `.env` files are excluded from Git via `.gitignore`.
   - No secrets are hardcoded in application source files or exposed in frontend builds.

---

## 12. Security Audit Logging Specification

Every security-relevant event must be recorded in structured format:

```json
{
  "timestamp": "2026-09-15T10:30:00.000Z",
  "event": "AUTHENTICATION_SUCCESS",
  "actor": "rev_officer_01",
  "role": "ISSUER_OFFICER",
  "department": "revenue",
  "action": "LOGIN",
  "ip": "127.0.0.1",
  "status": "SUCCESS"
}
```

### Mandatory Logged Events:
- `AUTHENTICATION_SUCCESS`: Successful login.
- `AUTHENTICATION_FAILURE`: Failed login attempt (with username and IP; never password).
- `RATE_LIMIT_TRIGGERED`: IP temporarily throttled.
- `CREDENTIAL_ISSUED_MANUAL`: Human officer triggered Ed25519 signing.
- `CREDENTIAL_ISSUED_SERVICE`: Wallet backend proxy triggered Ed25519 signing via service key.
- `APPLICATION_ADJUDICATED`: Review officer approved or rejected a Domicile application.
- `UNAUTHORIZED_ACCESS_ATTEMPT`: 401 or 403 response generated by security middleware.

---

## 13. Security Boundaries & Verification Invariants

The implementation of Phase 2 and Phase 3 hardening **strictly preserves** all core cryptographic guarantees codified in `docs/SECURITY_INTEROPERABILITY_CONTRACT.md`:

1. **Ed25519 Credential Signatures:** Unchanged. Signatures are verified against the public key using RFC 8032.
2. **Zero-Contact Offline Verification:** Domicile verifies credentials with 100% local cryptographic math. Zero database connections exist between Domicile and the Issuers.
3. **Presentation Replay Protection:** Single-use nonces and 15-minute expiration windows remain active.
4. **Demographic Matching Engine:** Fuzzy/exact demographic matching and ambiguity detection (e.g. Ramesh Kumar Patil vs. Ramesh K. Patil) remain unaltered.
5. **Edge-Held Privacy:** Citizen credentials remain edge-held in user IndexedDB. No centralized citizen database is introduced.

---

## 14. Architecture Comparison: Current vs Target

| Security Dimension | Current Implementation | Target Design |
|:---|:---|:---|
| **Admin Console Access** | Unauthenticated (publicly accessible) | Protected by login + session token |
| **API Perimeter** | Open to raw HTTP (curl/Postman) | Authoritative backend token validation |
| **RBAC** | None (zero roles) | `ADMIN`, `ISSUER_OFFICER`, `REVIEW_OFFICER` |
| **Password Storage** | None (no users table) | Memory-hard `scrypt` + random salt |
| **Session Model** | Static shared `ISSUER_API_KEY` in `sessionStorage` | Scoped 2-hour HMAC-SHA256 Bearer tokens |
| **Brute-Force Protection**| Missing (no rate limiter) | In-memory sliding window rate limiter (5 req/5 min) |
| **Adjudication Guard** | Anonymous `/review` approval | Strictly authenticated `REVIEW_OFFICER` |
| **Service Auth** | `X-API-Key` only on issuance | Preserved dual-mode (`X-API-Key` OR Bearer token) |
| **Citizen Wallet** | Edge-held in IndexedDB | Unaltered (edge-held, explicit consent) |
| **Infrastructure Overhead**| Zero | Zero (100% native Node.js, no external IAM) |

---

## 15. Conclusion & Next Steps

This Target Design solves **Drawback #1** and **Drawback #2** completely, cleanly, and minimally. 

Implementation will begin only after explicit user sign-off on Phase 2 and Phase 3.

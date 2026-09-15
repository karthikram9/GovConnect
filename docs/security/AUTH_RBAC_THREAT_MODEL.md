# GovConnect — Authentication & RBAC Threat Model (Phase 2)

> **Project:** GovConnect  
> **SIH Problem Statement:** SIH26129 — *“System integration and interoperability among government digital platforms, resulting in fragmented service delivery”*  
> **Engineering Cycle:** Security Hardening Cycle #01 — Phase 2 Threat Modeling  
> **Status:** COMPLETE — READY FOR ARCHITECTURAL REVIEW  
> **Baseline Audit Reference:** `docs/security/AUTH_RBAC_CURRENT_STATE.md`  
> **Architecture Invariant Reference:** `docs/SECURITY_INTEROPERABILITY_CONTRACT.md`  

---

## 1. Executive Summary & Threat Context

This Threat Model establishes a rigorous, code-level analysis of real-world threats against the GovConnect multi-department decentralized verifiable credential platform. 

GovConnect integrates three distinct server tiers:
1. **Issuer #1 (Revenue Department — Port 4001):** Node.js/Express, PostgreSQL, Ed25519 signer for Income Certificates.
2. **Issuer #2 (Social Welfare Department — Port 4002):** Node.js/Express, PostgreSQL, Ed25519 signer for Caste Certificates.
3. **Verifier (Domicile Certificate Office — Port 5000 / Frontend 5001):** Node.js/TypeScript/Express, in-memory datastores, Ed25519 offline signature verifier and adjudication engine.
4. **Holder Agent (GovConnect Wallet — Port 3001 / Frontend 3000):** Node.js/TypeScript proxy, client-side IndexedDB edge credential storage.

The Phase 1 Audit confirmed two foundational security gaps:
- **Drawback #1:** Production-grade admin and officer authentication is missing across all services. Sensitive administrative consoles (`/admin`, `/public/admin.html`) and review adjudication endpoints (`/api/applications/:id/review`) are exposed without identity checks.
- **Drawback #2:** Role-Based Access Control (RBAC) and Object-Level Authorization are absent. No roles (`ADMIN`, `ISSUER_OFFICER`, `REVIEW_OFFICER`) exist in code or schemas, allowing any caller to invoke operational endpoints.

This document evaluates **25 realistic attack vectors** strictly against the running repository implementation, establishing risk ratings, attack paths, and necessary mitigations.

---

## 2. Security Boundaries & Trust Domains

GovConnect relies on two fundamentally separate authentication domains that **must not be conflated**:

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      HUMAN / OFFICER DOMAIN                            │
 │                                                                        │
 │  Department Staff / Officers (Revenue, Social Welfare, Domicile)       │
 │   - Interactive browser UI access (/admin, verifier console)           │
 │   - Identity-based credentials (Username + Strong Password)            │
 │   - Short-lived signed session tokens (HMAC-SHA256 Bearer tokens)      │
 │   - Fine-grained role permissions (ADMIN, ISSUER_OFFICER, REVIEW_OFF)  │
 └────────────────────────────────────────────────────────────────────────┘
                                     │
                 [ STRICT ARCHITECTURAL SEPARATION ]
                                     │
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      SERVICE-TO-SERVICE DOMAIN                         │
 │                                                                        │
 │  Automated Machine Agents (Wallet Backend Proxy, Test Harness)         │
 │   - Direct API calls between trusted backend components                │
 │   - High-entropy cryptographic API secrets (X-API-Key)                 │
 │   - Constant-time verification (crypto.timingSafeEqual)                │
 │   - MUST REMAIN UNBROKEN for automated credential retrieval            │
 └────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Invariants:
1. **Service Authentication Preservation:** The `X-API-Key` mechanism on `POST /issue-credential/:citizenId` must remain functional for the Wallet backend proxy and automated test suites.
2. **Offline Cryptographic Verifier Invariant:** Domicile Office verifies Ed25519 signatures completely offline using cached public keys from the Trust Registry, with zero live network or database calls to Issuers.
3. **Edge-Held Citizen Privacy:** Citizen credentials reside exclusively on user devices in IndexedDB; the Wallet backend maintains no centralized citizen database.

---

## 3. Existing Security Controls (Controls That Reduce Risk)

The repository already implements several defense-in-depth controls that mitigate specific classes of attacks:

| Control Mechanism | Implementation File | Threat Mitigated |
|:---|:---|:---|
| **Constant-Time Secret Comparison** | `revenue-dept/src/middleware/auth.js`, `social-welfare-dept/src/middleware/auth.js` | Side-channel timing attacks against `X-API-Key` |
| **Asymmetric Digital Signatures** | `src/crypto/signer.js` (Ed25519 RFC 8032) | Forgery and unauthorized tampering of credential claims |
| **Deterministic Canonicalization** | `fast-json-stable-stringify` across all signers & verifiers | Serialization malleability and signature invalidation attacks |
| **Single-Use Nonce & Expiry Registry** | `domicile-office/backend/src/services/replayService.ts` | Presentation envelope replay attacks (15-minute validity window) |
| **Data Minimization on Pickers** | `revenue-dept/src/routes/citizens.js` (`GET /citizens`) | Public picker leaks only `id`, `name`, `dateOfBirth`; suppresses PAN, income, caste |
| **Private Key Isolation** | Issuer hosts in `keys/private_key.pem` (`0600`) | Private signing keys are never exposed over APIs or sent to clients |
| **Centralized Error Masking** | Global Express error handlers in all services | Database connection strings, stack traces, and internal errors are masked |

---

## 4. Threat Model Analysis: Authentication Threats (1 – 13)

### Threat 1: Unauthenticated Admin Access
- **Asset:** Department Admin Consoles (`http://localhost:4001/admin`, `http://localhost:4002/admin`, `http://localhost:5001`).
- **Attacker:** Public external user, unauthenticated network actor.
- **Attack Path:** Attacker navigates directly to `/admin` on Revenue or Social Welfare, or opens Domicile Verifier console. The server serves `admin.html` with HTTP 200 without requiring any login credentials.
- **Current Weakness:** `app.get('/admin')` in `server.js` serves static administrative UI pages unconditionally. No session, cookie, or token check exists.
- **Impact:** Administrative console interface is visible to anyone on the network, exposing metrics, citizen pickers, and administrative controls.
- **Likelihood:** HIGH
- **Risk Level:** **HIGH**
- **Required Mitigation:** Protect administrative routes with session/token authentication middleware; redirect unauthenticated visitors to `/login`.

---

### Threat 2: Direct API Access Without Frontend
- **Asset:** Protected administrative APIs (`GET /citizens/:citizenId`, `GET /issued-credentials`, `GET /api/applications`, `POST /api/applications/:id/review`).
- **Attacker:** Malicious script, curl, Postman, automated scraper.
- **Attack Path:** Attacker sends raw HTTP requests directly to backend ports 4001, 4002, 5000, completely bypassing browser frontends.
- **Current Weakness:** The only authorization prompt in the codebase is a client-side browser `prompt()` in `public/js/admin.js` for `POST /issue-credential`. Endpoints like `GET /citizens/:id` and `POST /api/applications/:id/review` have zero backend authentication middleware.
- **Impact:** Complete exposure of sensitive citizen PII (PAN, income, caste, address), full extraction of historical issued credentials, and unauthorized issuance of Domicile Certificates.
- **Likelihood:** HIGH
- **Risk Level:** **CRITICAL**
- **Required Mitigation:** Authoritative backend authentication middleware (`authenticateToken`) registered on all non-public routes. Frontend controls must be treated as UX convenience only.

---

### Threat 3: Credential / Password Guessing
- **Asset:** Human officer accounts and departmental administrative access.
- **Attacker:** External threat actor or opportunistic insider.
- **Attack Path:** Attacker targets the newly implemented login endpoint (`POST /auth/login`) with dictionary attacks, common passwords (`admin123`, `password`), or default credentials.
- **Current Weakness:** Currently, no user passwords exist. However, the static `ISSUER_API_KEY` is shared across staff. When human password authentication is introduced, lack of complexity policies would allow weak passwords.
- **Impact:** Total account takeover of departmental officer or administrator accounts.
- **Likelihood:** MEDIUM
- **Risk Level:** **MEDIUM**
- **Required Mitigation:** Enforce a strict password complexity policy (minimum 12 characters, requiring uppercase, lowercase, numeric, and symbol characters). Prohibit default credentials in production.

---

### Threat 4: Brute-Force Attempts
- **Asset:** Authentication endpoints (`POST /auth/login`, `POST /issue-credential/:citizenId`).
- **Attacker:** Automated botnet, brute-force script.
- **Attack Path:** Attacker sends thousands of rapid credential requests per second to guess passwords or service keys.
- **Current Weakness:** No rate-limiting middleware is installed or active in any service. Configuration parameters (`RATE_LIMIT_MAX=60`) exist in `.env.example` but are completely absent from running middleware in `app.ts` and `server.js`.
- **Impact:** Credential discovery through brute-force enumeration; resource exhaustion and denial of service.
- **Likelihood:** HIGH
- **Risk Level:** **HIGH**
- **Required Mitigation:** Implement rate limiting on `/auth/login` (max 5 failed attempts per 5-minute window per IP/account) and on issuance endpoints (max 10 requests per minute).

---

### Threat 5: Credential Leakage
- **Asset:** Service secrets (`ISSUER_API_KEY`) and human authentication tokens.
- **Attacker:** Cross-Site Scripting (XSS) attacker, rogue browser extension, shared workstation snoop.
- **Attack Path:** In `revenue-dept/public/js/admin.js` (lines 259–266), staff enter `ISSUER_API_KEY` into a browser prompt. The script saves it to `sessionStorage.setItem('issuer_api_key', apiKey)`. Any script running on that origin or rogue extension can extract `sessionStorage.getItem('issuer_api_key')`.
- **Current Weakness:** Static master service API keys are prompted to human users and stored in plaintext client-side `sessionStorage`.
- **Impact:** Permanent compromise of departmental cryptographic issuance authority.
- **Likelihood:** HIGH
- **Risk Level:** **HIGH**
- **Required Mitigation:** Remove browser prompts for raw service API keys. Implement individual officer login returning scoped, short-lived tokens. Never store master service keys in client storage.

---

### Threat 6: Session Theft
- **Asset:** Active officer authenticated session.
- **Attacker:** Network eavesdropper (unencrypted HTTP) or local machine snoop.
- **Attack Path:** Attacker intercepts session identifiers in transit or copies active session tokens from a browser.
- **Current Weakness:** Sessions currently do not exist. When implemented, if tokens are long-lived and transmitted over unencrypted HTTP, session hijacking is trivial.
- **Impact:** Attacker impersonates an authorized officer and performs administrative functions.
- **Likelihood:** MEDIUM
- **Risk Level:** **MEDIUM**
- **Required Mitigation:** Enforce short token lifetimes (maximum 2 hours), mandatory TLS in production, and bind tokens to user identity claims.

---

### Threat 7: Token Theft
- **Asset:** Signed Bearer tokens (`Authorization: Bearer <token>`).
- **Attacker:** Man-in-the-Middle (MitM) adversary or compromised intermediary proxy.
- **Attack Path:** Attacker inspects server logs, reverse proxy logs, or unencrypted headers to extract valid Bearer tokens.
- **Current Weakness:** The existing prototype logs requests without sanitization in some debug scripts. If full auth tokens are logged, they can be stolen.
- **Impact:** Attacker gains full officer privileges for the token duration.
- **Likelihood:** MEDIUM
- **Risk Level:** **HIGH**
- **Required Mitigation:** Never log authorization headers or token payloads. Maintain short token expiration windows.

---

### Threat 8: Token Replay
- **Asset:** Valid signed officer token.
- **Attacker:** Passive network eavesdropper.
- **Attack Path:** Attacker captures a legitimate token from an officer's HTTP request and replays it against backend APIs after the officer has disconnected.
- **Current Weakness:** Static `X-API-Key` has infinite replay validity. Prototype lacks replay-resistant temporal claims for human sessions.
- **Impact:** Unauthorized operations executed using captured tokens.
- **Likelihood:** MEDIUM
- **Risk Level:** **MEDIUM**
- **Required Mitigation:** Include unique token identifier (`jti`) and strict expiration timestamp (`exp`). Validate that `exp > currentTime` on every request.

---

### Threat 9: Expired Token / Session Reuse
- **Asset:** Historic or discarded session token.
- **Attacker:** Unauthorized user accessing an unattended workstation or salvaged token.
- **Attack Path:** Attacker submits a token whose intended operational window has passed.
- **Current Weakness:** `X-API-Key` has no expiration concept. If tokens without strict expiry checks are deployed, stale credentials remain indefinitely valid.
- **Impact:** Stale sessions remain open indefinitely, violating session hygiene.
- **Likelihood:** HIGH
- **Risk Level:** **HIGH**
- **Required Mitigation:** Middleware must explicitly reject any token where `Date.now() / 1000 > payload.exp` with HTTP 401 Unauthorized (`TOKEN_EXPIRED`).

---

### Threat 10: Logout Bypass
- **Asset:** Post-logout terminal or token.
- **Attacker:** Subsequent user on a shared departmental terminal.
- **Attack Path:** An officer clicks "Logout", but the token remains cryptographically valid. An attacker retrieves the token from history or memory and continues calling APIs.
- **Current Weakness:** Zero logout functionality exists. `sessionStorage.removeItem` is only triggered upon HTTP 401 errors in `admin.js`.
- **Impact:** Next user on shared government terminal accesses predecessor's administrative session.
- **Likelihood:** HIGH
- **Risk Level:** **HIGH**
- **Required Mitigation:** Client-side token purge upon logout, plus a server-side token invalidation blocklist (in-memory sliding cache tracking invalidated `jti` until token `exp`).

---

### Threat 11: Authentication Bypass
- **Asset:** All backend API routes across all services.
- **Attacker:** External attacker utilizing URL manipulation, verb tampering, or null-byte attacks.
- **Attack Path:** Attacker manipulates route paths (e.g. `/api//applications`, `/citizens/..`) or invokes alternate HTTP methods to bypass route-matching guards.
- **Current Weakness:** Currently, backend routes have no authentication middleware mounted at all (except `/issue-credential`).
- **Impact:** Total circumvention of security defenses.
- **Likelihood:** HIGH
- **Risk Level:** **CRITICAL**
- **Required Mitigation:** Mount authentication middleware globally on API routers (fail-closed model) rather than selectively on individual handlers.

---

### Threat 12: Account Enumeration
- **Asset:** Department officer usernames and system identities.
- **Attacker:** External adversary profiling system targets.
- **Attack Path:** Attacker submits usernames to `/auth/login` and analyzes differences in error responses ("User not found" vs "Incorrect password") or execution time.
- **Current Weakness:** Currently no login endpoint exists. If implemented naively, username enumeration is exposed.
- **Impact:** Discovery of valid staff usernames facilitates targeted brute-force and social engineering.
- **Likelihood:** MEDIUM
- **Risk Level:** **LOW**
- **Required Mitigation:** Uniform error messages: always return `401 Unauthorized` with generic message `"Invalid username or password"`. Perform constant-time dummy hash computation when username does not exist.

---

### Threat 13: Malformed Authentication Input
- **Asset:** Authentication middleware and server process stability.
- **Attacker:** Fuzzing bot or penetration tester.
- **Attack Path:** Attacker sends malformed tokens (non-base64 strings, null bytes, arrays instead of strings, massive headers > 1MB) to crash the server or trigger unhandled exceptions.
- **Current Weakness:** Lack of input validation schemas on route headers.
- **Impact:** Application denial of service, unhandled exceptions leaking runtime state.
- **Likelihood:** MEDIUM
- **Risk Level:** **MEDIUM**
- **Required Mitigation:** Defensive token parsing with strict structure validation (`try/catch`), string type checking, and length constraints before cryptographic verification.

---

## 5. Threat Model Analysis: Authorization Threats (14 – 25)

### Threat 14: Authenticated User Accessing Admin Functionality
- **Asset:** Audit logs (`/issued-credentials`), Trust Registry admin, user management.
- **Attacker:** Low-privilege operational staff (e.g. data-entry clerk).
- **Attack Path:** Authenticated officer with operational privileges calls administrative audit log endpoints.
- **Current Weakness:** No roles exist anywhere in the codebase. All authenticated calls possess identical binary authority.
- **Impact:** Unauthorized visibility into historical transactions, audit trails, and departmental configuration.
- **Likelihood:** HIGH
- **Risk Level:** **HIGH**
- **Required Mitigation:** Reusable backend RBAC middleware `requireRole(['ADMIN'])` enforcing least privilege.

---

### Threat 15: Wrong-Role Access
- **Asset:** Departmental operational capabilities.
- **Attacker:** Authorized user attempting actions assigned to another role within the same department.
- **Attack Path:** An officer assigned solely to audit/view records attempts to invoke credential issuance.
- **Current Weakness:** No role enforcement logic exists.
- **Impact:** Violation of operational segregation of duties.
- **Likelihood:** MEDIUM
- **Risk Level:** **HIGH**
- **Required Mitigation:** Explicit role claims in signed tokens (`role: 'ISSUER_OFFICER'`) checked against route permission requirements.

---

### Threat 16: Privilege Escalation (Vertical)
- **Asset:** Administrator privileges.
- **Attacker:** Authenticated operational officer (`ISSUER_OFFICER` or `REVIEW_OFFICER`).
- **Attack Path:** User tampers with their token payload or sends `"role": "ADMIN"` in a request body to elevate privileges.
- **Current Weakness:** If client-supplied role parameters are accepted without cryptographic verification, vertical escalation succeeds.
- **Impact:** Complete administrative takeover of departmental service.
- **Likelihood:** HIGH
- **Risk Level:** **CRITICAL**
- **Required Mitigation:** Roles must be embedded inside cryptographically signed tokens (HMAC-SHA256). Any tampering with the payload invalidates the signature. Backend must never accept role claims from request bodies.

---

### Threat 17: Reviewer Performing Issuer-Only Operations (Cross-Domain)
- **Asset:** Cryptographic Income/Caste Certificate issuance (`POST /issue-credential/:citizenId`).
- **Attacker:** Authenticated Domicile Review Officer (`REVIEW_OFFICER`).
- **Attack Path:** A review officer from Domicile Office obtains access to the Revenue or Social Welfare backend and invokes issuance.
- **Current Weakness:** Currently, issuer ports 4001/4002 check only the static `ISSUER_API_KEY`. If tokens are shared across services without department scoping, cross-department calls succeed.
- **Impact:** Fraudulent issuance of foundational income or caste credentials by verifier staff.
- **Likelihood:** MEDIUM
- **Risk Level:** **CRITICAL**
- **Required Mitigation:** Token must contain explicit department binding (`dept: 'revenue'` vs `dept: 'domicile'`). Middleware must reject tokens issued for a different department.

---

### Threat 18: Officer Performing Admin-Only Operations
- **Asset:** Full historical credential audit trail (`GET /issued-credentials`).
- **Attacker:** Operational `ISSUER_OFFICER`.
- **Attack Path:** Issuer officer queries `GET /issued-credentials` to inspect all credentials issued by all other officers.
- **Current Weakness:** `GET /issued-credentials` is currently completely unprotected on both Revenue (`credentials.js:73`) and Social Welfare (`credentials.js:73`).
- **Impact:** Mass PII harvesting and surveillance of colleague issuance activities.
- **Likelihood:** HIGH
- **Risk Level:** **HIGH**
- **Required Mitigation:** Restrict `GET /issued-credentials` strictly to `ADMIN` role.

---

### Threat 19: Client-Side Role Manipulation
- **Asset:** Frontend UI controls and views.
- **Attacker:** Curious user using browser Developer Tools.
- **Attack Path:** User modifies `localStorage.setItem('role', 'ADMIN')` or changes frontend React state to reveal hidden admin buttons.
- **Current Weakness:** Frontend code lacks auth state, but if UI-only guards are implemented without backend enforcement, manipulation is trivial.
- **Impact:** Attacker views administrative UI components (but must be blocked at backend).
- **Likelihood:** HIGH
- **Risk Level:** **MEDIUM** (UX only) / **CRITICAL** (if backend trusts frontend)
- **Required Mitigation:** Backend enforcement is authoritative. Every API request independently verifies the signed token. Frontend role checks are strictly for UI rendering.

---

### Threat 20: Forged Role Claims
- **Asset:** Authorization middleware decision logic.
- **Attacker:** External or internal attacker crafting custom tokens.
- **Attack Path:** Attacker crafts a token with `{"role": "ADMIN", "dept": "revenue"}` and signs it with an arbitrary key or uses `alg: "none"`.
- **Current Weakness:** If the token verification algorithm is weak or permits `none`, forged claims are accepted.
- **Impact:** Total authorization bypass and complete system compromise.
- **Likelihood:** HIGH
- **Risk Level:** **CRITICAL**
- **Required Mitigation:** Use fixed HMAC-SHA256 signing with a high-entropy, server-only secret (`AUTH_TOKEN_SECRET`). Hardcode the algorithm; never parse algorithm from incoming token headers.

---

### Threat 21: Direct API Authorization Bypass
- **Asset:** All protected endpoints.
- **Attacker:** Network script calling backend APIs directly without headers.
- **Attack Path:** Calling `GET /citizens/1` or `POST /api/applications/APP-2026-002/review` via curl.
- **Current Weakness:** Endpoints are currently unprotected in code.
- **Impact:** Unrestricted read/write operations without credentials.
- **Likelihood:** HIGH
- **Risk Level:** **CRITICAL**
- **Required Mitigation:** Enforce `authenticateToken` and `requireRole` middleware on all sensitive endpoints.

---

### Threat 22: Accessing Another Citizen Record (Object-Level: Citizen PII)
- **Asset:** Individual citizen records (`GET /citizens/:citizenId`).
- **Attacker:** Unauthenticated internet user or rogue staff member enumerating citizen IDs.
- **Attack Path:** Attacker loops through `GET /citizens/1`, `GET /citizens/2`, harvesting PAN numbers, income figures, and caste categories.
- **Current Weakness:** `GET /citizens/:citizenId` in `revenue-dept/src/routes/citizens.js` and `social-welfare-dept/src/routes/citizens.js` has zero authentication.
- **Impact:** Mass exfiltration of sensitive citizen PII and tax/caste records.
- **Likelihood:** HIGH
- **Risk Level:** **CRITICAL**
- **Required Mitigation:** Require valid authenticated officer session (`ISSUER_OFFICER` or `ADMIN` of that specific department). Apply rate limiting to citizen detail queries.

---

### Threat 23: Accessing Another Application (Object-Level: Domicile Applications)
- **Asset:** Domicile applications (`GET /api/applications/:applicationId`).
- **Attacker:** Unauthenticated external user or unauthorized applicant snooping on another citizen's application.
- **Attack Path:** Calling `GET /api/applications/APP-2026-001` directly from curl or browser.
- **Current Weakness:** `domicile-office/backend/src/routes/applications.ts` exposes `GET /` and `GET /:applicationId` with zero authentication.
- **Impact:** Exposure of applicant demographic data, address, and adjudication status.
- **Likelihood:** HIGH
- **Risk Level:** **HIGH**
- **Required Mitigation:** Restrict `GET /api/applications` and `GET /api/applications/:id` to authenticated Domicile staff (`REVIEW_OFFICER` or `ADMIN`).

---

### Threat 24: Insecure Direct Object Reference (IDOR) on Adjudication
- **Asset:** Application review state (`POST /api/applications/:applicationId/review`).
- **Attacker:** External attacker or malicious applicant.
- **Attack Path:** Submitting review decisions for arbitrary application IDs (e.g. `POST /api/applications/APP-2026-001/review` with `{"decision": "APPROVE"}`).
- **Current Weakness:** Zero authentication. Furthermore, the endpoint does not verify whether the application is actually in the `NEEDS_MANUAL_REVIEW` lifecycle state before executing approval.
- **Impact:** Illegitimate approval of arbitrary applications without demographic checks.
- **Likelihood:** HIGH
- **Risk Level:** **CRITICAL**
- **Required Mitigation:** Authenticate as `REVIEW_OFFICER` + validate application state (reject review if status is not `NEEDS_MANUAL_REVIEW`).

---

### Threat 25: Unauthorized Certificate Issuance
- **Asset:** Official Domicile Certificate generation (`issuePrototypeDomicileCertificate`).
- **Attacker:** Any anonymous caller on the internet.
- **Attack Path:** Send `POST http://localhost:5000/api/applications/APP-2026-002/review` with `{"decision": "APPROVE"}`.
- **Current Weakness:** Unauthenticated endpoint directly mints an official prototype Domicile Certificate and records it in `issuedCertificates`.
- **Impact:** Subversion of the entire state credential verification pipeline; fraudulent certificate generation.
- **Likelihood:** HIGH
- **Risk Level:** **CRITICAL**
- **Required Mitigation:** Restrict manual approval strictly to authenticated `REVIEW_OFFICER` with officer identity recorded in the certificate audit trail.

---

## 6. Threat Classification & Risk Summary

| Threat ID | Threat Category | Threat Description | Likelihood | Impact | Risk Level |
|:---:|:---|:---|:---:|:---:|:---:|
| **T-01** | Authentication | Unauthenticated Admin Console Access (`/admin`) | HIGH | HIGH | **HIGH** |
| **T-02** | Authentication | Direct API Access Without Frontend | HIGH | CRITICAL | **CRITICAL** |
| **T-03** | Authentication | Credential / Password Guessing | MEDIUM | MEDIUM | **MEDIUM** |
| **T-04** | Authentication | Brute-Force Attacks Against Login/Issuance | HIGH | HIGH | **HIGH** |
| **T-05** | Authentication | Credential Leakage via `sessionStorage` / `prompt()` | HIGH | HIGH | **HIGH** |
| **T-06** | Authentication | Session Theft Over Insecure Channels | MEDIUM | MEDIUM | **MEDIUM** |
| **T-07** | Authentication | Bearer Token Theft via Logs or Interception | MEDIUM | HIGH | **HIGH** |
| **T-08** | Authentication | Token Replay Across Sessions | MEDIUM | MEDIUM | **MEDIUM** |
| **T-09** | Authentication | Expired Token / Session Reuse | HIGH | HIGH | **HIGH** |
| **T-10** | Authentication | Logout Bypass on Shared Terminals | HIGH | HIGH | **HIGH** |
| **T-11** | Authentication | Authentication Bypass via Route Manipulation | HIGH | CRITICAL | **CRITICAL** |
| **T-12** | Authentication | Account Enumeration via Login Error Messages | MEDIUM | LOW | **LOW** |
| **T-13** | Authentication | Malformed Authentication Input / Fuzzing | MEDIUM | MEDIUM | **MEDIUM** |
| **T-14** | Authorization | Authenticated Officer Accessing Admin Operations | HIGH | HIGH | **HIGH** |
| **T-15** | Authorization | Wrong-Role Access Within Department | MEDIUM | HIGH | **HIGH** |
| **T-16** | Authorization | Vertical Privilege Escalation via Forged Claims | HIGH | CRITICAL | **CRITICAL** |
| **T-17** | Authorization | Reviewer Performing Issuer-Only Operations | MEDIUM | CRITICAL | **CRITICAL** |
| **T-18** | Authorization | Officer Accessing Full Historical Audit Logs | HIGH | HIGH | **HIGH** |
| **T-19** | Authorization | Client-Side Role Manipulation in Browser DOM | HIGH | MEDIUM | **MEDIUM** |
| **T-20** | Authorization | Forged Role Claims (Unsigned / None-Alg Tokens) | HIGH | CRITICAL | **CRITICAL** |
| **T-21** | Authorization | Direct API Authorization Bypass via Script | HIGH | CRITICAL | **CRITICAL** |
| **T-22** | Authorization | Object-Level PII Scraping (`/citizens/:id`) | HIGH | CRITICAL | **CRITICAL** |
| **T-23** | Authorization | Object-Level Application Snooping (`/applications/:id`)| HIGH | HIGH | **HIGH** |
| **T-24** | Authorization | IDOR on Adjudication (`/applications/:id/review`) | HIGH | CRITICAL | **CRITICAL** |
| **T-25** | Authorization | Unauthorized Domicile Certificate Minting | HIGH | CRITICAL | **CRITICAL** |

### Severity Distribution:
- **CRITICAL:** **9** (T-02, T-11, T-16, T-17, T-20, T-21, T-22, T-24, T-25)
- **HIGH:** **10** (T-01, T-04, T-05, T-07, T-09, T-10, T-14, T-15, T-18, T-23)
- **MEDIUM:** **5** (T-03, T-06, T-08, T-13, T-19)
- **LOW:** **1** (T-12)
- **Total Evaluated Threats:** **25**

---

## 7. Most Dangerous Attack Paths

The three most dangerous attack paths in the current code are:

```
ATTACK PATH 1: Anonymous Domicile Certificate Minting
Attacker ──[ HTTP POST /api/applications/APP-2026-002/review ]──► Domicile Office (:5000)
             Payload: { "decision": "APPROVE" }
                                │
                        (Zero Auth Check)
                                ▼
            issuePrototypeDomicileCertificate() executes
                                ▼
            Official State Domicile Certificate Issued to Attacker
```
*Current Impact: Complete subversion of state adjudication integrity.*

```
ATTACK PATH 2: Bulk Citizen PII Harvesting
Attacker ──[ Loop: GET /citizens/1, 2, 3... ]──► Revenue / Social Welfare (:4001 / :4002)
                                │
                        (Zero Auth Check)
                                ▼
            PostgreSQL returns PAN, annual_income, caste_category, address
                                ▼
            Attacker dumps entire state citizen financial & caste registry
```
*Current Impact: Catastrophic citizen privacy breach.*

```
ATTACK PATH 3: Master Service Key Theft via Browser Console
Attacker / XSS ──► Staff opens http://localhost:4001/admin
                      Staff enters ISSUER_API_KEY into browser prompt()
                                │
                      admin.js executes: sessionStorage.setItem('issuer_api_key', key)
                                ▼
Attacker reads sessionStorage.getItem('issuer_api_key')
                                ▼
Attacker signs fraudulent Income Certificates indefinitely using stolen service key
```
*Current Impact: Permanent compromise of departmental cryptographic authority.*

---

## 8. False Positives & Non-Applicable Threats

The following theoretical attack vectors were investigated and confirmed **NOT APPLICABLE** or **ALREADY SECURE** in the current code:

1. **Ed25519 Signature Forgery:** Cryptographic signatures generated by `src/crypto/signer.js` conform to RFC 8032. Modifying any claim in an issued credential causes `crypto.verify` to fail deterministically. Tampering with signatures without the private key is mathematically infeasible.
2. **Offline Verifier Tampering / Phone-Home Leakage:** Domicile Office performs 100% offline verification using local Trust Registry public keys. It makes zero HTTP or database calls to Issuers during verification. No live-call vulnerability exists.
3. **Presentation Replay Attacks:** `domicile-office/backend/src/services/replayService.ts` correctly validates nonce uniqueness and invalidates nonces upon single use. Replay attacks against presentation exchanges are already thwarted.
4. **Service Key Timing Attacks:** `requireIssuerApiKey` already implements `crypto.timingSafeEqual` with a constant-time dummy comparison for mismatched lengths. Timing side-channels on API keys are already mitigated.

---

## 9. Dependencies Between Authentication and RBAC

```
                    ┌─────────────────────────┐
                    │     INCOMING REQUEST    │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │   AUTHENTICATION (AuthN)│
                    │   - Valid token?        │
                    │   - Valid signature?    │
                    │   - Not expired?        │
                    │   - Not logged out?     │
                    └────────────┬────────────┘
                                 │ YES (Attaches req.user: { id, role, dept })
                                 ▼
                    ┌─────────────────────────┐
                    │   AUTHORIZATION (AuthZ) │
                    │   - Does role permit?   │
                    │   - Department match?   │
                    │   - Resource eligible?  │
                    └────────────┬────────────┘
                                 │ YES
                                 ▼
                    ┌─────────────────────────┐
                    │     EXECUTE ACTION      │
                    └─────────────────────────┘
```

**Crucial Dependency:** RBAC cannot function without reliable authentication. If authentication can be bypassed (e.g. T-02, T-11), RBAC is completely neutralized. Therefore, Authentication Hardening is the strict prerequisite for Authorization.

---

## 10. Conclusion & Transition to Phase 3

The Phase 2 Threat Model confirms that GovConnect's current core cryptographic primitives are sound, but the perimeter and access-control boundaries are wide open to anonymous callers.

Phase 3 (Target Design) must provide the **smallest, most robust architecture** to remediate all 25 threats without introducing unnecessary enterprise baggage.

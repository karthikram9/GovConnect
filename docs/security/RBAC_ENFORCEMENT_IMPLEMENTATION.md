# GovConnect — Phase 4B RBAC Enforcement Implementation Document
**Cycle 01 — Security Hardening**  
**Problem Statement:** SIH26129  
**Objective:** Fine-Grained Role-Based Access Control (RBAC) & Department Boundary Enforcement  
**Date:** September 15, 2026  
**Status:** **IMPLEMENTED & VERIFIED**

---

## 1. Executive Summary

Phase 4B builds directly upon the approved Phase 4A Authentication Foundation to resolve **Drawback #2**: *"Fine-grained RBAC needs strengthening."*

In Phase 4A, authenticated user identities, cryptographically signed HMAC-SHA256 Bearer tokens, token expiration, JTI revocation, and login rate limiting were deployed. Phase 4B enforces fine-grained authorization, operational role boundaries, strict departmental segregation, machine-to-human privilege separation, and object lifecycle guards across all GovConnect services.

---

## 2. Core RBAC Principles & Architecture

### 2.1 Roles Enforced
Three operational roles are recognized and strictly segregated:
1. **`ADMIN`**: Full administrative access within the user's home department. Can manage configurations and view staff records.
2. **`ISSUER_OFFICER`**: Operational credential officer within an issuing department (Revenue or Social Welfare). Authorized to inspect citizen records and issue credentials for their department. Barred from reviewing verifier applications.
3. **`REVIEW_OFFICER`**: Operational adjudication officer within a verifier department (Domicile Office). Authorized to inspect application queues and review ambiguous identity applications. Barred from issuing credentials in Revenue or Social Welfare.

### 2.2 Department Boundaries
Three authoritative departments are segregated:
- `revenue` (Revenue & Forest Department, Government of Maharashtra)
- `social-welfare` (Social Justice & Special Assistance Department, Government of Maharashtra)
- `domicile` (Domicile Certificate Office, Government of Maharashtra)

Normalization logic (`normalizeDept()`) ensures consistent casing and hyphen/underscore equivalence across services (e.g. `social_welfare` and `social-welfare` are equivalent).

### 2.3 Machine-to-Machine (`X-API-Key`) vs Human Operator (`Bearer`) Privilege Separation
- **Machine `X-API-Key`**: Reserved solely for backend wallet orchestrator integration on `POST /issue-credential/:citizenId`. Validated via constant-time comparison (`crypto.timingSafeEqual`).
- **Human `Bearer` Token**: Used by staff on administrative dashboards and APIs.
- **Strict Invariant**: `X-API-Key` is strictly barred from administrative or investigative endpoints (`/admin`, `/citizens`, `/citizens/:id`, `/issued-credentials`). Attempting to use `X-API-Key` on those endpoints returns `401 Unauthorized`.

---

## 3. Departmental Enforcement Details

### 3.1 Revenue Department (`revenue-dept`)
| Endpoint | Method | Allowed Identities | Response on Role Mismatch | Response on Dept Mismatch |
| :--- | :--- | :--- | :--- | :--- |
| `/admin` | GET | `ADMIN`, `ISSUER_OFFICER` of `revenue` | 403 Forbidden | 403 Forbidden |
| `/citizens` | GET | `ADMIN`, `ISSUER_OFFICER` of `revenue` | 403 Forbidden | 403 Forbidden |
| `/citizens/:id` | GET | `ADMIN`, `ISSUER_OFFICER` of `revenue` | 403 Forbidden | 403 Forbidden |
| `/issued-credentials` | GET | `ADMIN`, `ISSUER_OFFICER` of `revenue` | 403 Forbidden | 403 Forbidden |
| `/issue-credential/:id` | POST | Dual-Mode: `ADMIN`/`ISSUER_OFFICER` of `revenue` **OR** valid `X-API-Key` | 403 Forbidden | 403 Forbidden |
| `/health` | GET | Public (Zero Auth) | N/A | N/A |
| `/public-key` | GET | Public (Zero Auth) | N/A | N/A |

### 3.2 Social Welfare Department (`social-welfare-dept`)
| Endpoint | Method | Allowed Identities | Response on Role Mismatch | Response on Dept Mismatch |
| :--- | :--- | :--- | :--- | :--- |
| `/admin` | GET | `ADMIN`, `ISSUER_OFFICER` of `social-welfare` | 403 Forbidden | 403 Forbidden |
| `/citizens` | GET | `ADMIN`, `ISSUER_OFFICER` of `social-welfare` | 403 Forbidden | 403 Forbidden |
| `/citizens/:id` | GET | `ADMIN`, `ISSUER_OFFICER` of `social-welfare` | 403 Forbidden | 403 Forbidden |
| `/issued-credentials` | GET | `ADMIN`, `ISSUER_OFFICER` of `social-welfare` | 403 Forbidden | 403 Forbidden |
| `/issue-credential/:id` | POST | Dual-Mode: `ADMIN`/`ISSUER_OFFICER` of `social-welfare` **OR** valid `X-API-Key` | 403 Forbidden | 403 Forbidden |
| `/health` | GET | Public (Zero Auth) | N/A | N/A |
| `/public-key` | GET | Public (Zero Auth) | N/A | N/A |

### 3.3 Domicile Certificate Office (`domicile-office/backend`)
| Endpoint | Method | Allowed Identities | Lifecycle / State Guard |
| :--- | :--- | :--- | :--- |
| `/api/applications` | GET | `ADMIN`, `REVIEW_OFFICER` of `domicile` | None |
| `/api/applications/:id` | GET | `ADMIN`, `REVIEW_OFFICER` of `domicile` | None |
| `/api/applications/:id/review` | POST | `ADMIN`, `REVIEW_OFFICER` of `domicile` | **Enforced**: Application MUST be in `NEEDS_MANUAL_REVIEW`. Terminal/other states (`APPROVED`, `REJECTED`, `VERIFIED`, `PENDING_CREDENTIALS`) return `409 Conflict`. |
| `/health` | GET | Public (Zero Auth) | None |
| `/api/trust-registry` | GET | Public (Zero Auth) | None |
| `/api/verification-requests` | POST | Public (Zero Auth) | None |
| `/api/presentations/verify` | POST | Public (Zero Auth) | Cryptographic verification & replay guards |
| `/api/certificates/:id` | GET | Public (Zero Auth) | None |

---

## 4. HTTP Contract Standards

- **HTTP 401 Unauthorized**: Returned when authentication is missing, expired, revoked, has invalid signature, or malformed header.
- **HTTP 403 Forbidden**: Returned when an authenticated principal lacks the mandatory role or hails from an unauthorized department.
- **HTTP 409 Conflict**: Returned when an operation violates object lifecycle integrity (e.g. attempting to review an application not in `NEEDS_MANUAL_REVIEW`).

---

## 5. Artifacts Created & Modified

1. `revenue-dept/src/middleware/rbac.js` [NEW]
2. `revenue-dept/src/server.js` [MODIFIED]
3. `revenue-dept/src/routes/citizens.js` [MODIFIED]
4. `revenue-dept/src/routes/credentials.js` [MODIFIED]
5. `revenue-dept/tests/api.test.js` [MODIFIED]
6. `revenue-dept/tests/rbac.test.js` [NEW]
7. `revenue-dept/package.json` [MODIFIED]
8. `social-welfare-dept/src/middleware/rbac.js` [NEW]
9. `social-welfare-dept/src/server.js` [MODIFIED]
10. `social-welfare-dept/src/routes/citizens.js` [MODIFIED]
11. `social-welfare-dept/src/routes/credentials.js` [MODIFIED]
12. `social-welfare-dept/tests/api.test.js` [MODIFIED]
13. `social-welfare-dept/tests/rbac.test.js` [NEW]
14. `social-welfare-dept/package.json` [MODIFIED]
15. `domicile-office/backend/src/middleware/rbac.ts` [NEW]
16. `domicile-office/backend/src/routes/applications.ts` [MODIFIED]
17. `domicile-office/backend/tests/verifier.test.ts` [MODIFIED]
18. `domicile-office/backend/tests/rbac.test.ts` [NEW]
19. `tests/e2e-integration.test.mjs` [MODIFIED]

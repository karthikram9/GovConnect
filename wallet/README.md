# GovConnect — Citizen Credential Wallet

> **Problem Statement:** SIH26129  
> **Service:** GovConnect Citizen Credential Wallet (Holder Tier)  
> **Context:** Government of Maharashtra (Simulated Prototype)  
> **Notice:** *This is a Smart India Hackathon prototype (Problem Statement SIH26129). Not an official government service.*

---

## 1. Overview & Purpose

The **GovConnect Wallet** is the citizen-controlled credential holder application within the GovConnect decentralized verifiable credential ecosystem.

It empowers citizens to:
1. **Fetch & Hold:** Retrieve cryptographically signed verifiable credentials from authoritative government issuers (Income Certificates from the Revenue Department, Caste Certificates from the Social Welfare Department).
2. **Edge-Held Custody:** Store and manage credentials locally within the citizen's personal device storage (prepared for browser-local IndexedDB).
3. **Explicit Consent & Selective Disclosure:** Present credentials to verifiers (such as the Domicile Certificate Office) with explicit user consent (`[ Share and consent ]`), fresh transaction nonces, and verifier identity binding.
4. **Auditability:** Maintain a local append-only consent ledger tracking all shared credential presentations.

---

## 2. Core Architectural Principles

### 2.1 Edge-Held Credentials (Zero Central Citizen Database)
* In strict adherence to [`docs/SECURITY_INTEROPERABILITY_CONTRACT.md`](../docs/SECURITY_INTEROPERABILITY_CONTRACT.md), the Wallet is **NOT** a centralized database.
* The Wallet backend does **NOT** maintain PostgreSQL tables or persistent server-side registries of citizens.
* Credentials remain edge-held on the citizen's client device.

### 2.2 Relationship to Ecosystem Issuers & Verifier
| Service | Role | Default Port | Description |
| :--- | :--- | :--- | :--- |
| **`revenue-dept`** | Issuer #1 | `4001` | Issues signed `IncomeCertificate` credentials. |
| **`social-welfare-dept`** | Issuer #2 | `4002` | Issues signed `CasteCertificate` credentials. |
| **`wallet` (Frontend)** | Citizen UI | `3000` | Responsive React/Vite/TypeScript client application. |
| **`wallet` (Backend)** | Orchestrator | `3001` | Thin Node.js/Express/TypeScript proxy & health layer. |
| **`domicile`** | Verifier | `5000` | Planned Domicile Office verifier service. |

### 2.3 Identity & Aadhaar Exclusion
* **No Aadhaar:** No Aadhaar numbers, biometric attributes, or UIDAI e-KYC integrations are used, collected, or simulated.
* **Demo Identity Context (`demo-wallet-user`):** The application uses an explicit prototype demo holder identifier.
* **Contract Invariant:** *Cryptographic signature validity is never treated as identity proof.* Possession of a demo profile does not constitute statutory identity proof.

### 2.4 Cryptographic Verification Rule
For all backward-compatible v1 credentials:
$$\text{Received v1 credential} \longrightarrow \text{Verify original v1 payload + original signature} \longrightarrow \text{If valid, normalize to v2}$$
The transition adapter never transforms an unverified v1 credential to v2 before verifying the original signature.

---

## 3. Current Implementation Scope (Step 1 & Step 2 Complete)

The GovConnect Wallet currently implements:
- [x] **Step 1 — Project Foundation:**
  - Modern React + Vite + TypeScript frontend shell configured on port `3000`.
  - Thin Express + TypeScript backend orchestration layer on port `3001` with `GET /health` endpoint (`{ "service": "govconnect-wallet", "status": "ok" }`).
  - Environment configuration (`.env.example`, `.env`) with zero secret leakage to the browser.
- [x] **Step 2 — Premium Citizen-Facing Home UI:**
  - Institutional header with non-official generic emblem placeholder, GovConnect wordmark, structured navigation, and demo citizen profile dropdown.
  - Mandatory 4px Saffron / White / Green tricolor strip below header.
  - Welcome banner with active "Demo Mode" indicator and edge-held custody notice.
  - "My Government Credentials" dashboard section featuring preview cards for **Income Certificate** (Revenue Dept) and **Caste Certificate** (Social Welfare Dept) with subtle "Verified" badges.
  - Credential detail modal for inspection of certified claims and cryptographic metadata.
  - Quick action placeholders ("Add credential", "Consent history").
  - Trust and data ownership explanation emphasizing edge-held custody and zero central citizen database.
- [x] **Step 3A — Secure Issuer Integration Foundation:**
  - Prototype service-to-service authentication using `X-API-Key` configured across issuer endpoints (`POST /issue-credential/:citizenId`).
  - Backend-only secret configuration in `wallet/backend/.env` (`REVENUE_API_KEY`, `SOCIAL_WELFARE_API_KEY`).
  - Strict frontend isolation: issuer keys are never exposed in browser JavaScript, `VITE_` variables, or `/health` responses.
  - Automated security tests proving zero secret exposure.
- [x] **Step 3B — Real Credential Fetching + Ed25519 Verification + IndexedDB Storage:**
  - Credential retrieval flow: Browser (`:3000`) calls Wallet Backend (`:3001`), which calls Revenue (`:4001`) or Social Welfare (`:4002`) using backend-only `X-API-Key`.
  - Cryptographic verification: Wallet backend verifies the original v1 credential and Ed25519 signature against the issuer's registered public key prior to returning it. Invalid signatures are rejected with HTTP 502 and never saved.
  - Edge-held storage: Browser stores verified credentials locally in IndexedDB (`govconnect-wallet` database, `credentials` store). No central or server-side citizen database is created.
  - State persistence: Credentials survive browser page reloads without automatic re-fetching.
  - Demo Identity context: Explicit prototype identification ("Demo Identity: Ramesh Kumar Patil"). No Aadhaar collection, OTP, biometric, or statutory identity verification is performed.
- [x] **Step 3C — Real Wallet-Side "Share and Consent" Presentation Flow:**
  - Verifier Request parsing: Consumes and displays structured verifier requests representing the Domicile Certificate Office (`domicile-office-maharashtra`) specifying purpose, requested certificates (`IncomeCertificate`, `CasteCertificate`), and minimal required claims.
  - Interactive Consent UI: Citizen can review requested credentials, select/deselect specific certificates, verify requesting authority, and must explicitly check the statutory consent statement before proceeding.
  - Primary Action Button: Standardized citizen action button labeled literally `"Share and consent."`.
  - Verifiable Presentation Envelope: Client-side packaging into a standard presentation envelope binding `holder: "demo-wallet-user"`, `verifier`, `requestId`, `nonce`, `purpose`, and `proof.bindingDigest`.
  - Signature Preservation: Original issuer-signed credential payloads and Ed25519 signatures are preserved 100% intact and unmutated inside the presentation.
  - Reference-Only Consent Ledger: IndexedDB-backed `consents` store logs timestamped disclosures containing references and audit metadata only (consent ID, presentation ID, verifier, purpose, credential IDs/types, nonce, timestamp). Raw personal claims (income, caste, PAN) are strictly prohibited and never retained in this log.
  - Replay Protection: Tracks consumed `requestId` and `nonce` tokens in IndexedDB `consumed_requests` store, rejecting expired verification requests (`REQUEST_EXPIRED`) and preventing replay attacks (`REQUEST_ALREADY_USED`).
  - Transparent Consent Ledger UI: Dedicated "Consent History" view displaying all locally recorded disclosure authorizations.
- [ ] *Step 4 — Presentation & Consent Exchange with Domicile Office Verifier*

### 2.5 Credential Lifecycle: Fetch Time vs. Verification Time

A critical architectural distinction in GovConnect is the separation between credential fetching and credential presentation/verification:

```text
FETCH TIME (Step 3B):
  Browser (Citizen) ──> Wallet Backend (:3001) ──[X-API-Key]──> Issuer Department (:4001 / :4002)
                                                                       │
  Browser (IndexedDB) <── Verified Credential <── [Ed25519 Verify] ────┘
  (Wallet contacts issuer once to retrieve and verify citizen's certified document)

VERIFICATION TIME (Step 4 / Domicile Office):
  Citizen Wallet ──[Explicit Consent + Nonce]──> Domicile Office Verifier (:5000)
                                                        │
                                                        ├── Local Credential Verification
                                                        └── Issuer Public Key Registry
                                                        (OFFLINE: Zero contact with Issuer Databases)
```

1. **At Fetch Time:** The Wallet backend acts as an authenticated proxy to retrieve signed credentials from authoritative state issuers (`POST /issue-credential/:citizenId`) and verifies the signature using the issuer's public key.
2. **At Verification Time:** When presenting credentials to downstream verifiers (such as the Domicile Certificate Office), verification is designed to be completely **offline** from issuer databases, relying strictly on the citizen-presented verifiable credential, nonces, and the verifier's trusted public-key registry.

---

## 4. Getting Started

### Prerequisites
* Node.js v18.0.0+ (Tested on Node v25.6.1)
* npm v9.0.0+

### 4.1 Running the Backend (Port 3001)

```bash
cd wallet/backend

# Install dependencies
npm install

# Run automated tests
npm test

# Build TypeScript to dist/
npm run build

# Start the development server (with tsx hot-reload)
npm run dev
```

Health check verification:
```bash
curl http://localhost:3001/health
# Response: {"service":"govconnect-wallet","status":"ok"}
```

### 4.2 Running the Frontend (Port 3000)

```bash
cd wallet/frontend

# Install dependencies
npm install

# Validate production build
npm run build

# Start the Vite development server on port 3000
npm run dev
```

Open your browser and navigate to:
```text
http://localhost:3000
```

---

## 5. Security Notes

1. **Frontend Environment:** Only non-sensitive public configuration (such as `VITE_API_BASE_URL`) is exposed to the browser via Vite's `import.meta.env`.
2. **Issuer Decoupling:** Department issuer secrets and internal keys are never transmitted to or held by the client application.
3. **No Unnecessary Infrastructure:** No database, blockchain, message queues, or heavy microservice meshes are introduced.

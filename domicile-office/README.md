# GovConnect — Domicile Certificate Office (Verifier Tier)

> **Problem Statement:** SIH26129  
> **Role:** Verifier Tier (Offline Cryptographic Verification & Certificate Issuance)  
> **Jurisdiction:** Revenue & General Administration Department, Government of Maharashtra (Simulated Prototype)  
> **Default Ports:** Backend: `5000` | Frontend: `5001`  
> **Notice:** *This is a Smart India Hackathon prototype (Problem Statement SIH26129). Not an official government service.*

---

## 1. Role & Architectural Demonstration

The **Domicile Certificate Office** serves as the downstream relying party / verifier in the GovConnect decentralized verifiable credential platform.

It receives a `VerifiablePresentation` created and authorized by a citizen using the **GovConnect Wallet** (holding digitally signed `IncomeCertificate` and `CasteCertificate` credentials) and adjudicates eligibility for Domicile Certificate issuance.

### The Key Architectural Guarantee: 100% Offline Verification

$$\text{Citizen Wallet} \xrightarrow[\text{Consent + Nonce}]{\text{Verifiable Presentation}} \text{Domicile Office} \xleftarrow[\text{Registered Keys}]{\text{Offline Lookup}} \text{Trust Registry}$$

```text
CRITICAL DEMONSTRATION INVARIANT:
Domicile does NOT contact Revenue Department (:4001) or Social Welfare Department (:4002)
databases during credential verification.

Zero live HTTP calls.
Zero database queries to issuer records.
Zero citizen surveillance tracking by issuers.
```

When credentials arrive at Domicile:
1. Domicile checks each digital signature locally using **Ed25519** and the registered public key from its **Trust Registry**.
2. Domicile visibly displays:
   - *"Signature checked against Revenue Department's registered public key — no direct contact with Revenue Department was needed."*
   - *"Signature checked against Social Welfare Department's registered public key — no direct contact with Social Welfare Department was needed."*

---

## 2. Core Security & Verification Architecture

### 2.1 Public-Key Trust Registry
* **Prototype Simplification Notice:**
  > *"The Trust Registry is implemented inside the Domicile verifier backend as a prototype simplification. A production deployment may operate it as an independently governed registry service."*
* **Strict Segregation Rule (Section 8.2 of Contract):**
  The Trust Registry contains **ONLY** public issuer metadata, Key IDs, and Ed25519 public keys (`revenue-dept-maharashtra` / `revenue-key-1`, `social-welfare-dept-maharashtra` / `social-welfare-key-1`). It strictly contains **ZERO** citizen records, PAN, Aadhaar, DOB, income, caste, addresses, or credential payloads.

### 2.2 Replay Protection
* Independent verifier-side replay prevention tracks `{ requestId, nonce, presentationId, consumedAt }`.
* Each verification request contains a 128-bit cryptographic challenge nonce with a 15-minute expiration window.
* When a presentation is processed, the nonce and `requestId` are permanently burned. Re-submitting the same presentation produces `REQUEST_ALREADY_USED`.

### 2.3 Identity Linking & Demo Context
* **Notice:**
  > *"The prototype uses an application-level demo holder identifier (`demo-wallet-user`) and does not claim legal identity proof or certified OID4VP compliance."*
* Cryptographic signature validity proves that a document was signed by an authorized department and unaltered; it does not prove the presenter is the named person.
* Domicile presents an explicit citizen confirmation step: *"Do these credentials belong to you?"* with explicit Demo Identity confirmation.

### 2.4 Deterministic Demographic Matching & Ramesh Patil Ambiguity
* Matching engine evaluates normalized `name`, `dateOfBirth`, and `address`.
* **Canonical Ambiguity Test Case:**
  - The system intentionally tests `Ramesh Kumar Patil` against `Ramesh K. Patil` (matching DOB, PAN, and address, but with name variation).
  - The system does **NOT** silently auto-match!
  - It flags `NEEDS_MANUAL_REVIEW` and routes the file to human review with the message:
    > *"Some credential identity details are similar, but the submitted identity could not be deterministically linked with sufficient confidence."*

### 2.5 Manual Review & Certificate Issuance
* **Manual Review Queue:** Administrative officers inspect the demographic variance side-by-side, verify that Ed25519 signatures are valid, and enter administrative audit notes.
* **Approve:** Issues the `Prototype Domicile Certificate` with `issuanceMode: "APPROVED_AFTER_MANUAL_REVIEW"`.
* **Reject:** Marks application `REJECTED` with audit record: *"Application rejected after manual review."*
* **Prototype Domicile Certificate:** Contains certificate ID (`DOM-MH-2026-XXXX`), applicant demo reference, verified claims summary, verification ref, and mandatory disclaimer:
  > *"Prototype Domicile Certificate — Demo Output — Not an Official Government Certificate"*

### 2.6 Absolute Aadhaar Exclusion
* No Aadhaar numbers, images, OTPs, or UIDAI APIs are used or simulated.

---

## 3. Getting Started

### 3.1 Running the Backend (Port 5000)

```bash
cd domicile-office/backend

# Install dependencies
npm install

# Run automated test suite (31 tests covering all 24 contract scenarios)
npm test

# Build TypeScript to dist/
npm run build

# Start development server (port 5000)
npm run dev
```

Health check:
```bash
curl http://localhost:5000/health
# Response: {"service":"domicile-office","status":"ok"}
```

Trust Registry:
```bash
curl http://localhost:5000/api/trust-registry
```

### 3.2 Running the Frontend (Port 5001)

```bash
cd domicile-office/frontend

# Install dependencies
npm install

# Validate production build
npm run build

# Start Vite development server on port 5001
npm run dev
```

Open your browser to:
```text
http://localhost:5001
```

---

## 4. API Specification

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Service health status (`{"service": "domicile-office", "status": "ok"}`) |
| `GET` | `/api/trust-registry` | Registered departmental public keys (Revenue & Social Welfare) |
| `POST` | `/api/verification-requests` | Generates a fresh presentation request with unique nonce and 15m expiration |
| `GET` | `/api/verification-requests/:id` | Retrieves verification challenge by `requestId` |
| `POST` | `/api/presentations/verify` | Receives presentation from Wallet, verifies signatures offline, executes matching, issues certificate |
| `GET` | `/api/applications` | Lists citizen applications (`APP-2026-001`, `APP-2026-002`) |
| `POST` | `/api/applications/:id/review` | Officer manual adjudication (`APPROVE` or `REJECT`) |
| `GET` | `/api/certificates/:id` | Retrieves issued Prototype Domicile Certificate |

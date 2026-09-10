# GovConnect — Revenue Department (Issuer #1)

> **Problem Statement:** SIH26129  
> **Service:** Revenue Department — Issuer #1  
> **Context:** Government of Maharashtra (Simulated Prototype)  

---

## 1. Project Overview

**GovConnect** is a decentralized, privacy-preserving verifiable credential architecture. Rather than requiring downstream government authorities to query central departmental databases directly, departments act as cryptographically trusted **issuers**.

The **Revenue Department** is **Issuer #1** in this architecture:
1. Maintains citizen income registry records in PostgreSQL (`govconnect_revenue`).
2. Provides an internal staff console (`/admin`) for inspecting records and issuing **Income Certificates**.
3. Cryptographically signs each credential using asymmetric **Ed25519** digital signatures over canonicalized JSON.
4. Stores issued credentials and their signatures in PostgreSQL.
5. Exposes REST endpoints for citizen discovery and credential issuance (for the future **GovConnect Wallet**).
6. Exposes its Ed25519 public key (`GET /public-key`) so downstream verifiers (such as the **Domicile Certificate Office**) can verify credentials offline without contacting the Revenue Department database.

---

## 2. System Requirements

* **Node.js**: v18.0.0+ (Tested on v25.6.1)
* **npm**: v9.0.0+
* **PostgreSQL**: v14+ (Tested on PostgreSQL 18, `localhost:5432`)
* **pgAdmin** or `psql` CLI

---

## 3. Database Setup

The application connects to the pre-existing PostgreSQL database named:
```text
Database: govconnect_revenue
Host: localhost
Port: 5432
User: postgres
```

### Initializing Schema and Seed Data

To create the tables (`citizens`, `issued_credentials`) and insert the 3 seeded citizen records, use any of the following methods:

#### Option A: Run via npm script (Recommended)
Configure your `.env` file first (see Section 4), then run:
```bash
npm run db:init
```

#### Option B: Via pgAdmin Query Tool
1. Open pgAdmin and connect to your local PostgreSQL server.
2. Select the `govconnect_revenue` database.
3. Open the **Query Tool** and open `init.sql`.
4. Execute the script.

#### Option C: Via psql CLI
```bash
psql -U postgres -d govconnect_revenue -f init.sql
```

### Seed Data
The database is seeded with exactly three citizens (safe against duplicate initialization):
1. **Ramesh Kumar Patil** (DOB: `1988-04-12`, Income: ₹3,12,000, PAN: `ABCDE1234F`, Pune)
2. **Sunita Devi Sharma** (DOB: `1979-11-03`, Income: ₹2,45,000, PAN: `PQRSX5678K`, Nagpur)
3. **Ramesh K. Patil** (DOB: `1988-04-12`, Income: ₹3,12,000, PAN: `ABCDE1234F`, Pune)  
   *(Record #3 is intentionally identical in demographic markers to #1 to support future human-review fallback testing in the Domicile Office).*

---

## 4. Environment Configuration

Copy `.env.example` to create `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your local PostgreSQL password:
```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/govconnect_revenue
PORT=4001
CORS_ORIGIN=*
NODE_ENV=development
ISSUER_API_KEY=replace-with-a-long-random-secret
```

> **Security Rule:** Never commit `.env` to version control. The repository `.gitignore` automatically excludes `.env`.
>
> **Authentication Note:** `ISSUER_API_KEY` defines the service-to-service prototype secret required to issue credentials. It is server-side only and never exposed to browser clients. This is prototype service authentication, not production IAM.

---

## 5. Installation & Running

### Install Dependencies
```bash
npm install
```

### Start Server (Production Mode)
```bash
npm start
```

### Start Server (Development Mode with auto-reload)
```bash
npm run dev
```

The server will start at:
* **API Service:** `http://localhost:4001`
* **Staff Admin Console:** `http://localhost:4001/admin`

---

## 6. Cryptographic Architecture

* **Algorithm:** Asymmetric Ed25519 (RFC 8032) using Node.js built-in `crypto`.
* **Key Persistence:** On first startup, the server creates an Ed25519 keypair in `keys/` (`private_key.pem` and `public_key.pem`). On subsequent restarts, existing keys are loaded automatically.
* **Security:** `keys/` is gitignored. The private key is never returned by any API endpoint or exposed in client responses.
* **Deterministic Serialization:** Credentials are deterministically serialized prior to signing using `fast-json-stable-stringify` (consistent property order, whitespace, and formatting).
* **Signatures:** Base64-encoded 64-byte Ed25519 signatures.
* **Tamper Evidence:** Modifying any claim in the credential (e.g. changing `annualIncome` from `312000` to `999999`) causes cryptographic verification to fail.

---

## 7. REST API Endpoints

### 7.1 Health Check
**`GET /health`**  
Verifies server health and readiness.
* **Response (200 OK):**
```json
{
  "status": "ok"
}
```

---

### 7.2 Public Key
**`GET /public-key`**  
Retrieves the active Ed25519 public key.
* **Response (200 OK):**
```json
{
  "issuer": "revenue-dept-maharashtra",
  "publicKey": "MCowBQYDK2VwAyEA...",
  "publicKeyPem": "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA...\n-----END PUBLIC KEY-----\n"
}
```

---

### 7.3 Minimal Citizens Registry (For Wallet Picker)
**`GET /citizens`**  
Returns registered citizens with only minimal non-sensitive identity fields.
* **Response (200 OK):**
```json
[
  {
    "id": 1,
    "name": "Ramesh Kumar Patil",
    "dateOfBirth": "1988-04-12"
  },
  {
    "id": 2,
    "name": "Sunita Devi Sharma",
    "dateOfBirth": "1979-11-03"
  },
  {
    "id": 3,
    "name": "Ramesh K. Patil",
    "dateOfBirth": "1988-04-12"
  }
]
```

---

### 7.4 Issue Income Certificate
**`POST /issue-credential/:citizenId`**  
Constructs an `IncomeCertificate`, canonicalizes it, signs it with the Ed25519 private key, and stores it in PostgreSQL.
* **Authentication:** Requires `X-API-Key: <ISSUER_API_KEY>` header. Requests missing or presenting an invalid key return `401 Unauthorized` without database access or signing.
* **Response (201 Created):**
```json
{
  "credential": {
    "credentialType": "IncomeCertificate",
    "issuer": "revenue-dept-maharashtra",
    "subject": {
      "name": "Ramesh Kumar Patil",
      "dateOfBirth": "1988-04-12",
      "panNumber": "ABCDE1234F",
      "address": "12, Shivaji Nagar, Pune, Maharashtra"
    },
    "claims": {
      "annualIncome": 312000
    },
    "issuedAt": "2026-09-08T10:15:00.000Z"
  },
  "signature": "3l30fDqI...",
  "issuer": "revenue-dept-maharashtra"
}
```

---

### 7.5 Issued Credentials List
**`GET /issued-credentials`**  
Returns historical credentials issued by the department for admin inspection.
* **Response (200 OK):**
```json
[
  {
    "id": 1,
    "citizen_id": 1,
    "citizen_name": "Ramesh Kumar Patil",
    "credential_type": "IncomeCertificate",
    "issuer": "revenue-dept-maharashtra",
    "signature": "3l30fDqI...",
    "credential": { ... },
    "issued_at": "2026-09-08T10:15:00.000Z"
  }
]
```

---

## 8. cURL Examples

```bash
# Health Check
curl http://localhost:4001/health

# Get Public Key
curl http://localhost:4001/public-key

# List Citizens (Minimal Data)
curl http://localhost:4001/citizens

# Issue Income Certificate for Citizen ID 1 (Authorized with X-API-Key)
curl -X POST http://localhost:4001/issue-credential/1 -H "X-API-Key: replace-with-a-long-random-secret"

# List Issued Credentials
curl http://localhost:4001/issued-credentials
```

---

## 9. Automated Testing

Run the automated test suite:
```bash
npm test
```

### Included Tests:
* **`tests/crypto.test.js`**:
  * Key persistence across restarts.
  * Deterministic canonical serialization.
  * Deterministic signatures (same input + same key = identical Base64 signature).
  * Cryptographic verification with Ed25519 public key.
  * Tamper-evidence (modifying claims invalidates signature).
* **`tests/api.test.js`**:
  * Health check (`GET /health`).
  * Public key endpoint (`GET /public-key`, verifies private key is never returned).
  * Citizens listing (`GET /citizens`, verifies only minimal fields are exposed).
  * Credential issuance (`POST /issue-credential/1`, verifies schema, signature, and claims).
  * Error states (`404` for missing citizen, `400` for invalid ID).
  * Issued credentials listing (`GET /issued-credentials`).

---

## 10. Future Architecture Integration

This service is designed as **Issuer #1** in the GovConnect ecosystem:
* **GovConnect Wallet:** Will call `GET /citizens` to allow citizens to select their identity, and `POST /issue-credential/:citizenId` to download their signed Income Certificate into their personal wallet.
* **Domicile Certificate Office (Verifier):** Will receive the credential and signature directly from the citizen's wallet. The Domicile Office retrieves `GET /public-key` from Revenue Department to verify the signature offline, verifying citizen income without accessing the Revenue Department's database.

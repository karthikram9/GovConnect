# GovConnect — Social Welfare Department (Issuer #2)

> **SIH Prototype — Government of Maharashtra (Social Welfare Department, simulated)**  
> *This is a Smart India Hackathon prototype (Problem Statement SIH26129). Not an official government service.*

---

## 1. Overview

The **Social Welfare Department (Issuer #2)** is an independent issuer service within the **GovConnect** decentralized credential issuance and verification ecosystem.

It is responsible for:
- Holding demonstration citizen caste records in its own isolated PostgreSQL database (`govconnect_social_welfare`).
- Issuing cryptographically signed **CasteCertificate** credentials with **Ed25519** digital signatures.
- Exposing clean REST API endpoints for the future GovConnect Wallet and verifier authorities.
- Providing an institutional, staff-facing admin console at `/admin`.
- Maintaining persistent Ed25519 keys across server reboots.

### Architectural Independence
In accordance with GovConnect design principles:
- **Zero Cross-Talk**: The Social Welfare Department does NOT communicate with or depend on the Revenue Department (Issuer #1).
- **Independent Authorities**: Both departments independently maintain their own databases and issue domain-specific credentials (`IncomeCertificate` by Revenue, `CasteCertificate` by Social Welfare).
- **Independent Verification**: Future verifiers (such as the Domicile Office) obtain public keys directly from each issuer's `/public-key` endpoint to independently verify signatures. There is no centralized citizen database.

---

## 2. Tech Stack

- **Runtime**: Node.js (>= 18.0.0)
- **Framework**: Express.js
- **Database**: PostgreSQL (`govconnect_social_welfare`) via `pg`
- **Cryptography**: Node.js built-in `crypto` (Ed25519)
- **Canonicalization**: `fast-json-stable-stringify`
- **CORS**: `cors` (enabled for wallet integration)
- **Frontend**: Vanilla HTML5, institutional CSS3, JavaScript (no external CDN or frontend build steps required)
- **Test Framework**: Node.js native test runner (`node:test`, `node:assert`)

---

## 3. Database Schema & Mock Citizens

### Schema (`init.sql`)

```sql
CREATE TABLE IF NOT EXISTS citizens (
  id SERIAL PRIMARY KEY,
  applicant_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  caste_category TEXT NOT NULL,
  caste_name TEXT NOT NULL,
  certificate_number TEXT NOT NULL,
  address TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS issued_credentials (
  id SERIAL PRIMARY KEY,
  citizen_id INTEGER REFERENCES citizens(id),
  credential_json JSONB NOT NULL,
  signature TEXT NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT now()
);
```

### Mock Demonstration Citizens
The database is initialized with **exactly 20 fictional citizens** across Maharashtra locations with realistic caste categories (`SC`, `ST`, `OBC`, `VJNT`, `SBC`).

The records deliberately include matching entries for the test citizens from the Revenue Department to enable future end-to-end verification workflows:
1. **Ramesh Kumar Patil** (DOB: 1988-04-12, Address: 12, Shivaji Nagar, Pune, Maharashtra)
2. **Sunita Devi Sharma** (DOB: 1979-11-03, Address: 45, Gandhi Road, Nagpur, Maharashtra)
3. **Ramesh K. Patil** (DOB: 1988-04-12, Address: 12, Shivaji Nagar, Pune, Maharashtra) — *Preserves intentional similarity with Ramesh Kumar Patil for human-review testing.*

---

## 4. Cryptographic Implementation

### Ed25519 Key Management
- On startup, `initKeys()` in `src/crypto/signer.js` checks the `keys/` directory.
- If `private_key.pem` and `public_key.pem` exist, they are loaded into memory.
- If not present, an Ed25519 keypair is generated via `crypto.generateKeyPairSync('ed25519')` and saved to `keys/` (private key: mode `0o600`, public key: mode `0o644`).
- Keys are persistent and survive server restarts. The `keys/` directory is gitignored.

### Canonicalization & Deterministic Signatures
- Before signing, the credential object is canonically serialized using `fast-json-stable-stringify`. This guarantees that object key ordering never affects the signature.
- The UTF-8 string is signed via Ed25519 (`crypto.sign(null, buffer, privateKey)`).
- The resulting signature is encoded as Base64.
- Signing identical credential payloads produces identical Base64 signatures.
- Modifying any attribute of the payload (e.g. `claims.casteCategory`, `claims.certificateNumber`, `subject.name`, or `issuer`) invalidates verification.

---

## 5. Credential Format

```json
{
  "credentialType": "CasteCertificate",
  "issuer": "social-welfare-dept-maharashtra",
  "subject": {
    "name": "Ramesh Kumar Patil",
    "dateOfBirth": "1988-04-12",
    "address": "12, Shivaji Nagar, Pune, Maharashtra"
  },
  "claims": {
    "casteCategory": "OBC",
    "casteName": "Kunbi",
    "certificateNumber": "MS-CC-2023-001089"
  },
  "issuedAt": "2026-01-01T00:00:00.000Z"
}
```

---

## 6. API Endpoints

| Method | Path | Description | Access / Purpose |
|---|---|---|---|
| `GET` | `/health` | Service liveness health check | System monitoring (`{"status":"ok"}`) |
| `GET` | `/public-key` | Returns Base64 SPKI & PEM public keys | External Verifiers / Wallet |
| `GET` | `/citizens` | Returns minimal list (`id`, `applicant_name`, `date_of_birth`) | Wallet Citizen Picker (caste hidden) |
| `GET` | `/citizens/:citizenId` | Returns full department citizen record | Internal Admin Console Review |
| `POST` | `/issue-credential/:citizenId` | Generates, signs, and persists credential | Protected by `X-API-Key` (Admin / Wallet backend) |
| `GET` | `/issued-credentials` | Returns all issued credentials | Internal Admin Console audit log |
| `GET` | `/admin` | Institutional staff admin console | Department staff browser UI |

---

## 7. Quickstart

### Prerequisites
- Node.js >= 18.0.0
- PostgreSQL running locally on port 5432

### Configuration
Create `.env` from `.env.example`:
```ini
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/govconnect_social_welfare
PORT=4002
CORS_ORIGIN=*
NODE_ENV=development
ISSUER_API_KEY=replace-with-a-long-random-secret
```

> **Security & Prototype Notice:** `ISSUER_API_KEY` is a service-to-service prototype secret required by `POST /issue-credential/:citizenId` via the `X-API-Key` header. It is server-side only and never exposed to the browser. This is a prototype security mechanism, not production IAM.

### Initialize Database
Creates database `govconnect_social_welfare` and seeds 20 mock citizens:
```bash
npm run db:init
```

### Run Tests
Executes native Node.js cryptographic and API integration test suites:
```bash
npm test
```

### Start Server
```bash
npm start
```

Access the console in your browser:
- **Admin Console**: [http://localhost:4002/admin](http://localhost:4002/admin)
- **Health Check**: [http://localhost:4002/health](http://localhost:4002/health)
- **Public Key**: [http://localhost:4002/public-key](http://localhost:4002/public-key)

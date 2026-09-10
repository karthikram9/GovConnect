# GovConnect — Security & Interoperability Contract v2

> **Project:** GovConnect  
> **Problem Statement:** SIH26129  
> **Organization:** Government of Maharashtra (Simulated Prototype)  
> **Document Version:** 2.0.1 (Editorial Security Clarification)  
> **Status:** ARCHITECTURE CONTRACT FROZEN  

*Note on Version 2.0.1:* Version 2.0.1 is strictly an editorial and security-clarification amendment. It clarifies v1-to-v2 cryptographic verification sequencing, demo holder binding semantics, and status list terminology. It does NOT modify the frozen architecture, system roles, APIs, cryptographic primitives, or any of the 24 Frozen Decisions.

---

## 1. Purpose

This document constitutes the single authoritative **Security and Interoperability Contract (v2)** for the **GovConnect** decentralized verifiable credential platform (Smart India Hackathon Problem Statement SIH26129).

This specification establishes:
1. Immutable data contracts and JSON schemas for all verifiable credentials and presentations within the GovConnect ecosystem.
2. Cryptographic signature, verification, and canonicalization guarantees across all participants.
3. Strict trust registry, replay protection, holder binding, and consent management models.
4. Clear architectural boundaries separating production-grade principles from prototype simplifications.

All subsequent development of the **GovConnect Wallet** (Holder) and the **Domicile Certificate Office** (Verifier) must conform strictly to the interfaces, protocols, and data models codified herein. No service or component is permitted to introduce proprietary credential formats or divergent communication protocols.

---

## 2. System Roles

The GovConnect architecture comprises four distinct logical roles. No central government citizen-data repository exists in this design.

```
                    ┌─────────────────────────────┐
                    │     Revenue Department      │
                    │         Issuer #1           │
                    │    Income Certificate       │
                    └──────────────┬──────────────┘
                                   │
                              signed VC
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │      GovConnect Wallet      │
                    │      Citizen / Holder       │
                    └──────────────┬──────────────┘
                                   │
                       consent + presentation
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │    Domicile Certificate     │
                    │       Office / Verifier     │
                    └─────────────────────────────┘
                                   ▲
                                   │
                              signed VC
                                   │
                    ┌──────────────┴──────────────┐
                    │   Social Welfare Dept.      │
                    │         Issuer #2           │
                    │     Caste Certificate       │
                    └─────────────────────────────┘
```

| Role | Entity | Port / Base URL | Responsibilities |
| :--- | :--- | :--- | :--- |
| **Issuer #1** | **Revenue Department** (`revenue-dept-maharashtra`) | `http://localhost:4001` | Maintains citizen income records, issues cryptographically signed `IncomeCertificate` credentials, exposes Ed25519 public key. |
| **Issuer #2** | **Social Welfare Department** (`social-welfare-dept-maharashtra`) | `http://localhost:4002` | Maintains citizen caste records, issues cryptographically signed `CasteCertificate` credentials, exposes Ed25519 public key. |
| **Holder** | **GovConnect Wallet** | `http://localhost:3000` *(Planned)* | Citizen-controlled agent storing credentials locally, managing demo identity, presenting credentials under explicit user consent. |
| **Verifier** | **Domicile Certificate Office** | `http://localhost:5000` *(Planned)* | Verifies presented credentials offline using trusted issuer public keys; checks validity, status, and demographic matching before issuing Domicile Certificates. |

---

## 3. Architecture & Interaction Model

GovConnect operates on a privacy-preserving triangle of trust:

```text
               [ Trust Registry (Public Keys) ]
                     ▲                  ▲
        Published Key│                  │Local Verification Lookup
                     │                  │(Zero contact with Issuer DB)
             ┌───────┴──────┐     ┌─────┴────────┐
             │    Issuer    │     │   Verifier   │
             │ (Rev / SWD)  │     │  (Domicile)  │
             └───────┬──────┘     └─────▲────────┘
                     │                  │
           Fetch /   │                  │ Presentation Exchange
           Issuance  │                  │ (Request + Nonce + Consent)
                     ▼                  │
             ┌──────────────────────────┴┐
             │     GovConnect Wallet     │
             │      (Citizen Holder)     │
             └───────────────────────────┘
```

### Core Interactions:
1. **Issuance / Fetch Flow:** The Wallet connects to an Issuer API to retrieve a newly signed credential. The Wallet verifies the issuer's cryptographic signature before persisting the credential into local holder storage.
2. **Offline Verification Flow:** When verifying credentials submitted by a citizen, the Verifier (Domicile Office) validates cryptographic signatures against cached or registered public keys. **The Verifier requires zero live connectivity to the Issuer's transactional database during credential verification.**

---

## 4. Standards Alignment

GovConnect is architecturally inspired by and aligned with global open identity standards while acknowledging prototype boundaries:

* **W3C Verifiable Credentials (VC) 2.0-Inspired:** Adopts the semantic concepts of `issuer`, `credentialSubject`, `claims`, `validFrom`, `validUntil`, `credentialStatus`, and `proof`. Full W3C JSON-LD processing is intentionally replaced by canonical deterministic JSON serialization for lightweight embedded operation.
* **OpenID for Verifiable Presentations (OID4VP) 1.0-Inspired:** The Wallet-to-Verifier presentation protocol implements the core replay-prevention concepts of OID4VP: Verifier-generated presentation requests, verifier client identity binding, cryptographically fresh single-use nonces, and explicit holder consent.
* **Cryptographic Primitive:** Uses **Ed25519** (Edwards-curve Digital Signature Algorithm over Curve25519) per RFC 8032. Provides high security (128-bit level), fast signing and verification, compact signatures (64 bytes), and collision resistance.

*Disclaimer:* GovConnect does not claim certified W3C VC 2.0 or OpenID4VP 1.0 specification compliance. It implements the essential security guarantees in a transparent, auditable prototype.

---

## 5. Credential Contract

### 5.1 Common Credential Envelope (v2)

All credentials in GovConnect v2 conform to this structure:

```json
{
  "id": "urn:govconnect:credential:<credential-type-slug>:<uuid-v4>",
  "type": [
    "VerifiableCredential",
    "<CredentialType>"
  ],
  "issuer": {
    "id": "<issuer-identifier>",
    "keyId": "<key-identifier>"
  },
  "credentialSubject": {
    "name": "<string>",
    "dateOfBirth": "YYYY-MM-DD",
    "address": "<string>"
  },
  "claims": {
    "<domain-specific-key>": "<domain-specific-value>"
  },
  "validFrom": "<ISO-8601-Timestamp>",
  "validUntil": null,
  "credentialStatus": {
    "status": "active"
  },
  "proof": {
    "type": "Ed25519Signature",
    "signature": "<base64-encoded-signature>"
  }
}
```

### 5.2 Income Certificate Schema (`revenue-dept-maharashtra`)

```json
{
  "id": "urn:govconnect:credential:income:7a8b9c0d-1234-5678-90ab-cdef12345678",
  "type": [
    "VerifiableCredential",
    "IncomeCertificate"
  ],
  "issuer": {
    "id": "revenue-dept-maharashtra",
    "keyId": "revenue-key-1"
  },
  "credentialSubject": {
    "name": "Ramesh Kumar Patil",
    "dateOfBirth": "1988-04-12",
    "panNumber": "ABCDE1234F",
    "address": "12, Shivaji Nagar, Pune, Maharashtra"
  },
  "claims": {
    "annualIncome": 312000
  },
  "validFrom": "2026-01-01T00:00:00.000Z",
  "validUntil": null,
  "credentialStatus": {
    "status": "active"
  },
  "proof": {
    "type": "Ed25519Signature",
    "signature": "k6j7...=="
  }
}
```

### 5.3 Caste Certificate Schema (`social-welfare-dept-maharashtra`)

```json
{
  "id": "urn:govconnect:credential:caste:9f8e7d6c-5432-10fe-ba98-76543210fedc",
  "type": [
    "VerifiableCredential",
    "CasteCertificate"
  ],
  "issuer": {
    "id": "social-welfare-dept-maharashtra",
    "keyId": "social-welfare-key-1"
  },
  "credentialSubject": {
    "name": "Ramesh Kumar Patil",
    "dateOfBirth": "1988-04-12",
    "address": "12, Shivaji Nagar, Pune, Maharashtra"
  },
  "claims": {
    "casteCategory": "OBC",
    "casteName": "Kunbi",
    "certificateNumber": "MS-CC-2023-001089"
  },
  "validFrom": "2026-01-01T00:00:00.000Z",
  "validUntil": null,
  "credentialStatus": {
    "status": "active"
  },
  "proof": {
    "type": "Ed25519Signature",
    "signature": "x8y9...=="
  }
}
```

### 5.4 Backward Compatibility & Transition Adapter Model

The existing operational prototypes in `revenue-dept` and `social-welfare-dept` produce a working v1 response:
```json
{
  "credential": {
    "credentialType": "IncomeCertificate",
    "issuer": "revenue-dept-maharashtra",
    "subject": { ... },
    "claims": { ... },
    "issuedAt": "2026-09-09T..."
  },
  "signature": "<base64-signature>",
  "issuer": "revenue-dept-maharashtra"
}
```

**Backward Compatibility Guarantee & Cryptographic Transition Rules:**
1. Existing department services **MUST NOT** be broken or forcibly refactored.
2. When a v1 credential is received, the original v1 credential payload MUST be verified against its original v1 signature **BEFORE** any normalization or conversion takes place.
3. The original v1 payload and signature must remain strictly unchanged for cryptographic verification.
4. Only after the original v1 signature verification succeeds may the Wallet or Verifier normalize the credential into the internal v2 representation.
5. Normalization **MUST NOT** be used to create a new payload for verifying the original v1 signature.
6. The correct transition flow is:

```text
Received v1 credential
     ↓
Verify original v1 payload + original signature
     ↓
If valid
     ↓
Normalize into internal v2 representation
     ↓
Store / display / process
```

7. An invalid original v1 signature **MUST** be rejected immediately before any normalization occurs.
8. *Core Principle:* For backward-compatible v1 credentials, cryptographic verification MUST occur against the exact original v1 signed payload before normalization. The transition adapter MUST never transform a v1 credential into v2 and then attempt to verify the original v1 signature over the transformed object.
9. Issuers may in future iterations upgrade to emit v2 envelopes directly, provided backward compatibility for existing consumers is preserved.

---

## 6. Issuer Identity

Issuer identifiers are immutable uniform resource names:
* Revenue Department: `revenue-dept-maharashtra`
* Social Welfare Department: `social-welfare-dept-maharashtra`
* Domicile Office: `domicile-office-maharashtra`

**Prohibited Identifiers:** Under no circumstances may an IP address (`127.0.0.1`), host port (`localhost:4001`), database row index, or citizen identifier be used as the authoritative issuer identity.

---

## 7. Key Identity

Every cryptographic signing key maintained by an issuer possesses a unique `keyId`:
* `revenue-key-1`
* `social-welfare-key-1`

This key ID enables key lifecycle management, cryptographic agility, and seamless key rotation without invalidating historical credentials.

---

## 8. Trust Registry

The Trust Registry provides a cryptographically trusted mapping from Issuer to active Public Key:

```text
issuerId ──► keyId ──► publicKey (SPKI DER Base64) ──► status
```

### 8.1 Registry Schema
```json
[
  {
    "issuerId": "revenue-dept-maharashtra",
    "keyId": "revenue-key-1",
    "publicKey": "MCowBQYDK2VwAyEA...",
    "status": "active"
  },
  {
    "issuerId": "social-welfare-dept-maharashtra",
    "keyId": "social-welfare-key-1",
    "publicKey": "MCowBQYDK2VwAyEA...",
    "status": "active"
  }
]
```

### 8.2 Strict Segregation Rule
The Trust Registry is purely a **public-key distribution and governance artifact**.
* **STRICT PROHIBITION:** The Trust Registry must **NEVER** store, index, or reference citizen records, names, PAN numbers, Aadhaar data, caste records, income metrics, addresses, or credential payloads.

---

## 9. Signature Contract

### 9.1 Signing Algorithm
* Algorithm: **Ed25519**
* Key format: PKCS#8 PEM private keys (mode `0600`), SPKI DER Base64 public keys.

### 9.2 Canonicalization
To guarantee deterministic signatures, payloads are serialized using `fast-json-stable-stringify` prior to signing and verifying:
* Keys are sorted lexicographically at all nesting levels.
* Whitespace is strictly eliminated.
* Unicode is UTF-8 encoded.

### 9.3 Integrity & Tamper Protection
Signature verification strictly evaluates:
$$\text{Verify}(K_{\text{public}}, \text{Canonicalize}(\text{Payload}), \text{Signature}) \stackrel{?}{=} \text{true}$$

If even a single bit in `credentialSubject`, `claims`, `issuer`, or `issuedAt` is altered, signature verification evaluates to **`false`** (`INVALID_SIGNATURE`). Verifiers must never accept credentials based on syntactic validity alone.

---

## 10. Credential Validity

Credentials specify operational validity boundaries:
* `validFrom`: ISO-8601 timestamp marking issuance/activation.
* `validUntil`: ISO-8601 timestamp marking expiration (or `null` for certificates with no fixed expiration modeled in the prototype).

### Verifier Distinction:
The verifier must evaluate two independent states:
1. **Cryptographic Validity:** Signature matches issuer public key and payload is unaltered.
2. **Temporal Validity:** Current time $t$ satisfies $\text{validFrom} \le t \le \text{validUntil}$ (if `validUntil` is set).

---

## 11. Credential Status

Credentials maintain an explicit lifecycle state:
* `active`: Credential is valid and operational.
* `revoked`: Credential has been permanently nullified by the issuer.
* `suspended`: Credential is temporarily inactive pending administrative review.

> **Fundamental Security Principle:** A valid cryptographic signature does not by itself prove that a credential is currently valid. Verifiers must evaluate both signature and status.

---

## 12. Issuance Security

### Prototype vs. Production Security
In the local development prototype, department APIs operate inside a trusted local testbed. However, in production-aligned configurations:
1. Endpoints such as `POST /issue-credential/:citizenId` must require department staff or service authentication.
2. For the SIH prototype, an `X-API-Key` or Bearer token mechanism is sufficient to simulate authorized operator access.
3. Unauthenticated requests to issue credentials must be rejected with HTTP 401/403.

---

## 13. Citizen Identity Model

* A database record `id` (e.g. `1` or `3`) is an internal persistence sequence, **NOT** proof of real-world identity.
* The GovConnect Wallet operates under a **Demo Identity** context.
* Under no circumstances shall GovConnect claim that possession of a demo profile represents statutory government identity proof or official e-KYC.

---

## 14. Aadhaar Exclusion

**Absolute Architectural Constraint:**
* No Aadhaar numbers are collected.
* No Aadhaar numbers are stored in any database table.
* No Aadhaar cards or PDFs are uploaded.
* No UIDAI or e-KYC APIs are called or simulated.
* GovConnect demo identities use name, date of birth, PAN, and address for demonstration matching, but do not claim Aadhaar-backed authentication.

---

## 15. Wallet Data Ownership

* The **GovConnect Wallet** is an edge-held application run on citizen devices.
* The Wallet stores only credentials fetched by and belonging to the active demo citizen.
* The Wallet is **NOT** a central database and holds no records of other citizens.
* Issuing departments remain the authoritative records custodians for their respective domains.

---

## 16. Credential Retrieval Flow

When a citizen fetches an Income or Caste Certificate into the Wallet:

```text
Citizen (Wallet UI)
       │
       ▼
1. Wallet issues HTTP request to Issuer API:
   POST /issue-credential/:citizenId
       │
       ▼
2. Issuer validates parameters, queries departmental DB,
   constructs canonical credential, signs with Ed25519 private key,
   stores audit record, and returns payload + signature.
       │
       ▼
3. Wallet receives { credential, signature, issuer }.
       │
       ▼
4. Wallet obtains Issuer Public Key from Trust Registry.
       │
       ▼
5. Wallet verifies signature cryptographically:
   verifyCredential(credential, signature, publicKey)
       │
   ├── Valid: Wallet stores credential in local secure storage.
   │          Displays "Verified ✓ — Ready to Share".
   └── Invalid: Wallet rejects credential, alerts user.
```

---

## 17. Domicile Verification Flow

The Domicile Certificate Office verifies credentials entirely offline relative to the issuing departments:

```text
Citizen Wallet                      Domicile Office (Verifier)
      │                                         │
      │ 1. GET /presentation-request            │
      │◄────────────────────────────────────────┤ (Generates fresh nonce & requestId)
      │                                         │
      │ 2. Citizen Reviews Purpose & Claims     │
      │    Clicks [ Share and consent ]         │
      │                                         │
      │ 3. POST /submit-presentation            │
      ├────────────────────────────────────────►│
      │    (Signed VP + Nonce + Credentials)    │
      │                                         │ 4. Look up issuer public keys in Trust Registry
      │                                         │ 5. Perform local Ed25519 signature checks
      │                                         │ 6. Verify nonces, validity & status
      │                                         │ 7. Run demographic matching rules
      │                                         │ 8. Issue Certificate OR Route to Human Review
      │ 9. Verification Result / Certificate    │
      │◄────────────────────────────────────────┤
```

---

## 18. Verification Rules

When evaluating a presented credential, the Verifier executes the following 17-step verification sequence:

1. **Parse Credential:** Validate JSON syntax and required top-level keys.
2. **Validate Structure:** Ensure presence of `credentialSubject`, `claims`, `issuer`, and `proof`.
3. **Identify Issuer:** Extract `issuer.id` (e.g. `revenue-dept-maharashtra`).
4. **Identify Key ID:** Extract `issuer.keyId` (e.g. `revenue-key-1`).
5. **Lookup Trusted Key:** Match issuer and key in the Trust Registry. Reject if unknown.
6. **Verify Key Status:** Ensure the public key is marked `active`.
7. **Verify Cryptographic Signature:** Execute Ed25519 signature verification over canonical payload.
8. **Check `validFrom`:** Ensure current timestamp $\ge \text{validFrom}$.
9. **Check `validUntil`:** Ensure current timestamp $\le \text{validUntil}$ (if defined).
10. **Check Credential Status:** Ensure `credentialStatus.status === 'active'`.
11. **Check Credential Type:** Ensure presented credential matches the requested type.
12. **Check Request Binding:** Verify `requestId` matches active pending request.
13. **Check Nonce Freshness:** Verify `nonce` matches the unconsumed request nonce; reject if replayed.
14. **Check Holder Binding:** Verify presentation proof is bound to the verifier and request.
15. **Check Citizen Linking:** Ensure credential subject links to the presenting applicant.
16. **Check Consent:** Verify explicit citizen consent timestamp and record.
17. **Apply Matching Policy:** Reconcile demographic claims; output `VERIFIED` or `MANUAL_REVIEW_REQUIRED`.

---

## 19. Citizen Linking

Signature verification proves that a credential was issued by an authorized department and remains unaltered. **It does not prove that the person presenting the credential is the person named inside it.**

### Demo Citizen-Linking Flow
When associating a newly retrieved credential with a demo account, the Wallet displays:

```text
┌────────────────────────────────────────────────────────┐
│             Confirm Credential Ownership               │
│                                                        │
│ We found a verified credential issued for:             │
│   Name: Ramesh Kumar Patil                             │
│   DOB:  12 Apr 1988                                    │
│   PAN:  ABCDE1234F                                     │
│                                                        │
│ Is this your credential?                               │
│                                                        │
│         [ Yes, this is mine ]      [ No ]              │
└────────────────────────────────────────────────────────┘
```
This linking is explicitly a demo association and must not be described as statutory government identity authentication. The security principle remains absolute: **Cryptographic signature validity is never treated as identity proof.** Demo linking confirms a user association within the prototype Wallet, not statutory identity, Aadhaar authentication, or e-KYC verification.

---

## 20. Domicile Request Contract

Before requesting credentials, Domicile generates a signed request envelope:

```json
{
  "requestId": "req-98765432-10fe-ba98-7654-3210fedcba98",
  "verifier": {
    "id": "domicile-office-maharashtra",
    "name": "Domicile Certificate Office, Government of Maharashtra"
  },
  "purpose": "Verification of income eligibility and caste classification for Domicile Certificate application",
  "requestedCredentials": [
    {
      "type": "IncomeCertificate",
      "requiredClaims": ["annualIncome"]
    },
    {
      "type": "CasteCertificate",
      "requiredClaims": ["casteCategory", "casteName"]
    }
  ],
  "nonce": "n-f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "createdAt": "2026-09-09T10:00:00.000Z",
  "expiresAt": "2026-09-09T10:15:00.000Z"
}
```

---

## 21. Presentation Contract

The GovConnect Wallet packages the citizen's response into a Verifiable Presentation envelope:

```json
{
  "presentationId": "vp-12345678-abcd-ef01-2345-6789abcdef01",
  "holder": "demo-wallet-user",
  "verifier": "domicile-office-maharashtra",
  "requestId": "req-98765432-10fe-ba98-7654-3210fedcba98",
  "nonce": "n-f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "purpose": "Verification of income eligibility and caste classification for Domicile Certificate application",
  "credentials": [
    {
      "id": "urn:govconnect:credential:income:7a8b9c0d-1234-5678-90ab-cdef12345678",
      "type": ["VerifiableCredential", "IncomeCertificate"],
      "issuer": { "id": "revenue-dept-maharashtra", "keyId": "revenue-key-1" },
      "credentialSubject": {
        "name": "Ramesh Kumar Patil",
        "dateOfBirth": "1988-04-12",
        "panNumber": "ABCDE1234F",
        "address": "12, Shivaji Nagar, Pune, Maharashtra"
      },
      "claims": { "annualIncome": 312000 },
      "validFrom": "2026-01-01T00:00:00.000Z",
      "validUntil": null,
      "credentialStatus": { "status": "active" },
      "proof": { "type": "Ed25519Signature", "signature": "..." }
    },
    {
      "id": "urn:govconnect:credential:caste:9f8e7d6c-5432-10fe-ba98-76543210fedc",
      "type": ["VerifiableCredential", "CasteCertificate"],
      "issuer": { "id": "social-welfare-dept-maharashtra", "keyId": "social-welfare-key-1" },
      "credentialSubject": {
        "name": "Ramesh Kumar Patil",
        "dateOfBirth": "1988-04-12",
        "address": "12, Shivaji Nagar, Pune, Maharashtra"
      },
      "claims": {
        "casteCategory": "OBC",
        "casteName": "Kunbi",
        "certificateNumber": "MS-CC-2023-001089"
      },
      "validFrom": "2026-01-01T00:00:00.000Z",
      "validUntil": null,
      "credentialStatus": { "status": "active" },
      "proof": { "type": "Ed25519Signature", "signature": "..." }
    }
  ],
  "consent": {
    "granted": true,
    "timestamp": "2026-09-09T10:02:15.000Z"
  },
  "proof": {
    "type": "Ed25519Signature",
    "signature": "..."
  }
}
```

---

## 22. Nonce and Replay Protection

To prevent replay attacks:
1. **Freshness:** Every presentation request MUST contain a cryptographically secure pseudo-random 128-bit `nonce` (e.g. UUID v4 or random hex bytes).
2. **Single-Use:** Once verified, the verifier burns the nonce. Re-submitting the same presentation produces `REPLAY_DETECTED`.
3. **Mismatched Request:** Submitting a presentation containing a nonce from request A to request B produces `INVALID_NONCE`.
4. **Expiration:** Requests older than 15 minutes produce `REQUEST_EXPIRED`.

---

## 23. Holder Binding

The Wallet binds its presentation envelope to the verifier's identity:
* The presentation envelope explicitly declares `verifier: "domicile-office-maharashtra"` and embeds the `nonce`.
* The presentation proof is calculated over the entire envelope.
* If an adversary intercepts a valid presentation intended for Domicile and attempts to present it to a Scholarship Office, the receiving office rejects it immediately (`WRONG_VERIFIER`).

### Demo Holder Identity Clarification (`demo-wallet-user`)
The presentation envelope specifies `"holder": "demo-wallet-user"`. The following distinctions are strictly enforced:
* `"demo-wallet-user"` is an application-level demo holder identifier representing the citizen-controlled Wallet client context in this prototype.
* It is **NOT** a legal identity.
* It is **NOT** proof that the human presenting the credential is the person named in the credential.
* The presentation proof demonstrates that the demo Wallet created and cryptographically bound the presentation to the requested verifier, request ID, and nonce.
* It does **NOT** establish statutory identity, Aadhaar identity, e-KYC identity, or legal ownership of the credential.
* The core security invariant is preserved: **Cryptographic signature validity is never treated as identity proof.**

---

## 24. Consent Contract

Citizen consent is an uncompromised prerequisite for credential sharing:
1. **Zero Silent Sharing:** Credentials are never shared automatically in the background.
2. **Standard Consent Trigger:** The primary submission action button must literally read:
   $$\mathbf{[\text{Share and consent}]}$$
3. **Mandatory Consent Preview:** Prior to consent, the Wallet UI renders:
   * **Who:** Requesting Authority name and verified ID (`Domicile Certificate Office`).
   * **Why:** Exact purpose description (`Domicile certificate application`).
   * **What:** List of credential types (`Income Certificate`, `Caste Certificate`).
   * **Which Details:** Specific attributes to be shared (`annualIncome`, `casteCategory`, `casteName`).

---

## 25. Consent Ledger

Every successful credential sharing transaction creates an immutable consent audit log entry in the Wallet:

```json
{
  "consentId": "consent-d3b07384-d113-4660-9d84-9c0242ac1200",
  "requestId": "req-98765432-10fe-ba98-7654-3210fedcba98",
  "holder": "demo-wallet-user",
  "recipient": "domicile-office-maharashtra",
  "purpose": "Domicile certificate application",
  "credentialsShared": [
    "urn:govconnect:credential:income:7a8b9c0d-1234-5678-90ab-cdef12345678",
    "urn:govconnect:credential:caste:9f8e7d6c-5432-10fe-ba98-76543210fedc"
  ],
  "timestamp": "2026-09-09T10:02:15.000Z",
  "status": "granted"
}
```
*Note:* The consent ledger stores credential references, not the raw payload data, preventing unnecessary storage bloat and data sprawl.

---

## 26. Data Minimization

* Verifiers must request **only** claims necessary for the administrative decision.
* If Domicile requires `annualIncome` and `casteCategory`, it must not harvest or retain unneeded database records or tax histories.
* Issuing departments transfer only the certified credential, not the full underlying citizen database row.

---

## 27. Matching and Manual Review

Once cryptographic verification completes, the Verifier executes demographic matching between the presented credentials and the application record.

### 27.1 Matching Outcomes
1. **Match (`VERIFIED`):** All demographic fields (name, DOB, address) match with high confidence. Immediate certificate issuance.
2. **Ambiguous (`MANUAL_REVIEW_REQUIRED`):** Phonetic variations, initials, or minor spelling discrepancies detected. Record is routed to an officer's review queue.
3. **Mismatch (`MANUAL_REVIEW_REQUIRED` / `REJECTED`):** Significant conflict in DOB, PAN, or identity attributes.

### 27.2 The Ramesh Patil Canonical Test Case
The GovConnect database intentionally seeds two demonstration citizen records:
1. `Ramesh Kumar Patil` (DOB: `1988-04-12`, PAN: `ABCDE1234F`, Pune)
2. `Ramesh K. Patil` (DOB: `1988-04-12`, PAN: `ABCDE1234F`, Pune)

This test case verifies that the system does **NOT** naively equate fuzzy matching with statutory identity proof. The automated engine flags the records as `Possible match found` and routes the file to **Human Review**.

---

## 28. Error Model

The system enforces structured, unambiguous error codes:

| Error Code | HTTP Status | Description |
| :--- | :--- | :--- |
| `ISSUER_UNAVAILABLE` | 503 | Issuing department endpoint cannot be reached during retrieval. |
| `ISSUER_AUTH_FAILED` | 401 | Calling service lacked proper authorization to request issuance. |
| `INVALID_CREDENTIAL` | 400 | Credential payload malformed or missing required schema keys. |
| `UNKNOWN_ISSUER` | 400 | Credential claims an issuer not registered in the Trust Registry. |
| `UNKNOWN_KEY` | 400 | The keyId referenced in the credential is not registered or found. |
| `INVALID_SIGNATURE` | 400 | Cryptographic signature check failed; data has been tampered with. |
| `CREDENTIAL_EXPIRED` | 400 | Current timestamp exceeds the credential's `validUntil`. |
| `CREDENTIAL_REVOKED` | 400 | Credential has been revoked in the issuer status registry. |
| `CREDENTIAL_SUSPENDED` | 400 | Credential is under administrative suspension. |
| `REQUEST_EXPIRED` | 400 | The presentation request timestamp has expired (> 15 minutes). |
| `INVALID_NONCE` | 400 | Nonce does not match active presentation session. |
| `REPLAY_DETECTED` | 400 | Nonce was already consumed in a prior presentation. |
| `WRONG_VERIFIER` | 400 | Presentation envelope was signed for a different recipient. |
| `CONSENT_NOT_GRANTED` | 403 | Citizen rejected the presentation request. |
| `IDENTITY_MISMATCH` | 422 | Demographic attributes between credentials conflict irreconcilably. |
| `MANUAL_REVIEW_REQUIRED` | 200 / 202 | Ambiguous demographic match requires human officer adjudication. |

### UI Status Transitions in Verifier Console:
$$\text{Not yet received} \longrightarrow \text{Received — verifying…} \longrightarrow \text{Verified ✓} \;\Big(\text{or } \text{Needs manual review} \;\Big|\; \text{Signature invalid ✕}\Big)$$

### Mandatory Verifier Disclosure:
Upon successful signature verification, the Verifier UI **MUST** display:
> *"Signature checked against [Department]'s registered public key — no direct contact with [Department] was needed."*

---

## 29. API Authorization

In production deployment:
* `POST /issue-credential/:citizenId`: Accessible only by authenticated departmental staff or authorized service accounts.
* `GET /citizens`: Restricted to staff consoles; returns sanitized public projections (id, name, DOB).
* `GET /citizens/:citizenId`: Restricted internal endpoint for pre-issuance review.
* `GET /issued-credentials`: Internal departmental audit log.

For the SIH local development prototype, a lightweight service-key header (`X-API-Key: govconnect-internal-key`) is adopted to avoid heavy enterprise IAM overhead while preserving security boundaries.

---

## 30. CORS Configuration

* **Local Development Prototype:** CORS allows `*` or localhost origins (`http://localhost:3000`, `4001`, `4002`, `5000`) to facilitate frictionless local multi-service testing.
* **Production Deployment:** Explicit origin allowlisting is mandatory. Wildcard `*` is strictly forbidden in production.

---

## 31. Rate Limiting

To prevent denial of service and enumeration attacks, production deployments must rate-limit:
* Credential issuance (`POST /issue-credential/:id`): Maximum 10 requests/minute per staff IP.
* Credential retrieval: Maximum 30 requests/minute per citizen token.
* Presentation submission (`POST /submit-presentation`): Maximum 5 attempts/minute per IP.

---

## 32. Private Key Security

1. **Storage:** Private keys (`private_key.pem`) reside in the protected `keys/` directory on each issuer host with filesystem permissions `0600`.
2. **Isolation:** Private keys must **NEVER** be committed to public Git repositories, returned across REST APIs, or exposed in frontend JavaScript bundles.
3. **Public Exposure:** Only the SPKI Base64 public key is shared via `GET /public-key`.

---

## 33. Audit Logging

Each tier records structured audit events omitting sensitive demographic payload data:
* **Issuer Audit:** `{ event: "CREDENTIAL_ISSUED", citizenId: 1, type: "IncomeCertificate", keyId: "revenue-key-1", timestamp: "..." }`
* **Wallet Audit:** `{ event: "CONSENT_GRANTED", verifier: "domicile-office-maharashtra", credentials: [...], timestamp: "..." }`
* **Verifier Audit:** `{ event: "PRESENTATION_VERIFIED", requestId: "req-...", outcome: "VERIFIED", timestamp: "..." }`

---

## 34. Key Rotation

Key rotation operates seamlessly without breaking historical credentials:
1. An issuer generates a new key pair: `revenue-key-2`.
2. The Trust Registry is updated to register `revenue-key-2` as `active`.
3. Historical key `revenue-key-1` is marked `retired` (still trusted for credentials issued before rotation date).
4. Verifiers accept credentials signed by `revenue-key-1` if `validFrom` precedes key retirement.

---

## 35. Privacy Model

* **Decentralized Custody:** Citizens hold their own credentials in their personal Wallet.
* **Zero Inter-Departmental Tracking:** Issuers do not communicate with each other; Verifiers do not call Issuers during verification.
* **No Phone-Home:** Issuers cannot track when, where, or how often a citizen presents their credentials to downstream authorities.

---

## 36. Prototype Simplifications

To ensure clarity for evaluators and judges, the following prototype simplifications are explicitly documented:

| Feature | SIH Prototype Implementation | Production Government Architecture |
| :--- | :--- | :--- |
| **Citizen Identity** | Demo Identity context (name, DOB, PAN, address) | Official National Digital Identity / State SSO |
| **Aadhaar / e-KYC** | **Completely excluded** | Official UIDAI e-KYC / DigiLocker integration |
| **Issuer Key Storage** | Local filesystem (`keys/private_key.pem`, `0600`) | Hardware Security Modules (HSM, FIPS 140-2 Level 3) / Cloud KMS |
| **Trust Registry** | Static configuration within Verifier | Federated Government PKI Trust List / DNSSEC / DID Registry |
| **Status Check** | Statically modeled `active` status | Real-time W3C Bitstring Status List / OCSP-equivalent bitstring revocation |
| **Consent Storage** | Structured append-only local log | Cryptographically anchored, tamper-evident audit ledger |
| **Service Auth** | Development service keys / CORS allowlist | Mutual TLS (mTLS) + OAuth 2.0 / OpenID Connect |

---

## 37. Production Hardening Roadmap

Following the SIH competition, GovConnect may transition to production by:
1. Integrating certified HSMs for Ed25519 signing.
2. Deploying dynamic W3C Bitstring Status List infrastructure for real-time certificate revocation.
3. Enabling mTLS between departmental backends.
4. Integrating formal OpenID4VP 1.0 token flows with mobile wallet apps.
5. Implementing biometric device binding for holder keys.

---

## 38. Demo Acceptance Criteria

The system satisfies evaluation requirements when the following tests succeed:

1. **Revenue Service Integrity:** Health returns 200, public key endpoint returns valid Ed25519 SPKI key, issuance produces valid signed Income Certificate.
2. **Social Welfare Service Integrity:** Health returns 200, public key returns valid Ed25519 key, issuance produces valid signed Caste Certificate.
3. **Tamper Test:** Modifying any signed claim (e.g. `annualIncome: 312000` to `999999`) produces cryptographic verification **`FAIL`**.
4. **Replay Test:** Re-submitting a presentation with a previously consumed nonce is rejected with `REPLAY_DETECTED`.
5. **Ramesh Patil Human Review Test:** Submitting `Ramesh Kumar Patil` vs `Ramesh K. Patil` triggers `MANUAL_REVIEW_REQUIRED`.
6. **Offline Verification Check:** Domicile verifies credentials locally and displays: *"Signature checked against [Department]'s registered public key — no direct contact with [Department] was needed."*
7. **UI Visual Compliance:** Institutional palette (`#0B4F8A`, `#06325A`, `#F5F7FA`), 4px tricolor strip below header, explicit `[ Share and consent ]` button, and persistent prototype disclaimer banner.

---

## 39. Frozen Decisions

## FROZEN DECISIONS — DO NOT CHANGE WITHOUT EXPLICIT APPROVAL

1. **Revenue Department is Issuer #1** (`revenue-dept-maharashtra`, Port 4001, Income Certificates).
2. **Social Welfare Department is Issuer #2** (`social-welfare-dept-maharashtra`, Port 4002, Caste Certificates).
3. **GovConnect Wallet is the citizen holder** (local storage, citizen-controlled presentation).
4. **Domicile Office is the verifier** (offline cryptographic verification).
5. **Ed25519 remains the prototype signing algorithm** across all issuers.
6. **Aadhaar is excluded from the prototype** in all forms.
7. **No Aadhaar / e-KYC / UIDAI integration or simulation.**
8. **Wallet is not a central citizen database.**
9. **Issuers remain authoritative** for the credentials they issue.
10. **Domicile verifies credentials locally** using trusted issuer keys with zero live calls to issuer databases.
11. **Public-key registry contains issuer/key trust data only**, never citizen data.
12. **Credential IDs are unique and immutable** (`urn:govconnect:credential:<type>:<uuid>`).
13. **Credentials include explicit issuer and key identity** (`issuer.id`, `issuer.keyId`).
14. **Credentials support validity windows** (`validFrom`, `validUntil`) and lifecycle status (`credentialStatus`).
15. **Presentation requests contain a fresh request ID and nonce.**
16. **Presentations are bound to the intended verifier and request nonce.**
17. **Citizen consent is explicit and mandatory** before any data is transmitted.
18. **The UI consent button text is literally "Share and consent".**
19. **All consent transactions are recorded** in an audit ledger.
20. **Ambiguous citizen demographic matches trigger human review.**
21. **Cryptographic signature validity is never treated as identity proof.**
22. **Existing Revenue and Social Welfare functionality and tests must not be broken.**
23. **No unnecessary new infrastructure** (no blockchain, Kafka, Kubernetes, or zero-knowledge overhead).
24. **Prototype limitations and simplifications must remain explicitly documented.**

---

```text
SECURITY + INTEROPERABILITY CONTRACT v2: FROZEN
```

# GovConnect

> Problem Statement: SIH26129  
> Organization: Government of Maharashtra (Simulated Prototype)  

## Ecosystem Services

The GovConnect architecture follows a decentralized verifiable credential model across the following planned services:

1. **`revenue-dept` (Issuer #1 — Port 4001)**: Issues cryptographically signed Ed25519 Income Certificates.
2. **`social-welfare-dept` (Issuer #2 — Port 4002)**: Issues cryptographically signed Ed25519 Caste Certificates.
3. **`wallet` (Citizen Wallet — Frontend Port 3000, Backend Port 3001)**: Citizen credential holder and presentation manager (Step 1 Foundation).
4. **`domicile` (Verifier — Planned Port 5000)**: Verifies presented credentials offline using issuer public keys.

For the frozen architecture and interoperability contract, refer to [`docs/SECURITY_INTEROPERABILITY_CONTRACT.md`](./docs/SECURITY_INTEROPERABILITY_CONTRACT.md).  
For setup and documentation of individual services, refer to their respective README files:
* [`revenue-dept/README.md`](./revenue-dept/README.md)
* [`social-welfare-dept/README.md`](./social-welfare-dept/README.md)
* [`wallet/README.md`](./wallet/README.md)

import crypto from 'crypto';
import { PrototypeDomicileCertificate, CredentialVerificationDetail } from '../types/index.js';

let certCounter = 1001;

export function issuePrototypeDomicileCertificate(params: {
  applicant: {
    name: string;
    dateOfBirth: string;
    address: string;
    demoIdentityContext?: string;
  };
  credentialResults: CredentialVerificationDetail[];
  verificationReference: string;
  issuanceMode: 'AUTOMATIC' | 'APPROVED_AFTER_MANUAL_REVIEW';
}): PrototypeDomicileCertificate {
  const { applicant, credentialResults, verificationReference, issuanceMode } = params;

  const certificateId = `DOM-MH-2026-${certCounter++}`;

  // Summarize verified claims without dumping raw database row structures
  const incomeResult = credentialResults.find(c => c.credentialType === 'IncomeCertificate');
  const casteResult = credentialResults.find(c => c.credentialType === 'CasteCertificate');

  const incomeAmount = incomeResult?.extractedClaims.annualIncome;
  const casteCat = casteResult?.extractedClaims.casteCategory;
  const casteName = casteResult?.extractedClaims.casteName;

  const incomeStatus = incomeAmount !== undefined
    ? `Verified (Certified Annual Income: ₹${Number(incomeAmount).toLocaleString('en-IN')})`
    : 'Not Provided';

  const casteStatus = casteCat
    ? `Verified (${casteCat}${casteName ? ` - ${casteName}` : ''})`
    : 'Not Applicable / Not Provided';

  return {
    certificateId,
    certificateType: 'Prototype Domicile Certificate',
    applicant: {
      name: applicant.name,
      dateOfBirth: applicant.dateOfBirth,
      address: applicant.address,
      demoIdentityContext: applicant.demoIdentityContext || 'demo-wallet-user'
    },
    verifiedClaims: {
      incomeStatus,
      casteStatus
    },
    sourceCredentials: credentialResults.map(c => ({
      type: c.credentialType,
      issuer: c.issuerId,
      issuerName: c.issuerName
    })),
    verificationReference,
    issuingAuthority: 'Domicile Certificate Office',
    department: 'Revenue & General Administration Department, Government of Maharashtra',
    issuedAt: new Date().toISOString(),
    status: 'ISSUED',
    issuanceMode,
    disclaimer: 'Demo Output — Not an Official Government Certificate. Smart India Hackathon Prototype (SIH26129).'
  };
}

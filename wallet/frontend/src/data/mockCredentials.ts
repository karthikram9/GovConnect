/**
 * Local Demonstration Mock Credentials
 * 
 * NOTE: As specified in Step 2 of the GovConnect Wallet roadmap:
 * - These are UI preview / demo mock objects only.
 * - They are NOT fetched from live issuer APIs in this step.
 * - They do NOT represent legal identity proof or real citizens.
 * - This mock data is strictly isolated from future API and storage services.
 */

export interface MockCredential {
  id: string;
  type: string;
  title: string;
  issuerId: string;
  issuerName: string;
  issuerDept: string;
  subjectName: string;
  dateOfBirth: string;
  address: string;
  issuedDate: string;
  status: 'Verified';
  primaryClaimLabel: string;
  primaryClaimValue: string;
  secondaryClaims: Array<{ label: string; value: string }>;
  certificateNumber?: string;
  isMockPreview: true;
}

export const MOCK_CREDENTIALS: MockCredential[] = [
  {
    id: 'urn:govconnect:credential:income:preview-001',
    type: 'IncomeCertificate',
    title: 'Income Certificate',
    issuerId: 'revenue-dept-maharashtra',
    issuerName: 'Revenue Department',
    issuerDept: 'Government of Maharashtra',
    subjectName: 'Ramesh Kumar Patil',
    dateOfBirth: '1988-04-12',
    address: '12, Shivaji Nagar, Pune, Maharashtra',
    issuedDate: '01 Jan 2026',
    status: 'Verified',
    primaryClaimLabel: 'Annual Income',
    primaryClaimValue: '₹3,12,000',
    secondaryClaims: [
      { label: 'PAN Number', value: 'ABCDE1234F' },
      { label: 'Financial Year', value: '2025-2026' },
      { label: 'Issuing Authority', value: 'Tehsildar, Pune' }
    ],
    certificateNumber: 'MH-REV-2026-004812',
    isMockPreview: true
  },
  {
    id: 'urn:govconnect:credential:caste:preview-002',
    type: 'CasteCertificate',
    title: 'Caste Certificate',
    issuerId: 'social-welfare-dept-maharashtra',
    issuerName: 'Social Welfare Department',
    issuerDept: 'Government of Maharashtra',
    subjectName: 'Ramesh Kumar Patil',
    dateOfBirth: '1988-04-12',
    address: '12, Shivaji Nagar, Pune, Maharashtra',
    issuedDate: '01 Jan 2026',
    status: 'Verified',
    primaryClaimLabel: 'Caste Category',
    primaryClaimValue: 'OBC',
    secondaryClaims: [
      { label: 'Caste Name', value: 'Kunbi' },
      { label: 'Certificate Number', value: 'MS-CC-2023-001089' },
      { label: 'Issuing Officer', value: 'District Social Welfare Officer' }
    ],
    certificateNumber: 'MS-CC-2023-001089',
    isMockPreview: true
  }
];

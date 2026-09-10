/**
 * GovConnect Design Tokens & System Constants
 * 
 * Source of Truth: docs/SECURITY_INTEROPERABILITY_CONTRACT.md
 */

export const THEME = {
  primary: '#0B4F8A',
  dark: '#06325A',
  background: '#F5F7FA',
  card: '#FFFFFF',
  border: '#D9E1E8',
  text: '#1A2B3C',
  secondaryText: '#5B6B7A',
  success: '#1B7A3D',
  warning: '#B45309',
  error: '#B3261E'
} as const;

export const ECOSYSTEM_SERVICES = {
  revenueDept: {
    name: 'Revenue Department',
    role: 'Issuer #1',
    credential: 'IncomeCertificate',
    defaultPort: 4001,
    issuerId: 'revenue-dept-maharashtra'
  },
  socialWelfareDept: {
    name: 'Social Welfare Department',
    role: 'Issuer #2',
    credential: 'CasteCertificate',
    defaultPort: 4002,
    issuerId: 'social-welfare-dept-maharashtra'
  },
  wallet: {
    name: 'GovConnect Wallet',
    role: 'Citizen Holder (Edge-Held)',
    defaultPort: 3000,
    backendPort: 3001
  },
  domicileOffice: {
    name: 'Domicile Certificate Office',
    role: 'Verifier (Offline Verification)',
    defaultPort: 5000,
    verifierId: 'domicile-office-maharashtra'
  }
} as const;

export const PROTOTYPE_DISCLAIMER =
  'This is a Smart India Hackathon prototype (Problem Statement SIH26129). Not an official government service.';

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: [
    process.env.FRONTEND_URL || 'http://localhost:5001',
    process.env.WALLET_FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5001',
    'http://127.0.0.1:3000'
  ],
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '60', 10),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  verifier: {
    id: 'domicile-office-maharashtra',
    name: 'Domicile Certificate Office',
    department: 'Revenue & General Administration Department',
    jurisdiction: 'Maharashtra'
  }
};

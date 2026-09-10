import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface AppConfig {
  port: number;
  revenueApiUrl: string;
  revenueApiKey: string;
  socialWelfareApiUrl: string;
  socialWelfareApiKey: string;
  corsOrigin: string;
  nodeEnv: string;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3001', 10),
  revenueApiUrl: process.env.REVENUE_API_URL || 'http://localhost:4001',
  revenueApiKey: process.env.REVENUE_API_KEY || '',
  socialWelfareApiUrl: process.env.SOCIAL_WELFARE_API_URL || 'http://localhost:4002',
  socialWelfareApiKey: process.env.SOCIAL_WELFARE_API_KEY || '',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  nodeEnv: process.env.NODE_ENV || 'development'
};


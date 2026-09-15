import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import healthRouter from './routes/health.js';
import trustRegistryRouter from './routes/trustRegistry.js';
import verificationRequestsRouter from './routes/verificationRequests.js';
import presentationsRouter from './routes/presentations.js';
import applicationsRouter from './routes/applications.js';
import certificatesRouter from './routes/certificates.js';
import authRouter from './routes/auth.js';

export function createApp(): Express {
  const app = express();

  // 1. Security & CORS Configuration
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, test scripts)
      if (!origin) return callback(null, true);
      if (config.corsOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in prototype for multi-port testing
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));

  // 2. Body Parser with reasonable limits
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 3. Mount Routes
  app.use(healthRouter);
  app.use('/auth', authRouter);
  app.use('/api/trust-registry', trustRegistryRouter);
  app.use('/api/verification-requests', verificationRequestsRouter);
  app.use('/api/presentations', presentationsRouter);
  app.use('/api/applications', applicationsRouter);
  app.use('/api/certificates', certificatesRouter);

  // 4. Fallback 404 Handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: 'The requested resource was not found on this service.'
    });
  });

  // 5. Global Error Handler (No internal stack traces leaked)
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Domicile Backend Unhandled Error]:', err.message);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal error occurred.'
    });
  });

  return app;
}

import express, { Application } from 'express';
import cors from 'cors';
import { config } from './config';
import { healthRouter } from './routes/health';
import { credentialsRouter } from './routes/credentials';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): Application {
  const app = express();

  // Middleware
  app.use(cors({
    origin: config.corsOrigin === '*' ? true : config.corsOrigin,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  app.use(express.json());

  // Mount routes
  app.use('/', healthRouter);
  app.use('/api/credentials', credentialsRouter);

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  // Central error handler
  app.use(errorHandler);

  return app;
}

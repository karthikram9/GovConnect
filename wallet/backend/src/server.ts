import { createApp } from './app';
import { config } from './config';

const app = createApp();

export const server = app.listen(config.port, () => {
  console.log(`GovConnect Wallet Backend started on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`CORS Origin: ${config.corsOrigin}`);
  console.log(`Health endpoint: http://localhost:${config.port}/health`);
});

export default app;

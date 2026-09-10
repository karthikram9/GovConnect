import { createApp } from './app.js';
import { config } from './config/index.js';

const app = createApp();

const server = app.listen(config.port, config.host, () => {
  console.log(`==================================================`);
  console.log(` GovConnect Domicile Certificate Office (Verifier)`);
  console.log(` Problem Statement: SIH26129`);
  console.log(` Status: Running`);
  console.log(` Port: ${config.port}`);
  console.log(` Offline Signature Verification: ENABLED`);
  console.log(` Trust Registry: LOADED`);
  console.log(` Direct Issuer Calls: DISABLED (100% Offline Verifier)`);
  console.log(` Health Check: http://localhost:${config.port}/health`);
  console.log(`==================================================`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

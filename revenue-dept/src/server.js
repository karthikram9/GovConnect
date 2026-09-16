const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { initKeys } = require('./crypto/signer');
const { checkConnection } = require('./db');

const healthRoutes = require('./routes/health');
const publicKeyRoutes = require('./routes/publicKey');
const citizensRoutes = require('./routes/citizens');
const credentialsRoutes = require('./routes/credentials');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 4001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Middleware
app.use(cors({
  origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));
app.use(express.json());

// Serve static assets from public/
const publicDir = path.resolve(__dirname, '../public');
app.use('/public', express.static(publicDir));

const { authenticateToken } = require('./middleware/authenticateToken');
const { requireRole, requireDepartment } = require('./middleware/rbac');

// Admin dashboard route (serves UI shell; data APIs are protected by RBAC)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(publicDir, 'admin.html'));
});

// Mount API routes
app.use('/auth', authRoutes);
app.use('/', healthRoutes);
app.use('/', publicKeyRoutes);
app.use('/', citizensRoutes);
app.use('/', credentialsRoutes);

// Root redirect to /admin
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Centralized error handler (never leaks stack traces or db credentials)
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

/**
 * Starts the Revenue Department server.
 */
async function startServer() {
  try {
    // 1. Initialize or load Ed25519 keys
    initKeys();
    console.log('Ed25519 key loaded');

    // 2. Check database connection
    const dbOk = await checkConnection();
    if (dbOk) {
      console.log('Database connected');
    } else {
      console.warn('⚠️ Warning: Could not connect to PostgreSQL. Check DATABASE_URL in .env');
    }

    // 3. Start listening
    const server = app.listen(PORT, () => {
      console.log(`Revenue Department API started on port ${PORT}`);
      console.log(`Admin console available at: http://localhost:${PORT}/admin`);
    });

    return { app, server };
  } catch (err) {
    console.error('Failed to start Revenue Department server:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };

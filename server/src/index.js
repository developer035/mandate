require('dotenv').config();
const path = require('node:path');
const express = require('express');
const cors = require('cors');

const mandateRoutes = require('./routes/mandate');
const runRoutes = require('./routes/run');
const paypalRoutes = require('./routes/paypal');
const ledgerRoutes = require('./routes/ledger');
const demoRoutes = require('./routes/demo');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API Routes
app.use('/mandate', mandateRoutes);
app.use('/run', runRoutes);
app.use('/paypal', paypalRoutes);
app.use('/ledger', ledgerRoutes);
app.use('/demo', demoRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Mandate AI Restock Server'
  });
});

// Serve frontend static files if built (for single-service deployment on Render)
const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/mandate') || req.path.startsWith('/run') || req.path.startsWith('/paypal') || req.path.startsWith('/ledger') || req.path.startsWith('/demo')) {
    return next();
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  res.sendFile(indexPath, err => {
    if (err) {
      next();
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Mandate Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;

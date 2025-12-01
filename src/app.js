import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { port, environment, DATABASE_URL, CORS_ORIGIN, CORS_CREDENTIALS, MAX_FILE_SIZE } from './config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import routes
import routes from './routes.js';
import * as recruiterController from './app/modules/recruiter/recruiterController.js';

// Create Express app
const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:4000', 'https://stg-web.talentflip.ai'],
  credentials: true
}));

// Stripe webhook route (must be before express.json middleware to access raw body)
app.post('/api/webhook/stripe', express.raw({ type: 'application/json' }), recruiterController.handleStripeWebhook);

app.use(express.json({ limit: MAX_FILE_SIZE }));
app.use(express.urlencoded({ extended: true, limit: MAX_FILE_SIZE }));

// Serve static files from public directory
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Routes
app.use('/api', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(environment === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Initialize Prisma Client
const prisma = new PrismaClient();

// Database connection
prisma.$connect()
  .then(() => {
    console.log('Connected to PostgreSQL via Prisma');
  })
  .catch((error) => {
    console.error('Database connection error:', error);
    process.exit(1);
  });

// Make Prisma available globally
global.prisma = prisma;

export default app;

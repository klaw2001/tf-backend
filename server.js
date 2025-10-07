import app from './src/app.js';
import { port, environment } from './src/config/index.js';

// Start server
app.listen(port, () => {
  console.log(`🚀 TalentFlip API server is running on port ${port}`);
  console.log(`📊 Environment: ${environment}`);
  console.log(`🌐 Health check: http://localhost:${port}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

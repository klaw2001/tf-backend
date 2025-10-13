import { createServer } from 'http';
import app from './app.js';
import { port, environment } from './config/index.js';
import { initializeSocket } from './socket/socketServer.js';

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.io
const io = initializeSocket(httpServer);

// Start server
httpServer.listen(port, () => {
  console.log(`🚀 TalentFlip API server is running on port ${port}`);
  console.log(`📊 Environment: ${environment}`);
  console.log(`🌐 Health check: http://localhost:${port}/health`);
  console.log(`💬 Socket.io chat enabled`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

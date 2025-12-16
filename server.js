const http = require('http');
const { app, initializeApp } = require('./src/app');
const { initializeSocket } = require('./src/services/socketService');
require('dotenv').config();

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

const startServer = async () => {
  try {
    // Initialize databases
    await initializeApp();
    
    // Create HTTP server
    const server = http.createServer(app);
    
    // Initialize WebSocket
    initializeSocket(server);
    
    // Start server
    server.listen(PORT, HOST, () => {
      console.log(`
      🚀 PIGO Exchange Backend Server Started!
      =========================================
      Environment: ${process.env.NODE_ENV}
      Host: ${HOST}
      Port: ${PORT}
      Frontend: ${process.env.FRONTEND_URL}
      API URL: http://${HOST}:${PORT}
      Health Check: http://${HOST}:${PORT}/health
      =========================================
      `);
    });
    
    // Graceful shutdown
    const gracefulShutdown = () => {
      console.log('\n🛑 Received shutdown signal, closing server...');
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
      
      // Force close after 10 seconds
      setTimeout(() => {
        console.error('❌ Could not close connections in time, forcing shutdown');
        process.exit(1);
      }, 10000);
    };
    
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();
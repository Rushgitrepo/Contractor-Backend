import app from './app';
// server restart trigger: updated validators v2 (5 statuses)
import pool from './config/database';
import { config } from './config';
import logger from './utils/logger';
import fs from 'fs';
import path from 'path';
// Create logs directory if it doesn't exist

import http from 'http';
import { Server } from 'socket.io';
import { initializeSocket } from './socket';

const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

const startServer = async () => {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    logger.info('Database connection verified');

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize Socket.io
    const io = new Server(server, {
      cors: {
        origin: config.cors.origin,
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    initializeSocket(io);
    logger.info('Socket.io initialized');

    server.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`API: http://localhost:${config.port}/api`);
      logger.info(`Docs: http://localhost:${config.port}/api-docs`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

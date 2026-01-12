#!/usr/bin/env node

/**
 * HTTP Server for Governance Kernel
 */

import Fastify from 'fastify';
import { registerRoutes } from './routes';

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';

async function start() {
  const port = parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
  const host = process.env.HOST || DEFAULT_HOST;

  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // Register routes
  await registerRoutes(server);

  // Start server
  try {
    await server.listen({ port, host });
    console.log(`Governance Kernel HTTP server running on http://${host}:${port}`);
    console.log('Available endpoints:');
    console.log('  GET  /health');
    console.log('  POST /verify');
    console.log('  POST /scan');
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();

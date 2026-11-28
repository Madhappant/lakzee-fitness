import dotenv from 'dotenv';
dotenv.config();

import dns from 'dns';
// Force IPv4 resolution to prevent ENETUNREACH errors on hosts without IPv6 routing
dns.setDefaultResultOrder('ipv4first');

import app, { prisma } from './app';
import { securityEnv } from './config/env';
import { setServerDraining } from './config/lifecycle';
import { errorTracker } from './utils/error-tracker';
import { logger } from './utils/logger';
import { telemetry } from './utils/telemetry';
import { startReminderScheduler, stopReminderScheduler } from './services/reminder-scheduler.service';

const PORT = process.env.PORT || 5000;
const KEEP_ALIVE_INTERVAL_MS = 4 * 60 * 1000;

let isShuttingDown = false;

async function bootstrap() {
  try {
    setServerDraining(false);
    await prisma.$connect();
    logger.info('Connected to PostgreSQL database');

    const server = app.listen(PORT, () => {
      logger.info('HTTP server listening', {
        port: PORT,
        nodeEnv: securityEnv.nodeEnv,
      });
    });

    // Align timeouts above common reverse proxies (Render / Nginx 60s) to prevent 502 resets
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    // Periodic lightweight DB ping so pooled remote Postgres connections stay warm 24/7
    const keepAliveTimer = setInterval(() => {
      prisma.$queryRaw`SELECT 1`.catch((err) => {
        const reason = (err as Error).message;
        logger.warn('Database keep-alive ping warning', { error: reason });
        telemetry.recordHealthFailure(reason);
      });
    }, KEEP_ALIVE_INTERVAL_MS);
    keepAliveTimer.unref();

    startReminderScheduler();

    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      setServerDraining(true);
      logger.info('Initiating graceful shutdown drain', { signal });
      clearInterval(keepAliveTimer);
      stopReminderScheduler();

      const forceExitTimer = setTimeout(() => {
        logger.error('Forced exit after shutdown drain timeout');
        process.exit(1);
      }, 10000);
      forceExitTimer.unref();

      server.closeIdleConnections?.();
      server.close(async () => {
        try {
          await prisma.$disconnect();
          logger.info('Graceful shutdown completed cleanly', { signal });
          process.exit(0);
        } catch (err) {
          logger.error('Error during database disconnect on shutdown', { error: err });
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => {
      void shutdown('SIGTERM');
    });
    process.on('SIGINT', () => {
      void shutdown('SIGINT');
    });
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled promise rejection', { error: reason });
      errorTracker.captureException(reason, { source: 'unhandledRejection' });
    });
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception', { error: err });
      errorTracker.captureException(err, { source: 'uncaughtException' });
    });
  } catch (error) {
    logger.error('Failed to bootstrap backend server', { error });
    await prisma.$disconnect();
    process.exit(1);
  }
}

void bootstrap();

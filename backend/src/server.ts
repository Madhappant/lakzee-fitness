import dotenv from 'dotenv';
dotenv.config();

import dns from 'dns';
// Force IPv4 resolution to prevent ENETUNREACH errors on hosts without IPv6 routing
dns.setDefaultResultOrder('ipv4first');

import app, { prisma } from './app';

const PORT = process.env.PORT || 5000;
const KEEP_ALIVE_INTERVAL_MS = 4 * 60 * 1000;

let isShuttingDown = false;

async function bootstrap() {
  try {
    await prisma.$connect();
    console.log('Connected to Database');

    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Align timeouts above common reverse proxies (Render / Nginx 60s) to prevent 502 resets
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    // Periodic lightweight DB ping so pooled remote Postgres connections stay warm 24/7
    const keepAliveTimer = setInterval(() => {
      prisma.$queryRaw`SELECT 1`.catch((err) => {
        console.warn('Database keep-alive ping warning:', (err as Error).message);
      });
    }, KEEP_ALIVE_INTERVAL_MS);
    keepAliveTimer.unref();

    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      console.log(`Received ${signal}. Draining HTTP server and disconnecting database...`);
      clearInterval(keepAliveTimer);

      const forceExitTimer = setTimeout(() => {
        console.error('Forced exit after shutdown timeout');
        process.exit(1);
      }, 10000);
      forceExitTimer.unref();

      server.close(async () => {
        try {
          await prisma.$disconnect();
          console.log('Shutdown completed cleanly');
          process.exit(0);
        } catch (err) {
          console.error('Error during database disconnect:', err);
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
      console.error('Unhandled Promise Rejection:', reason);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

void bootstrap();

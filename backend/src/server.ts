import dotenv from 'dotenv';
dotenv.config();

import dns from 'dns';
// Force IPv4 resolution to prevent ENETUNREACH errors on hosts without IPv6 routing
dns.setDefaultResultOrder('ipv4first');

import app from './app';
import { prisma } from './app';

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('📦 Connected to Database');

    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`⚙️  Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

bootstrap();

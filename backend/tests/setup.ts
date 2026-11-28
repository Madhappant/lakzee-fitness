/**
 * Strict test environment isolation guard.
 * Guarantees unit and integration suites NEVER connect to production or local development databases.
 */
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.DATABASE_URL = 'postgresql://isolated_test:isolated_test@127.0.0.1:5432/lakzee_isolated_test?schema=public';
process.env.DIRECT_URL = 'postgresql://isolated_test:isolated_test@127.0.0.1:5432/lakzee_isolated_test?schema=public';
process.env.JWT_SECRET = 'isolated-test-jwt-access-secret-lakzee-2026-min-length';
process.env.JWT_REFRESH_SECRET = 'isolated-test-jwt-refresh-secret-lakzee-2026-min-length';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.CLIENT_URL = 'http://localhost:3000,http://127.0.0.1:3100';

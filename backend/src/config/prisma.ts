import { PrismaClient } from '@prisma/client';
import { telemetry } from '../utils/telemetry';

const SLOW_QUERY_THRESHOLD_MS = Number(process.env.SLOW_QUERY_THRESHOLD_MS || 200);
const DEFAULT_CONNECTION_LIMIT = Math.max(5, Number(process.env.PRISMA_CONNECTION_LIMIT || 15));
const DEFAULT_POOL_TIMEOUT = Math.max(5, Number(process.env.PRISMA_POOL_TIMEOUT || 15));

/**
 * Enriches production PostgreSQL URLs cleanly with bounded pool parameters
 * when not already supplied by an operator or managed pooler string.
 */
export function buildPooledDatabaseUrl(rawUrl?: string): string | undefined {
  if (!rawUrl || !/^postgres(ql)?:\/\//i.test(rawUrl)) return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', String(DEFAULT_CONNECTION_LIMIT));
    }
    if (!parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', String(DEFAULT_POOL_TIMEOUT));
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

const configuredDbUrl = buildPooledDatabaseUrl(process.env.DATABASE_URL);

export const prisma = new PrismaClient({
  ...(configuredDbUrl ? { datasources: { db: { url: configuredDbUrl } } } : {}),
  log: [{ emit: 'event' as const, level: 'query' as const }],
});

export function getDatabasePoolConfig() {
  const isPgBouncer = Boolean(configuredDbUrl && configuredDbUrl.includes('pgbouncer=true'));
  return {
    connectionLimit: DEFAULT_CONNECTION_LIMIT,
    poolTimeoutSeconds: DEFAULT_POOL_TIMEOUT,
    pgBouncerEnabled: isPgBouncer,
  };
}

function summarizeSqlTarget(sqlQuery: string): string {
  const normalized = sqlQuery.trim().replace(/\s+/g, ' ');
  const tableMatch = normalized.match(/\b(?:FROM|INTO|UPDATE|JOIN)\s+"?([a-zA-Z0-9_]+)"?/i);
  const verbMatch = normalized.match(/^(SELECT|INSERT|UPDATE|DELETE|BEGIN|COMMIT)/i);
  const verb = verbMatch ? verbMatch[1].toUpperCase() : 'QUERY';
  return tableMatch ? `${verb} ${tableMatch[1]}` : verb;
}

prisma.$on('query', (event) => {
  // Never emit raw SQL params so PII, emails, or hashes never enter query logs
  telemetry.recordDbQuery(event.duration, summarizeSqlTarget(event.query), SLOW_QUERY_THRESHOLD_MS);
});

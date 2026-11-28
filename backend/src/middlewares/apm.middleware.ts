import { Request, Response, NextFunction } from 'express';
import { telemetry } from '../utils/telemetry';

/**
 * Lightweight, zero-blocking APM request timer recording route latency percentiles
 * and HTTP status distributions strictly after the response finishes.
 */
export function apmMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startNs = process.hrtime.bigint();

  res.on('finish', () => {
    // Skip health probes & telemetry sink to avoid distorting user-facing latency stats
    if (req.path === '/health' || req.path === '/api/health' || req.path === '/api/telemetry/client') {
      return;
    }

    const durationMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
    telemetry.recordHttpRequest({
      routePath: req.originalUrl || req.path,
      method: req.method,
      statusCode: res.statusCode,
      durationMs,
    });
  });

  next();
}

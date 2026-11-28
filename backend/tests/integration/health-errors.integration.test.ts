import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import app, { prisma } from '../../src/app';
import { setServerDraining } from '../../src/config/lifecycle';
import { errorHandler } from '../../src/middlewares/error.middleware';
import { BadRequestError } from '../../src/utils/errors';
import { InMemoryPrismaDatabase } from '../factories/in-memory-db.factory';

describe('API Health & Standardized Error Envelope (Supertest Integration)', () => {
  const db = new InMemoryPrismaDatabase();
  let restoreDb: (() => void) | null = null;

  beforeAll(() => {
    restoreDb = db.installOnto(prisma);
  });

  afterAll(() => {
    restoreDb?.();
  });

  beforeEach(() => {
    db.reset();
    setServerDraining(false);
  });

  afterEach(() => {
    setServerDraining(false);
  });

  it('GET /api/health returns 200 OK with live DB status and no-store cache headers', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toMatchObject({
      success: true,
      status: 'success',
      db: 'up',
    });
    expect(typeof res.body.uptimeSeconds).toBe('number');
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('GET /api/health returns 503 when database readiness check fails or server is draining', async () => {
    db.failNextHealthProbe = true;
    const dbDown = await request(app).get('/api/health');
    expect(dbDown.status).toBe(503);
    expect(dbDown.body).toMatchObject({
      success: false,
      status: 'error',
      db: 'down',
    });

    db.failNextHealthProbe = false;
    setServerDraining(true);
    const draining = await request(app).get('/api/health');
    expect(draining.status).toBe(503);
    expect(draining.body).toMatchObject({
      success: false,
      status: 'draining',
    });
  });

  it('returns standardized 404 JSON envelope without HTML or stack traces on invalid routes', async () => {
    const getUnknown = await request(app).get('/api/does-not-exist');
    expect(getUnknown.status).toBe(404);
    expect(getUnknown.headers['content-type']).toMatch(/application\/json/);
    expect(getUnknown.body).toMatchObject({
      success: false,
      status: 'error',
      code: 'NOT_FOUND',
    });
    expect(getUnknown.body.stack).toBeUndefined();

    const postUnknown = await request(app).post('/api/v1/unknown-endpoint').send({ test: true });
    expect(postUnknown.status).toBe(404);
    expect(postUnknown.headers['content-type']).toMatch(/application\/json/);
    expect(postUnknown.body).toMatchObject({
      success: false,
      status: 'error',
      code: 'NOT_FOUND',
    });
    expect(postUnknown.body.stack).toBeUndefined();
  });

  it('returns standardized 500 JSON envelope without leaking stack traces on unexpected errors in production', async () => {
    const isolatedApp = express();
    isolatedApp.get('/explode', () => {
      throw new Error('sensitive postgres driver error details');
    });
    isolatedApp.get('/client-error', () => {
      throw new BadRequestError('Invalid billing payload');
    });
    isolatedApp.use(errorHandler);

    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const boom = await request(isolatedApp).get('/explode');
      expect(boom.status).toBe(500);
      expect(boom.body).toEqual({
        success: false,
        status: 'error',
        message: 'Internal server error',
      });
      expect(boom.body.stack).toBeUndefined();

      const bad = await request(isolatedApp).get('/client-error');
      expect(bad.status).toBe(400);
      expect(bad.body).toMatchObject({
        success: false,
        status: 'error',
        code: 'BAD_REQUEST',
        message: 'Invalid billing payload',
      });
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });
});

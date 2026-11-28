/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import { prisma } from '../config/prisma';
import { buildBranchWhere, PRIMARY_BRANCH_ID } from '../utils/tenant';

export interface CreateAuditLogInput {
  branchId?: string | null;
  userId?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  targetId?: string | null;
  ipAddress?: string | null;
  description: string;
  metadata?: string | null;
}

export class AuditRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async createAuditLog(input: CreateAuditLogInput) {
    const resolvedBranchId = input.branchId ?? PRIMARY_BRANCH_ID;
    try {
      return await this.db.auditLog.create({
        data: {
          branchId: resolvedBranchId,
          userId: input.actorId ?? input.userId ?? null,
          actorId: input.actorId ?? null,
          actorRole: input.actorRole ?? null,
          action: input.action,
          targetId: input.targetId ?? null,
          ipAddress: input.ipAddress ?? null,
          description: input.description,
          metadata: input.metadata ?? null,
        },
      });
    } catch (err: any) {
      // Graceful fallback when running against a database that has not yet pushed additive AuditLog columns
      if (err?.code === 'P2022' || String(err?.message || '').includes('column')) {
        return this.db.auditLog.create({
          data: {
            userId: input.actorId ?? input.userId ?? null,
            action: input.action,
            description: `${input.description}${input.targetId ? ` [target=${input.targetId}]` : ''}`,
          },
        });
      }
      throw err;
    }
  }

  async findRecentAuditLogs(
    options: { action?: string; branchId?: string | null; limit?: number } = {}
  ) {
    const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);
    const where: Record<string, any> = {
      ...(options.branchId ? buildBranchWhere(options.branchId) : {}),
      ...(options.action ? { action: options.action } : {}),
    };
    return this.db.auditLog.findMany({
      ...(Object.keys(where).length > 0 ? { where } : {}),
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

export const auditRepository = new AuditRepository();

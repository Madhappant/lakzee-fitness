import { AuditRepository, auditRepository } from '../repositories/audit.repository';
import { sanitizeTelemetryContext } from '../utils/error-tracker';
import { logger } from '../utils/logger';

export type AuditAction =
  | 'ADMIN_LOGIN'
  | 'LOGIN_FAILED'
  | 'MEMBER_CREATED'
  | 'MEMBER_UPDATED'
  | 'MEMBER_DELETED'
  | 'ROLE_CHANGED'
  | 'BRANCH_CREATED'
  | 'BRANCH_UPDATED'
  | 'REMINDER_SENT'
  | 'REMINDER_BATCH_RUN'
  | 'PAYMENT_ORDER_CREATED'
  | 'PAYMENT_CAPTURED'
  | 'PAYMENT_FAILED';

export interface RecordAuditParams {
  branchId?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
  action: AuditAction;
  targetId?: string | null;
  ipAddress?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
}

export class AuditService {
  private pendingWrites = new Set<Promise<void>>();

  constructor(private readonly repo: AuditRepository = auditRepository) {}

  /**
   * Non-blocking fire-and-forget audit persistence so primary API requests never block.
   * Redacts credentials and direct PII inside metadata before storing.
   */
  record(params: RecordAuditParams): void {
    const sanitizedMetadata = params.metadata
      ? JSON.stringify(sanitizeTelemetryContext(params.metadata))
      : null;

    const job = Promise.resolve()
      .then(async () => {
        await this.repo.createAuditLog({
          branchId: params.branchId ?? null,
          userId: params.actorId ?? null,
          actorId: params.actorId ?? null,
          actorRole: params.actorRole ?? null,
          action: params.action,
          targetId: params.targetId ?? null,
          ipAddress: params.ipAddress ?? null,
          description: params.description,
          metadata: sanitizedMetadata,
        });
      })
      .catch((err) => {
        logger.warn('Audit log write skipped', {
          action: params.action,
          reason: err instanceof Error ? err.message : 'db write skipped',
        });
      });

    this.pendingWrites.add(job);
    void job.finally(() => {
      this.pendingWrites.delete(job);
    });
  }

  listRecent(options: { action?: string; branchId?: string | null; limit?: number } = {}) {
    return this.repo.findRecentAuditLogs(options);
  }

  async flush(): Promise<void> {
    if (this.pendingWrites.size > 0) {
      await Promise.allSettled([...this.pendingWrites]);
    }
  }
}

export const auditService = new AuditService();

import { PrismaClient } from '@prisma/client';
import {
  PRIMARY_BRANCH_CODE,
  PRIMARY_BRANCH_ID,
  PRIMARY_BRANCH_LOCATION,
  PRIMARY_BRANCH_NAME,
} from '../src/utils/tenant';

export interface MultiBranchMigrationSummary {
  branchId: string;
  backfilledCounts: {
    users: number;
    memberProfiles: number;
    membershipPlans: number;
    subscriptions: number;
    invoices: number;
    payments: number;
    expenses: number;
    attendances: number;
    announcements: number;
    auditLogs: number;
    settings: number;
    inquiries: number;
    notificationLogs: number;
  };
}

/**
 * Idempotent, zero-downtime data migration script that provisions Branch #1
 * and links all pre-existing single-branch rows to it without modifying IDs or sorting.
 */
export async function migrateSingleBranchToPrimary(
  db: PrismaClient
): Promise<MultiBranchMigrationSummary> {
  return db.$transaction(async (tx) => {
    const settingsRow = await tx.settings.findFirst({
      orderBy: { id: 'asc' },
    });

    const primaryLocation =
      settingsRow?.address?.trim() ||
      settingsRow?.branch?.trim() ||
      PRIMARY_BRANCH_LOCATION;

    await tx.branch.upsert({
      where: { id: PRIMARY_BRANCH_ID },
      update: {},
      create: {
        id: PRIMARY_BRANCH_ID,
        name: settingsRow?.branch?.trim() || PRIMARY_BRANCH_NAME,
        code: PRIMARY_BRANCH_CODE,
        location: primaryLocation,
        status: 'ACTIVE',
      },
    });

    const [
      users,
      memberProfiles,
      membershipPlans,
      subscriptions,
      invoices,
      payments,
      expenses,
      attendances,
      announcements,
      auditLogs,
      settings,
      inquiries,
      notificationLogs,
    ] = await Promise.all([
      tx.user.updateMany({ where: { branchId: null }, data: { branchId: PRIMARY_BRANCH_ID } }),
      tx.memberProfile.updateMany({ where: { branchId: null }, data: { branchId: PRIMARY_BRANCH_ID } }),
      tx.membershipPlan.updateMany({ where: { branchId: null }, data: { branchId: PRIMARY_BRANCH_ID } }),
      tx.subscription.updateMany({ where: { branchId: null }, data: { branchId: PRIMARY_BRANCH_ID } }),
      tx.invoice.updateMany({ where: { branchId: null }, data: { branchId: PRIMARY_BRANCH_ID } }),
      tx.payment.updateMany({ where: { branchId: null }, data: { branchId: PRIMARY_BRANCH_ID } }),
      tx.expense.updateMany({ where: { branchId: null }, data: { branchId: PRIMARY_BRANCH_ID } }),
      tx.attendance.updateMany({ where: { branchId: null }, data: { branchId: PRIMARY_BRANCH_ID } }),
      tx.announcement.updateMany({ where: { branchId: null }, data: { branchId: PRIMARY_BRANCH_ID } }),
      tx.auditLog.updateMany({ where: { branchId: null }, data: { branchId: PRIMARY_BRANCH_ID } }),
      tx.settings.updateMany({ where: { branchId: null }, data: { branchId: PRIMARY_BRANCH_ID } }),
      tx.consultationInquiry.updateMany({ where: { branchId: null }, data: { branchId: PRIMARY_BRANCH_ID } }),
      tx.notificationLog
        ? tx.notificationLog.updateMany({ where: { branchId: null }, data: { branchId: PRIMARY_BRANCH_ID } })
        : Promise.resolve({ count: 0 }),
    ]);

    return {
      branchId: PRIMARY_BRANCH_ID,
      backfilledCounts: {
        users: users.count,
        memberProfiles: memberProfiles.count,
        membershipPlans: membershipPlans.count,
        subscriptions: subscriptions.count,
        invoices: invoices.count,
        payments: payments.count,
        expenses: expenses.count,
        attendances: attendances.count,
        announcements: announcements.count,
        auditLogs: auditLogs.count,
        settings: settings.count,
        inquiries: inquiries.count,
        notificationLogs: notificationLogs.count,
      },
    };
  }, { maxWait: 15_000, timeout: 60_000 });
}

if (require.main === module) {
  const migrationDbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const prisma = new PrismaClient(
    migrationDbUrl ? { datasources: { db: { url: migrationDbUrl } } } : undefined
  );
  migrateSingleBranchToPrimary(prisma)
    .then((summary) => {
      process.stdout.write(`${JSON.stringify({ status: 'ok', summary }, null, 2)}\n`);
    })
    .catch((err) => {
      process.stderr.write(`Migration failed: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

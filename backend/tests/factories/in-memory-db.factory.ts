/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';

export interface TestBranchRecord {
  id: string;
  name: string;
  code: string;
  location: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestUserRecord {
  id: string;
  email: string;
  password: string;
  role: string;
  branchId?: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  resetOtp: string | null;
  resetOtpExpiry: Date | null;
  phoneOtp: string | null;
  phoneOtpExpiry: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestMemberProfileRecord {
  id: string;
  userId: string;
  branchId?: string | null;
  memberId: string;
  qrCode: string;
  whatsapp?: string | null;
  whatsappNumber?: string | null;
  notificationsEnabled?: boolean;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  dob: Date | null;
  bloodGroup: string | null;
  address: string | null;
  emergencyContact: string | null;
  photoUrl: string | null;
  trainerId: string | null;
  joiningDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestRefreshSessionRecord {
  id: string;
  familyId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface TestMembershipPlanRecord {
  id: string;
  branchId?: string | null;
  name: string;
  description: string | null;
  price: number;
  priceInPaise?: number | null;
  durationDays: number;
  gstPercentage: number;
  taxPercent?: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestSubscriptionRecord {
  id: string;
  branchId?: string | null;
  memberId: string;
  planId: string;
  startDate: Date;
  endDate: Date;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  balanceAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestAttendanceRecord {
  id: string;
  branchId?: string | null;
  memberId: string;
  date: Date;
  checkIn: Date;
  checkOut: Date | null;
}

export interface InMemorySeedOptions {
  branches?: TestBranchRecord[];
  users?: TestUserRecord[];
  memberProfiles?: TestMemberProfileRecord[];
  plans?: TestMembershipPlanRecord[];
  subscriptions?: TestSubscriptionRecord[];
  attendances?: TestAttendanceRecord[];
}

function matchesBranchWhere(recordBranchId: string | null | undefined, where: any): boolean {
  if (!where) return true;
  if (Array.isArray(where.AND)) {
    for (const clause of where.AND) {
      if (!matchesBranchWhere(recordBranchId, clause)) return false;
    }
  }
  const effective = recordBranchId ?? 'branch-primary-001';
  if (typeof where.branchId === 'string') {
    return effective === where.branchId;
  }
  if (Array.isArray(where.OR)) {
    const branchConds = where.OR.filter((c: any) => c && ('branchId' in c));
    if (branchConds.length > 0) {
      return branchConds.some((c: any) =>
        c.branchId === null
          ? recordBranchId === null || recordBranchId === undefined
          : recordBranchId === c.branchId
      );
    }
  }
  return true;
}

function applySelectAndOmit<T extends Record<string, any>>(
  record: T,
  args?: { select?: Record<string, any>; omit?: Record<string, boolean> }
): any {
  const out: Record<string, any> = {};
  if (args?.select) {
    for (const [k, v] of Object.entries(args.select)) {
      if (v) out[k] = record[k];
    }
    return out;
  }
  for (const [k, v] of Object.entries(record)) {
    if (args?.omit?.[k]) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Stateful, transaction-safe in-memory Prisma database double for deterministic unit,
 * HTTP integration, and E2E browser testing with zero risk to live databases.
 */
export class InMemoryPrismaDatabase {
  branches: TestBranchRecord[] = [];
  users: TestUserRecord[] = [];
  memberProfiles: TestMemberProfileRecord[] = [];
  refreshSessions: TestRefreshSessionRecord[] = [];
  plans: TestMembershipPlanRecord[] = [];
  subscriptions: TestSubscriptionRecord[] = [];
  attendances: TestAttendanceRecord[] = [];
  invoices: any[] = [];
  payments: any[] = [];
  dietPlans: any[] = [];
  workoutRoutines: any[] = [];
  announcements: any[] = [];
  expenses: any[] = [];
  settings: any[] = [];
  inquiries: any[] = [];
  auditLogs: any[] = [];
  notificationLogs: any[] = [];
  failNextHealthProbe = false;

  reset(seed: InMemorySeedOptions = {}): void {
    const now = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
    this.branches = (seed.branches ?? [
      {
        id: 'branch-primary-001',
        name: 'Lakzee Primary Studio',
        code: 'BR-001',
        location: 'Main Studio Campus',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      },
    ]).map((b) => ({ ...b }));
    this.users = (seed.users ?? []).map((u) => ({
      ...u,
      branchId: u.branchId ?? 'branch-primary-001',
    }));
    this.memberProfiles = (seed.memberProfiles ?? []).map((p) => ({
      ...p,
      branchId: p.branchId ?? 'branch-primary-001',
      notificationsEnabled: p.notificationsEnabled ?? true,
    }));
    this.plans = (seed.plans ?? []).map((p) => ({
      ...p,
      branchId: p.branchId ?? 'branch-primary-001',
      priceInPaise: p.priceInPaise ?? Math.round(Number(p.price) * 100),
      taxPercent: p.taxPercent ?? p.gstPercentage ?? 18.0,
    }));
    this.subscriptions = (seed.subscriptions ?? []).map((s) => ({
      ...s,
      branchId: s.branchId ?? 'branch-primary-001',
    }));
    this.attendances = (seed.attendances ?? []).map((a) => ({
      ...a,
      branchId: a.branchId ?? 'branch-primary-001',
    }));
    this.refreshSessions = [];
    this.invoices = [];
    this.payments = [];
    this.dietPlans = [];
    this.workoutRoutines = [];
    this.announcements = [];
    this.expenses = [];
    this.settings = [];
    this.inquiries = [];
    this.auditLogs = [];
    this.notificationLogs = [];
    this.failNextHealthProbe = false;
  }

  private hydrateUser(user: TestUserRecord, args?: any): any {
    const profile = this.memberProfiles.find((p) => p.userId === user.id) ?? null;
    const base = applySelectAndOmit(user, args);

    const wantsProfile =
      Boolean(args?.include?.memberProfile) ||
      Boolean(args?.select?.memberProfile) ||
      args?.select?.memberProfile !== undefined;

    if (wantsProfile) {
      if (!profile) {
        base.memberProfile = null;
      } else {
        const subArgs = args?.select?.memberProfile?.select?.subscriptions;
        const memberSubs = this.subscriptions
          .filter((s) => s.memberId === profile.id)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((sub) => ({
            ...sub,
            plan: this.plans.find((pl) => pl.id === sub.planId) ?? null,
          }));
        const hydratedProfile: Record<string, any> = args?.select?.memberProfile?.select
          ? applySelectAndOmit(profile, args.select.memberProfile)
          : { ...profile };
        if (subArgs) {
          hydratedProfile.subscriptions = memberSubs.slice(0, subArgs.take ?? memberSubs.length);
        }
        base.memberProfile = hydratedProfile;
      }
    }

    if (args?.include?.assignedMembers) {
      base.assignedMembers = [];
    }
    return base;
  }

  createDelegate(): PrismaClient {
    const db = this;

    const delegate: any = {
      $connect: async () => undefined,
      $disconnect: async () => undefined,
      $queryRaw: async () => {
        if (db.failNextHealthProbe) {
          throw new Error('Isolated test DB probe failure');
        }
        return [{ '?column?': 1 }];
      },
      $transaction: async (cb: (tx: any) => Promise<any>) => cb(delegate),

      branch: {
        findMany: async () =>
          [...db.branches].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
        findUnique: async ({ where }: any) =>
          db.branches.find((b) => b.id === where?.id) ?? null,
        findFirst: async ({ where }: any) => {
          const conds = where?.OR ?? [];
          return (
            db.branches.find((b) =>
              conds.some((c: any) => {
                if (c.code?.equals) return b.code.toLowerCase() === c.code.equals.toLowerCase();
                if (c.name?.equals) return b.name.toLowerCase() === c.name.equals.toLowerCase();
                return false;
              })
            ) ?? null
          );
        },
        upsert: async ({ where, update, create }: any) => {
          const existing = db.branches.find((b) => b.id === where.id);
          if (existing) {
            Object.assign(existing, update, { updatedAt: new Date() });
            return existing;
          }
          const now = new Date();
          const rec: TestBranchRecord = {
            id: create.id ?? `br-${crypto.randomUUID().slice(0, 8)}`,
            name: create.name,
            code: create.code,
            location: create.location,
            status: create.status ?? 'ACTIVE',
            createdAt: now,
            updatedAt: now,
          };
          db.branches.push(rec);
          return rec;
        },
        create: async ({ data }: any) => {
          const now = new Date();
          const rec: TestBranchRecord = {
            id: data.id ?? `br-${crypto.randomUUID().slice(0, 8)}`,
            name: data.name,
            code: data.code,
            location: data.location,
            status: data.status ?? 'ACTIVE',
            createdAt: now,
            updatedAt: now,
          };
          db.branches.push(rec);
          return rec;
        },
        update: async ({ where, data }: any) => {
          const target = db.branches.find((b) => b.id === where.id);
          if (!target) return null;
          Object.assign(target, data, { updatedAt: new Date() });
          return target;
        },
      },

      user: {
        findUnique: async (args: any) => {
          const where = args?.where ?? {};
          const found = db.users.find((u) => {
            if (where.id !== undefined) return u.id === where.id;
            if (where.email !== undefined) return u.email === where.email;
            return false;
          });
          return found ? db.hydrateUser(found, args) : null;
        },

        findMany: async (args: any = {}) => {
          let rows = [...db.users];
          if (args.where?.role) {
            if (typeof args.where.role === 'string') {
              rows = rows.filter((u) => u.role === args.where.role);
            } else if (Array.isArray(args.where?.role?.in)) {
              rows = rows.filter((u) => args.where.role.in.includes(u.role));
            }
          }
          rows = rows.filter((u) => matchesBranchWhere(u.branchId, args.where));

          if (Array.isArray(args.orderBy) || args.orderBy) {
            const orders = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy];
            rows.sort((a, b) => {
              for (const ord of orders) {
                if (ord.createdAt) {
                  const cmp = a.createdAt.getTime() - b.createdAt.getTime();
                  if (cmp !== 0) return ord.createdAt === 'desc' ? -cmp : cmp;
                }
                if (ord.memberProfile?.memberId) {
                  const pa = db.memberProfiles.find((p) => p.userId === a.id)?.memberId ?? '';
                  const pb = db.memberProfiles.find((p) => p.userId === b.id)?.memberId ?? '';
                  const cmp = pa.localeCompare(pb, 'en', { numeric: true });
                  if (cmp !== 0) return ord.memberProfile.memberId === 'desc' ? -cmp : cmp;
                }
                if (ord.id) {
                  const cmp = a.id.localeCompare(b.id);
                  if (cmp !== 0) return ord.id === 'desc' ? -cmp : cmp;
                }
              }
              return 0;
            });
          }

          if (args.cursor?.id) {
            const idx = rows.findIndex((u) => u.id === args.cursor.id);
            if (idx >= 0) {
              rows = rows.slice(idx + (args.skip ?? 0));
            }
          }
          if (args.take !== undefined) {
            rows = rows.slice(0, args.take);
          }

          return rows.map((u) => db.hydrateUser(u, args));
        },

        create: async (args: any) => {
          const now = new Date();
          const id = args.data.id ?? `u-${crypto.randomUUID().slice(0, 8)}`;
          const newUser: TestUserRecord = {
            id,
            email: args.data.email,
            password: args.data.password,
            role: args.data.role ?? 'MEMBER',
            branchId: args.data.branchId ?? 'branch-primary-001',
            firstName: args.data.firstName,
            lastName: args.data.lastName,
            phone: args.data.phone ?? null,
            resetOtp: null,
            resetOtpExpiry: null,
            phoneOtp: null,
            phoneOtpExpiry: null,
            createdAt: args.data.createdAt ?? now,
            updatedAt: now,
          };
          db.users.push(newUser);

          if (args.data.memberProfile?.create) {
            const p = args.data.memberProfile.create;
            const newProfile: TestMemberProfileRecord = {
              id: `mp-${crypto.randomUUID().slice(0, 8)}`,
              userId: id,
              branchId: p.branchId ?? newUser.branchId ?? 'branch-primary-001',
              memberId: p.memberId,
              qrCode: p.qrCode ?? `LAKZEE-QR-${p.memberId}`,
              whatsappNumber: p.whatsappNumber ?? null,
              notificationsEnabled: p.notificationsEnabled ?? true,
              gender: p.gender ?? 'MALE',
              dob: p.dob ?? null,
              bloodGroup: p.bloodGroup ?? null,
              address: p.address ?? null,
              emergencyContact: p.emergencyContact ?? null,
              photoUrl: p.photoUrl ?? null,
              trainerId: null,
              joiningDate: p.joiningDate ?? now,
              createdAt: now,
              updatedAt: now,
            };
            db.memberProfiles.push(newProfile);
          }

          return db.hydrateUser(newUser, args);
        },

        update: async (args: any) => {
          const target = db.users.find((u) => u.id === args.where.id);
          if (!target) {
            const err: any = new Error('Record not found');
            err.code = 'P2025';
            throw err;
          }

          const { memberProfile: profileOp, ...userFields } = args.data;
          for (const [k, v] of Object.entries(userFields)) {
            if (v !== undefined) (target as any)[k] = v;
          }
          target.updatedAt = new Date();

          if (profileOp?.update) {
            const existingProfile = db.memberProfiles.find((p) => p.userId === target.id);
            if (existingProfile) {
              for (const [k, v] of Object.entries(profileOp.update)) {
                if (v !== undefined) (existingProfile as any)[k] = v;
              }
              existingProfile.updatedAt = new Date();
            }
          } else if (profileOp?.create) {
            const now = new Date();
            db.memberProfiles.push({
              id: `mp-${crypto.randomUUID().slice(0, 8)}`,
              userId: target.id,
              memberId: profileOp.create.memberId,
              qrCode: `LAKZEE-QR-${profileOp.create.memberId}`,
              gender: profileOp.create.gender ?? 'MALE',
              dob: profileOp.create.dob ?? null,
              bloodGroup: profileOp.create.bloodGroup ?? null,
              address: profileOp.create.address ?? null,
              emergencyContact: profileOp.create.emergencyContact ?? null,
              photoUrl: profileOp.create.photoUrl ?? null,
              trainerId: null,
              joiningDate: now,
              createdAt: now,
              updatedAt: now,
            });
          }

          return db.hydrateUser(target, args);
        },

        delete: async (args: any) => {
          const idx = db.users.findIndex((u) => u.id === args.where.id);
          if (idx === -1) {
            const err: any = new Error('Record not found');
            err.code = 'P2025';
            throw err;
          }
          const [removed] = db.users.splice(idx, 1);
          return removed;
        },

        count: async (args?: any) => {
          let rows = [...db.users];
          if (args?.where?.role) {
            rows = rows.filter((u) => u.role === args.where.role);
          }
          rows = rows.filter((u) => matchesBranchWhere(u.branchId, args?.where));
          if (args?.where?.createdAt?.gte) {
            rows = rows.filter((u) => u.createdAt >= args.where.createdAt.gte);
          }
          if (args?.where?.createdAt?.lt) {
            rows = rows.filter((u) => u.createdAt < args.where.createdAt.lt);
          }
          return rows.length;
        },

        updateMany: async (args: any) => {
          let count = 0;
          for (const u of db.users) {
            if (args?.where?.branchId === null && u.branchId != null) continue;
            Object.assign(u, args.data);
            count++;
          }
          return { count };
        },
      },

      memberProfile: {
        findMany: async (args: any = {}) => {
          let rows = [...db.memberProfiles];
          const where = args.where;
          rows = rows.filter((p) => matchesBranchWhere(p.branchId, where));
          const profileOrArrays: any[] = [];
          if (Array.isArray(where?.OR)) profileOrArrays.push(where.OR);
          if (Array.isArray(where?.AND)) {
            for (const clause of where.AND) {
              if (clause && Array.isArray(clause.OR)) {
                profileOrArrays.push(clause.OR);
              }
            }
          }
          for (const orArr of profileOrArrays) {
            const idOrNameConds = orArr.filter((c: any) => !('branchId' in c));
            if (idOrNameConds.length > 0) {
              rows = rows.filter((p) => {
                const user = db.users.find((u) => u.id === p.userId);
                return idOrNameConds.some((cond: any) => {
                  if (cond.memberId?.equals) return p.memberId.toLowerCase() === cond.memberId.equals.toLowerCase();
                  if (cond.qrCode?.equals) return p.qrCode.toLowerCase() === cond.qrCode.equals.toLowerCase();
                  if (cond.user?.firstName?.contains && user) {
                    return user.firstName.toLowerCase().includes(cond.user.firstName.contains.toLowerCase());
                  }
                  if (cond.user?.lastName?.contains && user) {
                    return user.lastName.toLowerCase().includes(cond.user.lastName.contains.toLowerCase());
                  }
                  return false;
                });
              });
            }
          }
          if (where?.subscriptions?.some) {
            const { endDate, status } = where.subscriptions.some;
            rows = rows.filter((p) =>
              db.subscriptions.some(
                (s) =>
                  s.memberId === p.id &&
                  (!status || s.status === status) &&
                  (!endDate?.gte || s.endDate >= endDate.gte)
              )
            );
          }
          if (where?.user?.createdAt?.gte) {
            rows = rows.filter((p) => {
              const user = db.users.find((u) => u.id === p.userId);
              return user && user.createdAt >= where.user.createdAt.gte;
            });
          }
          if (where?.dob?.not === null) {
            rows = rows.filter((p) => p.dob !== null);
          }
          return rows.map((p) => {
            const user = db.users.find((u) => u.id === p.userId);
            const subs = db.subscriptions
              .filter((s) => s.memberId === p.id)
              .map((s) => ({ ...s, plan: db.plans.find((pl) => pl.id === s.planId) ?? null }));
            const out: Record<string, any> = args.select ? applySelectAndOmit(p, args) : { ...p };
            if (args.select?.user) out.user = user ? applySelectAndOmit(user, args.select.user) : null;
            if (args.select?.subscriptions) out.subscriptions = subs;
            return out;
          });
        },

        findUnique: async (args: any) => {
          const where = args?.where ?? {};
          const found = db.memberProfiles.find((p) => {
            if (where.id !== undefined) return p.id === where.id;
            if (where.memberId !== undefined) return p.memberId === where.memberId;
            if (where.userId !== undefined) return p.userId === where.userId;
            return false;
          });
          if (!found) return null;
          const out = applySelectAndOmit(found, args);
          if (args?.include?.user) {
            const user = db.users.find((u) => u.id === found.userId) ?? null;
            out.user = user ? applySelectAndOmit(user, args.include.user) : null;
          }
          if (args?.include?.branch) {
            out.branch = db.branches.find((b) => b.id === (found.branchId ?? 'branch-primary-001')) ?? null;
          }
          if (args?.include?.subscriptions) {
            const subCfg = args.include.subscriptions;
            let subs = db.subscriptions
              .filter((s) => s.memberId === found.id)
              .map((s) => ({
                ...s,
                ...(subCfg.include?.plan ? { plan: db.plans.find((pl) => pl.id === s.planId) ?? null } : {}),
              }));
            subs.sort((a, b) => b.endDate.getTime() - a.endDate.getTime());
            if (subCfg.take) subs = subs.slice(0, subCfg.take);
            out.subscriptions = subs;
          }
          return out;
        },

        findFirst: async (args: any) => {
          const where = args?.where ?? {};
          const found = db.memberProfiles.find((p) => {
            if (!matchesBranchWhere(p.branchId, where)) return false;
            if (where.memberId !== undefined) {
              const eq = typeof where.memberId === 'object' ? where.memberId.equals : where.memberId;
              if (eq && p.memberId.toLowerCase() !== String(eq).toLowerCase()) return false;
            }
            if (where.qrCode !== undefined) {
              const eq = typeof where.qrCode === 'object' ? where.qrCode.equals : where.qrCode;
              if (eq && p.qrCode.toLowerCase() !== String(eq).toLowerCase()) return false;
            }
            if (where.userId !== undefined && p.userId !== where.userId) return false;
            return true;
          });
          if (!found) return null;
          const out = applySelectAndOmit(found, args);
          if (args?.include?.user) {
            const user = db.users.find((u) => u.id === found.userId) ?? null;
            out.user = user ? applySelectAndOmit(user, args.include.user) : null;
          }
          if (args?.include?.branch) {
            out.branch = db.branches.find((b) => b.id === (found.branchId ?? 'branch-primary-001')) ?? null;
          }
          return out;
        },

        updateMany: async (args: any) => {
          let count = 0;
          for (const p of db.memberProfiles) {
            if (args?.where?.trainerId !== undefined && p.trainerId !== args.where.trainerId) continue;
            if (args?.where?.branchId === null && p.branchId != null) continue;
            Object.assign(p, args.data);
            count++;
          }
          return { count };
        },

        delete: async (args: any) => {
          const idx = db.memberProfiles.findIndex((p) => p.id === args.where.id);
          if (idx === -1) return null;
          const [removed] = db.memberProfiles.splice(idx, 1);
          return removed;
        },
      },

      refreshSession: {
        create: async ({ data }: any) => {
          const rec: TestRefreshSessionRecord & { createdAt?: Date } = {
            ...data,
            revokedAt: null,
            replacedById: null,
            createdAt: new Date(),
          };
          db.refreshSessions.push(rec);
          return rec;
        },
        findMany: async (args: any = {}) => {
          const w = args.where ?? {};
          return db.refreshSessions.filter((s: any) => {
            if (w.revokedAt === null && s.revokedAt !== null) return false;
            if (w.expiresAt?.gte && s.expiresAt < w.expiresAt.gte) return false;
            if (w.createdAt?.gte && (s.createdAt ?? new Date()) < w.createdAt.gte) return false;
            if (Array.isArray(w.user?.role?.in)) {
              const user = db.users.find((u) => u.id === s.userId);
              if (!user || !w.user.role.in.includes(user.role)) return false;
            }
            return true;
          });
        },
        findUnique: async ({ where }: any) =>
          db.refreshSessions.find((s) =>
            where.tokenHash ? s.tokenHash === where.tokenHash : s.id === where.id
          ) ?? null,
        update: async ({ where, data }: any) => {
          const target = db.refreshSessions.find((s) => s.id === where.id);
          if (target) Object.assign(target, data);
          return target ?? null;
        },
        updateMany: async ({ where, data }: any) => {
          let count = 0;
          for (const s of db.refreshSessions) {
            if (where?.familyId && s.familyId !== where.familyId) continue;
            if (where?.tokenHash && s.tokenHash !== where.tokenHash) continue;
            if (where?.userId && s.userId !== where.userId) continue;
            if (where?.revokedAt === null && s.revokedAt !== null) continue;
            Object.assign(s, data);
            count++;
          }
          return { count };
        },
      },

      membershipPlan: {
        findMany: async (args: any = {}) =>
          db.plans.filter((p) => matchesBranchWhere(p.branchId, args?.where)),
        findUnique: async ({ where }: any) => db.plans.find((p) => p.id === where.id) ?? null,
        create: async ({ data }: any) => {
          const now = new Date();
          const priceNum = Number(data.price);
          const gstNum = Number(data.gstPercentage ?? data.taxPercent ?? 18.0);
          const plan: TestMembershipPlanRecord = {
            id: `plan-${crypto.randomUUID().slice(0, 8)}`,
            branchId: data.branchId ?? 'branch-primary-001',
            name: data.name,
            description: data.description ?? null,
            price: priceNum,
            priceInPaise: data.priceInPaise ?? Math.round(priceNum * 100),
            durationDays: Number(data.durationDays),
            gstPercentage: gstNum,
            taxPercent: data.taxPercent ?? gstNum,
            isActive: data.isActive ?? true,
            createdAt: now,
            updatedAt: now,
          };
          db.plans.push(plan);
          return plan;
        },
        update: async ({ where, data }: any) => {
          const target = db.plans.find((p) => p.id === where.id);
          if (target) Object.assign(target, data, { updatedAt: new Date() });
          return target ?? null;
        },
        updateMany: async ({ where, data }: any) => {
          let count = 0;
          for (const p of db.plans) {
            if (where?.branchId === null && p.branchId != null) continue;
            Object.assign(p, data);
            count++;
          }
          return { count };
        },
      },

      subscription: {
        count: async (args: any = {}) =>
          db.subscriptions.filter((s) => matchesBranchWhere(s.branchId, args?.where)).length,
        findMany: async (args: any = {}) => {
          let rows = [...db.subscriptions];
          const w = args.where ?? {};
          rows = rows.filter((s) => matchesBranchWhere(s.branchId, w));
          if (w.memberId) {
            rows = rows.filter((s) => s.memberId === w.memberId);
          }
          if (w.paymentStatus) {
            rows = rows.filter((s) => s.paymentStatus === w.paymentStatus);
          }
          if (typeof w.status === 'string') {
            rows = rows.filter((s) => s.status === w.status);
          } else if (Array.isArray(w.status?.in)) {
            rows = rows.filter((s) => w.status.in.includes(s.status));
          } else if (Array.isArray(w.status?.notIn)) {
            rows = rows.filter((s) => !w.status.notIn.includes(s.status));
          }
          if (w.createdAt?.gte) {
            rows = rows.filter((s) => s.createdAt >= w.createdAt.gte);
          }
          if (w.endDate?.gte) {
            rows = rows.filter((s) => s.endDate >= w.endDate.gte);
          }
          if (w.endDate?.lte) {
            rows = rows.filter((s) => s.endDate <= w.endDate.lte);
          }
          if (w.endDate?.lt) {
            rows = rows.filter((s) => s.endDate < w.endDate.lt);
          }
          const allOrClauses: any[] = [];
          if (Array.isArray(w.OR)) allOrClauses.push(w.OR);
          if (Array.isArray(w.AND)) {
            for (const clause of w.AND) {
              if (clause && Array.isArray(clause.OR)) {
                allOrClauses.push(clause.OR);
              }
            }
          }
          for (const orArr of allOrClauses) {
            const nonBranchOr = orArr.filter((cond: any) => !('branchId' in cond));
            if (nonBranchOr.length > 0) {
              rows = rows.filter((s) =>
                nonBranchOr.some((cond: any) => {
                  if (cond.status && s.status === cond.status) return true;
                  if (cond.endDate?.lt && s.endDate < cond.endDate.lt) return true;
                  return false;
                })
              );
            }
          }
          if (w.member?.subscriptions?.none) {
            const noneCond = w.member.subscriptions.none;
            rows = rows.filter(
              (s) =>
                !db.subscriptions.some(
                  (other) =>
                    other.memberId === s.memberId &&
                    (!noneCond.status || other.status === noneCond.status) &&
                    (!noneCond.endDate?.gte || other.endDate >= noneCond.endDate.gte)
                )
            );
          }
          return rows.map((s) => {
            const member = db.memberProfiles.find((m) => m.id === s.memberId);
            const user = member ? db.users.find((u) => u.id === member.userId) : null;
            const plan = db.plans.find((pl) => pl.id === s.planId) ?? null;
            const branch = db.branches.find((b) => b.id === (s.branchId ?? 'branch-primary-001')) ?? null;
            return {
              ...s,
              plan,
              branch,
              member: member ? { ...member, user } : null,
            };
          });
        },
        findFirst: async ({ where, orderBy }: any = {}) => {
          let rows = db.subscriptions.filter(
            (s) =>
              (!where?.memberId || s.memberId === where.memberId) &&
              (!where?.status || s.status === where.status)
          );
          if (orderBy?.endDate === 'desc') {
            rows = rows.sort((a, b) => b.endDate.getTime() - a.endDate.getTime());
          } else if (orderBy?.createdAt === 'desc') {
            rows = rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          }
          const found = rows[0] ?? null;
          if (!found) return null;
          return {
            ...found,
            plan: db.plans.find((pl) => pl.id === found.planId) ?? null,
          };
        },
        create: async ({ data }: any) => {
          const now = new Date();
          const sub: TestSubscriptionRecord = {
            id: `sub-${crypto.randomUUID().slice(0, 8)}`,
            branchId: data.branchId ?? 'branch-primary-001',
            memberId: data.memberId,
            planId: data.planId,
            startDate: new Date(data.startDate),
            endDate: new Date(data.endDate),
            status: data.status ?? 'ACTIVE',
            paymentStatus: data.paymentStatus ?? 'PAID',
            paymentMethod: data.paymentMethod ?? 'CASH',
            balanceAmount: Number(data.balanceAmount ?? 0),
            createdAt: now,
            updatedAt: now,
          };
          db.subscriptions.push(sub);
          return {
            ...sub,
            plan: db.plans.find((pl) => pl.id === sub.planId) ?? null,
          };
        },
        update: async ({ where, data }: any) => {
          const target = db.subscriptions.find((s) => s.id === where.id);
          if (!target) return null;
          Object.assign(target, data, { updatedAt: new Date() });
          return target;
        },
        updateMany: async ({ where, data }: any) => {
          let count = 0;
          for (const s of db.subscriptions) {
            if (where?.branchId === null && s.branchId != null) continue;
            if (where?.status && s.status !== where.status) continue;
            if (where?.endDate?.lt && !(s.endDate < where.endDate.lt)) continue;
            Object.assign(s, data);
            count++;
          }
          return { count };
        },
        deleteMany: async ({ where }: any) => {
          const before = db.subscriptions.length;
          db.subscriptions = db.subscriptions.filter((s) => s.memberId !== where?.memberId);
          return { count: before - db.subscriptions.length };
        },
      },

      attendance: {
        count: async (args: any = {}) =>
          db.attendances.filter((a) => matchesBranchWhere(a.branchId, args?.where)).length,
        findMany: async (args: any = {}) =>
          db.attendances
            .filter((a) => matchesBranchWhere(a.branchId, args?.where))
            .sort((a, b) => b.checkIn.getTime() - a.checkIn.getTime())
            .map((a) => {
              const member = db.memberProfiles.find((m) => m.id === a.memberId) ?? null;
              const user = member ? db.users.find((u) => u.id === member.userId) ?? null : null;
              return {
                ...a,
                member: member ? { ...member, user } : null,
              };
            }),
        findFirst: async ({ where }: any) =>
          db.attendances.find((a) => a.memberId === where?.memberId && a.checkOut === null) ?? null,
        create: async ({ data }: any) => {
          const rec: TestAttendanceRecord = {
            id: `att-${crypto.randomUUID().slice(0, 8)}`,
            branchId: data.branchId ?? 'branch-primary-001',
            memberId: data.memberId,
            date: data.date,
            checkIn: data.checkIn ?? data.date,
            checkOut: null,
          };
          db.attendances.push(rec);
          return rec;
        },
        update: async ({ where, data }: any) => {
          const target = db.attendances.find((a) => a.id === where.id);
          if (target) Object.assign(target, data);
          return target ?? null;
        },
        deleteMany: async ({ where }: any) => {
          const before = db.attendances.length;
          db.attendances = db.attendances.filter((a) => a.memberId !== where?.memberId);
          return { count: before - db.attendances.length };
        },
        updateMany: async ({ where, data }: any) => {
          let count = 0;
          for (const a of db.attendances) {
            if (where?.branchId === null && a.branchId != null) continue;
            Object.assign(a, data);
            count++;
          }
          return { count };
        },
      },

      invoice: {
        findMany: async ({ where }: any = {}) =>
          where?.memberId ? db.invoices.filter((i) => i.memberId === where.memberId) : db.invoices,
        findUnique: async ({ where }: any) =>
          db.invoices.find((i) => (where?.id ? i.id === where.id : where?.invoiceNumber ? i.invoiceNumber === where.invoiceNumber : false)) ?? null,
        findFirst: async ({ where }: any = {}) =>
          db.invoices.find(
            (i) =>
              (!where?.branchId || (i.branchId ?? 'branch-primary-001') === where.branchId) &&
              (!where?.memberId || i.memberId === where.memberId)
          ) ?? null,
        create: async ({ data }: any) => {
          if (data.invoiceNumber && db.invoices.some((i) => i.invoiceNumber === data.invoiceNumber)) {
            const err: any = new Error('Unique constraint failed on invoiceNumber');
            err.code = 'P2002';
            err.meta = { target: ['invoiceNumber'] };
            throw err;
          }
          const rec = {
            id: `inv-${crypto.randomUUID().slice(0, 8)}`,
            branchId: data.branchId ?? 'branch-primary-001',
            invoiceNumber: data.invoiceNumber,
            memberId: data.memberId,
            subscriptionId: data.subscriptionId ?? null,
            subtotal: Number(data.subtotal),
            discount: Number(data.discount ?? 0),
            gstAmount: Number(data.gstAmount),
            totalAmount: Number(data.totalAmount),
            status: data.status ?? 'PENDING',
            createdAt: new Date(),
          };
          db.invoices.push(rec);
          return rec;
        },
        update: async ({ where, data }: any) => {
          const target = db.invoices.find((i) => i.id === where.id);
          if (!target) return null;
          Object.assign(target, data);
          return target;
        },
        updateMany: async ({ where, data }: any) => {
          let count = 0;
          for (const inv of db.invoices) {
            if (where?.branchId === null && inv.branchId != null) continue;
            Object.assign(inv, data);
            count++;
          }
          return { count };
        },
        deleteMany: async ({ where }: any) => {
          const before = db.invoices.length;
          db.invoices = db.invoices.filter((i) => i.memberId !== where?.memberId);
          return { count: before - db.invoices.length };
        },
      },

      payment: {
        count: async (args: any = {}) => {
          const w = args?.where ?? {};
          return db.payments.filter(
            (p) =>
              matchesBranchWhere(p.branchId, w) &&
              (!w.status || p.status === w.status) &&
              (!w.invoiceNumber?.startsWith ||
                (typeof p.invoiceNumber === 'string' && p.invoiceNumber.startsWith(w.invoiceNumber.startsWith)))
          ).length;
        },
        findUnique: async ({ where }: any) => {
          const found =
            db.payments.find(
              (p) =>
                (where?.id !== undefined && p.id === where.id) ||
                (where?.razorpayOrderId !== undefined && p.razorpayOrderId === where.razorpayOrderId) ||
                (where?.razorpayPaymentId !== undefined && p.razorpayPaymentId === where.razorpayPaymentId) ||
                (where?.invoiceNumber !== undefined && p.invoiceNumber === where.invoiceNumber)
            ) ?? null;
          if (!found) return null;
          const member = found.memberId ? db.memberProfiles.find((m) => m.id === found.memberId) ?? null : null;
          const user = member ? db.users.find((u) => u.id === member.userId) ?? null : null;
          const plan = found.planId ? db.plans.find((pl) => pl.id === found.planId) ?? null : null;
          const invoice = found.invoiceId ? db.invoices.find((inv) => inv.id === found.invoiceId) ?? null : null;
          const branch = db.branches.find((b) => b.id === (found.branchId ?? 'branch-primary-001')) ?? null;
          return {
            ...found,
            member: member ? { ...member, user } : null,
            plan,
            invoice,
            branch,
          };
        },
        findFirst: async ({ where }: any = {}) => {
          const w = where ?? {};
          const found =
            db.payments.find(
              (p) =>
                matchesBranchWhere(p.branchId, w) &&
                (!w.razorpayOrderId || p.razorpayOrderId === w.razorpayOrderId) &&
                (!w.razorpayPaymentId || p.razorpayPaymentId === w.razorpayPaymentId) &&
                (!w.memberId || p.memberId === w.memberId) &&
                (!w.status || p.status === w.status)
            ) ?? null;
          if (!found) return null;
          const member = found.memberId ? db.memberProfiles.find((m) => m.id === found.memberId) ?? null : null;
          const user = member ? db.users.find((u) => u.id === member.userId) ?? null : null;
          const plan = found.planId ? db.plans.find((pl) => pl.id === found.planId) ?? null : null;
          const invoice = found.invoiceId ? db.invoices.find((inv) => inv.id === found.invoiceId) ?? null : null;
          const branch = db.branches.find((b) => b.id === (found.branchId ?? 'branch-primary-001')) ?? null;
          return {
            ...found,
            member: member ? { ...member, user } : null,
            plan,
            invoice,
            branch,
          };
        },
        create: async ({ data }: any) => {
          if (data.razorpayOrderId && db.payments.some((p) => p.razorpayOrderId === data.razorpayOrderId)) {
            const err: any = new Error('Unique constraint failed on razorpayOrderId');
            err.code = 'P2002';
            throw err;
          }
          if (data.razorpayPaymentId && db.payments.some((p) => p.razorpayPaymentId === data.razorpayPaymentId)) {
            const err: any = new Error('Unique constraint failed on razorpayPaymentId');
            err.code = 'P2002';
            throw err;
          }
          if (data.invoiceNumber && db.payments.some((p) => p.invoiceNumber === data.invoiceNumber)) {
            const err: any = new Error('Unique constraint failed on invoiceNumber');
            err.code = 'P2002';
            throw err;
          }
          const rec = {
            id: data.id ?? `pay-${crypto.randomUUID().slice(0, 8)}`,
            branchId: data.branchId ?? 'branch-primary-001',
            invoiceId: data.invoiceId ?? null,
            memberId: data.memberId ?? null,
            planId: data.planId ?? null,
            amount: Number(data.amount),
            amountInPaise: data.amountInPaise ?? Math.round(Number(data.amount) * 100),
            currency: data.currency ?? 'INR',
            method: data.method,
            transactionId: data.transactionId ?? null,
            razorpayOrderId: data.razorpayOrderId ?? null,
            razorpayPaymentId: data.razorpayPaymentId ?? null,
            razorpaySignature: data.razorpaySignature ?? null,
            invoiceNumber: data.invoiceNumber ?? null,
            receiptUrl: data.receiptUrl ?? null,
            previousExpiryDate: data.previousExpiryDate ? new Date(data.previousExpiryDate) : null,
            newExpiryDate: data.newExpiryDate ? new Date(data.newExpiryDate) : null,
            status: data.status ?? 'COMPLETED',
            paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
            paidAt: data.paidAt ? new Date(data.paidAt) : null,
            failureReason: data.failureReason ?? null,
            notes: data.notes ?? null,
          };
          db.payments.push(rec);
          return rec;
        },
        update: async ({ where, data }: any) => {
          const target = db.payments.find(
            (p) =>
              (where?.id !== undefined && p.id === where.id) ||
              (where?.razorpayOrderId !== undefined && p.razorpayOrderId === where.razorpayOrderId)
          );
          if (!target) {
            const err: any = new Error('Record not found');
            err.code = 'P2025';
            throw err;
          }
          if (
            data.razorpayPaymentId &&
            db.payments.some((p) => p.id !== target.id && p.razorpayPaymentId === data.razorpayPaymentId)
          ) {
            const err: any = new Error('Unique constraint failed on razorpayPaymentId');
            err.code = 'P2002';
            throw err;
          }
          if (
            data.invoiceNumber &&
            db.payments.some((p) => p.id !== target.id && p.invoiceNumber === data.invoiceNumber)
          ) {
            const err: any = new Error('Unique constraint failed on invoiceNumber');
            err.code = 'P2002';
            throw err;
          }
          Object.assign(target, data);
          return target;
        },
        updateMany: async ({ where, data }: any) => {
          let count = 0;
          for (const p of db.payments) {
            if (where?.branchId === null && p.branchId != null) continue;
            Object.assign(p, data);
            count++;
          }
          return { count };
        },
        deleteMany: async () => ({ count: 0 }),
        findMany: async (args: any = {}) => {
          const w = args?.where ?? {};
          let rows = db.payments.filter((p) => matchesBranchWhere(p.branchId, w));
          if (w.memberId) rows = rows.filter((p) => p.memberId === w.memberId);
          if (w.status) {
            if (typeof w.status === 'string') rows = rows.filter((p) => p.status === w.status);
            else if (Array.isArray(w.status?.in)) rows = rows.filter((p) => w.status.in.includes(p.status));
          }
          if (w.method) rows = rows.filter((p) => p.method === w.method);
          if (w.razorpayOrderId?.not === null) {
            rows = rows.filter((p) => p.razorpayOrderId !== null && p.razorpayOrderId !== undefined);
          }
          rows.sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime());
          const sliced = typeof args.take === 'number' ? rows.slice(0, args.take) : rows;
          return sliced.map((p) => {
            const member = p.memberId ? db.memberProfiles.find((m) => m.id === p.memberId) ?? null : null;
            const user = member ? db.users.find((u) => u.id === member.userId) ?? null : null;
            const plan = p.planId ? db.plans.find((pl) => pl.id === p.planId) ?? null : null;
            const invoice = p.invoiceId ? db.invoices.find((inv) => inv.id === p.invoiceId) ?? null : null;
            const branch = db.branches.find((b) => b.id === (p.branchId ?? 'branch-primary-001')) ?? null;
            return {
              ...p,
              member: member ? { ...member, user } : null,
              plan,
              invoice,
              branch,
            };
          });
        },
      },

      dietPlan: { deleteMany: async () => ({ count: 0 }) },
      workoutRoutine: { deleteMany: async () => ({ count: 0 }) },
      announcement: {
        findMany: async (args: any = {}) =>
          db.announcements.filter((a) => matchesBranchWhere(a.branchId, args?.where)),
        findUnique: async ({ where }: any) => db.announcements.find((a) => a.id === where.id) ?? null,
        deleteMany: async () => ({ count: 0 }),
        updateMany: async ({ where, data }: any) => {
          let count = 0;
          for (const a of db.announcements) {
            if (where?.branchId === null && a.branchId != null) continue;
            Object.assign(a, data);
            count++;
          }
          return { count };
        },
      },
      expense: {
        findMany: async (args: any = {}) =>
          db.expenses.filter((e) => matchesBranchWhere(e.branchId, args?.where)),
        findUnique: async ({ where }: any) => db.expenses.find((e) => e.id === where.id) ?? null,
        aggregate: async () => ({ _sum: { amount: 0 } }),
        updateMany: async ({ where, data }: any) => {
          let count = 0;
          for (const e of db.expenses) {
            if (where?.branchId === null && e.branchId != null) continue;
            Object.assign(e, data);
            count++;
          }
          return { count };
        },
      },
      settings: {
        findFirst: async (args: any = {}) =>
          db.settings.find((s) => matchesBranchWhere(s.branchId, args?.where)) ??
          db.settings[0] ?? {
            id: '1',
            branchId: 'branch-primary-001',
            gymName: 'Lakzee Fitness Studio',
            contactEmail: 'studio@lakzee.fit',
            contactPhone: '9999999999',
            address: 'Chennai',
            whatsappRemindersEnabled: true,
            emailRemindersEnabled: true,
            reminderMilestones: '7,3,1,0',
          },
        findUnique: async ({ where }: any) => db.settings.find((s) => s.id === where?.id) ?? null,
        create: async ({ data }: any) => {
          const rec = {
            whatsappRemindersEnabled: true,
            emailRemindersEnabled: true,
            reminderMilestones: '7,3,1,0',
            ...data,
          };
          db.settings.push(rec);
          return rec;
        },
        upsert: async ({ where, update, create }: any) => {
          const existing = db.settings.find((s) => s.id === where.id);
          if (existing) {
            Object.assign(existing, update);
            return existing;
          }
          const rec = {
            whatsappRemindersEnabled: true,
            emailRemindersEnabled: true,
            reminderMilestones: '7,3,1,0',
            ...create,
          };
          db.settings.push(rec);
          return rec;
        },
        updateMany: async ({ where, data }: any) => {
          let count = 0;
          for (const s of db.settings) {
            if (where?.branchId === null && s.branchId != null) continue;
            Object.assign(s, data);
            count++;
          }
          return { count };
        },
      },
      consultationInquiry: {
        updateMany: async ({ where, data }: any) => {
          let count = 0;
          for (const i of db.inquiries) {
            if (where?.branchId === null && i.branchId != null) continue;
            Object.assign(i, data);
            count++;
          }
          return { count };
        },
      },
      gymSettings: {
        findFirst: async () => ({
          id: 'settings-1',
          gymName: 'Lakzee Fitness Studio',
          phone: '9999999999',
          email: 'studio@lakzee.fit',
          address: 'Chennai',
        }),
      },
      auditLog: {
        create: async ({ data }: any) => {
          const rec = {
            id: `aud-${crypto.randomUUID().slice(0, 8)}`,
            branchId: data.branchId ?? 'branch-primary-001',
            userId: data.userId ?? null,
            actorId: data.actorId ?? null,
            actorRole: data.actorRole ?? null,
            action: data.action,
            targetId: data.targetId ?? null,
            ipAddress: data.ipAddress ?? null,
            description: data.description,
            metadata: data.metadata ?? null,
            createdAt: new Date(),
          };
          db.auditLogs.push(rec);
          return rec;
        },
        findMany: async (args: any = {}) => {
          let rows = [...db.auditLogs];
          rows = rows.filter((entry) => matchesBranchWhere(entry.branchId, args?.where));
          if (args.where?.action) {
            rows = rows.filter((entry) => entry.action === args.where.action);
          }
          rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          return rows.slice(0, args.take ?? 50);
        },
        updateMany: async ({ where, data }: any) => {
          let count = 0;
          for (const a of db.auditLogs) {
            if (where?.branchId === null && a.branchId != null) continue;
            Object.assign(a, data);
            count++;
          }
          return { count };
        },
      },

      notificationLog: {
        findUnique: async ({ where }: any) => {
          if (where?.id) {
            const found = db.notificationLogs.find((n) => n.id === where.id) ?? null;
            if (!found) return null;
            const member = db.memberProfiles.find((m) => m.id === found.memberId) ?? null;
            const user = member ? db.users.find((u) => u.id === member.userId) ?? null : null;
            const branch = db.branches.find((b) => b.id === found.branchId) ?? null;
            return { ...found, member: member ? { ...member, user } : null, branch };
          }
          const k = where?.memberId_channel_milestone_cycleExpiryDate;
          if (!k) return null;
          const targetTs = new Date(k.cycleExpiryDate).getTime();
          return (
            db.notificationLogs.find(
              (n) =>
                n.memberId === k.memberId &&
                n.channel === k.channel &&
                n.milestone === k.milestone &&
                new Date(n.cycleExpiryDate).getTime() === targetTs
            ) ?? null
          );
        },
        findFirst: async ({ where }: any = {}) => {
          const w = where ?? {};
          return (
            db.notificationLogs.find(
              (n) =>
                (!w.memberId || n.memberId === w.memberId) &&
                (!w.channel || n.channel === w.channel) &&
                (!w.milestone || n.milestone === w.milestone) &&
                (!w.cycleExpiryDate ||
                  new Date(n.cycleExpiryDate).getTime() === new Date(w.cycleExpiryDate).getTime())
            ) ?? null
          );
        },
        findMany: async (args: any = {}) => {
          const w = args.where ?? {};
          let rows = db.notificationLogs.filter((n) => matchesBranchWhere(n.branchId, w));
          if (w.status) rows = rows.filter((n) => n.status === w.status);
          if (w.channel) rows = rows.filter((n) => n.channel === w.channel);
          if (w.memberId) rows = rows.filter((n) => n.memberId === w.memberId);
          rows.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
          const sliced = rows.slice(0, args.take ?? 50);
          return sliced.map((n) => {
            const member = db.memberProfiles.find((m) => m.id === n.memberId) ?? null;
            const user = member ? db.users.find((u) => u.id === member.userId) ?? null : null;
            const branch = db.branches.find((b) => b.id === n.branchId) ?? null;
            return {
              ...n,
              member: member
                ? {
                    ...member,
                    user: user
                      ? {
                          id: user.id,
                          firstName: user.firstName,
                          lastName: user.lastName,
                          email: user.email,
                          phone: user.phone,
                        }
                      : null,
                  }
                : null,
              branch,
            };
          });
        },
        create: async ({ data }: any) => {
          const cycleTs = new Date(data.cycleExpiryDate).getTime();
          const duplicate = db.notificationLogs.find(
            (n) =>
              n.memberId === data.memberId &&
              n.channel === data.channel &&
              n.milestone === data.milestone &&
              new Date(n.cycleExpiryDate).getTime() === cycleTs
          );
          if (duplicate) {
            const err: any = new Error('Unique constraint failed on notificationLog');
            err.code = 'P2002';
            err.meta = { target: ['memberId', 'channel', 'milestone', 'cycleExpiryDate'] };
            throw err;
          }
          const rec = {
            id: `nlog-${crypto.randomUUID().slice(0, 8)}`,
            branchId: data.branchId ?? 'branch-primary-001',
            memberId: data.memberId,
            channel: data.channel,
            milestone: data.milestone,
            cycleExpiryDate: new Date(cycleTs),
            status: data.status,
            providerMessageId: data.providerMessageId ?? null,
            errorMessage: data.errorMessage ?? null,
            sentAt: data.sentAt ? new Date(data.sentAt) : new Date(),
          };
          db.notificationLogs.push(rec);
          return rec;
        },
        update: async ({ where, data }: any) => {
          const target = db.notificationLogs.find((n) => n.id === where.id);
          if (!target) {
            const err: any = new Error('Record not found');
            err.code = 'P2025';
            throw err;
          }
          Object.assign(target, data);
          return target;
        },
        deleteMany: async ({ where }: any = {}) => {
          const before = db.notificationLogs.length;
          if (where?.memberId) {
            db.notificationLogs = db.notificationLogs.filter((n) => n.memberId !== where.memberId);
          }
          return { count: before - db.notificationLogs.length };
        },
        updateMany: async ({ where, data }: any) => {
          let count = 0;
          for (const n of db.notificationLogs) {
            if (where?.branchId === null && n.branchId != null) continue;
            Object.assign(n, data);
            count++;
          }
          return { count };
        },
      },
    };

    return delegate as unknown as PrismaClient;
  }

  /**
   * Binds all Prisma delegates on the runtime singleton to this isolated in-memory database
   * and returns an automatic cleanup hook to restore original delegates on teardown.
   */
  installOnto(prismaInstance: any): () => void {
    const fake = this.createDelegate() as Record<string, any>;
    const saved = new Map<string, PropertyDescriptor | undefined>();

    for (const key of Object.keys(fake)) {
      saved.set(key, Object.getOwnPropertyDescriptor(prismaInstance, key));
      Object.defineProperty(prismaInstance, key, {
        value: fake[key],
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }

    return () => {
      for (const [key, desc] of saved.entries()) {
        if (desc) {
          Object.defineProperty(prismaInstance, key, desc);
        } else {
          delete prismaInstance[key];
        }
      }
    };
  }
}

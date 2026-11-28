import bcrypt from 'bcryptjs';
import type { TestUserRecord } from './in-memory-db.factory';

let userSeq = 1;

// Pre-computed bcrypt hash (cost 6 in test factories for fast deterministic runs) for "TestPass!2026"
export const DEFAULT_TEST_PASSWORD = 'TestPass!2026';
export const DEFAULT_TEST_PASSWORD_HASH = bcrypt.hashSync(DEFAULT_TEST_PASSWORD, 6);

export interface UserFactoryOverrides {
  id?: string;
  email?: string;
  passwordHash?: string;
  role?: 'SUPER_ADMIN' | 'BRANCH_ADMIN' | 'ADMIN' | 'RECEPTIONIST' | 'TRAINER' | 'STAFF' | 'MEMBER';
  branchId?: string | null;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  createdAt?: Date;
}

export function resetUserFactorySequence(): void {
  userSeq = 1;
}

export function buildUserRecord(overrides: UserFactoryOverrides = {}): TestUserRecord {
  const n = userSeq++;
  const role = overrides.role ?? 'STAFF';
  return {
    id: overrides.id ?? `user-${role.toLowerCase()}-${n}`,
    email: overrides.email ?? `${role.toLowerCase()}-${n}@lakzee.test`,
    password: overrides.passwordHash ?? DEFAULT_TEST_PASSWORD_HASH,
    role,
    branchId: overrides.branchId ?? 'branch-primary-001',
    firstName: overrides.firstName ?? role.charAt(0) + role.slice(1).toLowerCase(),
    lastName: overrides.lastName ?? `User${n}`,
    phone: overrides.phone === undefined ? `9800000${String(n).padStart(3, '0')}` : overrides.phone,
    resetOtp: null,
    resetOtpExpiry: null,
    phoneOtp: null,
    phoneOtpExpiry: null,
    createdAt: overrides.createdAt ?? new Date(Date.UTC(2026, 0, n, 10, 0, 0)),
    updatedAt: overrides.createdAt ?? new Date(Date.UTC(2026, 0, n, 10, 0, 0)),
  };
}

export function buildAdminUser(overrides: Omit<UserFactoryOverrides, 'role'> = {}): TestUserRecord {
  return buildUserRecord({
    id: 'admin-1',
    email: 'admin@lakzee.fit',
    firstName: 'Arjun',
    lastName: 'Admin',
    ...overrides,
    role: 'ADMIN',
  });
}

export function buildSuperAdminUser(overrides: Omit<UserFactoryOverrides, 'role'> = {}): TestUserRecord {
  return buildUserRecord({
    id: 'super-admin-1',
    email: 'owner@lakzee.fit',
    firstName: 'Lakzee',
    lastName: 'Owner',
    ...overrides,
    role: 'SUPER_ADMIN',
  });
}

export function buildStaffUser(
  role: 'RECEPTIONIST' | 'TRAINER' | 'STAFF' = 'TRAINER',
  overrides: Omit<UserFactoryOverrides, 'role'> = {}
): TestUserRecord {
  return buildUserRecord({
    id: `${role.toLowerCase()}-1`,
    email: `${role.toLowerCase()}@lakzee.fit`,
    firstName: role === 'TRAINER' ? 'Vikram' : 'Divya',
    lastName: role === 'TRAINER' ? 'Coach' : 'Desk',
    ...overrides,
    role,
  });
}

import { DEFAULT_TEST_PASSWORD_HASH } from './user.factory';
import type { TestMemberProfileRecord, TestUserRecord } from './in-memory-db.factory';

let memberSeq = 1;

export function resetMemberFactorySequence(): void {
  memberSeq = 1;
}

export interface MemberFactoryOverrides {
  userId?: string;
  profileId?: string;
  branchId?: string | null;
  memberId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  bloodGroup?: string;
  address?: string;
  emergencyContact?: string;
  qrCode?: string;
  dob?: Date | null;
  createdAt?: Date;
  joiningDate?: Date;
  passwordHash?: string;
}

export function buildMemberPair(overrides: MemberFactoryOverrides = {}): {
  user: TestUserRecord;
  profile: TestMemberProfileRecord;
} {
  const n = memberSeq++;
  const padded = overrides.memberId ?? String(n).padStart(3, '0');
  const userId = overrides.userId ?? `member-user-${padded}`;
  const profileId = overrides.profileId ?? `member-profile-${padded}`;
  const createdAt = overrides.createdAt ?? new Date(Date.UTC(2026, 0, n, 9, 0, 0));

  const user: TestUserRecord = {
    id: userId,
    email: overrides.email ?? `member.${padded.toLowerCase()}@lakzee.test`,
    password: overrides.passwordHash ?? DEFAULT_TEST_PASSWORD_HASH,
    role: 'MEMBER',
    branchId: overrides.branchId ?? 'branch-primary-001',
    firstName: overrides.firstName ?? `Athlete`,
    lastName: overrides.lastName ?? `${padded}`,
    phone: overrides.phone ?? `9000000${String(n).padStart(3, '0')}`,
    resetOtp: null,
    resetOtpExpiry: null,
    phoneOtp: null,
    phoneOtpExpiry: null,
    createdAt,
    updatedAt: createdAt,
  };

  const profile: TestMemberProfileRecord = {
    id: profileId,
    userId,
    branchId: overrides.branchId ?? 'branch-primary-001',
    memberId: padded,
    qrCode: overrides.qrCode ?? `LAKZEE-QR-${padded}`,
    gender: overrides.gender ?? 'MALE',
    dob: overrides.dob ?? null,
    bloodGroup: overrides.bloodGroup ?? 'O+',
    address: overrides.address ?? 'Chennai, TN',
    emergencyContact: overrides.emergencyContact ?? '9999999999',
    photoUrl: null,
    trainerId: null,
    joiningDate: overrides.joiningDate ?? createdAt,
    createdAt,
    updatedAt: createdAt,
  };

  return { user, profile };
}

/**
 * Returns sequential IDs (001, 002, 010, 011) stored intentionally out of order
 * in the backing store so tests prove natural numeric sorting works reliably.
 */
export function createSequentialMemberRoster() {
  const specs: Array<MemberFactoryOverrides> = [
    {
      memberId: '010',
      firstName: 'Kavin',
      lastName: 'Ten',
      email: 'kavin.010@lakzee.test',
      createdAt: new Date(Date.UTC(2026, 1, 10, 10, 0, 0)),
    },
    {
      memberId: '002',
      firstName: 'Meera',
      lastName: 'Two',
      email: 'meera.002@lakzee.test',
      gender: 'FEMALE',
      createdAt: new Date(Date.UTC(2026, 1, 2, 10, 0, 0)),
    },
    {
      memberId: '011',
      firstName: 'Rohan',
      lastName: 'Eleven',
      email: 'rohan.011@lakzee.test',
      createdAt: new Date(Date.UTC(2026, 1, 20, 12, 0, 0)),
    },
    {
      memberId: '001',
      firstName: 'Aarav',
      lastName: 'One',
      email: 'aarav.001@lakzee.test',
      createdAt: new Date(Date.UTC(2026, 1, 1, 10, 0, 0)),
    },
  ];

  return specs.map((spec) => buildMemberPair(spec));
}

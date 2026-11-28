import { beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  compareMemberIds,
  generateUniqueMemberId,
  parseMemberSortOrder,
  sortMembers,
} from '../../src/services/member.service';
import { memoryCache } from '../../src/utils/cache';
import {
  buildMemberPair,
  createSequentialMemberRoster,
  resetMemberFactorySequence,
} from '../factories/member.factory';

describe('Member ID Natural Comparison, 3-Mode Sorting & Sequential Allocation', () => {
  beforeEach(() => {
    memoryCache.clear();
    resetMemberFactorySequence();
  });

  it('sorts numeric and prefixed Member IDs naturally rather than alphabetically', () => {
    const raw = ['010', '2', '001', '011', '100', '002'];
    expect([...raw].sort(compareMemberIds)).toEqual(['001', '002', '2', '010', '011', '100']);

    const prefixed = ['LZ-10', 'LZ-2', 'LZ-001', 'LZ-100'];
    expect([...prefixed].sort(compareMemberIds)).toEqual(['LZ-001', 'LZ-2', 'LZ-10', 'LZ-100']);
  });

  it('defaults unknown sort parameters to asc and handles asc, desc, and latest cleanly', () => {
    expect(parseMemberSortOrder(undefined)).toBe('asc');
    expect(parseMemberSortOrder('invalid')).toBe('asc');
    expect(parseMemberSortOrder('desc')).toBe('desc');
    expect(parseMemberSortOrder('latest')).toBe('latest');

    const roster = createSequentialMemberRoster().map(({ user, profile }) => ({
      id: user.id,
      createdAt: user.createdAt,
      memberProfile: {
        memberId: profile.memberId,
        joiningDate: profile.joiningDate,
      },
    }));

    expect(sortMembers(roster, 'asc').map((m) => m.memberProfile.memberId)).toEqual([
      '001',
      '002',
      '010',
      '011',
    ]);
    expect(sortMembers(roster, 'desc').map((m) => m.memberProfile.memberId)).toEqual([
      '011',
      '010',
      '002',
      '001',
    ]);
    // Ordered newest createdAt first: 011 (Feb 20), 010 (Feb 10), 002 (Feb 02), 001 (Feb 01)
    expect(sortMembers(roster, 'latest').map((m) => m.memberProfile.memberId)).toEqual([
      '011',
      '010',
      '002',
      '001',
    ]);
  });

  it('generates sequential IDs starting at 001 and skipping occupied IDs', async () => {
    const emptyDb = {
      memberProfile: {
        findMany: async () => [],
        findUnique: async () => null,
      },
    } as unknown as Pick<PrismaClient, 'memberProfile'>;

    expect(await generateUniqueMemberId(emptyDb)).toBe('001');

    const populatedDb = {
      memberProfile: {
        findMany: async () =>
          ['001', '002', '010', '011'].map((memberId) => ({ memberId })),
        findUnique: async ({ where }: { where: { memberId: string } }) =>
          where.memberId === '012' ? { id: 'already-taken' } : null,
      },
    } as unknown as Pick<PrismaClient, 'memberProfile'>;

    const allocated = await generateUniqueMemberId(populatedDb);
    expect(allocated).toBe('013');

    const extra = buildMemberPair({ memberId: allocated });
    expect(compareMemberIds('011', extra.profile.memberId)).toBeLessThan(0);
  });
});

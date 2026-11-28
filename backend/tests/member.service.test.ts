/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret-lakzee';

let compareMemberIds: any;
let generateUniqueMemberId: any;
let parseMemberSortOrder: any;
let sortMembers: any;

describe('member ID natural comparison and 3-mode sorting', () => {
  before(async () => {
    const mod = await import('../src/services/member.service');
    compareMemberIds = mod.compareMemberIds;
    generateUniqueMemberId = mod.generateUniqueMemberId;
    parseMemberSortOrder = mod.parseMemberSortOrder;
    sortMembers = mod.sortMembers;
  });

  it('compareMemberIds sorts numerically/naturally rather than alphabetically', () => {
    const raw = ['010', '2', '001', '011', '100', '002'];
    const sorted = [...raw].sort(compareMemberIds);
    assert.deepEqual(sorted, ['001', '002', '2', '010', '011', '100']);

    const prefixed = ['LZ-10', 'LZ-2', 'LZ-001', 'LZ-100'];
    assert.deepEqual([...prefixed].sort(compareMemberIds), ['LZ-001', 'LZ-2', 'LZ-10', 'LZ-100']);
  });

  it('sortMembers supports asc (001->Last), desc (Last->001), and latest with ID fallback', () => {
    const sample = [
      { id: 'u-10', createdAt: '2026-01-05T10:00:00Z', memberProfile: { memberId: '010' } },
      { id: 'u-2', createdAt: '2026-01-10T10:00:00Z', memberProfile: { memberId: '002' } },
      { id: 'u-1', createdAt: '2026-01-01T10:00:00Z', memberProfile: { memberId: '001' } },
      { id: 'u-no-ts-low', createdAt: null, memberProfile: { memberId: '011' } },
      { id: 'u-no-ts-high', createdAt: null, memberProfile: { memberId: '025' } },
    ];

    assert.equal(parseMemberSortOrder('invalid'), 'asc');
    assert.equal(parseMemberSortOrder('desc'), 'desc');
    assert.equal(parseMemberSortOrder('latest'), 'latest');

    const ascIds = sortMembers(sample, 'asc').map((m: any) => m.memberProfile?.memberId);
    assert.deepEqual(ascIds, ['001', '002', '010', '011', '025']);

    const descIds = sortMembers(sample, 'desc').map((m: any) => m.memberProfile?.memberId);
    assert.deepEqual(descIds, ['025', '011', '010', '002', '001']);

    const latestIds = sortMembers(sample, 'latest').map((m: any) => m.memberProfile?.memberId);
    assert.deepEqual(latestIds, ['002', '010', '001', '025', '011']);
  });
});

describe('generateUniqueMemberId sequential ordering', () => {
  it('starts at 001 on an empty roster', async () => {
    const db = {
      memberProfile: {
        findMany: async () => [],
        findUnique: async () => null,
      },
    } as any;

    assert.equal(await generateUniqueMemberId(db), '001');
  });

  it('increments sequentially above the highest existing numeric ID and skips collisions', async () => {
    const existing = [{ memberId: '001' }, { memberId: '002' }, { memberId: '010' }];
    const db = {
      memberProfile: {
        findMany: async () => existing,
        findUnique: async ({ where }: any) =>
          where.memberId === '011' ? { id: 'taken' } : null,
      },
    } as any;

    const nextId = await generateUniqueMemberId(db);
    assert.equal(nextId, '012');

    const combined = [...existing.map((e) => e.memberId), nextId].sort(compareMemberIds);
    assert.equal(combined[combined.length - 1], '012');
  });

  it('preserves alphabetic prefix conventions sequentially', async () => {
    const db = {
      memberProfile: {
        findMany: async () => [{ memberId: 'LZ-002' }, { memberId: 'LZ-009' }],
        findUnique: async () => null,
      },
    } as any;

    assert.equal(await generateUniqueMemberId(db), 'LZ-010');
  });
});

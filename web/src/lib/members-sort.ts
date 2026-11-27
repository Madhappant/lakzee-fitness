export type MemberSortOrder = "asc" | "desc" | "latest";

const naturalIdCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

export function compareMemberIds(aRaw?: string | null, bRaw?: string | null): number {
  const a = (aRaw ?? "").trim();
  const b = (bRaw ?? "").trim();
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const cmp = naturalIdCollator.compare(a, b);
  if (cmp !== 0) return cmp;
  return a.localeCompare(b);
}

function toTimestamp(val: Date | string | null | undefined): number | null {
  if (!val) return null;
  const ms = val instanceof Date ? val.getTime() : Date.parse(val);
  return Number.isFinite(ms) ? ms : null;
}

export interface SortableMember {
  id: string;
  createdAt?: Date | string | null;
  memberProfile?: {
    memberId?: string | null;
    joiningDate?: Date | string | null;
  } | null;
}

export function sortMembers<T extends SortableMember>(
  members: readonly T[],
  sortOrder: MemberSortOrder = "asc"
): T[] {
  return [...members].sort((a, b) => {
    const aId = a.memberProfile?.memberId;
    const bId = b.memberProfile?.memberId;

    if (sortOrder === "latest") {
      const aTime = toTimestamp(a.createdAt ?? a.memberProfile?.joiningDate);
      const bTime = toTimestamp(b.createdAt ?? b.memberProfile?.joiningDate);
      if (aTime !== null && bTime !== null && aTime !== bTime) {
        return bTime - aTime;
      }
      if (aTime !== null && bTime === null) return -1;
      if (aTime === null && bTime !== null) return 1;
      return compareMemberIds(bId, aId);
    }

    const idCmp = sortOrder === "desc" ? compareMemberIds(bId, aId) : compareMemberIds(aId, bId);
    if (idCmp !== 0) return idCmp;

    const aTime = toTimestamp(a.createdAt) ?? 0;
    const bTime = toTimestamp(b.createdAt) ?? 0;
    if (aTime !== bTime) {
      return sortOrder === "desc" ? bTime - aTime : aTime - bTime;
    }
    return a.id.localeCompare(b.id);
  });
}

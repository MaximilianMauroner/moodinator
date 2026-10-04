/** Recorded mood totals used by rhythm cells and tag comparisons. */
export interface GroupStats {
  count: number;
  sum: number;
}

export function emptyGroup(): GroupStats {
  return { count: 0, sum: 0 };
}

export function addToGroup(group: GroupStats, value: number): void {
  group.count += 1;
  group.sum += value;
}

export function subtractGroup(whole: GroupStats, part: GroupStats): GroupStats {
  return { count: whole.count - part.count, sum: whole.sum - part.sum };
}

export function groupMean(group: GroupStats): number {
  return group.count > 0 ? group.sum / group.count : 0;
}

/** Combine recorded totals without treating weekdays as equally sized groups. */
export function mergeGroups(groups: Iterable<GroupStats>): GroupStats {
  const total = emptyGroup();
  for (const group of groups) {
    total.count += group.count;
    total.sum += group.sum;
  }
  return total;
}

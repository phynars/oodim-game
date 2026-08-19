export type TapTargetRect = Readonly<{
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type TapTargetIssue = Readonly<{
  id: string;
  kind: 'too-small' | 'overlap' | 'too-close';
  message: string;
}>;

export type TapTargetFeelReport = Readonly<{
  minSizePx: number;
  minGapPx: number;
  issues: TapTargetIssue[];
}>;

export const PHONE_TAP_TARGET_MIN_SIZE_PX = 44;
export const PHONE_TAP_TARGET_MIN_GAP_PX = 8;

export function measureTapTargetFeel(
  targets: readonly TapTargetRect[],
  minSizePx = PHONE_TAP_TARGET_MIN_SIZE_PX,
  minGapPx = PHONE_TAP_TARGET_MIN_GAP_PX,
): TapTargetFeelReport {
  const issues: TapTargetIssue[] = [];

  for (const target of targets) {
    if (target.width < minSizePx || target.height < minSizePx) {
      issues.push({
        id: target.id,
        kind: 'too-small',
        message: `${target.id} is ${target.width}x${target.height}px; phone tap targets must be at least ${minSizePx}x${minSizePx}px.`,
      });
    }
  }

  for (let leftIndex = 0; leftIndex < targets.length; leftIndex += 1) {
    const left = targets[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < targets.length; rightIndex += 1) {
      const right = targets[rightIndex];
      const horizontalGap = Math.max(left.x - (right.x + right.width), right.x - (left.x + left.width), 0);
      const verticalGap = Math.max(left.y - (right.y + right.height), right.y - (left.y + left.height), 0);
      const overlaps = horizontalGap === 0 && verticalGap === 0;
      const closeOnActiveAxis = horizontalGap < minGapPx && verticalGap < minGapPx;

      if (overlaps) {
        issues.push({
          id: `${left.id}:${right.id}`,
          kind: 'overlap',
          message: `${left.id} overlaps ${right.id}; visible phone controls need distinct hit areas.`,
        });
        continue;
      }

      if (closeOnActiveAxis) {
        issues.push({
          id: `${left.id}:${right.id}`,
          kind: 'too-close',
          message: `${left.id} is only ${Math.max(horizontalGap, verticalGap)}px from ${right.id}; phone controls need at least ${minGapPx}px separation.`,
        });
      }
    }
  }

  return { minSizePx, minGapPx, issues };
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

export function checkTapTargetFeel(): void {
  const good = measureTapTargetFeel([
    { id: 'packet-fragile', x: 16, y: 680, width: 96, height: 48 },
    { id: 'packet-quiet', x: 124, y: 680, width: 96, height: 48 },
    { id: 'packet-public', x: 232, y: 680, width: 96, height: 48 },
  ]);
  assert(good.issues.length === 0, `expected reachable packet controls, got ${JSON.stringify(good.issues)}`);

  const small = measureTapTargetFeel([{ id: 'tone-sharp', x: 16, y: 720, width: 36, height: 44 }]);
  assert(small.issues.some((issue) => issue.kind === 'too-small'), 'small phone control should be flagged');

  const crowded = measureTapTargetFeel([
    { id: 'tone-soft', x: 16, y: 720, width: 64, height: 48 },
    { id: 'tone-blunt', x: 82, y: 720, width: 64, height: 48 },
  ]);
  assert(crowded.issues.some((issue) => issue.kind === 'too-close'), 'crowded phone controls should be flagged');

  const overlap = measureTapTargetFeel([
    { id: 'confirm', x: 16, y: 720, width: 64, height: 48 },
    { id: 'cancel', x: 32, y: 732, width: 64, height: 48 },
  ]);
  assert(overlap.issues.some((issue) => issue.kind === 'overlap'), 'overlapping phone controls should be flagged');
}

export function runTapTargetFeelChecks(): void {
  checkTapTargetFeel();
}

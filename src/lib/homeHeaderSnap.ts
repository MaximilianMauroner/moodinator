const DEFAULT_SNAP_THRESHOLD_PROGRESS = 0.5;
const DEFAULT_SNAP_EPSILON = 0.5;

export interface HomeHeaderSnapMetrics {
  offsetY: number;
  contentHeight: number;
  viewportHeight: number;
  collapseDistance: number;
  thresholdProgress?: number;
  epsilon?: number;
}

function isFinitePositive(value: number) {
  return Number.isFinite(value) && value > 0;
}

export function getHomeHeaderSnapTarget({
  offsetY,
  contentHeight,
  viewportHeight,
  collapseDistance,
  thresholdProgress = DEFAULT_SNAP_THRESHOLD_PROGRESS,
  epsilon = DEFAULT_SNAP_EPSILON,
}: HomeHeaderSnapMetrics) {
  if (
    offsetY < 0 ||
    !Number.isFinite(offsetY) ||
    !isFinitePositive(contentHeight) ||
    !isFinitePositive(viewportHeight) ||
    !isFinitePositive(collapseDistance)
  ) {
    return null;
  }

  const maxScrollableOffset = Math.max(contentHeight - viewportHeight, 0);

  if (offsetY <= epsilon) {
    return null;
  }

  if (maxScrollableOffset + epsilon < collapseDistance) {
    return 0;
  }

  if (offsetY + epsilon >= collapseDistance) {
    return null;
  }

  const target =
    offsetY / collapseDistance < thresholdProgress ? 0 : collapseDistance;

  return Math.abs(offsetY - target) <= epsilon ? null : target;
}

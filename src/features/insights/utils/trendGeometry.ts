import type { DailyPoint } from "./dailySeries";
export interface TrendGeometry {
  lines: string[];
  bands: string[];
  whiskers: { x: number; minY: number; maxY: number }[];
  dots: { x: number; y: number; mood: number }[];
}
export function trendGeometry(
  series: DailyPoint[],
  width = 300,
  height = 120,
): TrendGeometry {
  const result: TrendGeometry = {
    lines: [],
    bands: [],
    dots: [],
    whiskers: [],
  };
  const x = (index: number) =>
    series.length <= 1 ? width / 2 : (index * width) / (series.length - 1);
  const y = (mood: number) => (mood / 10) * height;
  let run: { index: number; point: DailyPoint }[] = [];
  function flush() {
    if (!run.length) return;
    const path = (values: typeof run, key: "mean" | "min" | "max") =>
      values
        .map(
          ({ index, point }, i) =>
            `${i ? "L" : "M"}${x(index).toFixed(2)},${y(point[key]!).toFixed(2)}`,
        )
        .join(" ");
    if (run.length === 1) {
      result.whiskers.push({
        x: x(run[0].index),
        minY: y(run[0].point.min!),
        maxY: y(run[0].point.max!),
      });
    }
    result.lines.push(path(run, "mean"));
    result.bands.push(
      `${path(run, "min")} ${path([...run].reverse(), "max").replace(/^M/, "L")} Z`,
    );
    run = [];
  }
  series.forEach((point, index) => {
    if (point.mean === null) {
      flush();
      return;
    }
    run.push({ index, point });
    result.dots.push({ x: x(index), y: y(point.mean), mood: point.mean });
  });
  flush();
  return result;
}

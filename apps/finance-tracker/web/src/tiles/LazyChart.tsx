import { lazy, Suspense } from "react";
import type { EChartsOption } from "echarts";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Lazy-loaded ECharts wrapper.
 *
 * `echarts-for-react` + `echarts` is ~200 KB gzipped (design §8). Importing it
 * with `React.lazy` keeps it OUT of the main dashboard bundle — it loads in its
 * own chunk the first time any tile renders a chart, while the shell stays
 * light. Each tile that draws a chart renders `<LazyChart option={...} />`.
 */
const ReactECharts = lazy(() => import("echarts-for-react"));

export function LazyChart({
  option,
  className,
  style,
  ariaLabel,
}: {
  option: EChartsOption;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}) {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full rounded-md" />}>
      <div className={className} aria-label={ariaLabel} role="img">
        <ReactECharts
          option={option}
          style={{ height: 220, ...style }}
          opts={{ renderer: "svg" }}
          notMerge
          lazyUpdate
        />
      </div>
    </Suspense>
  );
}

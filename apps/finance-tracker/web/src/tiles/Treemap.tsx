import { useMemo } from "react";
import type { EChartsOption } from "echarts";

import { formatEur, formatPct } from "@/lib/format";

import { LazyChart } from "./LazyChart";
import { TileCard, TileEmpty, TileSkeleton } from "./TileCard";
import { buildTreemapData, OTHER_NAME } from "./treemapMath";
import { usePortfolioData } from "./usePortfolioData";
import type { TileProps } from "./types";

/**
 * M11.7 — full-width heatmap treemap.
 *
 * Boxes are sized by position EUR value and coloured by unrealised return
 * (green = gain, red = loss, grey = no cost basis). Positions beyond the top 50
 * (when the book exceeds 100 names) collapse into a drill-down "Other" box —
 * ECharts' treemap handles the click-to-expand natively (`leafDepth: 1`).
 */
export function Treemap({ accountIds }: TileProps) {
  const { data, isLoading } = usePortfolioData(accountIds);

  const nodes = useMemo(
    () => (data ? buildTreemapData(data.positions) : []),
    [data],
  );

  const option: EChartsOption = useMemo(
    () => ({
      tooltip: {
        formatter: (info: unknown) => {
          const node = info as {
            name: string;
            value: number;
            data?: { returnPct?: number | null };
          };
          const ret = node.data?.returnPct;
          const retLine =
            node.name === OTHER_NAME || ret === null || ret === undefined
              ? ""
              : `<br/>${formatPct(ret)}`;
          return `${node.name}<br/>${formatEur(node.value)}${retLine}`;
        },
      },
      series: [
        {
          type: "treemap",
          // Show only the top level; clicking "Other" drills into its children.
          leafDepth: 1,
          roam: false,
          nodeClick: "zoomToNode",
          breadcrumb: { show: true },
          label: {
            show: true,
            formatter: "{b}",
            overflow: "truncate",
          },
          itemStyle: { borderColor: "var(--bg)", borderWidth: 1, gapWidth: 1 },
          data: nodes,
        },
      ],
    }),
    [nodes],
  );

  return (
    <TileCard title="Heatmap" infoHash="concentration">
      {isLoading ? (
        <TileSkeleton />
      ) : nodes.length === 0 ? (
        <TileEmpty message="No positions to map yet." />
      ) : (
        <LazyChart
          option={option}
          ariaLabel="Portfolio heatmap by value and return"
          style={{ height: 360 }}
        />
      )}
    </TileCard>
  );
}

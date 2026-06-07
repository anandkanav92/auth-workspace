import { useMemo } from "react";

import { diversificationScores } from "./diversificationMath";
import { TileCard, TileEmpty, TileSkeleton } from "./TileCard";
import { usePortfolioData } from "./usePortfolioData";
import type { TileProps } from "./types";

/**
 * M11.4 — diversification headline + sub-scores (reviewer fix B4).
 *
 * Headline = Effective N (= 1/overall_HHI) in an SVG circular progress ring.
 * The ring fills by how close Effective N is to the raw position count (a
 * perfectly equal-weighted book fills the ring; concentration shrinks it).
 * Beneath: sector / geo / currency Effective-N sub-scores, all with ETF
 * look-through baked into the underlying allocation buckets.
 */
function CircularProgress({
  fraction,
  label,
}: {
  fraction: number;
  label: string;
}) {
  const size = 132;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, fraction));
  const offset = circumference * (1 - clamped);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Effective number of holdings: ${label}`}
      className="mx-auto"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--muted)"
        strokeOpacity={0.18}
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="46%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-fg"
        style={{ fontSize: 28, fontWeight: 700 }}
      >
        {label}
      </text>
      <text
        x="50%"
        y="64%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-muted"
        style={{ fontSize: 11 }}
      >
        effective
      </text>
    </svg>
  );
}

function SubScore({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-muted/10 p-2">
      <span className="text-base font-semibold tabular-nums text-fg">
        {value >= 10 ? value.toFixed(0) : value.toFixed(1)}
      </span>
      <span className="text-[11px] text-muted">{label}</span>
    </div>
  );
}

export function DiversificationScore({ accountIds }: TileProps) {
  const { data, isLoading } = usePortfolioData(accountIds);

  const scores = useMemo(
    () => (data ? diversificationScores(data.positions) : null),
    [data],
  );

  // Ring fills by Effective N relative to the raw position count — 1.0 means
  // perfectly equal-weighted; lower means concentrated.
  const fraction =
    scores && scores.positionCount > 0
      ? scores.effectiveN / scores.positionCount
      : 0;

  const headline =
    scores && scores.effectiveN >= 10
      ? scores.effectiveN.toFixed(0)
      : (scores?.effectiveN ?? 0).toFixed(1);

  return (
    <TileCard title="Diversification">
      {isLoading ? (
        <TileSkeleton />
      ) : !scores || scores.positionCount === 0 ? (
        <TileEmpty message="No positions to score yet." />
      ) : (
        <div>
          <CircularProgress fraction={fraction} label={headline} />
          <p className="mt-1 text-center text-xs text-muted">
            {headline} effective holdings across {scores.positionCount} positions
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <SubScore label="Sector" value={scores.sectorEffectiveN} />
            <SubScore label="Geo" value={scores.geoEffectiveN} />
            <SubScore label="Currency" value={scores.currencyEffectiveN} />
          </div>
        </div>
      )}
    </TileCard>
  );
}

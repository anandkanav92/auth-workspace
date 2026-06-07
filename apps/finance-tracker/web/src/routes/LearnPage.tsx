import { useEffect, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  ArrowUpDown,
  Coins,
  Gauge,
  Layers,
  PieChart,
  Share2,
  ShieldCheck,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * `/learn` — a plain-English glossary of every metric on the dashboard.
 *
 * The copy describes how THIS app actually computes each number (Yahoo prices,
 * ECB FX, harmonic P/E, effective-N diversification, ETF sector look-through),
 * not generic textbook definitions — so the page stays honest about the data's
 * limits (delayed prices, missing cost basis, ETF geo, etc.).
 *
 * Each section has a stable `id` so tiles can deep-link to it (the ⓘ on every
 * tile points at `/learn#<id>`); we scroll the target into view on navigation.
 */

interface MetricSectionProps {
  id: string;
  icon: LucideIcon;
  title: string;
  lede: string;
  formula?: string;
  children: ReactNode;
}

function MetricSection({
  id,
  icon: Icon,
  title,
  lede,
  formula,
  children,
}: MetricSectionProps) {
  return (
    <section
      id={id}
      // scroll-mt keeps the heading clear of the sticky header when deep-linked.
      className="scroll-mt-20 rounded-xl bg-surface p-5 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-fg">{title}</h2>
          <p className="mt-0.5 text-sm text-muted">{lede}</p>
        </div>
      </div>

      <div className="mt-3 space-y-2 text-sm leading-relaxed text-fg/90">
        {children}
      </div>

      {formula ? (
        <p className="mt-3 rounded-md bg-muted/10 px-3 py-2 font-mono text-xs text-muted">
          {formula}
        </p>
      ) : null}
    </section>
  );
}

export function LearnPage() {
  const hash = useRouterState({ select: (s) => s.location.hash });

  // Scroll the deep-linked section into view (TanStack restores scroll to top on
  // navigation; we honour an explicit #anchor ourselves so the ⓘ links land on
  // the right metric).
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-fg">
          Understanding your metrics
        </h1>
        <p className="text-sm text-muted">
          What each number on your dashboard means, and exactly how we work it
          out from your holdings.
        </p>
      </header>

      <MetricSection
        id="value"
        icon={Wallet}
        title="Total value"
        lede="What your holdings are worth right now, in euros."
        formula="Σ (quantity × latest price) → converted to EUR"
      >
        <p>
          We multiply each holding by its latest market price, then convert every
          position into euros so the whole book is comparable.
        </p>
        <p>
          Prices come from Yahoo Finance (delayed, refreshed through the trading
          day) and currency conversion uses the European Central Bank&rsquo;s
          daily reference rates. A position with no price yet is counted as €0 and
          flagged in the banner until its price loads.
        </p>
      </MetricSection>

      <MetricSection
        id="return"
        icon={TrendingUp}
        title="Total return"
        lede="Your gain or loss versus what you paid — over the whole holding period."
        formula="current value − cost basis  ·  % = return ÷ cost"
      >
        <p>
          This is your <strong>unrealised</strong> profit or loss, not today&rsquo;s
          move. It compares each position&rsquo;s current value against what it
          cost you.
        </p>
        <p>
          It only covers holdings where we know your purchase cost. Revolut
          statements don&rsquo;t include a cost basis, so those positions are
          excluded from the return (you&rsquo;ll see a note saying how many).
        </p>
      </MetricSection>

      <MetricSection
        id="allocation"
        icon={PieChart}
        title="Allocation"
        lede="Where your money actually sits — by sector, country, or currency."
        formula="ETF value is split across its underlying sector weights"
      >
        <p>
          ETFs are <em>looked through</em>: a global ETF spreads its value across
          the sectors it actually holds, rather than counting as one lump. An
          individual stock contributes its whole value to its single sector.
        </p>
        <p>
          Gold and other commodity products have no company sector, so they show
          as <em>Uncategorised</em>. For <strong>Country</strong>, ETFs are grouped
          as <em>Multiple/Diversified</em> (true country look-through is a later
          addition). <strong>Currency</strong> groups by each holding&rsquo;s
          listing currency.
        </p>
      </MetricSection>

      <MetricSection
        id="concentration"
        icon={Layers}
        title="Top holdings"
        lede="How much of the portfolio rides on your largest positions."
        formula="combined share of your 5 biggest holdings"
      >
        <p>
          We rank every position by value and add up the share held by your top
          few. A high top-5 share (say, over 60%) means your outcome depends
          heavily on a handful of names.
        </p>
      </MetricSection>

      <MetricSection
        id="movers"
        icon={ArrowUpDown}
        title="Movers"
        lede="Your biggest winners and losers, by percentage return."
        formula="ranked by (current value − cost) ÷ cost"
      >
        <p>
          We rank each position by its unrealised return and surface the top
          gainers and losers. Like Total return, this needs a cost basis — so it
          covers your Trading 212 holdings, not cost-less Revolut positions.
        </p>
      </MetricSection>

      <MetricSection
        id="diversification"
        icon={Share2}
        title="Diversification — effective holdings"
        lede="How many holdings you effectively own, once you account for size."
        formula="effective N = 1 ÷ Σ(weightᵢ²)   (inverse Herfindahl index)"
      >
        <p>
          Owning 36 positions doesn&rsquo;t mean much if one is 90% of the book.
          Effective N answers &ldquo;how many <em>equal-sized</em> holdings would
          give the same concentration?&rdquo;
        </p>
        <p>
          36 equally-weighted positions score 36; if a few dominate, the effective
          number drops well below your real count. The sub-scores apply the same
          idea to sector, geography, and currency — the closer each is to its raw
          count, the more evenly you&rsquo;re spread.
        </p>
      </MetricSection>

      <MetricSection
        id="health"
        icon={ShieldCheck}
        title="Health checks"
        lede="Quick concentration guardrails, as a pass/warn checklist."
        formula="largest position ≤ 10% · top sector ≤ 30% · top country ≤ 60%"
      >
        <p>
          A handful of rules of thumb from common diversification guidance: no
          single position dominating (over ~10%), no sector over ~30%, and no
          single country over ~60% (a home/foreign-bias flag). We also check that
          every position has a live price. An amber flag is a nudge to look, not a
          verdict — concentration can be deliberate.
        </p>
      </MetricSection>

      <MetricSection
        id="quality"
        icon={Gauge}
        title="Quality — P/E and beta"
        lede="Two size-weighted gauges of how your book is priced and how it moves."
        formula="weighted P/E (harmonic mean)  ·  weighted beta (arithmetic mean)"
      >
        <p>
          <strong>Weighted P/E</strong> is your portfolio&rsquo;s average
          price-to-earnings, weighted by position size and combined with a
          harmonic mean (the right way to average ratios). Loss-making companies
          (negative P/E) and funds with no P/E are left out. Lower means you&rsquo;re
          paying less per euro of earnings.
        </p>
        <p>
          <strong>Weighted beta</strong> measures how much your book tends to move
          relative to the market. β = 1 moves with the market; above 1 is more
          volatile, below 1 less, and a negative beta tends to move the opposite
          way. Holdings without beta data are skipped.
        </p>
      </MetricSection>

      <MetricSection
        id="income"
        icon={Coins}
        title="Income & yield"
        lede="A rough estimate of the dividends your holdings might pay in a year."
        formula="Σ (position value × dividend yield)  ·  yield = income ÷ total value"
      >
        <p>
          We add up each position&rsquo;s value times its dividend yield. Holdings
          with no yield data are skipped, so treat this as a floor — an
          approximation, not a promise. Dividends can be cut, raised, or paused.
        </p>
      </MetricSection>

      <p className="px-1 pb-2 text-xs text-muted">
        Prices are delayed and provided for information only — this is not
        investment advice.
      </p>
    </div>
  );
}

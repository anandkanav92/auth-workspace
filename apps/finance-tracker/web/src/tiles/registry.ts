/**
 * Modular tile registry (design §7).
 *
 * Each tile is `{ id, title, component }` where `component` is a React component
 * accepting {@link TileProps}. The dashboard maps over this list to render the
 * grid, so adding a tile is one file + one line here — no dashboard changes.
 *
 * Phase 1 tiles 1–3 (Allocation, Concentration, Diversification) plus Income,
 * Quality, and the full-width Treemap (design §7) are wired here. Adding a tile
 * is one file + one line in this list.
 */

import type { ComponentType } from "react";

import { Allocation } from "./Allocation";
import { Concentration } from "./Concentration";
import { DiversificationScore } from "./DiversificationScore";
import { Income } from "./Income";
import { Quality } from "./Quality";
import type { TileProps } from "./types";

export interface TileDef {
  id: string;
  title: string;
  component: ComponentType<TileProps>;
  /** Render across the whole grid row (e.g. the Treemap heatmap). */
  fullWidth?: boolean;
}

export const PHASE_1_TILES: TileDef[] = [
  { id: "allocation", title: "Allocation", component: Allocation },
  { id: "concentration", title: "Top 5", component: Concentration },
  {
    id: "diversification",
    title: "Diversification",
    component: DiversificationScore,
  },
  { id: "income", title: "Income", component: Income },
  { id: "quality", title: "Quality", component: Quality },
];

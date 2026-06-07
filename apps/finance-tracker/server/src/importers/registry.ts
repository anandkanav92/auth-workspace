// Importer registry (Strategy selection, Task 6.4). The upload route extracts
// the statement's full text once and asks each registered importer's detect()
// whether it owns this file. Adding a new broker = adding one importer here.

import { trading212Importer } from './trading212';
import { revolutImporter } from './revolut';
import type { StatementImporter } from './types';

export const importers: StatementImporter[] = [
  trading212Importer,
  revolutImporter,
];

/**
 * Pick the importer that recognises `text` (the full concatenated statement
 * text), or null if none match.
 */
export function detectImporter(text: string): StatementImporter | null {
  return importers.find((imp) => imp.detect(text)) ?? null;
}

import type { Sheet } from "./types";

/**
 * Grouping sheets under the GM's own categories.
 *
 * A category is free text on the sheet rather than a list kept somewhere
 * central: how a table wants its adversaries filed changes from session to
 * session, and a stored list would cost room metadata while going stale.
 * The cost of that choice is that two spellings make two groups, which is
 * why the editor suggests the categories already in use.
 */

/** Shown for sheets with no category, so they are never hidden. */
export const UNGROUPED = "Sin categoría";

export interface SheetGroup {
  /** The category as written, or UNGROUPED. */
  name: string;
  /** True when this is the catch-all group rather than a real category. */
  ungrouped: boolean;
  sheets: Sheet[];
}

function categoryOf(sheet: Sheet): string {
  if (sheet.kind === "character") return "";
  return sheet.category.trim();
}

/**
 * Splits sheets into groups, in the order they will be shown.
 *
 * Categories sort alphabetically, and the uncategorised group always comes
 * last: it is a leftovers pile rather than a real heading, so it should not
 * sit between two real ones.
 *
 * Grouping is by the category's exact text. Comparing case-insensitively
 * would merge "Bosque" and "bosque" in the list while the sheets still
 * carried different values, so the suggestions in the editor are what keep
 * spellings consistent.
 */
export function groupByCategory(sheets: Sheet[]): SheetGroup[] {
  const groups = new Map<string, Sheet[]>();
  const loose: Sheet[] = [];

  for (const sheet of sheets) {
    const category = categoryOf(sheet);
    if (!category) {
      loose.push(sheet);
      continue;
    }

    const existing = groups.get(category);
    if (existing) existing.push(sheet);
    else groups.set(category, [sheet]);
  }

  const named = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, grouped]) => ({ name, ungrouped: false, sheets: grouped }));

  if (loose.length > 0) {
    named.push({ name: UNGROUPED, ungrouped: true, sheets: loose });
  }

  return named;
}

/**
 * Every category already in use, for the editor's suggestions.
 *
 * Offering what the GM has already typed is what keeps one group from
 * splitting into three over a stray capital or plural.
 */
export function usedCategories(sheets: Sheet[]): string[] {
  const seen = new Set<string>();
  for (const sheet of sheets) {
    const category = categoryOf(sheet);
    if (category) seen.add(category);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

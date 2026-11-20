import type { Sheet, Track } from "./types";

/**
 * Which tracks a token shows above itself, and in what order.
 *
 * Kept free of Owlbear so the rules can be tested directly: the caller
 * passes a sheet and gets back the bars to draw.
 */

export interface TrackBar {
  /** Stable within a token, so a bar can be matched and updated in place. */
  key: string;
  label: string;
  /** Pips filled, already clamped to `max`. */
  marked: number;
  max: number;
  /** Bar colour, as a CSS hex string. */
  color: string;
  /**
   * Whether a filled pip is the bad outcome.
   *
   * HP and Stress count damage taken, so a full bar is trouble. Hope and
   * Armor count a resource held, so a full bar is good. The difference
   * decides nothing about the drawing, but it documents why Hope is not
   * drawn in red.
   */
  depleting: boolean;
}

/** Colours chosen to stay apart at token size, dark map or light. */
const COLORS = {
  hp: "#d64545",
  stress: "#e09b3d",
  hope: "#f5d76e",
  armor: "#6aa9d6",
} as const;

function clamp(track: Track): { marked: number; max: number } {
  const max = Math.max(0, Math.floor(track.max));
  const marked = Math.min(Math.max(0, Math.floor(track.marked)), max);
  return { marked, max };
}

/**
 * The bars for a sheet, topmost first.
 *
 * A track with no pips at all is skipped: an adversary with no armour
 * should not carry an empty bar that never changes.
 */
export function trackBars(sheet: Sheet): TrackBar[] {
  const bars: TrackBar[] = [];

  const add = (
    key: keyof typeof COLORS,
    label: string,
    track: Track,
    depleting: boolean,
  ) => {
    const { marked, max } = clamp(track);
    if (max <= 0) return;
    bars.push({ key, label, marked, max, color: COLORS[key], depleting });
  };

  if (sheet.kind === "character") {
    add("hp", "PV", sheet.hp, true);
    add("stress", "Estrés", sheet.stress, true);
    add("hope", "Esperanza", sheet.hope, false);
    add("armor", "Armadura", sheet.armor, false);
    return bars;
  }

  if (sheet.kind === "adversary") {
    // An adversary has no Hope and no armour track in the rules.
    add("hp", "PV", sheet.hp, true);
    add("stress", "Estrés", sheet.stress, true);
    return bars;
  }

  // An environment has no tracks to show.
  return bars;
}

/**
 * Whether two sets of bars would draw identically.
 *
 * Redrawing writes to scene items, which syncs to every player, so a token
 * whose sheet changed in some unrelated way should not churn the scene.
 */
export function sameBars(a: TrackBar[], b: TrackBar[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((bar, index) => {
    const other = b[index];
    return (
      !!other &&
      bar.key === other.key &&
      bar.marked === other.marked &&
      bar.max === other.max
    );
  });
}

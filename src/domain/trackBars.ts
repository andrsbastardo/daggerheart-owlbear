import type { Sheet, Track } from "./types";

/**
 * What a token displays about its sheet.
 *
 * One wide bar for the track that changes most in play, and a value in each
 * corner for the numbers consulted at a glance. Kept free of Owlbear so the
 * rules can be tested directly: the caller passes a sheet and gets back
 * what to draw.
 */

/** Where a corner value sits, relative to the token. */
export type Corner =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface TokenBar {
  /** Pips filled, already clamped to `max`. */
  marked: number;
  max: number;
  /** Shown on the bar, e.g. "3/7". */
  text: string;
  color: string;
}

/** The badge outline a value is drawn in. */
export type BadgeShape = "diamond" | "hexagon";

export interface CornerValue {
  /** Stable per token, so a value can be matched across redraws. */
  key: string;
  corner: Corner;
  /** The number itself, with no maximum: the shape stays readable small. */
  text: string;
  shape: BadgeShape;
  /**
   * The badge's outline colour.
   *
   * The badge itself is white with a dark number, so the outline is what
   * tells one value from another at a glance.
   */
  color: string;
  /** Spoken label, used for the item's name in the scene. */
  label: string;
}

export interface TokenDisplay {
  bar?: TokenBar;
  corners: CornerValue[];
}

/** Outline colours, kept apart at token size on dark maps and light. */
const COLORS = {
  hp: "#c0392b",
  stress: "#e8c33a",
  hope: "#8a8a93",
  armor: "#8a8a93",
  evasion: "#3aa655",
} as const;

function clamp(track: Track): { marked: number; max: number } {
  const max = Math.max(0, Math.floor(track.max));
  const marked = Math.min(Math.max(0, Math.floor(track.marked)), max);
  return { marked, max };
}

/**
 * What to draw for a sheet.
 *
 * HP takes the bar: it is what changes on every hit, and the one number the
 * table reads constantly. The rest are corner badges.
 *
 * A track with no pips at all is skipped rather than drawn empty, so a
 * character with no armour carries no armour badge.
 */
export function tokenDisplay(sheet: Sheet): TokenDisplay {
  const corners: CornerValue[] = [];

  const addTrack = (
    key: keyof typeof COLORS,
    label: string,
    corner: Corner,
    shape: BadgeShape,
    track: Track,
  ) => {
    const { marked, max } = clamp(track);
    if (max <= 0) return;
    corners.push({
      key,
      corner,
      text: String(marked),
      shape,
      color: COLORS[key],
      label,
    });
  };

  if (sheet.kind === "character") {
    const hp = clamp(sheet.hp);

    // Diamonds on the left, hexagons on the right.
    addTrack("hope", "Esperanza", "top-left", "diamond", sheet.hope);
    addTrack("stress", "Estrés", "bottom-left", "diamond", sheet.stress);
    addTrack("armor", "Armadura", "top-right", "hexagon", sheet.armor);

    // Evasion is a flat number rather than a track, so it is always shown.
    corners.push({
      key: "evasion",
      corner: "bottom-right",
      text: String(sheet.evasion),
      shape: "hexagon",
      color: COLORS.evasion,
      label: "Evasión",
    });

    return {
      bar:
        hp.max > 0
          ? {
              ...hp,
              text: `${hp.marked}/${hp.max}`,
              color: COLORS.hp,
            }
          : undefined,
      corners,
    };
  }

  if (sheet.kind === "adversary") {
    const hp = clamp(sheet.hp);
    addTrack("stress", "Estrés", "bottom-left", "diamond", sheet.stress);

    return {
      bar:
        hp.max > 0
          ? { ...hp, text: `${hp.marked}/${hp.max}`, color: COLORS.hp }
          : undefined,
      corners,
    };
  }

  // An environment has nothing to show on the map.
  return { corners: [] };
}

/**
 * Whether two displays would draw identically.
 *
 * Redrawing writes to scene items, which syncs to every player, so a sheet
 * edit that changes no displayed number must not churn the scene.
 */
export function sameDisplay(a: TokenDisplay, b: TokenDisplay): boolean {
  if ((a.bar === undefined) !== (b.bar === undefined)) return false;
  if (a.bar && b.bar) {
    if (a.bar.marked !== b.bar.marked || a.bar.max !== b.bar.max) {
      return false;
    }
  }

  if (a.corners.length !== b.corners.length) return false;
  return a.corners.every((corner, index) => {
    const other = b.corners[index];
    return (
      !!other &&
      corner.key === other.key &&
      corner.text === other.text &&
      corner.corner === other.corner
    );
  });
}

/** True when there is nothing at all to draw for this sheet. */
export function isEmptyDisplay(display: TokenDisplay): boolean {
  return !display.bar && display.corners.length === 0;
}

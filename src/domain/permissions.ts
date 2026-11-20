import type { DomainCard, Sheet } from "./types";

export type Role = "GM" | "PLAYER";

export interface Viewer {
  id: string;
  role: Role;
}

/**
 * Owlbear Rodeo has no per-field write permissions: room metadata is
 * writable by everyone in the room. These rules are enforced in the UI,
 * and re-checked in the store before every write, so a player cannot
 * edit another player's sheet or a GM-only sheet through normal use.
 */

export function canView(sheet: Sheet, viewer: Viewer): boolean {
  if (viewer.role === "GM") return true;
  // Adversaries and environments are GM-only.
  if (sheet.kind !== "character") return false;
  // Players see every character sheet (party visibility), own or not.
  return true;
}

export function canEdit(sheet: Sheet, viewer: Viewer): boolean {
  if (viewer.role === "GM") return true;
  if (sheet.kind !== "character") return false;
  return sheet.ownerId === viewer.id;
}

/** Only the GM may spend or gain Fear. */
export function canEditFear(viewer: Viewer): boolean {
  return viewer.role === "GM";
}

export function canCreate(
  kind: Sheet["kind"],
  viewer: Viewer,
): boolean {
  if (viewer.role === "GM") return true;
  return kind === "character";
}

export function canDelete(sheet: Sheet, viewer: Viewer): boolean {
  // Deleting is destructive and affects the whole table: GM only,
  // except a player may delete their own character.
  if (viewer.role === "GM") return true;
  return sheet.kind === "character" && sheet.ownerId === viewer.id;
}

export function visibleSheets(sheets: Sheet[], viewer: Viewer): Sheet[] {
  return sheets.filter((sheet) => canView(sheet, viewer));
}

/**
 * Whether a card's text may be read on someone else's sheet.
 *
 * A player may keep cards private so an unplayed hand stays hidden. Playing a
 * card is a separate act that publishes its text to the log regardless.
 */
export function canViewCard(
  card: DomainCard,
  sheet: Sheet,
  viewer: Viewer,
): boolean {
  if (viewer.role === "GM") return true;
  if (sheet.ownerId === viewer.id) return true;
  return card.visibleToParty;
}

/** Only the sheet's owner (or the GM) may play its cards. */
export function canPlayCard(sheet: Sheet, viewer: Viewer): boolean {
  return canEdit(sheet, viewer);
}

/** Clearing the shared log affects the whole table, so GM only. */
export function canClearLog(viewer: Viewer): boolean {
  return viewer.role === "GM";
}

export function visibleCards(sheet: Sheet, viewer: Viewer): DomainCard[] {
  if (sheet.kind !== "character") return [];
  return sheet.domainCards.filter((card) =>
    canViewCard(card, sheet, viewer),
  );
}

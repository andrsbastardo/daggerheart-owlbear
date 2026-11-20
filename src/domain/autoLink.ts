import type { Sheet } from "./types";

/**
 * Deciding which token a player's character sheet should attach itself to.
 *
 * Kept free of Owlbear so the rules can be tested directly: the caller passes
 * in what it saw in the scene, and gets back what to do.
 */

export interface TokenFacts {
  id: string;
  /** Who dropped the token into the scene. */
  createdUserId: string;
  /** The sheet id already written on the token, if any. */
  linkedSheetId?: string;
  /** Whether the token already carries a full sheet of its own. */
  hasOwnSheet?: boolean;
  /** How long the token has been in the scene, in milliseconds. */
  ageMs?: number;
}

export type AutoLinkPlan =
  | { action: "none" }
  /** Too soon to tell: owlbear-persistence may still restore this token. */
  | { action: "wait"; tokenId: string }
  | { action: "link"; tokenId: string; sheetId: string }
  | { action: "create-and-link"; tokenId: string };

/**
 * Works out whether a player's newly dropped token should get their sheet.
 *
 * The rules, chosen with the table in mind:
 *
 * - Only the player's own tokens count. The GM drops adversaries, props and
 *   scenery, so their tokens are left alone entirely.
 * - Only one token gets the sheet. A player who also brings a mount, a
 *   summon or a marker should not see their character sheet on all of them,
 *   so once any of their tokens carries the sheet, the rest stay free.
 * - A token someone already linked by hand is never re-pointed.
 * - A token that already carries its own sheet is left alone: it came back
 *   from another scene with its data, and overwriting it would discard it.
 * - Nothing is written until the grace period has passed, because
 *   owlbear-persistence restores a key only while it is absent. Claiming it
 *   first would lock the token out of its own history.
 */
export function planAutoLink(
  tokens: TokenFacts[],
  viewerId: string,
  viewerRole: "GM" | "PLAYER",
  sheets: Sheet[],
  graceMs = 0,
): AutoLinkPlan {
  if (viewerRole === "GM") return { action: "none" };

  const mine = tokens.filter((token) => token.createdUserId === viewerId);
  if (mine.length === 0) return { action: "none" };

  const ownSheet = sheets.find(
    (sheet) => sheet.kind === "character" && sheet.ownerId === viewerId,
  );

  /*
   * If one of my tokens already points at my sheet, the job is done. This is
   * what keeps the rule at "only the first token": every later drop sees the
   * earlier link and stops here.
   */
  if (ownSheet) {
    const alreadyLinked = mine.some(
      (token) => token.linkedSheetId === ownSheet.id,
    );
    if (alreadyLinked) return { action: "none" };
  }

  /*
   * A token restored by persistence already has everything it needs, whether
   * that is a pointer or a whole sheet. Those are not candidates.
   */
  const free = mine.find(
    (token) => !token.linkedSheetId && !token.hasOwnSheet,
  );
  if (!free) return { action: "none" };

  // Give persistence its chance before claiming the metadata key.
  if (graceMs > 0 && (free.ageMs ?? 0) < graceMs) {
    return { action: "wait", tokenId: free.id };
  }

  return ownSheet
    ? { action: "link", tokenId: free.id, sheetId: ownSheet.id }
    : { action: "create-and-link", tokenId: free.id };
}

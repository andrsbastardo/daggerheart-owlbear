import type { Sheet } from "./types";

/**
 * Where a sheet is persisted.
 *
 * Having a token is what decides it, not the kind of sheet. A sheet on its
 * token costs the room's shared 16 KB budget nothing, and the
 * owlbear-persistence extension carries the token's metadata into the next
 * scene. Room metadata holds only the sheets with no token yet, so a
 * character can exist before anyone drops a token for it.
 *
 * This lives in the domain rather than the Owlbear layer so it can be
 * tested without the SDK, which needs a browser to load.
 */
export function sheetStore(sheet: Sheet): "room" | "token" {
  return sheet.tokenId ? "token" : "room";
}

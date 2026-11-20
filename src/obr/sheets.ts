import type { Sheet } from "../domain/types";
import { deleteSheet as deleteRoomSheet, upsertSheet } from "./store";
import { deleteTokenSheet, saveTokenSheet } from "./tokenSheets";
import { declarePersistedKeys } from "./persistence";
import { sheetStore } from "../domain/storage";

/**
 * One door for writing a sheet, whichever store it belongs to.
 *
 * A sheet lives on its token whenever it has one, which keeps the room's
 * shared 16 KB budget free and lets owlbear-persistence carry it between
 * scenes. A character with no token yet falls back to room metadata so it
 * still exists before anyone drops a token for it.
 *
 * Routing here means callers never have to remember which, and the two paths
 * cannot drift apart.
 */
export async function saveSheet(sheet: Sheet): Promise<void> {
  if (sheetStore(sheet) === "room") {
    await upsertSheet(sheet);
    return;
  }

  // A token-backed sheet needs a token to be saved to.
  if (!sheet.tokenId) {
    throw new Error("Una ficha guardada en el token necesita un token");
  }

  await saveTokenSheet(sheet.tokenId, sheet);
  await declarePersistedKeys(sheet.tokenId);

  /*
   * A character that used to live in room metadata leaves no copy behind
   * once it has a token: two copies would drift, and the stale one would
   * reappear as a duplicate in the list.
   */
  if (sheet.kind === "character") {
    await deleteRoomSheet(sheet.id).catch(() => undefined);
  }
}

export async function removeSheet(sheet: Sheet): Promise<void> {
  // A character may have a copy in either place, so clear both.
  if (sheet.kind === "character") {
    await deleteRoomSheet(sheet.id).catch(() => undefined);
  }

  if (sheet.tokenId) await deleteTokenSheet(sheet.tokenId);
}

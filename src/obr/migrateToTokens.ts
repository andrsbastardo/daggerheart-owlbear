import OBR, { isImage } from "@owlbear-rodeo/sdk";
import { ITEM_SHEET_DATA_KEY } from "./constants";
import { declarePersistedKeys } from "./persistence";
import { readState, updateState } from "./store";

/**
 * Moves sheets out of room metadata and onto their tokens.
 *
 * Sheets used to live in room metadata, which overran Owlbear's 16 KB room
 * budget — shared with every other extension. A sheet on its token costs
 * that budget nothing, and owlbear-persistence carries the token's metadata
 * into the next scene. Rooms from before that change still hold sheets in
 * the room, so they are relocated once, on the GM's first load of a scene.
 *
 * Characters are included: they are the bulk of the data. Only sheets whose
 * token is in the open scene can move, since a token elsewhere cannot be
 * written to. A sheet without a token stays where it is rather than being
 * discarded, and moves on a later run once it has one.
 *
 * Nothing is deleted that was not successfully copied first.
 */
export async function migrateSheetsToTokens(): Promise<number> {
  const state = await readState();

  const strays = Object.values(state.sheets);
  if (strays.length === 0) return 0;

  // Only sheets whose token still exists in this scene can be moved.
  const items = await OBR.scene.items.getItems(isImage);
  const present = new Set(items.map((item) => item.id));

  const movable = strays.filter(
    (sheet) => sheet.tokenId && present.has(sheet.tokenId),
  );
  if (movable.length === 0) return 0;

  for (const sheet of movable) {
    const tokenId = sheet.tokenId!;
    await OBR.scene.items.updateItems([tokenId], (targets) => {
      for (const target of targets) {
        target.metadata[ITEM_SHEET_DATA_KEY] = { ...sheet };
      }
    });
    // Tell persistence to carry it, so the move is not undone by the next
    // scene change.
    await declarePersistedKeys(tokenId);
  }

  // Remove from room metadata only after every copy landed, so a failure
  // part-way through leaves the originals intact.
  const movedIds = new Set(movable.map((sheet) => sheet.id));
  await updateState((current) => {
    for (const id of movedIds) delete current.sheets[id];
    return current;
  });

  return movable.length;
}

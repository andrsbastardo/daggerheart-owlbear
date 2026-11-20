import OBR, { isImage, type Item } from "@owlbear-rodeo/sdk";
import { ITEM_SHEET_KEY } from "./constants";

/**
 * Sheets are linked to tokens by writing the sheet id into the item's own
 * metadata. That keeps the link with the scene (so it survives reloads and
 * is visible to everyone) rather than in our own state, and means deleting
 * a token cleanly orphans the sheet instead of corrupting it.
 */

export function getSheetIdFromItem(item: Item): string | undefined {
  const value = item.metadata[ITEM_SHEET_KEY];
  return typeof value === "string" ? value : undefined;
}

export async function linkSheetToToken(
  itemId: string,
  sheetId: string,
): Promise<void> {
  await OBR.scene.items.updateItems([itemId], (items) => {
    for (const item of items) {
      item.metadata[ITEM_SHEET_KEY] = sheetId;
    }
  });
}

export async function unlinkToken(itemId: string): Promise<void> {
  await OBR.scene.items.updateItems([itemId], (items) => {
    for (const item of items) {
      delete item.metadata[ITEM_SHEET_KEY];
    }
  });
}

/** All image tokens in the scene, which are the only items worth linking. */
export async function getTokens(): Promise<Item[]> {
  return OBR.scene.items.getItems(isImage);
}

export function onTokensChange(
  callback: (items: Item[]) => void,
): () => void {
  return OBR.scene.items.onChange((items) => {
    callback(items.filter(isImage));
  });
}

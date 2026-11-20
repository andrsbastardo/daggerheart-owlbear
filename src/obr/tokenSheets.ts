import OBR, { isImage, type Item } from "@owlbear-rodeo/sdk";
import type { Sheet } from "../domain/types";
import { migrateSheet } from "../domain/migrate";
import { ITEM_SHEET_DATA_KEY } from "./constants";

/**
 * Sheets stored on the token itself — characters included.
 *
 * Owlbear gives a whole room 16 KB of metadata shared with every other
 * extension, which the party's character sheets alone can fill. An item
 * carries its own metadata, so a sheet on its token costs that budget
 * nothing.
 *
 * Item metadata belongs to the scene, so on its own a sheet would vanish
 * when the map changed. The owlbear-persistence extension is what closes
 * that gap: it snapshots a token's metadata while the scene is open and
 * restores it onto the matching token in the next one. See `persistence.ts`
 * for exactly what we assume of it.
 */

export type TokenSheet = Sheet;

function readSheet(item: Item): TokenSheet | undefined {
  const raw = item.metadata[ITEM_SHEET_DATA_KEY];
  if (!raw) return undefined;

  const sheet = migrateSheet(raw);
  if (!sheet) return undefined;

  // The token is the sheet's home, so its id is authoritative over
  // whatever was serialised alongside it.
  return { ...sheet, tokenId: item.id };
}

/** Every sheet carried by a token in the open scene, in no order. */
export async function getTokenSheets(): Promise<TokenSheet[]> {
  const items = await OBR.scene.items.getItems(isImage);
  return items.flatMap((item) => {
    const sheet = readSheet(item);
    return sheet ? [sheet] : [];
  });
}

export function onTokenSheetsChange(
  callback: (sheets: TokenSheet[]) => void,
): () => void {
  return OBR.scene.items.onChange((items) => {
    callback(
      items.flatMap((item) => {
        const sheet = readSheet(item);
        return sheet ? [sheet] : [];
      }),
    );
  });
}

export async function saveTokenSheet(
  tokenId: string,
  sheet: TokenSheet,
): Promise<void> {
  await OBR.scene.items.updateItems([tokenId], (items) => {
    for (const item of items) {
      item.metadata[ITEM_SHEET_DATA_KEY] = {
        ...sheet,
        tokenId,
        updatedAt: Date.now(),
      };
    }
  });
}

export async function deleteTokenSheet(tokenId: string): Promise<void> {
  await OBR.scene.items.updateItems([tokenId], (items) => {
    for (const item of items) {
      delete item.metadata[ITEM_SHEET_DATA_KEY];
    }
  });
}

import OBR from "@owlbear-rodeo/sdk";
import {
  ITEM_SHEET_DATA_KEY,
  ITEM_SHEET_KEY,
  PERSISTENCE_KEYS_KEY,
} from "./constants";

/**
 * Interop with the owlbear-persistence extension (com.desain.persistence).
 *
 * That extension snapshots a token's metadata while a scene is open and
 * restores it onto a matching token in the next scene, which is what carries
 * our sheets across scene changes. It is a separate extension by another
 * author, so this module holds everything we assume about it, in one place.
 *
 * What we rely on, and what we do not:
 *
 * - It saves a token's whole metadata, so our keys travel without being
 *   declared. Declaring them anyway states our intent and is the documented
 *   contract, so a future version that does filter keeps working.
 * - It restores a key only while that key is absent on the token. Anything
 *   we write to a fresh token therefore blocks its own restore, which is why
 *   `useAutoLink` yields first.
 * - Its records live in the GM's browser, keyed by the token's image URL.
 *   Two characters sharing an image share a record, and clearing that
 *   browser's data loses them.
 */

/** The metadata keys we want persistence to carry between scenes. */
const OUR_KEYS = [ITEM_SHEET_KEY, ITEM_SHEET_DATA_KEY];

/**
 * Declares our keys on a token, preserving any another extension set.
 *
 * The value must be an array of strings: persistence validates the shape and
 * stops treating the item as a token at all if it is anything else, which
 * would silently disable persistence for that token.
 */
export async function declarePersistedKeys(tokenId: string): Promise<void> {
  await OBR.scene.items
    .updateItems([tokenId], (items) => {
      for (const item of items) {
        const existing = item.metadata[PERSISTENCE_KEYS_KEY];
        const previous = Array.isArray(existing)
          ? existing.filter((key): key is string => typeof key === "string")
          : [];

        item.metadata[PERSISTENCE_KEYS_KEY] = [
          ...new Set([...previous, ...OUR_KEYS]),
        ];
      }
    })
    .catch(() => {
      // Persistence saves everything regardless, so a failure here costs
      // nothing today. Not worth interrupting the player over.
    });
}

/**
 * Whether a token looks like persistence will carry it.
 *
 * Only a hint for the interface: the authoritative state lives in the GM's
 * own browser, which we cannot see from here.
 */
export function hasPersistedKeys(metadata: Record<string, unknown>): boolean {
  const value = metadata[PERSISTENCE_KEYS_KEY];
  if (!Array.isArray(value)) return false;
  return OUR_KEYS.every((key) => value.includes(key));
}

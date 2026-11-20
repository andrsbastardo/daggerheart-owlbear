import { useEffect, useMemo, useState } from "react";
import type { RoomState, Sheet } from "../domain/types";
import { sheetStore } from "../domain/storage";
import {
  getTokenSheets,
  onTokenSheetsChange,
  type TokenSheet,
} from "./tokenSheets";

/**
 * Every sheet the viewer can see, from both places they are stored.
 *
 * A sheet lives on its token once it has one: that keeps the room's shared
 * 16 KB budget free, and owlbear-persistence carries the token's data into
 * the next scene. Room metadata holds only the sheets that have no token
 * yet, so a character can exist before anyone drops a token for it.
 *
 * The cost of that choice is that a token-backed sheet is only listed while
 * its scene is open. The interface says so rather than letting it look like
 * the sheet was lost.
 *
 * Callers get one combined list and do not need to know which is which;
 * `sheetStore` says where a given sheet belongs when a write needs it.
 */
export function useSheets(
  ready: boolean,
  sceneReady: boolean,
  state: RoomState,
): Sheet[] {
  const [tokenSheets, setTokenSheets] = useState<TokenSheet[]>([]);

  useEffect(() => {
    if (!ready || !sceneReady) {
      // Without a scene there are no items, so no token sheets to show.
      setTokenSheets([]);
      return;
    }

    let cancelled = false;
    void getTokenSheets()
      .then((sheets) => {
        if (!cancelled) setTokenSheets(sheets);
      })
      // The scene can close mid-read; onChange will deliver the next one.
      .catch(() => undefined);

    const unsubscribe = onTokenSheetsChange(setTokenSheets);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [ready, sceneReady]);

  return useMemo(() => {
    /*
     * A character may briefly exist in both stores — it is written to its
     * token and then cleared from the room. The token copy wins, so a
     * half-finished move never shows the same character twice.
     */
    const onToken = new Set(tokenSheets.map((sheet) => sheet.id));
    const inRoom = Object.values(state.sheets).filter(
      (sheet) => !onToken.has(sheet.id),
    );

    return [...inRoom, ...tokenSheets];
  }, [state.sheets, tokenSheets]);
}

/** Re-exported so callers in this layer have one import for sheet storage. */
export { sheetStore };

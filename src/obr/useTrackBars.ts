import { useEffect, useRef } from "react";
import OBR, { isImage, type Item } from "@owlbear-rodeo/sdk";
import type { Sheet } from "../domain/types";
import type { Viewer } from "../domain/permissions";
import {
  sameDisplay,
  tokenDisplay,
  isEmptyDisplay,
  type TokenDisplay,
} from "../domain/trackBars";
import { migrateSheet } from "../domain/migrate";
import { getSheetIdFromItem } from "./tokens";
import { clearAllBars, syncTokenBars } from "./trackBars";
import { ITEM_SHEET_DATA_KEY } from "./constants";

/**
 * Keeps every token's bars matching its sheet.
 *
 * Only the GM runs this. The bars are scene items, so two clients drawing
 * them would each delete and re-add the other's work on every change; one
 * writer avoids that entirely, and the result syncs to every player anyway.
 *
 * Redrawing is skipped unless the numbers actually changed. Sheet edits
 * arrive constantly while someone types, and each redraw writes to the
 * scene for the whole table.
 */
export function useTrackBars(
  ready: boolean,
  sceneReady: boolean,
  viewer: Viewer | undefined,
  sheets: Sheet[],
): void {
  const sheetsRef = useRef(sheets);
  sheetsRef.current = sheets;

  /** What we last drew per token, to avoid pointless rewrites. */
  const drawn = useRef(new Map<string, TokenDisplay>());

  // One pass at a time: our own writes come back as item changes, so a
  // re-entrant pass would fight the one still running.
  const busy = useRef(false);
  const again = useRef(false);

  /** The running pass, so a sheet edit can trigger one. */
  const redraw = useRef<() => void>(undefined);

  useEffect(() => {
    if (!ready || !sceneReady || viewer?.role !== "GM") return;

    const sheetFor = (item: Item): Sheet | undefined => {
      // A sheet stored on the token wins, as everywhere else.
      const stored = migrateSheet(item.metadata[ITEM_SHEET_DATA_KEY]);
      if (stored) return { ...stored, tokenId: item.id };

      const sheetId = getSheetIdFromItem(item);
      if (!sheetId) return undefined;
      return sheetsRef.current.find((sheet) => sheet.id === sheetId);
    };

    const pass = async () => {
      if (busy.current) {
        // Coalesce: run once more after the current pass rather than
        // queueing one per event.
        again.current = true;
        return;
      }

      busy.current = true;
      try {
        do {
          again.current = false;

          const tokens = await OBR.scene.items.getItems(isImage);
          const live = new Set(tokens.map((token) => token.id));

          for (const token of tokens) {
            const sheet = sheetFor(token);
            const wanted: TokenDisplay = sheet
              ? tokenDisplay(sheet)
              : { corners: [] };
            const previous = drawn.current.get(token.id) ?? { corners: [] };

            if (sameDisplay(previous, wanted)) continue;

            await syncTokenBars(token, sheet);
            if (isEmptyDisplay(wanted)) drawn.current.delete(token.id);
            else drawn.current.set(token.id, wanted);
          }

          // Forget tokens that left, so the map does not grow all session.
          for (const id of drawn.current.keys()) {
            if (!live.has(id)) drawn.current.delete(id);
          }
        } while (again.current);
      } catch (error) {
        /*
         * The scene can close mid-pass, and a token can vanish between the
         * read and the write. Bars are decoration: the next change redraws
         * them, and failing loudly would interrupt play for nothing.
         *
         * Logged rather than swallowed outright, because a bar that never
         * appears is otherwise invisible to diagnose.
         */
        console.warn("[Daggerheart] no se pudieron dibujar las barras", error);
      } finally {
        busy.current = false;
      }
    };

    redraw.current = () => void pass();

    /*
     * Wipe every marker before the first pass.
     *
     * `drawn` is our memory of what is on the map, and it starts empty on
     * every load while the scene still holds whatever a previous session
     * drew. Without this, markers from an older layout are never
     * recognised as ours to replace and simply stay there. Clearing first
     * makes the scene match our memory instead of assuming it already
     * does.
     */
    void clearAllBars()
      .catch(() => undefined)
      .then(() => pass());
    const unsubscribe = OBR.scene.items.onChange(() => void pass());

    return () => {
      redraw.current = undefined;
      drawn.current.clear();
      unsubscribe();
    };
    /*
     * `sheets` is deliberately not a dependency: it is a new array on every
     * render, so listing it would tear down and rebuild the subscription
     * continuously, clearing `drawn` each time. The ref above carries the
     * latest sheets in, and the effect below re-runs a pass when they
     * change.
     */
  }, [ready, sceneReady, viewer?.role]);

  /*
   * Redraw when a sheet changes without the scene changing — editing HP in
   * the panel moves no item, so no item event would arrive.
   */
  useEffect(() => {
    if (!ready || !sceneReady || viewer?.role !== "GM") return;
    redraw.current?.();
  }, [ready, sceneReady, viewer?.role, sheets]);
}

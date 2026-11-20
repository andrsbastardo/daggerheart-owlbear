import { useEffect, useRef } from "react";
import OBR, { isImage, type Item } from "@owlbear-rodeo/sdk";
import type { Sheet } from "../domain/types";
import type { Viewer } from "../domain/permissions";
import { planAutoLink, type TokenFacts } from "../domain/autoLink";
import { createCharacter } from "../domain/factories";
import { saveSheet } from "./sheets";
import { getSheetIdFromItem, linkSheetToToken } from "./tokens";
import { declarePersistedKeys } from "./persistence";
import { AUTO_LINK_GRACE_MS, ITEM_SHEET_DATA_KEY } from "./constants";

/**
 * Attaches a player's character sheet to the token they drop in the scene.
 *
 * The token carries the sheet, so right-clicking it opens the character
 * without anyone having to press «Vincular token» first, and
 * owlbear-persistence carries that data into the next scene.
 *
 * The one subtlety is ordering. Persistence restores a metadata key only
 * while the key is *absent*, so a token returning from another scene must be
 * left untouched long enough for its own data to come back. We therefore
 * wait out a grace period and only claim tokens that are still empty
 * afterwards — those are the genuinely new ones.
 *
 * Each client only ever links its own tokens, which is also what keeps two
 * players from writing to the same item at once.
 */
export function useAutoLink(
  ready: boolean,
  sceneReady: boolean,
  viewer: Viewer | undefined,
  sheets: Sheet[],
): void {
  /*
   * The latest sheets, read inside the item subscription without making it
   * a dependency: re-subscribing on every sheet edit would tear down and
   * rebuild the listener continuously while someone types.
   */
  const sheetsRef = useRef(sheets);
  sheetsRef.current = sheets;

  // One link attempt at a time. An item change arrives for our own write
  // too, so without this the handler could re-enter before the first
  // finished and link twice.
  const busy = useRef(false);

  // When each token was first seen, so we can tell a fresh drop from a
  // token that has been sitting there since the scene loaded.
  const firstSeen = useRef(new Map<string, number>());

  // Pending re-check for a token still inside its grace period.
  const retry = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!ready || !sceneReady || !viewer || viewer.role === "GM") return;

    const consider = async (items: Item[]) => {
      if (busy.current) return;

      const now = Date.now();
      const tokens: TokenFacts[] = items.filter(isImage).map((item) => {
        let seen = firstSeen.current.get(item.id);
        if (seen === undefined) {
          seen = now;
          firstSeen.current.set(item.id, now);
        }

        return {
          id: item.id,
          createdUserId: item.createdUserId,
          linkedSheetId: getSheetIdFromItem(item),
          hasOwnSheet: item.metadata[ITEM_SHEET_DATA_KEY] !== undefined,
          ageMs: now - seen,
        };
      });

      // Forget tokens that left, so the map does not grow all session.
      const live = new Set(tokens.map((token) => token.id));
      for (const id of firstSeen.current.keys()) {
        if (!live.has(id)) firstSeen.current.delete(id);
      }

      const plan = planAutoLink(
        tokens,
        viewer.id,
        viewer.role,
        sheetsRef.current,
        AUTO_LINK_GRACE_MS,
      );

      if (plan.action === "none") return;

      /*
       * Still within the grace period. Nothing changes on its own once the
       * scene settles, so schedule our own re-check rather than waiting for
       * an item event that may never arrive.
       */
      if (plan.action === "wait") {
        clearTimeout(retry.current);
        retry.current = setTimeout(() => {
          void OBR.scene.items
            .getItems(isImage)
            .then(consider)
            // The scene can close while the call is in flight; there is
            // simply nothing to link then.
            .catch(() => undefined);
        }, AUTO_LINK_GRACE_MS);
        return;
      }

      busy.current = true;
      try {
        if (plan.action === "link") {
          await linkSheetToToken(plan.tokenId, plan.sheetId);
          await declarePersistedKeys(plan.tokenId);
          return;
        }

        // No sheet yet: give the player one named after them, so dropping a
        // token is all it takes to have something to fill in.
        const sheet = createCharacter(
          await OBR.player.getName().catch(() => "Mi personaje"),
          viewer.id,
        );
        await saveSheet({ ...sheet, tokenId: plan.tokenId });
        await linkSheetToToken(plan.tokenId, sheet.id);
        await declarePersistedKeys(plan.tokenId);
      } catch {
        // Linking is a convenience; the manual button still works. Staying
        // quiet avoids an error toast for something the player can redo.
      } finally {
        busy.current = false;
      }
    };

    void OBR.scene.items
      .getItems(isImage)
      .then(consider)
      .catch(() => undefined);
    const unsubscribe = OBR.scene.items.onChange(consider);

    return () => {
      clearTimeout(retry.current);
      firstSeen.current.clear();
      unsubscribe();
    };
  }, [ready, sceneReady, viewer?.id, viewer?.role]);
}

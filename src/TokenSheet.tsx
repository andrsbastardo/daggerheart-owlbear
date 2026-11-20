import { useEffect, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { canEdit } from "./domain/permissions";
import type { Sheet } from "./domain/types";
import { migrateSheet } from "./domain/migrate";
import { useObrReady, useRoomState, useViewer } from "./obr/useObr";
import { useDebouncedSheet } from "./obr/useDebouncedSheet";
import { getSheetIdFromItem } from "./obr/tokens";
import { ITEM_SHEET_DATA_KEY } from "./obr/constants";
import { SheetEditor } from "./components/SheetEditor";

/**
 * The popover opened from a token's context menu.
 *
 * A token carries a sheet in one of two ways: a GM sheet stored on the item
 * itself, or a pointer to a character held in room metadata. Both are
 * resolved here so the right-click behaves the same either way.
 */
export function TokenSheet() {
  const ready = useObrReady();
  const viewer = useViewer(ready);
  const state = useRoomState(ready);
  const [tokenSheet, setTokenSheet] = useState<Sheet>();
  const [sheetId, setSheetId] = useState<string>();
  const [resolved, setResolved] = useState(false);

  // The popover is opened for the current selection, so read from the
  // selected item and keep following it while the popover is open.
  useEffect(() => {
    if (!ready) return;

    const resolve = async () => {
      const selection = await OBR.player.getSelection();
      const itemId = selection?.[0];
      if (!itemId) {
        setTokenSheet(undefined);
        setSheetId(undefined);
        setResolved(true);
        return;
      }

      const [item] = await OBR.scene.items.getItems([itemId]);
      if (!item) {
        setTokenSheet(undefined);
        setSheetId(undefined);
        setResolved(true);
        return;
      }

      // A sheet stored on the token takes precedence: it is the token's own
      // data rather than a reference to one held elsewhere.
      const stored = migrateSheet(item.metadata[ITEM_SHEET_DATA_KEY]);
      setTokenSheet(stored ? { ...stored, tokenId: item.id } : undefined);
      setSheetId(getSheetIdFromItem(item));
      setResolved(true);
    };

    void resolve();
    return OBR.scene.items.onChange(() => void resolve());
  }, [ready]);

  const remote = tokenSheet ?? (sheetId ? state.sheets[sheetId] : undefined);
  const { draft, edit } = useDebouncedSheet(remote);

  if (!ready || !viewer || !resolved) {
    return (
      <div className="app">
        <div className="empty">Cargando…</div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="app">
        <div className="notice">
          Este token no tiene ficha vinculada. Abre el panel de Daggerheart,
          selecciona el token y pulsa «Vincular token».
        </div>
      </div>
    );
  }

  const readOnly = !canEdit(draft, viewer);

  return (
    <div className="app">
      {readOnly && (
        <div className="notice" style={{ marginBottom: 10 }}>
          Solo lectura.
        </div>
      )}
      <SheetEditor
        sheet={draft}
        readOnly={readOnly}
        viewer={viewer}
        onChange={edit}
        sheets={Object.values(state.sheets)}
      />
    </div>
  );
}

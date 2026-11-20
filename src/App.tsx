import { useEffect, useMemo, useRef, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import {
  canClearLog,
  canCreate,
  canDelete,
  canEdit,
  canEditFear,
  visibleSheets,
} from "./domain/permissions";
import {
  createAdversary,
  createCharacter,
  createDefaultDiceSlots,
  createEnvironment,
} from "./domain/factories";
import type { Sheet, SheetKind } from "./domain/types";
import { clearLog, setDiceSlots, setFear } from "./obr/store";
import { removeSheet, saveSheet } from "./obr/sheets";
import { deleteTokenSheet as removeTokenSheet } from "./obr/tokenSheets";
import { useSheets } from "./obr/useSheets";
import { migrateSheetsToTokens } from "./obr/migrateToTokens";
import {
  useObrReady,
  useRoomState,
  useSceneReady,
  useSelection,
  useViewer,
} from "./obr/useObr";
import { registerTokenContextMenu } from "./obr/contextMenu";
import { useToastPopover } from "./obr/useToastPopover";
import { useAutoLink } from "./obr/useAutoLink";
import { useTrackBars } from "./obr/useTrackBars";
import { clearTokenBars } from "./obr/trackBars";
import { useDebouncedSheet } from "./obr/useDebouncedSheet";
import { linkSheetToToken, unlinkToken } from "./obr/tokens";
import { SheetEditor } from "./components/SheetEditor";
import { FearPool } from "./components/FearPool";
import { SheetList } from "./components/SheetList";
import { LogPanel } from "./components/LogPanel";
import { DiceBar } from "./components/DiceBar";
import { rollSlot } from "./obr/roll";

/** The log is a view, not a sheet kind, so it gets its own tab value. */
type Tab = SheetKind | "log";

const TAB_LABELS: Record<Tab, string> = {
  character: "Personajes",
  adversary: "Adversarios",
  environment: "Entornos",
  log: "Registro",
};

export function App() {
  const ready = useObrReady();
  const viewer = useViewer(ready);
  const state = useRoomState(ready);
  const selection = useSelection(ready);
  const sceneReady = useSceneReady(ready);

  const [tab, setTab] = useState<Tab>("character");
  const [openId, setOpenId] = useState<string>();

  // Register the token right-click entry once we are connected.
  useEffect(() => {
    if (!ready) return;
    void registerTokenContextMenu();
  }, [ready]);

  // Shows the floating toast while there is something to show, and closes
  // it afterwards so no empty panel sits over the map.
  useToastPopover(ready, state);

  /*
   * Relocate sheets saved by an older version into their tokens.
   *
   * Only the GM runs it, and only once per scene load: it rewrites shared
   * room state, so several clients doing it at once would fight. The GM is
   * also the one who can write to every token, including the players'.
   */
  const migrated = useRef(false);
  useEffect(() => {
    if (!ready || !sceneReady || viewer?.role !== "GM") return;
    if (migrated.current) return;
    migrated.current = true;

    void migrateSheetsToTokens()
      .then((count) => {
        if (count > 0) {
          void OBR.notification.show(
            `${count} ${count === 1 ? "ficha movida" : "fichas movidas"} a sus tokens para liberar espacio de la sala.`,
            "SUCCESS",
          );
        }
      })
      .catch(() => {
        // Leaving the sheets where they are is safe; the next load retries.
        migrated.current = false;
      });
  }, [ready, sceneReady, viewer?.role]);

  // Sheets with no token from room metadata, the rest from the open scene.
  const allSheets = useSheets(ready, sceneReady, state);

  /*
   * A player who drops their token gets their sheet attached to it, so the
   * token's right-click opens the character without anyone pressing
   * «Vincular token». The sheet itself stays in room metadata.
   */
  useAutoLink(ready, sceneReady, viewer, allSheets);

  /*
   * Draw each token's tracks above it. GM-only: the bars are scene items,
   * so a single writer keeps clients from undoing each other's work, and
   * what it draws is visible to everyone.
   */
  useTrackBars(ready, sceneReady, viewer, allSheets);

  // Built once: the slot ids must stay stable across renders, or React would
  // remount the inputs mid-edit.
  const defaultSlots = useMemo(() => createDefaultDiceSlots(), []);

  // Looked up across both stores: a GM sheet is not in room metadata.
  const remoteOpen = openId
    ? allSheets.find((sheet) => sheet.id === openId)
    : undefined;
  const { draft, edit } = useDebouncedSheet(remoteOpen);

  if (!OBR.isAvailable) {
    return (
      <div className="app">
        <div className="notice">
          Esta página es una extensión de Owlbear Rodeo. Ábrela desde
          dentro de una sala de Owlbear Rodeo, no directamente en el
          navegador.
        </div>
      </div>
    );
  }

  if (!ready || !viewer) {
    return (
      <div className="app">
        <div className="empty">Conectando con Owlbear Rodeo…</div>
      </div>
    );
  }

  const isGm = viewer.role === "GM";
  const visible = visibleSheets(allSheets, viewer);
  const sheetTab: SheetKind | undefined = tab === "log" ? undefined : tab;
  const tabSheets = visible
    .filter((sheet) => sheet.kind === sheetTab)
    .sort((a, b) => a.name.localeCompare(b.name));

  const availableTabs: Tab[] = isGm
    ? ["character", "adversary", "environment", "log"]
    : ["character", "log"];

  /*
   * An adversary or environment is created straight onto a token, so one
   * must be selected. A character starts in room metadata and moves onto
   * its token when the player drops it, so it needs nothing selected.
   */
  const needsToken = sheetTab === "adversary" || sheetTab === "environment";
  const selectedToken = selection[0];
  const canCreateHere =
    !!sheetTab &&
    canCreate(sheetTab, viewer) &&
    (!needsToken || (sceneReady && selection.length === 1));

  const handleCreate = async () => {
    if (!sheetTab || !canCreateHere) return;

    if (sheetTab === "character") {
      const base = createCharacter(
        await OBR.player.getName().catch(() => "Nuevo personaje"),
        viewer.id,
      );

      /*
       * Born straight onto the selected token when there is one, so it is
       * persisted from the start. Otherwise it waits in room metadata and
       * moves across as soon as a token is linked.
       */
      const onToken = sceneReady && selection.length === 1 && selectedToken;
      const sheet = onToken ? { ...base, tokenId: selectedToken } : base;

      await saveSheet(sheet);
      if (onToken) await linkSheetToToken(selectedToken, sheet.id);
      setOpenId(sheet.id);
      return;
    }

    if (!selectedToken) return;

    const sheet: Sheet =
      sheetTab === "adversary"
        ? { ...createAdversary("Adversario nuevo"), tokenId: selectedToken }
        : { ...createEnvironment("Entorno nuevo"), tokenId: selectedToken };

    await saveSheet(sheet);
    setOpenId(sheet.id);
  };

  const handleDelete = async (sheet: Sheet) => {
    if (!canDelete(sheet, viewer)) return;
    if (sheet.tokenId) {
      // Clear the token's pointer so it does not dangle.
      await unlinkToken(sheet.tokenId).catch(() => undefined);
    }
    await removeSheet(sheet);
    setOpenId(undefined);
  };

  /*
   * A token-backed sheet is only listed while its scene is open, so say so
   * instead of letting an absent character look deleted.
   */
  const hiddenWithoutScene = !sceneReady;

  // A player's bar falls back to the defaults until they customise it, so
  // the dice work on first open without anyone configuring anything.
  const slots = state.diceSlots[viewer.id] ?? defaultSlots;

  const diceBar = (
    <DiceBar
      slots={slots}
      onRoll={(slot) => void rollSlot(slot, viewer, allSheets)}
      onChange={(next) => void setDiceSlots(viewer.id, next)}
    />
  );

  const handleLinkToken = async (sheet: Sheet) => {
    const tokenId = selection[0];
    if (!tokenId) return;
    await linkSheetToToken(tokenId, sheet.id);
    await saveSheet({ ...sheet, tokenId });
  };

  /*
   * Unlinking moves the sheet back into room metadata before the token
   * stops carrying it. Done the other way round the data would be gone
   * with the token's metadata and there would be nothing left to save.
   */
  const handleUnlinkToken = async (sheet: Sheet) => {
    await saveSheet({ ...sheet, tokenId: undefined });
    if (sheet.tokenId) {
      await unlinkToken(sheet.tokenId).catch(() => undefined);
      await removeTokenSheet(sheet.tokenId).catch(() => undefined);
      // Drop the bars now rather than waiting for the next scene event,
      // so the token does not keep a stale set for a moment.
      await clearTokenBars(sheet.tokenId).catch(() => undefined);
    }
  };

  // ---- Detail view -------------------------------------------------------

  if (draft) {
    const readOnly = !canEdit(draft, viewer);
    const canLink = !readOnly && sceneReady && selection.length === 1;

    return (
      <div className="app">
        <div className="row spread" style={{ marginBottom: 10 }}>
          <button type="button" onClick={() => setOpenId(undefined)}>
            {"< Volver"}
          </button>
          <div className="row" style={{ gap: 4 }}>
            {/*
              Only characters can be linked and unlinked: a GM sheet is
              stored on its token, so detaching it would delete the sheet.
            */}
            {draft.kind === "character" &&
              (draft.tokenId ? (
                <button
                  type="button"
                  className="icon"
                  disabled={readOnly}
                  onClick={() => void handleUnlinkToken(draft)}
                >
                  Desvincular token
                </button>
              ) : (
                <button
                  type="button"
                  className="icon"
                  disabled={!canLink}
                  title={
                    !sceneReady
                      ? "Abre una escena para vincular tokens"
                      : canLink
                        ? "Vincular al token seleccionado"
                        : "Selecciona un token en el mapa"
                  }
                  onClick={() => void handleLinkToken(draft)}
                >
                  Vincular token
                </button>
              ))}
            {canDelete(draft, viewer) && (
              <button
                type="button"
                className="icon danger"
                onClick={() => void handleDelete(draft)}
              >
                Eliminar
              </button>
            )}
          </div>
        </div>

        {readOnly && (
          <div className="notice" style={{ marginBottom: 10 }}>
            Solo lectura: esta ficha pertenece a otro jugador.
          </div>
        )}

        <SheetEditor
          sheet={draft}
          readOnly={readOnly}
          viewer={viewer}
          onChange={edit}
          sheets={allSheets}
        />

        {diceBar}
      </div>
    );
  }

  // ---- List view ---------------------------------------------------------

  return (
    <div className="app">
      <div className="row spread" style={{ marginBottom: 8 }}>
        <h1>Daggerheart</h1>
        <span className={`badge${isGm ? " gm" : ""}`}>
          {isGm ? "DJ" : "Jugador"}
        </span>
      </div>

      <FearPool
        fear={state.fear}
        readOnly={!canEditFear(viewer)}
        onChange={(fear) => void setFear(fear)}
      />

      <div className="tabs" style={{ marginTop: 10 }}>
        {availableTabs.map((candidate) => (
          <button
            key={candidate}
            type="button"
            className={`tab${tab === candidate ? " active" : ""}`}
            onClick={() => setTab(candidate)}
          >
            {TAB_LABELS[candidate]}
          </button>
        ))}
      </div>

      {tab === "log" ? (
        <LogPanel
          entries={state.log}
          canClear={canClearLog(viewer)}
          onClear={() => void clearLog()}
        />
      ) : (
        <>
          <div className="row spread" style={{ marginBottom: 8 }}>
            <span className="small muted">
              {tabSheets.length}{" "}
              {tabSheets.length === 1 ? "ficha" : "fichas"}
            </span>
            {sheetTab && canCreate(sheetTab, viewer) && (
              <button
                type="button"
                className="primary"
                disabled={!canCreateHere}
                title={
                  canCreateHere
                    ? undefined
                    : !sceneReady
                      ? "Abre una escena para crear fichas aquí"
                      : "Selecciona un token en el mapa: la ficha se guarda en él"
                }
                onClick={() => void handleCreate()}
              >
                + Nueva
              </button>
            )}
          </div>

          {hiddenWithoutScene && (
            <div className="notice" style={{ marginBottom: 8 }}>
              Sin escena abierta solo se ven las fichas que aún no tienen
              token. Abre la escena para ver el resto.
            </div>
          )}

          {needsToken && !canCreateHere && (
            <div className="notice" style={{ marginBottom: 8 }}>
              {!sceneReady
                ? "Estas fichas se guardan en el token, así que necesitan una escena abierta."
                : "Selecciona un token del mapa para crear la ficha sobre él."}
            </div>
          )}

          <SheetList
            sheets={tabSheets}
            viewer={viewer}
            // Only GM sheets carry categories.
            grouped={tab !== "character"}
            emptyMessage={
              tab === "character"
                ? "Aún no hay personajes. Crea el tuyo."
                : "Aún no hay fichas aquí."
            }
            onSelect={setOpenId}
          />
        </>
      )}

      {diceBar}
    </div>
  );
}

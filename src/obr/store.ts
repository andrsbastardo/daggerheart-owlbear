import OBR from "@owlbear-rodeo/sdk";
import {
  DICE_SLOT_COUNT,
  MAX_LOG_ENTRIES,
  MAX_LOG_TEXT,
  type DiceSlot,
  type DualityOutcomeValue,
  type LogEntry,
  type RoomState,
  type Sheet,
} from "../domain/types";
import { migrateState } from "../domain/migrate";
import { newId } from "../domain/factories";
import { applyDualityOutcome } from "../domain/resources";
import { ROOM_STATE_KEY } from "./constants";

/**
 * Room metadata is the single source of truth: Owlbear syncs it to every
 * connected player and persists it with the room, so sheets survive reloads
 * and are shared across the table without any server of our own.
 */


export async function readState(): Promise<RoomState> {
  const metadata = await OBR.room.getMetadata();
  return migrateState(metadata[ROOM_STATE_KEY]);
}

/**
 * Owlbear caps a room's metadata — shared by every extension in it — at
 * 16 KB. Staying meaningfully under that leaves room for other extensions.
 */
const SIZE_BUDGET_BYTES = 15_000;

function truncate(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

function byteSize(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

/**
 * Drops the oldest log entries until the state fits the budget.
 *
 * The log is the only part that grows without bound, so it yields first:
 * losing old feed entries is far better than being unable to save a sheet.
 */
function trimToBudget(state: RoomState): RoomState {
  while (state.log.length > 0 && byteSize(state) > SIZE_BUDGET_BYTES) {
    state.log.pop();
  }
  return state;
}

/**
 * Read-modify-write against room metadata.
 *
 * Owlbear merges metadata updates per top-level key, not per nested field, so
 * two players writing different sheets at the same moment could clobber each
 * other. We re-read immediately before writing to keep that window as small as
 * possible; sheet edits are also debounced by the caller.
 */
export async function updateState(
  mutate: (state: RoomState) => RoomState,
): Promise<void> {
  const current = await readState();
  const next = trimToBudget(mutate(structuredClone(current)));

  try {
    await OBR.room.setMetadata({ [ROOM_STATE_KEY]: next });
  } catch (error) {
    // A rejected write used to vanish silently, leaving the table wondering
    // why nothing saved. Surface it instead.
    await OBR.notification
      .show(
        "No se pudo guardar: la sala ha alcanzado su límite de datos. Vacía el registro desde la pestaña Registro.",
        "ERROR",
      )
      .catch(() => undefined);
    throw error;
  }
}

export function onStateChange(
  callback: (state: RoomState) => void,
): () => void {
  return OBR.room.onMetadataChange((metadata) => {
    callback(migrateState(metadata[ROOM_STATE_KEY]));
  });
}

export async function upsertSheet(sheet: Sheet): Promise<void> {
  await updateState((state) => {
    state.sheets[sheet.id] = { ...sheet, updatedAt: Date.now() };
    return state;
  });
}

export async function deleteSheet(sheetId: string): Promise<void> {
  await updateState((state) => {
    delete state.sheets[sheetId];
    return state;
  });
}

export async function setFear(fear: number): Promise<void> {
  await updateState((state) => {
    state.fear = fear;
    return state;
  });
}

/**
 * Publishes an entry to the table log.
 *
 * The floating toast stack watches the log itself, so writing here is all
 * that is needed to surface it to every player.
 */
export async function publishToLog(
  entry: Omit<LogEntry, "id" | "playedAt">,
): Promise<void> {
  const full: LogEntry = {
    ...entry,
    // Long card text would eat the room's whole metadata budget; the full
    // wording stays on the sheet it came from.
    text: truncate(entry.text, MAX_LOG_TEXT),
    id: newId(),
    playedAt: Date.now(),
  };

  await updateState((state) => {
    state.log = [full, ...state.log].slice(0, MAX_LOG_ENTRIES);
    return state;
  });
}

export async function clearLog(): Promise<void> {
  await updateState((state) => {
    state.log = [];
    return state;
  });
}

export async function setDiceSlots(
  playerId: string,
  slots: DiceSlot[],
): Promise<void> {
  await updateState((state) => {
    state.diceSlots[playerId] = slots.slice(0, DICE_SLOT_COUNT);
    return state;
  });
}

export interface PublishRollOptions {
  entry: Omit<LogEntry, "id" | "playedAt">;
  /**
   * Duality outcome to act on, if any.
   *
   * A Hope result marks a Hope pip on the roller's own sheet; a Fear result
   * adds to the table's Fear pool. Both are capped at their track maximum,
   * so a roll can never push a resource past its limit.
   */
  duality?: {
    outcome: DualityOutcomeValue;
    /** Sheet to credit Hope to. Omitted when the roller has no character. */
    sheetId?: string;
  };
}

/**
 * Publishes a roll and applies its duality resource in one write.
 *
 * Doing both in a single read-modify-write keeps the log entry and the
 * resource change from racing each other through room metadata.
 */
export async function publishRoll({
  entry,
  duality,
}: PublishRollOptions): Promise<void> {
  const full: LogEntry = {
    ...entry,
    id: newId(),
    playedAt: Date.now(),
  };

  await updateState((state) => {
    state.log = [full, ...state.log].slice(0, MAX_LOG_ENTRIES);

    if (duality) {
      applyDualityOutcome(state, duality.outcome, duality.sheetId);
    }

    return state;
  });
}

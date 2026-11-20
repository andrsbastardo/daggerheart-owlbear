import { MAX_FEAR, type DualityOutcomeValue, type RoomState } from "./types";

/**
 * Applies a duality roll's resource change to the room state.
 *
 * Split out from the Owlbear store so the rule — who gains Hope, when Fear
 * rises, and that neither exceeds its cap — can be tested on its own.
 */
export function applyDualityOutcome(
  state: RoomState,
  outcome: DualityOutcomeValue,
  sheetId: string | undefined,
): RoomState {
  // A critical grants Hope as well; clearing Stress is left to the table
  // because the rules make it situational.
  if (outcome === "hope" || outcome === "critical") {
    const sheet = sheetId ? state.sheets[sheetId] : undefined;
    if (sheet?.kind === "character") {
      sheet.hope.marked = Math.min(sheet.hope.marked + 1, sheet.hope.max);
    }
  }

  if (outcome === "fear") {
    state.fear = Math.min(state.fear + 1, MAX_FEAR);
  }

  return state;
}

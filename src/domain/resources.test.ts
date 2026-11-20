import { expect, test } from "vitest";
import { applyDualityOutcome } from "./resources";
import { createCharacter } from "./factories";
import { EMPTY_STATE, MAX_FEAR, type RoomState } from "./types";

function stateWithCharacter(hopeMarked: number, hopeMax = 6) {
  const sheet = createCharacter("Alice", "p-alice");
  sheet.hope = { marked: hopeMarked, max: hopeMax };

  const state: RoomState = {
    ...structuredClone(EMPTY_STATE),
    sheets: { [sheet.id]: sheet },
  };

  return { state, sheetId: sheet.id };
}

function hopeOf(state: RoomState, sheetId: string): number {
  const sheet = state.sheets[sheetId];
  return sheet?.kind === "character" ? sheet.hope.marked : -1;
}

test("a Hope result marks one Hope on the roller's sheet", () => {
  const { state, sheetId } = stateWithCharacter(2);

  applyDualityOutcome(state, "hope", sheetId);

  expect(hopeOf(state, sheetId)).toBe(3);
  expect(state.fear).toBe(0);
});

test("a Fear result raises the table's Fear instead", () => {
  const { state, sheetId } = stateWithCharacter(2);

  applyDualityOutcome(state, "fear", sheetId);

  expect(state.fear).toBe(1);
  expect(hopeOf(state, sheetId)).toBe(2);
});

test("a critical grants Hope", () => {
  const { state, sheetId } = stateWithCharacter(0);

  applyDualityOutcome(state, "critical", sheetId);

  expect(hopeOf(state, sheetId)).toBe(1);
  expect(state.fear).toBe(0);
});

test("Hope never exceeds the track maximum", () => {
  const { state, sheetId } = stateWithCharacter(6, 6);

  applyDualityOutcome(state, "hope", sheetId);

  expect(hopeOf(state, sheetId)).toBe(6);
});

test("Fear never exceeds its cap", () => {
  const { state, sheetId } = stateWithCharacter(0);
  state.fear = MAX_FEAR;

  applyDualityOutcome(state, "fear", sheetId);

  expect(state.fear).toBe(MAX_FEAR);
});

test("a Hope result with no character sheet changes nothing", () => {
  const state = structuredClone(EMPTY_STATE);

  applyDualityOutcome(state, "hope", undefined);

  expect(state.fear).toBe(0);
  expect(state.sheets).toEqual({});
});

test("a Hope result pointing at a missing sheet is ignored", () => {
  const { state } = stateWithCharacter(1);

  applyDualityOutcome(state, "hope", "no-such-sheet");

  expect(state.fear).toBe(0);
});

test("Fear still rises when the roller has no character of their own", () => {
  const state = structuredClone(EMPTY_STATE);

  applyDualityOutcome(state, "fear", undefined);

  expect(state.fear).toBe(1);
});

test("repeated Fear results accumulate up to the cap", () => {
  const state = structuredClone(EMPTY_STATE);

  for (let roll = 0; roll < MAX_FEAR + 5; roll += 1) {
    applyDualityOutcome(state, "fear", undefined);
  }

  expect(state.fear).toBe(MAX_FEAR);
});

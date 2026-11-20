import { expect, test } from "vitest";
import {
  createCharacter,
  createDefaultDiceSlots,
  newId,
} from "./factories";
import {
  MAX_LOG_ENTRIES,
  MAX_LOG_TEXT,
  MAX_SHEET_TEXT,
  type LogEntry,
  type RoomState,
} from "./types";

/**
 * Owlbear gives a whole room 16 KB of metadata, shared across every
 * extension in it. Exceeding it makes writes fail, which previously showed
 * up as dice and sheets silently refusing to save.
 */
const OBR_ROOM_LIMIT = 16 * 1024;

/** What we allow ourselves, leaving room for other extensions. */
const OUR_BUDGET = 10_000;

function byteSize(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function busyTable(): RoomState {
  const sheets: RoomState["sheets"] = {};

  // Four players, each with a full hand of cards and some weapons.
  for (let player = 0; player < 4; player += 1) {
    const sheet = createCharacter(`Personaje ${player}`, `p-${player}`);
    sheet.domainCards = Array.from({ length: 6 }, (_, card) => ({
      id: newId(),
      name: `Carta de dominio ${card}`,
      domain: "Arcana 2",
      text: "x".repeat(MAX_SHEET_TEXT),
      visibleToParty: true,
      inVault: false,
    }));
    sheet.weapons = Array.from({ length: 2 }, (_, weapon) => ({
      id: newId(),
      name: `Arma ${weapon}`,
      trait: "agility" as const,
      range: "Melee",
      damage: "1d8+3",
      type: "phy",
      // Weapon text is optional and short in practice.
      text: "x".repeat(60),
    }));
    sheets[sheet.id] = sheet;
  }

  // Adversaries and environments are stored on their tokens, not here, so
  // however many the GM prepares they cost the room nothing.

  const log: LogEntry[] = Array.from({ length: MAX_LOG_ENTRIES }, (_, i) => ({
    id: newId(),
    source: "card",
    title: "Una carta de dominio",
    text: "x".repeat(MAX_LOG_TEXT),
    subtitle: "Arcana 2",
    actorName: "Un jugador",
    sheetName: "Un personaje",
    playedAt: i,
  }));

  const diceSlots: RoomState["diceSlots"] = {};
  for (let player = 0; player < 4; player += 1) {
    diceSlots[`p-${player}`] = createDefaultDiceSlots();
  }

  return { version: 1, sheets, fear: 5, log, diceSlots };
}

/*
 * Measured ceiling: with MAX_SHEET_TEXT at 200, four players holding six
 * cards each plus six adversaries fits. Eight cards each does not — the
 * store trims the log to cope, and warns if a write is still rejected.
 */
test("a busy table's state fits inside Owlbear's room metadata limit", () => {
  const size = byteSize(busyTable());
  expect(size, `estado: ${size} bytes`).toBeLessThan(OBR_ROOM_LIMIT);
});

test("a full log alone stays well inside our own budget", () => {
  const log: LogEntry[] = Array.from({ length: MAX_LOG_ENTRIES }, (_, i) => ({
    id: `log-${i}`,
    source: "roll",
    title: "Dualidad",
    text: "",
    subtitle: "",
    actorName: "Un jugador",
    sheetName: "Un personaje",
    playedAt: i,
    roll: {
      formula: "2d12 + 1d6 + 3",
      values: [9, 4, 5],
      modifier: 3,
      total: 21,
      duality: { hope: 9, fear: 4, outcome: "hope" as const },
    },
  }));

  const size = byteSize(log);
  // The log must never be the thing that starves the sheets.
  expect(size, `registro: ${size} bytes`).toBeLessThan(OUR_BUDGET / 2);
});

test("the log cap is small enough to be a feed, not an archive", () => {
  expect(MAX_LOG_ENTRIES).toBeLessThanOrEqual(15);
});

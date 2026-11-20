import { expect, test } from "vitest";
import {
  canClearLog,
  canPlayCard,
  canViewCard,
  visibleCards,
  type Viewer,
} from "./permissions";
import { createAdversary, createCharacter, newId } from "./factories";
import { migrateState } from "./migrate";
import {
  DICE_SLOT_COUNT,
  MAX_LOG_ENTRIES,
  type DomainCard,
  type LogEntry,
} from "./types";

const gm: Viewer = { id: "gm-1", role: "GM" };
const alice: Viewer = { id: "p-alice", role: "PLAYER" };
const bob: Viewer = { id: "p-bob", role: "PLAYER" };

/** Treat a sheet as loose JSON, the way it arrives from room metadata. */
function asRaw(sheet: object): Record<string, unknown> {
  return sheet as unknown as Record<string, unknown>;
}

function card(overrides: Partial<DomainCard> = {}): DomainCard {
  return {
    id: newId(),
    name: "Ráfaga de fuego",
    domain: "Arcana 1",
    text: "Gasta una Esperanza para lanzar 2d6 de daño mágico.",
    visibleToParty: true,
    inVault: false,
    ...overrides,
  };
}

test("a public card is readable by the whole table", () => {
  const sheet = createCharacter("Alice", alice.id);
  const open = card({ visibleToParty: true });

  expect(canViewCard(open, sheet, bob)).toBe(true);
  expect(canViewCard(open, sheet, gm)).toBe(true);
  expect(canViewCard(open, sheet, alice)).toBe(true);
});

test("a private card hides from other players but not its owner or the GM", () => {
  const sheet = createCharacter("Alice", alice.id);
  const secret = card({ visibleToParty: false });

  expect(canViewCard(secret, sheet, bob)).toBe(false);
  expect(canViewCard(secret, sheet, alice)).toBe(true);
  expect(canViewCard(secret, sheet, gm)).toBe(true);
});

test("visibleCards filters a mixed hand per viewer", () => {
  const sheet = createCharacter("Alice", alice.id);
  sheet.domainCards = [
    card({ name: "Pública", visibleToParty: true }),
    card({ name: "Privada", visibleToParty: false }),
  ];

  expect(visibleCards(sheet, bob).map((entry) => entry.name)).toEqual([
    "Pública",
  ]);
  expect(visibleCards(sheet, alice)).toHaveLength(2);
  expect(visibleCards(sheet, gm)).toHaveLength(2);
});

test("only the owner or GM may play a card", () => {
  const sheet = createCharacter("Alice", alice.id);

  expect(canPlayCard(sheet, alice)).toBe(true);
  expect(canPlayCard(sheet, gm)).toBe(true);
  expect(canPlayCard(sheet, bob)).toBe(false);
});

test("adversaries carry no domain cards", () => {
  expect(visibleCards(createAdversary("Goblin"), gm)).toEqual([]);
});

test("only the GM may clear the shared log", () => {
  expect(canClearLog(gm)).toBe(true);
  expect(canClearLog(alice)).toBe(false);
});

test("a sheet saved before domain cards existed gains an empty hand", () => {
  const legacy = asRaw(createCharacter("Vieja", alice.id));
  delete legacy.domainCards;

  const migrated = migrateState({
    version: 1,
    sheets: { [legacy.id as string]: legacy },
    fear: 3,
  });

  const sheet = migrated.sheets[legacy.id as string];
  expect(sheet?.kind).toBe("character");
  expect(sheet?.kind === "character" && sheet.domainCards).toEqual([]);
  expect(migrated.fear).toBe(3);
  expect(migrated.log).toEqual([]);
});

test("migration defaults a card with missing fields to visible and loaded", () => {
  const sheet = asRaw(createCharacter("Alice", alice.id));
  sheet.domainCards = [{ id: "card-1", name: "Rota" }];

  const migrated = migrateState({
    version: 1,
    sheets: { [sheet.id as string]: sheet },
    fear: 0,
  });

  const result = migrated.sheets[sheet.id as string];
  const cards =
    result?.kind === "character" ? result.domainCards : [];

  expect(cards).toHaveLength(1);
  expect(cards[0]?.name).toBe("Rota");
  expect(cards[0]?.text).toBe("");
  expect(cards[0]?.visibleToParty).toBe(true);
  expect(cards[0]?.inVault).toBe(false);
});

test("migration drops malformed cards rather than crashing", () => {
  const sheet = asRaw(createCharacter("Alice", alice.id));
  sheet.domainCards = [null, "nonsense", { name: "sin id" }, { id: "ok" }];

  const migrated = migrateState({
    version: 1,
    sheets: { [sheet.id as string]: sheet },
    fear: 0,
  });

  const result = migrated.sheets[sheet.id as string];
  const cards = result?.kind === "character" ? result.domainCards : [];

  expect(cards).toHaveLength(1);
  expect(cards[0]?.id).toBe("ok");
});

test("the log is capped and ordered newest first", () => {
  const entries: LogEntry[] = Array.from(
    { length: MAX_LOG_ENTRIES + 20 },
    (_, index) => ({
      id: `entry-${index}`,
      source: "card" as const,
      title: `Carta ${index}`,
      text: "",
      subtitle: "",
      actorName: "Alice",
      sheetName: "Alice",
      playedAt: index,
    }),
  );

  const migrated = migrateState({
    version: 1,
    sheets: {},
    fear: 0,
    log: entries,
  });

  expect(migrated.log).toHaveLength(MAX_LOG_ENTRIES);
  // Highest playedAt wins, so the newest entry leads.
  expect(migrated.log[0]?.playedAt).toBe(MAX_LOG_ENTRIES + 19);
  expect(migrated.log[0]?.playedAt).toBeGreaterThan(
    migrated.log[1]?.playedAt ?? 0,
  );
});

test("state from an unknown schema version is discarded, not trusted", () => {
  const migrated = migrateState({ version: 99, sheets: { x: {} }, fear: 7 });

  expect(migrated.sheets).toEqual({});
  expect(migrated.fear).toBe(0);
});

test("garbage in room metadata yields empty state", () => {
  expect(migrateState(undefined).sheets).toEqual({});
  expect(migrateState("nonsense").sheets).toEqual({});
  expect(migrateState(null).log).toEqual([]);
});

test("dice slots survive a round trip through migration", () => {
  const migrated = migrateState({
    version: 1,
    sheets: {},
    fear: 0,
    log: [],
    diceSlots: {
      "p-alice": [
        { id: "s1", label: "Dualidad", formula: "2d12", duality: true },
        { id: "s2", label: "Daño", formula: "1d8+2", duality: false },
      ],
    },
  });

  expect(migrated.diceSlots["p-alice"]).toHaveLength(2);
  expect(migrated.diceSlots["p-alice"]?.[0]?.duality).toBe(true);
  expect(migrated.diceSlots["p-alice"]?.[1]?.formula).toBe("1d8+2");
});

test("a room saved before the dice bar existed gets an empty slot map", () => {
  const migrated = migrateState({ version: 1, sheets: {}, fear: 0 });
  expect(migrated.diceSlots).toEqual({});
});

test("migration caps a player at the allowed number of slots", () => {
  const tooMany = Array.from({ length: DICE_SLOT_COUNT + 4 }, (_, index) => ({
    id: `s${index}`,
    label: `Slot ${index}`,
    formula: "1d6",
    duality: false,
  }));

  const migrated = migrateState({
    version: 1,
    sheets: {},
    fear: 0,
    diceSlots: { "p-alice": tooMany },
  });

  expect(migrated.diceSlots["p-alice"]).toHaveLength(DICE_SLOT_COUNT);
});

test("malformed dice slots are dropped, not rendered", () => {
  const migrated = migrateState({
    version: 1,
    sheets: {},
    fear: 0,
    diceSlots: { "p-alice": [null, "nope", { label: "sin id" }, { id: "ok" }] },
  });

  const slots = migrated.diceSlots["p-alice"];
  expect(slots).toHaveLength(1);
  expect(slots?.[0]?.id).toBe("ok");
  // Missing fields fall back to something rollable rather than breaking.
  expect(slots?.[0]?.formula).toBe("1d20");
});

test("a roll entry keeps its dice detail through migration", () => {
  const migrated = migrateState({
    version: 1,
    sheets: {},
    fear: 0,
    log: [
      {
        id: "r1",
        source: "roll",
        title: "Dualidad",
        text: "",
        subtitle: "",
        actorName: "Alice",
        sheetName: "Alice",
        playedAt: 10,
        roll: {
          formula: "2d12",
          values: [9, 4],
          modifier: 0,
          total: 13,
          duality: { hope: 9, fear: 4, outcome: "hope" },
        },
      },
    ],
  });

  expect(migrated.log).toHaveLength(1);
  expect(migrated.log[0]?.roll?.total).toBe(13);
  expect(migrated.log[0]?.roll?.duality?.outcome).toBe("hope");
});

test("a roll entry with no dice detail is discarded as meaningless", () => {
  const migrated = migrateState({
    version: 1,
    sheets: {},
    fear: 0,
    log: [
      {
        id: "r1",
        source: "roll",
        title: "Rota",
        text: "",
        subtitle: "",
        actorName: "Alice",
        sheetName: "",
        playedAt: 1,
      },
    ],
  });

  expect(migrated.log).toEqual([]);
});

test("a weapon saved before the text field existed gains an empty one", () => {
  const sheet = asRaw(createCharacter("Alice", alice.id));
  sheet.weapons = [
    {
      id: "w1",
      name: "Espada larga",
      trait: "strength",
      range: "Melee",
      damage: "1d10+3",
      type: "phy",
    },
  ];

  const migrated = migrateState({
    version: 1,
    sheets: { [sheet.id as string]: sheet },
    fear: 0,
  });

  const result = migrated.sheets[sheet.id as string];
  const weapons = result?.kind === "character" ? result.weapons : [];

  expect(weapons).toHaveLength(1);
  expect(weapons[0]?.name).toBe("Espada larga");
  expect(weapons[0]?.damage).toBe("1d10+3");
  expect(weapons[0]?.trait).toBe("strength");
  // The new field is filled in rather than left undefined.
  expect(weapons[0]?.text).toBe("");
});

test("a weapon with an unknown trait falls back to a valid one", () => {
  const sheet = asRaw(createCharacter("Alice", alice.id));
  sheet.weapons = [{ id: "w1", name: "Rara", trait: "telepatia" }];

  const migrated = migrateState({
    version: 1,
    sheets: { [sheet.id as string]: sheet },
    fear: 0,
  });

  const result = migrated.sheets[sheet.id as string];
  const weapons = result?.kind === "character" ? result.weapons : [];

  expect(weapons[0]?.trait).toBe("agility");
  // Missing fields get rollable defaults rather than breaking the sheet.
  expect(weapons[0]?.damage).toBe("1d8");
});

test("malformed weapons are dropped", () => {
  const sheet = asRaw(createCharacter("Alice", alice.id));
  sheet.weapons = [null, "nope", { name: "sin id" }, { id: "ok" }];

  const migrated = migrateState({
    version: 1,
    sheets: { [sheet.id as string]: sheet },
    fear: 0,
  });

  const result = migrated.sheets[sheet.id as string];
  const weapons = result?.kind === "character" ? result.weapons : [];

  expect(weapons).toHaveLength(1);
  expect(weapons[0]?.id).toBe("ok");
});

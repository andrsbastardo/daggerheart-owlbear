import { expect, test } from "vitest";
import {
  createAdversary,
  createCharacter,
  createEnvironment,
} from "./factories";
import { migrateSheet } from "./migrate";
import { sheetStore } from "./storage";

/**
 * A sheet lives on its token once it has one, which costs the room's shared
 * 16 KB budget nothing and lets owlbear-persistence carry it between
 * scenes. Room metadata holds only the sheets with no token yet.
 *
 * `sheetStore` is in the Owlbear layer because it is a storage decision,
 * but the rule it encodes is a domain one, so it is pinned down here. The
 * real function is imported rather than restated, or this test could agree
 * with itself while the app disagreed.
 */
test("having a token decides the store, not the kind of sheet", () => {
  const homeless = createCharacter("Alice", "p1");
  expect(sheetStore(homeless)).toBe("room");

  // The same character, once her token is dropped.
  expect(sheetStore({ ...homeless, tokenId: "token-1" })).toBe("token");

  expect(sheetStore({ ...createAdversary("Goblin"), tokenId: "t2" })).toBe(
    "token",
  );
  expect(sheetStore({ ...createEnvironment("Bosque"), tokenId: "t3" })).toBe(
    "token",
  );
});

test("a sheet read back from a token survives the round trip", () => {
  const original = createAdversary("Goblin");
  original.tokenId = "token-1";
  original.hp = { marked: 2, max: 5 };
  original.features = [
    { id: "f1", name: "Emboscada", text: "Ataca desde las sombras." },
  ];

  // Item metadata is plain JSON, so this is what actually comes back.
  const roundTripped = migrateSheet(JSON.parse(JSON.stringify(original)));

  expect(roundTripped).toBeDefined();
  expect(roundTripped?.kind).toBe("adversary");
  expect(roundTripped?.name).toBe("Goblin");
  if (roundTripped?.kind === "adversary") {
    expect(roundTripped.hp.marked).toBe(2);
    expect(roundTripped.features[0]?.name).toBe("Emboscada");
  }
});

test("a character round trips too, for tokens that point at one", () => {
  const original = createCharacter("Alice", "p-alice");
  original.hope = { marked: 3, max: 6 };

  const roundTripped = migrateSheet(JSON.parse(JSON.stringify(original)));

  expect(roundTripped?.kind).toBe("character");
  if (roundTripped?.kind === "character") {
    expect(roundTripped.hope.marked).toBe(3);
    expect(roundTripped.ownerId).toBe("p-alice");
  }
});

test("rubbish in a token's metadata yields no sheet rather than throwing", () => {
  expect(migrateSheet(undefined)).toBeUndefined();
  expect(migrateSheet(null)).toBeUndefined();
  expect(migrateSheet("nope")).toBeUndefined();
  expect(migrateSheet({})).toBeUndefined();
  expect(migrateSheet({ id: "x" })).toBeUndefined();
});

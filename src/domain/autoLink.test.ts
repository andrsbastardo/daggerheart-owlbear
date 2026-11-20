import { expect, test } from "vitest";
import { planAutoLink, type TokenFacts } from "./autoLink";
import { createAdversary, createCharacter } from "./factories";
import type { Sheet } from "./types";

const ALICE = "p-alice";
const BOB = "p-bob";
const GM = "p-gm";

function token(id: string, createdUserId: string, linkedSheetId?: string) {
  const facts: TokenFacts = { id, createdUserId };
  if (linkedSheetId) facts.linkedSheetId = linkedSheetId;
  return facts;
}

test("a player's first token gets their existing sheet", () => {
  const sheet = createCharacter("Alice", ALICE);

  const plan = planAutoLink(
    [token("t1", ALICE)],
    ALICE,
    "PLAYER",
    [sheet],
  );

  expect(plan).toEqual({ action: "link", tokenId: "t1", sheetId: sheet.id });
});

test("a player without a sheet gets one created for the token", () => {
  const plan = planAutoLink([token("t1", ALICE)], ALICE, "PLAYER", []);

  expect(plan).toEqual({ action: "create-and-link", tokenId: "t1" });
});

test("only the first token is linked: later drops are left free", () => {
  const sheet = createCharacter("Alice", ALICE);

  const plan = planAutoLink(
    [token("t1", ALICE, sheet.id), token("t2", ALICE)],
    ALICE,
    "PLAYER",
    [sheet],
  );

  expect(plan).toEqual({ action: "none" });
});

test("another player's tokens are never touched", () => {
  const alice = createCharacter("Alice", ALICE);
  const bob = createCharacter("Bob", BOB);

  const plan = planAutoLink(
    [token("t1", BOB)],
    ALICE,
    "PLAYER",
    [alice, bob],
  );

  expect(plan).toEqual({ action: "none" });
});

test("the GM's tokens are ignored, so adversaries and scenery stay clean", () => {
  const sheet = createCharacter("Game master", GM);

  const plan = planAutoLink(
    [token("t1", GM)],
    GM,
    "GM",
    [sheet],
  );

  expect(plan).toEqual({ action: "none" });
});

test("a token already linked by hand is not re-pointed", () => {
  const mine = createCharacter("Alice", ALICE);
  const other: Sheet = createAdversary("Esqueleto");

  const plan = planAutoLink(
    [token("t1", ALICE, other.id)],
    ALICE,
    "PLAYER",
    [mine, other],
  );

  expect(plan).toEqual({ action: "none" });
});

test("a second token is linked when the first was pointed elsewhere by hand", () => {
  const mine = createCharacter("Alice", ALICE);
  const other = createAdversary("Esqueleto");

  const plan = planAutoLink(
    [token("t1", ALICE, other.id), token("t2", ALICE)],
    ALICE,
    "PLAYER",
    [mine, other],
  );

  expect(plan).toEqual({ action: "link", tokenId: "t2", sheetId: mine.id });
});

test("re-running after a link is a no-op, so an item change cannot link twice", () => {
  const sheet = createCharacter("Alice", ALICE);
  const tokens = [token("t1", ALICE)];

  const first = planAutoLink(tokens, ALICE, "PLAYER", [sheet]);
  expect(first).toEqual({
    action: "link",
    tokenId: "t1",
    sheetId: sheet.id,
  });

  // The link lands, the scene reports the change, and we see it again.
  const second = planAutoLink(
    [token("t1", ALICE, sheet.id)],
    ALICE,
    "PLAYER",
    [sheet],
  );
  expect(second).toEqual({ action: "none" });
});

// ---- Yielding to owlbear-persistence -----------------------------------

const GRACE = 1200;

test("a just-dropped token is left alone so persistence can restore it", () => {
  const sheet = createCharacter("Alice", ALICE);

  const plan = planAutoLink(
    [{ ...token("t1", ALICE), ageMs: 0 }],
    ALICE,
    "PLAYER",
    [sheet],
    GRACE,
  );

  expect(plan).toEqual({ action: "wait", tokenId: "t1" });
});

test("a token still empty after the grace period is claimed", () => {
  const sheet = createCharacter("Alice", ALICE);

  const plan = planAutoLink(
    [{ ...token("t1", ALICE), ageMs: GRACE + 1 }],
    ALICE,
    "PLAYER",
    [sheet],
    GRACE,
  );

  expect(plan).toEqual({ action: "link", tokenId: "t1", sheetId: sheet.id });
});

test("a token restored with its own sheet is never overwritten", () => {
  const sheet = createCharacter("Alice", ALICE);

  const plan = planAutoLink(
    [{ ...token("t1", ALICE), hasOwnSheet: true, ageMs: GRACE + 1 }],
    ALICE,
    "PLAYER",
    [sheet],
    GRACE,
  );

  expect(plan).toEqual({ action: "none" });
});

test("a restored token is skipped while a genuinely new one is claimed", () => {
  const sheet = createCharacter("Alice", ALICE);

  const plan = planAutoLink(
    [
      { ...token("t1", ALICE), hasOwnSheet: true, ageMs: GRACE + 1 },
      { ...token("t2", ALICE), ageMs: GRACE + 1 },
    ],
    ALICE,
    "PLAYER",
    [sheet],
    GRACE,
  );

  expect(plan).toEqual({ action: "link", tokenId: "t2", sheetId: sheet.id });
});

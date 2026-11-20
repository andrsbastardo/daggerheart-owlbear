import { expect, test } from "vitest";
import {
  canCreate,
  canDelete,
  canEdit,
  canEditFear,
  canView,
  visibleSheets,
  type Viewer,
} from "./permissions";
import {
  createAdversary,
  createCharacter,
  createEnvironment,
} from "./factories";

const gm: Viewer = { id: "gm-1", role: "GM" };
const alice: Viewer = { id: "p-alice", role: "PLAYER" };
const bob: Viewer = { id: "p-bob", role: "PLAYER" };

const aliceSheet = createCharacter("Alice", alice.id);
const bobSheet = createCharacter("Bob", bob.id);
const goblin = createAdversary("Goblin");
const forest = createEnvironment("Bosque");

test("a player can edit only their own character", () => {
  expect(canEdit(aliceSheet, alice)).toBe(true);
  expect(canEdit(bobSheet, alice)).toBe(false);
});

test("the GM can edit every sheet", () => {
  for (const sheet of [aliceSheet, bobSheet, goblin, forest]) {
    expect(canEdit(sheet, gm)).toBe(true);
  }
});

test("players never see adversaries or environments", () => {
  expect(canView(goblin, alice)).toBe(false);
  expect(canView(forest, alice)).toBe(false);
  expect(canView(goblin, gm)).toBe(true);
  expect(canView(forest, gm)).toBe(true);
});

test("players see each other's character sheets but cannot edit them", () => {
  expect(canView(bobSheet, alice)).toBe(true);
  expect(canEdit(bobSheet, alice)).toBe(false);
});

test("players cannot edit the Fear pool", () => {
  expect(canEditFear(alice)).toBe(false);
  expect(canEditFear(gm)).toBe(true);
});

test("players can only create characters", () => {
  expect(canCreate("character", alice)).toBe(true);
  expect(canCreate("adversary", alice)).toBe(false);
  expect(canCreate("environment", alice)).toBe(false);
  expect(canCreate("adversary", gm)).toBe(true);
});

test("a player can delete only their own character", () => {
  expect(canDelete(aliceSheet, alice)).toBe(true);
  expect(canDelete(bobSheet, alice)).toBe(false);
  expect(canDelete(goblin, alice)).toBe(false);
  expect(canDelete(goblin, gm)).toBe(true);
});

test("visibleSheets hides GM-only sheets from players", () => {
  const all = [aliceSheet, bobSheet, goblin, forest];

  const forPlayer = visibleSheets(all, alice);
  expect(forPlayer.map((sheet) => sheet.name).sort()).toEqual(["Alice", "Bob"]);

  expect(visibleSheets(all, gm).length).toBe(4);
});

test("a fresh character starts with its owner set and sane defaults", () => {
  const sheet = createCharacter("Nueva", alice.id);
  expect(sheet.ownerId).toBe(alice.id);
  expect(sheet.kind).toBe("character");
  expect(sheet.level).toBe(1);
  expect(sheet.hp.marked).toBe(0);
  expect(sheet.hp.max > 0).toBe(true);
  expect(sheet.tokenId).toBe(undefined);
});

test("GM-only sheets are never flagged visible to players", () => {
  expect(goblin.visibleToPlayers).toBe(false);
  expect(forest.visibleToPlayers).toBe(false);
});

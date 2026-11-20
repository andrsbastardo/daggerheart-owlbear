import { expect, test } from "vitest";
import { shouldDraw, type Connected } from "./drawer";

const gm = (connectionId: string): Connected => ({
  connectionId,
  role: "GM",
});
const player = (connectionId: string): Connected => ({
  connectionId,
  role: "PLAYER",
});

test("a lone GM draws, even when the party list is empty", () => {
  expect(shouldDraw("c2", "GM", [])).toBe(true);
});

test("a player never draws", () => {
  expect(shouldDraw("c1", "PLAYER", [])).toBe(false);
  expect(shouldDraw("c1", "PLAYER", [gm("c9")])).toBe(false);
});

test("players in the room do not affect the choice", () => {
  expect(shouldDraw("c5", "GM", [player("c1"), player("c2")])).toBe(true);
});

test("exactly one of two GM clients draws", () => {
  const first = shouldDraw("c1", "GM", [gm("c2")]);
  const second = shouldDraw("c2", "GM", [gm("c1")]);

  expect(first).toBe(true);
  expect(second).toBe(false);
  // The point of the rule: never both, never neither.
  expect([first, second].filter(Boolean)).toHaveLength(1);
});

test("one GM with two tabs open draws from only one of them", () => {
  // Same person, two connections: the case that caused the flicker.
  const tabA = shouldDraw("conn-a", "GM", [gm("conn-b")]);
  const tabB = shouldDraw("conn-b", "GM", [gm("conn-a")]);

  expect([tabA, tabB].filter(Boolean)).toHaveLength(1);
});

test("every client agrees on the same drawer", () => {
  const ids = ["c3", "c1", "c2"];
  const decisions = ids.map((id) =>
    shouldDraw(
      id,
      "GM",
      ids.filter((other) => other !== id).map(gm),
    ),
  );

  expect(decisions.filter(Boolean)).toHaveLength(1);
  // And it is the lowest id that wins, whoever is asking.
  expect(decisions[ids.indexOf("c1")]).toBe(true);
});

test("the choice moves on when the chosen client leaves", () => {
  expect(shouldDraw("c2", "GM", [gm("c1")])).toBe(false);
  // c1 disconnects.
  expect(shouldDraw("c2", "GM", [])).toBe(true);
});

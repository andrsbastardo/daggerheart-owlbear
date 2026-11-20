import { expect, test } from "vitest";
import { sameBars, trackBars } from "./trackBars";
import {
  createAdversary,
  createCharacter,
  createEnvironment,
} from "./factories";

test("a character shows HP, stress, hope and armor, in that order", () => {
  const bars = trackBars(createCharacter("Alice", "p1"));

  expect(bars.map((bar) => bar.key)).toEqual([
    "hp",
    "stress",
    "hope",
    "armor",
  ]);
});

test("an adversary shows only HP and stress", () => {
  const bars = trackBars(createAdversary("Goblin"));

  expect(bars.map((bar) => bar.key)).toEqual(["hp", "stress"]);
});

test("an environment has no bars", () => {
  expect(trackBars(createEnvironment("Bosque"))).toEqual([]);
});

test("a track with no pips is skipped rather than drawn empty", () => {
  const sheet = createCharacter("Alice", "p1");
  sheet.armor = { marked: 0, max: 0 };

  const bars = trackBars(sheet);
  expect(bars.map((bar) => bar.key)).not.toContain("armor");
});

test("marked pips are clamped to the maximum", () => {
  const sheet = createCharacter("Alice", "p1");
  sheet.hp = { marked: 99, max: 6 };

  const hp = trackBars(sheet).find((bar) => bar.key === "hp");
  expect(hp?.marked).toBe(6);
  expect(hp?.max).toBe(6);
});

test("negative values are floored at zero rather than drawn backwards", () => {
  const sheet = createCharacter("Alice", "p1");
  sheet.stress = { marked: -3, max: 6 };

  const stress = trackBars(sheet).find((bar) => bar.key === "stress");
  expect(stress?.marked).toBe(0);
});

test("damage tracks and resource tracks are distinguished", () => {
  const bars = trackBars(createCharacter("Alice", "p1"));
  const by = (key: string) => bars.find((bar) => bar.key === key);

  // HP and stress count harm taken; hope and armor count what is held.
  expect(by("hp")?.depleting).toBe(true);
  expect(by("stress")?.depleting).toBe(true);
  expect(by("hope")?.depleting).toBe(false);
  expect(by("armor")?.depleting).toBe(false);
});

test("every bar has its own colour, so none is mistaken for another", () => {
  const colors = trackBars(createCharacter("Alice", "p1")).map(
    (bar) => bar.color,
  );

  expect(new Set(colors).size).toBe(colors.length);
});

// ---- Redraw suppression -------------------------------------------------

test("identical bars compare equal, so nothing is redrawn", () => {
  const sheet = createCharacter("Alice", "p1");
  expect(sameBars(trackBars(sheet), trackBars(sheet))).toBe(true);
});

test("a changed value is detected", () => {
  const before = createCharacter("Alice", "p1");
  const after = { ...before, hp: { marked: 3, max: 6 } };

  expect(sameBars(trackBars(before), trackBars(after))).toBe(false);
});

test("a changed maximum is detected even when marked stays put", () => {
  const before = createCharacter("Alice", "p1");
  const after = { ...before, hp: { marked: 0, max: 8 } };

  expect(sameBars(trackBars(before), trackBars(after))).toBe(false);
});

test("an edit that touches no track does not trigger a redraw", () => {
  const before = createCharacter("Alice", "p1");
  const after = { ...before, name: "Alicia", notes: "una nota larga" };

  expect(sameBars(trackBars(before), trackBars(after))).toBe(true);
});

test("gaining a track is detected", () => {
  const before = createCharacter("Alice", "p1");
  before.armor = { marked: 0, max: 0 };
  const after = { ...before, armor: { marked: 1, max: 3 } };

  expect(sameBars(trackBars(before), trackBars(after))).toBe(false);
});

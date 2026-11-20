import { expect, test } from "vitest";
import { isEmptyDisplay, sameDisplay, tokenDisplay } from "./trackBars";
import {
  createAdversary,
  createCharacter,
  createEnvironment,
} from "./factories";

function cornerKeys(sheet: Parameters<typeof tokenDisplay>[0]) {
  return tokenDisplay(sheet).corners.map((corner) => corner.key);
}

// ---- What each kind of sheet shows --------------------------------------

test("a character shows HP on the bar and four values in the corners", () => {
  const display = tokenDisplay(createCharacter("Alice", "p1"));

  expect(display.bar?.text).toBe("0/6");
  expect(cornerKeys(createCharacter("Alice", "p1"))).toEqual([
    "stress",
    "hope",
    "armor",
    "evasion",
  ]);
  expect(display.corners).toHaveLength(4);
});

test("each corner value sits in its own corner", () => {
  const display = tokenDisplay(createCharacter("Alice", "p1"));
  const corners = display.corners.map((value) => value.corner);

  expect(new Set(corners).size).toBe(corners.length);
});

test("an adversary shows HP and stress only", () => {
  const display = tokenDisplay(createAdversary("Goblin"));

  expect(display.bar?.text).toBe("0/5");
  expect(display.corners.map((corner) => corner.key)).toEqual(["stress"]);
});

test("an environment shows nothing on the map", () => {
  const display = tokenDisplay(createEnvironment("Bosque"));

  expect(isEmptyDisplay(display)).toBe(true);
});

// ---- The bar ------------------------------------------------------------

test("the bar reads marked over maximum", () => {
  const sheet = createCharacter("Alice", "p1");
  sheet.hp = { marked: 3, max: 7 };

  expect(tokenDisplay(sheet).bar?.text).toBe("3/7");
});

test("marked pips are clamped to the maximum", () => {
  const sheet = createCharacter("Alice", "p1");
  sheet.hp = { marked: 99, max: 6 };

  const bar = tokenDisplay(sheet).bar;
  expect(bar?.marked).toBe(6);
  expect(bar?.text).toBe("6/6");
});

test("negative values floor at zero rather than drawing backwards", () => {
  const sheet = createCharacter("Alice", "p1");
  sheet.hp = { marked: -3, max: 6 };

  expect(tokenDisplay(sheet).bar?.text).toBe("0/6");
});

test("a sheet with no HP track has no bar", () => {
  const sheet = createCharacter("Alice", "p1");
  sheet.hp = { marked: 0, max: 0 };

  expect(tokenDisplay(sheet).bar).toBeUndefined();
});

// ---- Corner values ------------------------------------------------------

test("a corner shows the bare number, with no maximum", () => {
  const sheet = createCharacter("Alice", "p1");
  sheet.hope = { marked: 2, max: 6 };

  const hope = tokenDisplay(sheet).corners.find(
    (corner) => corner.key === "hope",
  );
  expect(hope?.text).toBe("2");
});

test("a track with no pips is skipped rather than shown empty", () => {
  const sheet = createCharacter("Alice", "p1");
  sheet.armor = { marked: 0, max: 0 };

  expect(cornerKeys(sheet)).not.toContain("armor");
});

test("evasion is always shown, being a flat number rather than a track", () => {
  const sheet = createCharacter("Alice", "p1");
  sheet.evasion = 12;

  const evasion = tokenDisplay(sheet).corners.find(
    (corner) => corner.key === "evasion",
  );
  expect(evasion?.text).toBe("12");
});

test("every value has its own colour, so none is mistaken for another", () => {
  const display = tokenDisplay(createCharacter("Alice", "p1"));
  const colors = display.corners.map((corner) => corner.color);

  expect(new Set(colors).size).toBe(colors.length);
});

// ---- Redraw suppression -------------------------------------------------

test("an identical sheet compares equal, so nothing is redrawn", () => {
  const sheet = createCharacter("Alice", "p1");
  expect(sameDisplay(tokenDisplay(sheet), tokenDisplay(sheet))).toBe(true);
});

test("a changed HP value is detected", () => {
  const before = createCharacter("Alice", "p1");
  const after = { ...before, hp: { marked: 3, max: 6 } };

  expect(sameDisplay(tokenDisplay(before), tokenDisplay(after))).toBe(false);
});

test("a changed corner value is detected", () => {
  const before = createCharacter("Alice", "p1");
  const after = { ...before, hope: { marked: 5, max: 6 } };

  expect(sameDisplay(tokenDisplay(before), tokenDisplay(after))).toBe(false);
});

test("an edit that changes no displayed number does not redraw", () => {
  const before = createCharacter("Alice", "p1");
  const after = { ...before, name: "Alicia", notes: "una nota larga" };

  expect(sameDisplay(tokenDisplay(before), tokenDisplay(after))).toBe(true);
});

test("gaining a track is detected", () => {
  const before = createCharacter("Alice", "p1");
  before.armor = { marked: 0, max: 0 };
  const after = { ...before, armor: { marked: 1, max: 3 } };

  expect(sameDisplay(tokenDisplay(before), tokenDisplay(after))).toBe(false);
});

test("losing the bar entirely is detected", () => {
  const before = createCharacter("Alice", "p1");
  const after = { ...before, hp: { marked: 0, max: 0 } };

  expect(sameDisplay(tokenDisplay(before), tokenDisplay(after))).toBe(false);
});

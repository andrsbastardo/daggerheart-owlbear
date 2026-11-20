import { expect, test } from "vitest";
import {
  MAX_DICE_PER_ROLL,
  describeRoll,
  describeRollToast,
  parseFormula,
  rollFormula,
  traitRollFormula,
  type DiceFormula,
} from "./dice";

function parsed(input: string): DiceFormula {
  const result = parseFormula(input);
  if (!result.ok) throw new Error(`no parseó: ${input} — ${result.error.message}`);
  return result.formula;
}

/** Deterministic randomness: feeds back the given 0..1 values in order. */
function sequence(...values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length] ?? 0;
}

/** Always rolls the maximum face. */
const always = (fraction: number) => () => fraction;

test("parses a bare dice term", () => {
  expect(parsed("2d12")).toEqual({
    terms: [{ count: 2, sides: 12, sign: 1 }],
    modifier: 0,
  });
});

test("defaults an omitted count to one die", () => {
  expect(parsed("d20").terms).toEqual([{ count: 1, sides: 20, sign: 1 }]);
});

test("parses a positive flat modifier", () => {
  const formula = parsed("1d8+3");
  expect(formula.terms).toEqual([{ count: 1, sides: 8, sign: 1 }]);
  expect(formula.modifier).toBe(3);
});

test("parses a negative flat modifier", () => {
  expect(parsed("1d20-1").modifier).toBe(-1);
});

test("parses several terms with whitespace", () => {
  const formula = parsed("2d6 + 1d4 + 2");
  expect(formula.terms).toHaveLength(2);
  expect(formula.modifier).toBe(2);
});

test("parses a subtracted dice term", () => {
  const formula = parsed("2d6 - 1d4");
  expect(formula.terms[1]).toEqual({ count: 1, sides: 4, sign: -1 });
});

test("rejects empty input", () => {
  const result = parseFormula("   ");
  expect(result.ok).toBe(false);
});

test("rejects a formula with no dice", () => {
  expect(parseFormula("5").ok).toBe(false);
});

test("rejects input with no dice at all", () => {
  expect(parseFormula("tirada").ok).toBe(false);
  expect(parseFormula("daño mágico").ok).toBe(false);
});

test("a word after the dice is read as a label, not an error", () => {
  // Damage fields carry the damage type, so a trailing word is expected.
  // The cost is that a typo like "2d6 veces" parses as 2d6 rather than
  // failing — acceptable, since a wrong roll is visible immediately.
  const result = parseFormula("2d6 veces");
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.formula.terms).toHaveLength(1);
});

test("rejects a one-sided die", () => {
  expect(parseFormula("1d1").ok).toBe(false);
});

test("rejects absurd dice counts so a typo cannot hang the page", () => {
  expect(parseFormula(`${MAX_DICE_PER_ROLL + 1}d6`).ok).toBe(false);
  expect(parseFormula(`${MAX_DICE_PER_ROLL}d6`).ok).toBe(true);
});

test("rejects absurd side counts", () => {
  expect(parseFormula("1d99999").ok).toBe(false);
});

test("rolls within the possible range for the formula", () => {
  const formula = parsed("2d6+1");

  for (let attempt = 0; attempt < 200; attempt += 1) {
    const result = rollFormula(formula, Math.random);
    expect(result.total).toBeGreaterThanOrEqual(3);
    expect(result.total).toBeLessThanOrEqual(13);
    expect(result.dice).toHaveLength(2);
  }
});

test("a die never rolls zero or above its face count", () => {
  const formula = parsed("1d12");

  expect(rollFormula(formula, always(0)).dice[0]?.value).toBe(1);
  expect(rollFormula(formula, always(0.999999)).dice[0]?.value).toBe(12);
});

test("subtracted dice reduce the total", () => {
  // 1d6 rolls 6, 1d4 rolls 4, so 6 - 4 = 2.
  const result = rollFormula(parsed("1d6-1d4"), always(0.999999));
  expect(result.total).toBe(2);
});

test("duality reads the first die as Hope and the second as Fear", () => {
  // d12 rolls: 0.5 -> 7, 0.1 -> 2.
  const result = rollFormula(parsed("2d12"), sequence(0.5, 0.1), true);

  expect(result.duality?.hope).toBe(7);
  expect(result.duality?.fear).toBe(2);
  expect(result.duality?.outcome).toBe("hope");
});

test("a higher Fear die yields a Fear result", () => {
  const result = rollFormula(parsed("2d12"), sequence(0.1, 0.5), true);
  expect(result.duality?.outcome).toBe("fear");
});

test("matching dice are a critical", () => {
  const result = rollFormula(parsed("2d12"), sequence(0.5, 0.5), true);
  expect(result.duality?.outcome).toBe("critical");
  expect(result.duality?.hope).toBe(result.duality?.fear);
});

test("duality is absent unless the slot asks for it", () => {
  expect(rollFormula(parsed("2d12"), Math.random).duality).toBeUndefined();
});

test("duality is skipped when the formula has only one die", () => {
  expect(rollFormula(parsed("1d12"), Math.random, true).duality).toBeUndefined();
});

test("a duality roll still totals every die plus the modifier", () => {
  // Both d12 roll 7, plus the +2.
  const result = rollFormula(parsed("2d12+2"), always(0.5), true);
  expect(result.total).toBe(16);
});

test("describeRoll shows the dice, modifier and total", () => {
  const result = rollFormula(parsed("2d6+3"), always(0.5));
  expect(describeRoll("2d6+3", result)).toBe("2d6+3: 4, 4 (+3) = 11");
});

test("describeRoll omits a zero modifier", () => {
  const result = rollFormula(parsed("1d20"), always(0.5));
  expect(describeRoll("1d20", result)).toBe("1d20: 11 = 11");
});

test("describeRoll renders a negative modifier", () => {
  const result = rollFormula(parsed("1d20-2"), always(0.5));
  expect(describeRoll("1d20-2", result)).toBe("1d20-2: 11 (-2) = 9");
});

test("the toast appends the duality verdict after the total", () => {
  expect(
    describeRollToast({
      actorName: "GM",
      title: "Dualidad",
      roll: { total: 6, duality: { outcome: "fear" } },
    }),
  ).toBe("GM: Dualidad = 6 con Miedo");

  expect(
    describeRollToast({
      actorName: "Alice",
      title: "Dualidad",
      roll: { total: 17, duality: { outcome: "hope" } },
    }),
  ).toBe("Alice: Dualidad = 17 con Esperanza");
});

test("a critical says so in the toast", () => {
  expect(
    describeRollToast({
      actorName: "Alice",
      title: "Dualidad",
      roll: { total: 14, duality: { outcome: "critical" } },
    }),
  ).toBe("Alice: Dualidad = 14 ¡Crítico!");
});

test("a plain roll keeps the total with no verdict", () => {
  expect(
    describeRollToast({
      actorName: "Alice",
      title: "Daño d8",
      roll: { total: 5 },
    }),
  ).toBe("Alice: Daño d8 = 5");
});

test("an entry with no roll falls back to the title alone", () => {
  expect(
    describeRollToast({ actorName: "Alice", title: "Ráfaga de fuego" }),
  ).toBe("Alice: Ráfaga de fuego");
});

test("a trait roll is the duality pair plus the modifier", () => {
  expect(traitRollFormula(2)).toBe("2d12 + 2");
  expect(traitRollFormula(0)).toBe("2d12");
  expect(traitRollFormula(-1)).toBe("2d12 - 1");
});

test("advantage adds a d6 and disadvantage subtracts one", () => {
  expect(traitRollFormula(2, "advantage")).toBe("2d12 + 1d6 + 2");
  expect(traitRollFormula(2, "disadvantage")).toBe("2d12 - 1d6 + 2");
  expect(traitRollFormula(0, "advantage")).toBe("2d12 + 1d6");
});

test("every trait roll formula parses", () => {
  for (const stance of ["normal", "advantage", "disadvantage"] as const) {
    for (const modifier of [-3, -1, 0, 1, 5]) {
      const formula = traitRollFormula(modifier, stance);
      expect(parseFormula(formula).ok, formula).toBe(true);
    }
  }
});

test("the duality pair stays first, so Hope and Fear read correctly", () => {
  // Advantage puts a d6 in the formula; it must not displace the d12s.
  const formula = parsed(traitRollFormula(2, "advantage"));
  const result = rollFormula(formula, sequence(0.5, 0.1, 0.5), true);

  expect(result.dice[0]?.sides).toBe(12);
  expect(result.dice[1]?.sides).toBe(12);
  expect(result.dice[2]?.sides).toBe(6);
  expect(result.duality?.outcome).toBe("hope");
});

test("a disadvantage d6 lowers the total", () => {
  // Every die rolls its maximum: 12 + 12 - 6 + 2.
  const withPenalty = rollFormula(
    parsed(traitRollFormula(2, "disadvantage")),
    always(0.999999),
    true,
  );
  expect(withPenalty.total).toBe(20);

  const withBonus = rollFormula(
    parsed(traitRollFormula(2, "advantage")),
    always(0.999999),
    true,
  );
  expect(withBonus.total).toBe(32);
});

test("a trailing type annotation is allowed on a damage formula", () => {
  // Damage fields are commonly written with the damage type appended.
  for (const input of [
    "1d8+3 (mag)",
    "2d6 phy",
    "1d10+2 mágico",
    "1d8 [phy]",
    "1d12+4 físico",
  ]) {
    expect(parseFormula(input).ok, input).toBe(true);
  }
});

test("an annotated formula rolls only its dice, ignoring the label", () => {
  const result = parseFormula("1d8+3 (mag)");
  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.formula.terms).toEqual([{ count: 1, sides: 8, sign: 1 }]);
  expect(result.formula.modifier).toBe(3);
});

test("pasted typographic dashes are treated as minus", () => {
  // An en dash or em dash arrives when text is copied from a rules document.
  expect(parseFormula("1d8\u20133").ok).toBe(true);
  expect(parseFormula("1d8\u20143").ok).toBe(true);
  expect(parsed("1d8\u20133").modifier).toBe(-3);
});

test("a non-breaking space does not break a formula", () => {
  expect(parseFormula("1d8\u00a0+\u00a03").ok).toBe(true);
});

test("the label allowance applies only after the dice, not before", () => {
  // Leading junk still fails: the notation must start the string.
  expect(parseFormula("hola 2d6").ok).toBe(false);
  expect(parseFormula("daño 1d8").ok).toBe(false);
  // And a formula with no dice is still an error whatever follows.
  expect(parseFormula("tirada").ok).toBe(false);
});

// ---- Attack vs damage ---------------------------------------------------

/*
 * The rule that is easy to get backwards: a weapon's trait modifies the
 * ATTACK roll, never the damage. Damage is the weapon's own dice.
 */
test("an attack roll is the duality dice plus the weapon's trait", () => {
  // A weapon using Agility +3 on a character with that trait at 3.
  expect(traitRollFormula(3)).toBe("2d12 + 3");
  expect(traitRollFormula(3, "advantage")).toBe("2d12 + 1d6 + 3");
});

test("damage carries no trait: the weapon's own dice are rolled as written", () => {
  // What a damage field holds, parsed exactly as typed.
  for (const damage of ["1d8", "1d8+3", "2d6 + 1", "1d10"]) {
    const parsed = parseFormula(damage);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      // No d12 is involved, so no duality die leaked into damage.
      expect(parsed.formula.terms.some((term) => term.sides === 12)).toBe(
        false,
      );
    }
  }
});

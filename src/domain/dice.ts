/**
 * Dice notation parsing and rolling.
 *
 * Kept free of Owlbear and of React so the whole thing is testable: the roll
 * function takes its randomness as a parameter rather than calling Math.random
 * itself, which lets tests pin down exact outcomes.
 */

export interface DiceTerm {
  count: number;
  sides: number;
  /** +1 or -1, applied to every die in the term. */
  sign: 1 | -1;
}

export interface DiceFormula {
  terms: DiceTerm[];
  /** Sum of all flat modifiers, e.g. the +3 in "2d6+3". */
  modifier: number;
}

export interface ParseError {
  message: string;
}

export type ParseResult =
  | { ok: true; formula: DiceFormula }
  | { ok: false; error: ParseError };

/** Guard rails so a typo cannot lock up the browser or spam the log. */
export const MAX_DICE_PER_ROLL = 50;
export const MAX_SIDES = 1000;

const TOKEN = /([+-]?)\s*(\d*)\s*[dD]\s*(\d+)|([+-]?)\s*(\d+)/g;

/**
 * Parses notation like "2d12", "1d8+3", "d20-1", "2d6 + 1d4 + 2".
 *
 * Returns a result rather than throwing: the input comes from a text field
 * the player edits, so a malformed formula is an expected state to render,
 * not an exceptional one.
 */
export function parseFormula(input: string): ParseResult {
  // Typographic dashes and non-breaking spaces arrive whenever text is
  // pasted from a rules document; treat them as the plain characters.
  const trimmed = input
    .replace(/[‒-―−]/g, "-")
    .replace(/ /g, " ")
    .trim();

  if (!trimmed) {
    return { ok: false, error: { message: "Escribe una fórmula, p. ej. 2d12" } };
  }

  /*
   * Split the dice notation from any trailing annotation.
   *
   * A damage field is commonly written "1d8+3 (mag)" or "2d6 phy", so the
   * notation is read from the front and whatever follows is kept as a label
   * rather than rejected. Anything non-numeric *between* terms still fails,
   * so "2d6 veces 3" does not silently parse as "2d6".
   */
  const match = /^([\d\s+\-dD]+?)\s*([(\[]?[^\d]*)?$/.exec(trimmed);
  const notation = match?.[1]?.trim() ?? trimmed;

  if (!/^[\d\s+\-dD]+$/.test(notation)) {
    return {
      ok: false,
      error: { message: "Solo se admiten números, d, + y -" },
    };
  }

  const terms: DiceTerm[] = [];
  let modifier = 0;
  let matched = 0;

  TOKEN.lastIndex = 0;
  for (const match of notation.matchAll(TOKEN)) {
    matched += match[0].trim().length;

    const [, diceSign, rawCount, rawSides, flatSign, rawFlat] = match;

    if (rawSides !== undefined) {
      const count = rawCount ? Number(rawCount) : 1;
      const sides = Number(rawSides);

      if (count < 1) {
        return { ok: false, error: { message: "Cantidad de dados inválida" } };
      }
      if (sides < 2) {
        return { ok: false, error: { message: "Un dado necesita 2 caras o más" } };
      }
      if (sides > MAX_SIDES) {
        return {
          ok: false,
          error: { message: `Máximo ${MAX_SIDES} caras por dado` },
        };
      }

      terms.push({ count, sides, sign: diceSign === "-" ? -1 : 1 });
    } else if (rawFlat !== undefined) {
      const value = Number(rawFlat);
      modifier += flatSign === "-" ? -value : value;
    }
  }

  if (terms.length === 0) {
    return {
      ok: false,
      error: { message: "Falta al menos un dado, p. ej. 1d20" },
    };
  }

  // Catch leftovers the token pattern skipped, e.g. "2d6 7 d".
  if (matched < notation.replace(/\s/g, "").length) {
    return { ok: false, error: { message: "Fórmula no reconocida" } };
  }

  const total = terms.reduce((sum, term) => sum + term.count, 0);
  if (total > MAX_DICE_PER_ROLL) {
    return {
      ok: false,
      error: { message: `Máximo ${MAX_DICE_PER_ROLL} dados por tirada` },
    };
  }

  return { ok: true, formula: { terms, modifier } };
}

export interface RolledDie {
  sides: number;
  value: number;
  sign: 1 | -1;
}

export type DualityOutcome = "hope" | "fear" | "critical";

export interface RollResult {
  dice: RolledDie[];
  modifier: number;
  total: number;
  /** Present only when the slot is flagged as a duality roll. */
  duality?: {
    hope: number;
    fear: number;
    outcome: DualityOutcome;
  };
}

/** Injected so tests can roll deterministically. */
export type Random = () => number;

function rollDie(sides: number, random: Random): number {
  return Math.floor(random() * sides) + 1;
}

/**
 * Rolls a parsed formula.
 *
 * When `duality` is set, the first two dice rolled are read as Hope and Fear
 * in that order — the slot's own checkbox is what declares the intent, since
 * plain notation carries no way to tell the two apart.
 */
export function rollFormula(
  formula: DiceFormula,
  random: Random,
  duality = false,
): RollResult {
  const dice: RolledDie[] = [];

  for (const term of formula.terms) {
    for (let index = 0; index < term.count; index += 1) {
      dice.push({
        sides: term.sides,
        value: rollDie(term.sides, random),
        sign: term.sign,
      });
    }
  }

  const total =
    dice.reduce((sum, die) => sum + die.value * die.sign, 0) +
    formula.modifier;

  const result: RollResult = { dice, modifier: formula.modifier, total };

  const [first, second] = dice;
  if (duality && first && second) {
    const hope = first.value;
    const fear = second.value;
    result.duality = {
      hope,
      fear,
      outcome: hope === fear ? "critical" : hope > fear ? "hope" : "fear",
    };
  }

  return result;
}

/** Renders a result for the log, e.g. "2d12: 9, 4 (+2) = 15". */
export function describeRoll(formula: string, result: RollResult): string {
  const values = result.dice
    .map((die) => (die.sign === -1 ? `-${die.value}` : `${die.value}`))
    .join(", ");

  const modifier =
    result.modifier === 0
      ? ""
      : result.modifier > 0
        ? ` (+${result.modifier})`
        : ` (${result.modifier})`;

  return `${formula}: ${values}${modifier} = ${result.total}`;
}

export const DUALITY_LABELS: Record<DualityOutcome, string> = {
  hope: "con Esperanza",
  fear: "con Miedo",
  critical: "¡Crítico!",
};

/** How a duality roll is modified before it is rolled. */
export type RollStance = "normal" | "advantage" | "disadvantage";

export const STANCE_LABELS: Record<RollStance, string> = {
  normal: "Normal",
  advantage: "Con ventaja",
  disadvantage: "Con desventaja",
};

/**
 * Builds the notation for a Daggerheart trait roll.
 *
 * Always the two duality d12s plus the trait modifier. Advantage adds a d6
 * and disadvantage subtracts one — the d6 modifies the same roll rather
 * than replacing a die, so the duality pair stays first and the Hope/Fear
 * reading is unaffected.
 */
export function traitRollFormula(
  modifier: number,
  stance: RollStance = "normal",
): string {
  const parts = ["2d12"];

  if (stance === "advantage") parts.push("+ 1d6");
  if (stance === "disadvantage") parts.push("- 1d6");

  if (modifier > 0) parts.push(`+ ${modifier}`);
  if (modifier < 0) parts.push(`- ${Math.abs(modifier)}`);

  return parts.join(" ");
}

/**
 * One-line summary for the toast that flashes to the table.
 *
 * The toast is brief and disappears on its own, so it leads with what the
 * table needs at a glance: the total, then which side of the duality won.
 */
export function describeRollToast(entry: {
  actorName: string;
  title: string;
  roll?: {
    total: number;
    duality?: { outcome: DualityOutcome };
  };
}): string {
  const { actorName, title, roll } = entry;
  if (!roll) return `${actorName}: ${title}`;

  const outcome = roll.duality
    ? ` ${DUALITY_LABELS[roll.duality.outcome]}`
    : "";

  return `${actorName}: ${title} = ${roll.total}${outcome}`;
}

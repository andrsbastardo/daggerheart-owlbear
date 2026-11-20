import OBR from "@owlbear-rodeo/sdk";
import {
  TRAIT_LABELS,
  type DiceSlot,
  type Sheet,
  type Trait,
} from "../domain/types";
import type { Viewer } from "../domain/permissions";
import {
  STANCE_LABELS,
  parseFormula,
  rollFormula,
  traitRollFormula,
  type RollStance,
} from "../domain/dice";
import { publishRoll } from "./store";

/**
 * Rolls a dice slot and publishes the result to the table log.
 *
 * A duality roll also adjusts a resource: Hope goes to the roller's own
 * character sheet, Fear to the table pool. The sheet is resolved here rather
 * than passed in, so the bar works from any screen in the panel.
 */
/**
 * Rolls a formula and publishes it, applying any duality resource.
 *
 * Shared by the dice bar and the trait buttons so both reach the log the
 * same way, and so Hope always lands on the roller's own character.
 */
async function roll(
  formula: string,
  title: string,
  subtitle: string,
  duality: boolean,
  viewer: Viewer,
  sheets: Sheet[],
): Promise<void> {
  const parsed = parseFormula(formula);
  if (!parsed.ok) return;

  const result = rollFormula(parsed.formula, Math.random, duality);
  const actorName = await OBR.player.getName().catch(() => "Alguien");

  // Hope lands on the roller's own character, whichever sheet is open.
  const ownCharacter = sheets.find(
    (sheet) => sheet.kind === "character" && sheet.ownerId === viewer.id,
  );

  await publishRoll({
    entry: {
      source: "roll",
      title,
      text: "",
      subtitle,
      actorName,
      sheetName: ownCharacter?.name ?? "",
      roll: {
        formula,
        values: result.dice.map((die) => die.value),
        modifier: result.modifier,
        total: result.total,
        duality: result.duality,
      },
    },
    duality: result.duality
      ? {
          outcome: result.duality.outcome,
          sheetId: ownCharacter?.id,
        }
      : undefined,
  });
}

export async function rollSlot(
  slot: DiceSlot,
  viewer: Viewer,
  sheets: Sheet[],
): Promise<void> {
  await roll(
    slot.formula,
    slot.label || slot.formula,
    "",
    slot.duality,
    viewer,
    sheets,
  );
}

/**
 * Rolls a trait from a character sheet.
 *
 * Always a duality roll — a trait check is the duality pair plus the trait
 * modifier, with advantage or disadvantage adding or subtracting a d6.
 */
/**
 * Rolls a weapon's damage.
 *
 * Not a duality roll: damage is the weapon's own dice, so no Hope or Fear
 * is read from it and no resource moves.
 */
export async function rollDamage(
  weaponName: string,
  damage: string,
  viewer: Viewer,
  sheets: Sheet[],
): Promise<void> {
  await roll(
    damage,
    `${weaponName || "Arma"} · daño`,
    "",
    false,
    viewer,
    sheets,
  );
}

/**
 * An attack roll: the duality dice plus the weapon's trait.
 *
 * In Daggerheart the weapon's trait modifies the attack, not the damage —
 * damage is the weapon's own dice. So this is a trait roll made with
 * whichever trait the weapon uses, and it moves Hope or Fear like any other
 * duality roll. The modifier comes from the character sheet, so changing a
 * trait is reflected here without touching the weapon.
 */
export async function rollAttack(
  weaponName: string,
  trait: Trait,
  modifier: number,
  stance: RollStance,
  viewer: Viewer,
  sheets: Sheet[],
): Promise<void> {
  const detail = [
    TRAIT_LABELS[trait],
    stance === "normal" ? "" : STANCE_LABELS[stance],
  ]
    .filter(Boolean)
    .join(" · ");

  await roll(
    traitRollFormula(modifier, stance),
    `${weaponName || "Arma"} · ataque`,
    detail,
    true,
    viewer,
    sheets,
  );
}

export async function rollTrait(
  trait: Trait,
  modifier: number,
  stance: RollStance,
  viewer: Viewer,
  sheets: Sheet[],
): Promise<void> {
  await roll(
    traitRollFormula(modifier, stance),
    TRAIT_LABELS[trait],
    stance === "normal" ? "" : STANCE_LABELS[stance],
    true,
    viewer,
    sheets,
  );
}

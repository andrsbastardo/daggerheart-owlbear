import OBR from "@owlbear-rodeo/sdk";
import type { DomainCard, Sheet, Weapon } from "../domain/types";
import { canEdit, type Viewer } from "../domain/permissions";
import type { Feature } from "../components/FeatureList";
import { publishToLog } from "./store";

/**
 * Playing a card or feature publishes its text to the table log.
 *
 * Shared by the main panel and the token popover so both surfaces behave
 * identically, and so the permission check cannot drift between them.
 */

async function actorName(): Promise<string> {
  return OBR.player.getName().catch(() => "Alguien");
}

export async function playCard(
  sheet: Sheet,
  card: DomainCard,
  viewer: Viewer,
): Promise<void> {
  if (!canEdit(sheet, viewer)) return;

  await publishToLog({
    source: "card",
    title: card.name || "Carta sin nombre",
    text: card.text,
    subtitle: card.domain,
    actorName: await actorName(),
    sheetName: sheet.name,
  });
}

/**
 * Publishes a weapon's text, the way a card or a feature is played.
 *
 * The subtitle carries range and damage, which is the context the table
 * wants beside the weapon's own wording.
 */
export async function playWeapon(
  sheet: Sheet,
  weapon: Weapon,
  viewer: Viewer,
): Promise<void> {
  if (!canEdit(sheet, viewer)) return;

  await publishToLog({
    source: "card",
    title: weapon.name || "Arma",
    text: weapon.text,
    subtitle: [weapon.range, weapon.damage].filter(Boolean).join(" · "),
    actorName: await actorName(),
    sheetName: sheet.name,
  });
}

export async function playFeature(
  sheet: Sheet,
  feature: Feature,
  viewer: Viewer,
): Promise<void> {
  if (!canEdit(sheet, viewer)) return;

  await publishToLog({
    source: "feature",
    title: feature.name || "Rasgo sin nombre",
    text: feature.text,
    subtitle: "",
    actorName: await actorName(),
    sheetName: sheet.name,
  });
}

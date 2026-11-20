import OBR, { buildShape, type Item } from "@owlbear-rodeo/sdk";
import type { Sheet } from "../domain/types";
import { trackBars, type TrackBar } from "../domain/trackBars";
import { EXTENSION_ID } from "./constants";

/**
 * Draws a sheet's tracks as small bars above its token.
 *
 * The bars are ordinary scene items attached to the token, so Owlbear moves
 * and deletes them with it and every player sees the same thing. They are
 * rebuilt rather than patched: a handful of shapes is cheap, and diffing
 * them against the previous layout would be far more code than it saves.
 *
 * Only the bars are ours to touch. Everything is tagged with
 * `TRACK_BAR_KEY` so a rebuild never removes an attachment belonging to the
 * token, another extension, or the GM.
 */

/** Marks an item as one of our bars, and says which token it belongs to. */
const TRACK_BAR_KEY = `${EXTENSION_ID}/trackBar`;

/** Bar geometry, in Owlbear grid units at 150 DPI. */
const BAR_WIDTH = 140;
const BAR_HEIGHT = 14;
const BAR_GAP = 4;
/** Clear of the token's top edge, so art is not covered. */
const BAR_OFFSET = 26;

function isOurBar(item: Item): boolean {
  return item.metadata[TRACK_BAR_KEY] !== undefined;
}

/**
 * Builds the shapes for one token's bars.
 *
 * Each bar is two rectangles: the track behind and the filled part in
 * front. Drawing the fill as its own shape keeps the proportions exact at
 * any zoom, which a stroked partial rectangle would not.
 */
function buildBars(token: Item, bars: TrackBar[], dpi: number): Item[] {
  const scale = dpi / 150;
  const width = BAR_WIDTH * scale;
  const height = BAR_HEIGHT * scale;
  const gap = BAR_GAP * scale;

  // Stack upwards from just above the token, newest row on top.
  const bottom = token.position.y - BAR_OFFSET * scale;
  const left = token.position.x - width / 2;

  const items: Item[] = [];

  bars.forEach((bar, index) => {
    const y = bottom - index * (height + gap);
    const common = {
      [TRACK_BAR_KEY]: { tokenId: token.id, key: bar.key },
    };

    items.push(
      buildShape()
        .shapeType("RECTANGLE")
        .width(width)
        .height(height)
        .position({ x: left, y })
        .fillColor("#1a1a1f")
        .fillOpacity(0.75)
        .strokeColor("#000000")
        .strokeOpacity(0.5)
        .strokeWidth(1)
        .attachedTo(token.id)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        // The bars describe the token, so they must not be scaled or
        // rotated with it: a rotated token would tip its own health bar.
        .disableAttachmentBehavior(["SCALE", "ROTATION"])
        .metadata(common)
        .name(`${bar.label} (fondo)`)
        .build(),
    );

    const filled = bar.max > 0 ? bar.marked / bar.max : 0;
    if (filled > 0) {
      items.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(Math.max(1, width * filled))
          .height(height)
          .position({ x: left, y })
          .fillColor(bar.color)
          .fillOpacity(0.95)
          .strokeOpacity(0)
          .strokeWidth(0)
          .attachedTo(token.id)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .disableAttachmentBehavior(["SCALE", "ROTATION"])
          .metadata(common)
          .name(`${bar.label} ${bar.marked}/${bar.max}`)
          .build(),
      );
    }
  });

  return items;
}

/**
 * Redraws one token's bars to match its sheet.
 *
 * Passing no sheet removes them, which is what unlinking a token wants.
 */
export async function syncTokenBars(
  token: Item,
  sheet: Sheet | undefined,
): Promise<void> {
  const existing = await OBR.scene.items.getItemAttachments([token.id]);
  const ours = existing.filter(isOurBar).map((item) => item.id);

  const bars = sheet ? trackBars(sheet) : [];

  // Remove first, so a shrinking set never leaves a stale row behind.
  if (ours.length > 0) await OBR.scene.items.deleteItems(ours);
  if (bars.length === 0) return;

  const dpi = await OBR.scene.grid.getDpi();
  await OBR.scene.items.addItems(buildBars(token, bars, dpi));
}

/** Removes every bar we drew for a token, leaving other attachments alone. */
export async function clearTokenBars(tokenId: string): Promise<void> {
  const attachments = await OBR.scene.items.getItemAttachments([tokenId]);
  const ours = attachments.filter(isOurBar).map((item) => item.id);
  if (ours.length > 0) await OBR.scene.items.deleteItems(ours);
}

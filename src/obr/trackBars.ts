import OBR, { buildShape, isImage, type Image, type Item } from "@owlbear-rodeo/sdk";
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

/** Bar geometry, as a fraction of one grid cell. */
const BAR_WIDTH = 0.9;
const BAR_HEIGHT = 0.1;
const BAR_GAP = 0.03;
/** Gap between the token's top edge and the first bar. */
const BAR_OFFSET = 0.08;

/**
 * Where a token's top edge actually is, and how wide it is.
 *
 * An image's `position` is its anchor point, not its centre: `grid.offset`
 * says where that anchor sits inside the picture, in the image's own pixels.
 * Converting that to scene units needs both the scene's DPI and the image's
 * own, plus the item's scale. Guessing a fixed offset instead puts the bars
 * inside the art on any token that is not exactly one cell.
 */
function tokenBounds(token: Image, dpi: number) {
  const ratio = dpi / token.grid.dpi;
  const width = token.image.width * ratio * token.scale.x;
  const height = token.image.height * ratio * token.scale.y;

  const left = token.position.x - token.grid.offset.x * ratio * token.scale.x;
  const top = token.position.y - token.grid.offset.y * ratio * token.scale.y;

  return { left, top, width, height, centerX: left + width / 2 };
}

function isOurBar(item: Item): boolean {
  return item.metadata[TRACK_BAR_KEY] !== undefined;
}

/**
 * Our bars for one token, found by our own mark.
 *
 * Scanning the scene rather than asking for the token's attachments: an
 * attachment query is the obvious route, but a bar whose parent link was
 * lost would then never be found and would linger on the map forever. The
 * mark carries the token id, so this cannot miss one.
 */
async function ourBarsFor(tokenId: string): Promise<string[]> {
  const items = await OBR.scene.items.getItems((item) => {
    const mark = item.metadata[TRACK_BAR_KEY];
    return (
      typeof mark === "object" &&
      mark !== null &&
      (mark as { tokenId?: unknown }).tokenId === tokenId
    );
  });
  return items.map((item) => item.id);
}

/**
 * Builds the shapes for one token's bars.
 *
 * Each bar is two rectangles: the track behind and the filled part in
 * front. Drawing the fill as its own shape keeps the proportions exact at
 * any zoom, which a stroked partial rectangle would not.
 */
function buildBars(token: Image, bars: TrackBar[], dpi: number): Item[] {
  const box = tokenBounds(token, dpi);

  // Sized against the token so a large one gets proportionate bars.
  const width = Math.min(box.width * BAR_WIDTH, dpi * 1.5);
  const height = Math.max(dpi * BAR_HEIGHT, 6);
  const gap = dpi * BAR_GAP;

  // Stack upwards from just above the token's real top edge.
  const bottom = box.top - dpi * BAR_OFFSET - height;
  const left = box.centerX - width / 2;

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
  // Bars are positioned from the image's own geometry, so only an image
  // token can carry them.
  if (!isImage(token)) return;

  const ours = await ourBarsFor(token.id);
  const bars = sheet ? trackBars(sheet) : [];

  // Remove first, so a shrinking set never leaves a stale row behind.
  if (ours.length > 0) await OBR.scene.items.deleteItems(ours);
  if (bars.length === 0) return;

  const dpi = await OBR.scene.grid.getDpi();
  await OBR.scene.items.addItems(buildBars(token, bars, dpi));
}

/** Removes every bar we drew for a token, leaving other attachments alone. */
export async function clearTokenBars(tokenId: string): Promise<void> {
  const ours = await ourBarsFor(tokenId);
  if (ours.length > 0) await OBR.scene.items.deleteItems(ours);
}

/**
 * Removes every bar in the scene, whatever token it belonged to.
 *
 * For the case the drawing code cannot reach on its own: bars left by a
 * token that was deleted while another client held the scene.
 */
export async function clearAllBars(): Promise<void> {
  const items = await OBR.scene.items.getItems(isOurBar);
  if (items.length > 0) {
    await OBR.scene.items.deleteItems(items.map((item) => item.id));
  }
}

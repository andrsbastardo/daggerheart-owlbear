import OBR, {
  buildLabel,
  buildShape,
  isImage,
  type Image,
  type Item,
} from "@owlbear-rodeo/sdk";
import type { Sheet } from "../domain/types";
import {
  isEmptyDisplay,
  tokenDisplay,
  type Corner,
  type TokenDisplay,
} from "../domain/trackBars";
import { EXTENSION_ID } from "./constants";

/**
 * Draws a sheet's numbers on its token: a health bar across its lower edge
 * and a value in each corner.
 *
 * These are ordinary scene items attached to the token, so Owlbear moves
 * and deletes them with it and every player sees the same thing. They are
 * rebuilt rather than patched: a handful of items is cheap, and diffing
 * them against the previous layout would be more code than it saves.
 *
 * Only our own items are ever touched. Everything carries `TRACK_BAR_KEY`
 * with its token's id, so a redraw cannot remove an attachment belonging to
 * the token, to another extension, or to the GM.
 */

/** Marks an item as ours, and says which token it belongs to. */
const TRACK_BAR_KEY = `${EXTENSION_ID}/trackBar`;

/** Geometry, as fractions of one grid cell or of the token. */
const BAR_HEIGHT = 0.22;
const BAR_WIDTH = 0.95;
/** How far the bar rides up onto the token's lower edge. */
const BAR_OVERLAP = 0.08;
const BADGE_SIZE = 0.3;

function isOurItem(item: Item): boolean {
  return item.metadata[TRACK_BAR_KEY] !== undefined;
}

/**
 * Our items for one token, found by our own mark.
 *
 * Scanning the scene rather than asking for the token's attachments: an
 * attachment query is the obvious route, but an item whose parent link was
 * lost would then never be found and would linger on the map forever. The
 * mark carries the token id, so this cannot miss one.
 */
async function ourItemsFor(tokenId: string): Promise<string[]> {
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
 * Where a token's edges actually are.
 *
 * An image's `position` is its anchor point, not its centre: `grid.offset`
 * says where that anchor sits inside the picture, in the image's own
 * pixels. Converting that to scene units needs both the scene's DPI and the
 * image's own, plus the item's scale. A fixed offset instead would put the
 * bar inside the art on any token that is not exactly one cell.
 */
function tokenBounds(token: Image, dpi: number) {
  const ratio = dpi / token.grid.dpi;
  const width = token.image.width * ratio * token.scale.x;
  const height = token.image.height * ratio * token.scale.y;

  const left = token.position.x - token.grid.offset.x * ratio * token.scale.x;
  const top = token.position.y - token.grid.offset.y * ratio * token.scale.y;

  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    centerX: left + width / 2,
  };
}

type Bounds = ReturnType<typeof tokenBounds>;

/** The centre point for a corner badge. */
function cornerCentre(corner: Corner, box: Bounds, size: number) {
  /*
   * Pulled inwards from the bounding box. Token art is usually a circle
   * inside a square image, so a badge flush with the corner would float
   * off the artwork entirely.
   */
  const inset = box.width * 0.12 + size / 2;

  const x =
    corner === "top-left" || corner === "bottom-left"
      ? box.left + inset
      : box.right - inset;

  // The bottom pair sits above the health bar rather than behind it.
  const y =
    corner === "top-left" || corner === "top-right"
      ? box.top + inset
      : box.bottom - inset - box.height * 0.1;

  return { x, y };
}

/** Builds every item for one token. */
function buildDisplay(
  token: Image,
  display: TokenDisplay,
  dpi: number,
): Item[] {
  const box = tokenBounds(token, dpi);
  const items: Item[] = [];
  const mark = (key: string) => ({
    [TRACK_BAR_KEY]: { tokenId: token.id, key },
  });

  // ---- The health bar, across the token's lower edge --------------------

  if (display.bar) {
    const width = box.width * BAR_WIDTH;
    const height = dpi * BAR_HEIGHT;
    const left = box.centerX - width / 2;
    const y = box.bottom - height - box.height * BAR_OVERLAP;

    // The empty track behind.
    items.push(
      buildShape()
        .shapeType("RECTANGLE")
        .width(width)
        .height(height)
        .position({ x: left, y })
        .fillColor("#15151a")
        .fillOpacity(0.85)
        .strokeColor("#000000")
        .strokeOpacity(0.6)
        .strokeWidth(1)
        .attachedTo(token.id)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        // Follow the token, but do not scale or rotate with it: a rotated
        // token would otherwise tip its own health bar.
        .disableAttachmentBehavior(["SCALE", "ROTATION"])
        .metadata(mark("bar-bg"))
        .name("Vida (fondo)")
        .build(),
    );

    /*
     * The filled part is its own shape rather than a partial stroke, so the
     * proportion stays exact at any zoom. HP counts damage taken, so what
     * is drawn is what remains: the bar empties as it is marked.
     */
    const remaining =
      display.bar.max > 0
        ? (display.bar.max - display.bar.marked) / display.bar.max
        : 0;

    if (remaining > 0) {
      items.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(Math.max(1, width * remaining))
          .height(height)
          .position({ x: left, y })
          .fillColor(display.bar.color)
          .fillOpacity(0.95)
          .strokeOpacity(0)
          .strokeWidth(0)
          .attachedTo(token.id)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .disableAttachmentBehavior(["SCALE", "ROTATION"])
          .metadata(mark("bar-fill"))
          .name("Vida")
          .build(),
      );
    }

    // The reading, centred on the bar.
    items.push(
      buildLabel()
        .plainText(display.bar.text)
        .fontSize(height * 0.72)
        .fontWeight(700)
        .textAlign("CENTER")
        .textAlignVertical("MIDDLE")
        .fillColor("#ffffff")
        .backgroundOpacity(0)
        .padding(0)
        .position({ x: box.centerX, y: y + height / 2 })
        .attachedTo(token.id)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .disableAttachmentBehavior(["SCALE", "ROTATION"])
        .metadata(mark("bar-text"))
        .name(`Vida ${display.bar.text}`)
        .build(),
    );
  }

  // ---- Corner values ----------------------------------------------------

  const size = dpi * BADGE_SIZE;

  for (const value of display.corners) {
    const at = cornerCentre(value.corner, box, size);

    items.push(
      buildLabel()
        .plainText(value.text)
        .fontSize(size * 0.6)
        .fontWeight(700)
        .textAlign("CENTER")
        .textAlignVertical("MIDDLE")
        .fillColor("#ffffff")
        .backgroundColor(value.color)
        .backgroundOpacity(0.92)
        .padding(size * 0.2)
        .position(at)
        .attachedTo(token.id)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .disableAttachmentBehavior(["SCALE", "ROTATION"])
        .metadata(mark(value.key))
        .name(`${value.label} ${value.text}`)
        .build(),
    );
  }

  return items;
}

/**
 * Redraws one token's display to match its sheet.
 *
 * Passing no sheet removes everything, which is what unlinking wants.
 */
export async function syncTokenBars(
  token: Item,
  sheet: Sheet | undefined,
): Promise<void> {
  // The layout is derived from the image's own geometry, so only an image
  // token can carry it.
  if (!isImage(token)) return;

  const ours = await ourItemsFor(token.id);
  const display: TokenDisplay = sheet
    ? tokenDisplay(sheet)
    : { corners: [] };

  // Remove first, so a shrinking set never leaves a stale item behind.
  if (ours.length > 0) await OBR.scene.items.deleteItems(ours);
  if (isEmptyDisplay(display)) return;

  const dpi = await OBR.scene.grid.getDpi();
  await OBR.scene.items.addItems(buildDisplay(token, display, dpi));
}

/** Removes everything we drew for a token, leaving other items alone. */
export async function clearTokenBars(tokenId: string): Promise<void> {
  const ours = await ourItemsFor(tokenId);
  if (ours.length > 0) await OBR.scene.items.deleteItems(ours);
}

/**
 * Removes every marker in the scene, whatever token it belonged to.
 *
 * For the case the drawing code cannot reach on its own: items left by a
 * token that was deleted while another client held the scene.
 */
export async function clearAllBars(): Promise<void> {
  const items = await OBR.scene.items.getItems(isOurItem);
  if (items.length > 0) {
    await OBR.scene.items.deleteItems(items.map((item) => item.id));
  }
}

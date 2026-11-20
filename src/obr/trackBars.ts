import OBR, {
  buildShape,
  buildText,
  isImage,
  type BoundingBox,
  type Item,
} from "@owlbear-rodeo/sdk";
import type { Sheet } from "../domain/types";
import {
  isEmptyDisplay,
  tokenDisplay,
  type Corner,
  type CornerValue,
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

/*
 * Geometry, in grid cells.
 *
 * Everything is sized against the scene's DPI — one grid square — and never
 * against the token or the viewport. A marker is a readout, so it should
 * stay the same size whether it labels a goblin or a dragon, and the map's
 * own zoom already scales the whole scene with it.
 *
 * The one exception is the bar's width, which is capped to the token so a
 * one-cell bar does not hang off a smaller miniature.
 */
const BAR_HEIGHT = 0.2;
const BAR_WIDTH = 1;
/**
 * Gap below the token, in cells.
 *
 * Wide enough that the bottom pair of badges, which straddle the token's
 * lower corners, clear the bar instead of touching it.
 */
const BAR_GAP = 0.12;
const BADGE_SIZE = 0.34;

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

/*
 * Token geometry comes from `OBR.scene.items.getItemBounds`, not from the
 * image's own fields.
 *
 * An image's `position` is an anchor point whose place inside the picture
 * is set by `grid.offset`, in the image's own pixels, and turning that into
 * scene units means juggling two DPIs and the item's scale. Owlbear already
 * knows where the token is on screen, so it is asked instead of guessed.
 * Attached items take absolute scene coordinates, so these values are used
 * as they come.
 */

/**
 * The centre point for a corner badge.
 *
 * Badges sit on the token's rim, not on the corners of its bounding box.
 * Token art is almost always a circle inside a square image, so the box's
 * corners are empty map: a badge placed there floats away from the token,
 * which is exactly how it looked before this.
 *
 * So the position is taken around a circle inscribed in the box, at 45
 * degrees to each corner, which puts each badge half on the artwork and
 * half off it.
 */
function cornerCentre(corner: Corner, box: BoundingBox) {
  const radius = Math.min(box.width, box.height) / 2;
  // sin(45°), so the badge lands on the diagonal of the rim.
  const reach = radius * 0.7071;

  const left = corner === "top-left" || corner === "bottom-left";
  const top = corner === "top-left" || corner === "top-right";

  return {
    x: box.center.x + (left ? -reach : reach),
    y: box.center.y + (top ? -reach : reach),
  };
}

/** Builds every item for one token. */
function buildDisplay(
  token: Item,
  box: BoundingBox,
  display: TokenDisplay,
  dpi: number,
): Item[] {
  const items: Item[] = [];
  const mark = (key: string) => ({
    [TRACK_BAR_KEY]: { tokenId: token.id, key },
  });

  // ---- The health bar, across the token's lower edge --------------------

  if (display.bar) {
    // One cell wide, but never wider than the token it belongs to.
    const width = Math.min(dpi * BAR_WIDTH, box.width);
    const height = dpi * BAR_HEIGHT;
    const left = box.center.x - width / 2;
    // Just below the token, clear of the art.
    const y = box.max.y + dpi * BAR_GAP;

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
      buildText()
        .plainText(display.bar.text)
        .textType("PLAIN")
        .fontSize(height * 0.8)
        .fontWeight(700)
        .textAlign("CENTER")
        .textAlignVertical("MIDDLE")
        .fillColor("#ffffff")
        .strokeOpacity(0)
        .strokeWidth(0)
        .width(width)
        .height(height)
        // Text is positioned by its corner, so start at the bar's own.
        .position({ x: left, y })
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
    items.push(
      ...buildBadge(
        token.id,
        value,
        cornerCentre(value.corner, box),
        size,
        mark,
      ),
    );
  }

  return items;
}

/**
 * One corner value: a white badge with a coloured outline and a dark
 * number on top.
 *
 * Two items rather than one, because a label cannot be a diamond or a
 * hexagon. A diamond is a square turned 45 degrees; a hexagon is its own
 * shape type. The number is drawn separately so it stays upright, since
 * rotating the badge would rotate any text inside it.
 */
function buildBadge(
  tokenId: string,
  value: CornerValue,
  centre: { x: number; y: number },
  size: number,
  mark: (key: string) => Record<string, unknown>,
): Item[] {
  const diamond = value.shape === "diamond";

  /*
   * A square turned 45 degrees sticks out further than its side length, so
   * it is drawn smaller to match the hexagons optically.
   */
  const box = diamond ? size * 0.72 : size;

  const attach = {
    attachedTo: tokenId,
    layer: "ATTACHMENT" as const,
  };

  const badge = buildShape()
    .shapeType(diamond ? "RECTANGLE" : "HEXAGON")
    .width(box)
    .height(box)
    // A shape is positioned by its corner, so pull back by half.
    .position({ x: centre.x - box / 2, y: centre.y - box / 2 })
    .rotation(diamond ? 45 : 0)
    .fillColor("#f7f7f5")
    .fillOpacity(1)
    .strokeColor(value.color)
    .strokeOpacity(1)
    .strokeWidth(Math.max(2, size * 0.09))
    .attachedTo(attach.attachedTo)
    .layer(attach.layer)
    .locked(true)
    .disableHit(true)
    .disableAttachmentBehavior(["SCALE", "ROTATION"])
    .metadata(mark(`${value.key}-shape`))
    .name(value.label)
    .build();

  const text = buildText()
    .plainText(value.text)
    // A text item defaults to RICH, and we only ever set the plain string:
    // without this the badge draws empty.
    .textType("PLAIN")
    .fontSize(size * 0.52)
    .fontWeight(700)
    .textAlign("CENTER")
    .textAlignVertical("MIDDLE")
    .fillColor("#15151a")
    .strokeOpacity(0)
    .strokeWidth(0)
    .width(size * 1.4)
    .height(size)
    // Text is positioned by its corner too, and its box is wider than the
    // badge so a two-digit number stays centred.
    .position({ x: centre.x - size * 0.7, y: centre.y - size / 2 })
    .attachedTo(attach.attachedTo)
    .layer(attach.layer)
    .locked(true)
    .disableHit(true)
    .disableAttachmentBehavior(["SCALE", "ROTATION"])
    .metadata(mark(value.key))
    .name(`${value.label} ${value.text}`)
    .build();

  return [badge, text];
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

  /*
   * Measured after our own items are gone: the bounds of a group include
   * its attachments, so leaving them in would grow the box on every pass
   * and walk the markers off the token.
   */
  const [dpi, box] = await Promise.all([
    OBR.scene.grid.getDpi(),
    OBR.scene.items.getItemBounds([token.id]),
  ]);

  await OBR.scene.items.addItems(buildDisplay(token, box, display, dpi));
}

/** Removes everything we drew for a token, leaving other items alone. */
export async function clearTokenBars(tokenId: string): Promise<void> {
  const ours = await ourItemsFor(tokenId);
  if (ours.length > 0) await OBR.scene.items.deleteItems(ours);
}

/**
 * Removes markers whose token is no longer in the scene.
 *
 * Only the orphans: a marker belonging to a token that is still here may
 * have been drawn moments ago by another client, and deleting it would
 * start the two of them undoing each other's work on every pass.
 */
export async function clearOrphanBars(): Promise<void> {
  const [markers, tokens] = await Promise.all([
    OBR.scene.items.getItems(isOurItem),
    OBR.scene.items.getItems(isImage),
  ]);

  const live = new Set(tokens.map((token) => token.id));
  const orphans = markers.filter((item) => {
    const mark = item.metadata[TRACK_BAR_KEY] as { tokenId?: unknown };
    return typeof mark?.tokenId !== "string" || !live.has(mark.tokenId);
  });

  if (orphans.length > 0) {
    await OBR.scene.items.deleteItems(orphans.map((item) => item.id));
  }
}

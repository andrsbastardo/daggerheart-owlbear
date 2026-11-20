import OBR from "@owlbear-rodeo/sdk";
import { TOAST_POPOVER_ID } from "./constants";
import { asset } from "./asset";

/**
 * Footprint in the bottom-right corner.
 *
 * The height is just a starting value for a roll-sized card: the page
 * measures itself on mount and calls `fitToastPopover` to match its real
 * content, so opening small avoids a tall frame flashing over the map
 * before it shrinks.
 */
const WIDTH = 350;
const INITIAL_HEIGHT = 80;

/**
 * Ceiling for the fitted height, as a share of the map viewport.
 *
 * A long card could otherwise grow the frame until it covers the board.
 * Scaling with the viewport keeps the toast proportionate on a laptop and
 * on a large monitor alike.
 */
export const MAX_TOAST_VIEWPORT_FRACTION = 0.25;

/** Floor, so the cap never collapses the card on a very short window. */
const MIN_TOAST_HEIGHT = 80;

/**
 * The current ceiling in pixels.
 *
 * Read from Owlbear rather than from `vh`: inside the popover iframe the
 * viewport units measure the frame itself, not the screen.
 */
export async function maxToastHeight(): Promise<number> {
  const viewportHeight = await OBR.viewport.getHeight().catch(() => 0);
  if (!viewportHeight) return MIN_TOAST_HEIGHT;

  return Math.max(
    MIN_TOAST_HEIGHT,
    Math.round(viewportHeight * MAX_TOAST_VIEWPORT_FRACTION),
  );
}

/** Clear of Owlbear's own bottom-right controls. */
const MARGIN_RIGHT = 16;
const MARGIN_BOTTOM = 56;

/**
 * Opens the floating toast over the map.
 *
 * Owlbear renders a popover in its own layer rather than inside our panel,
 * which is the only way to draw over the map. It is anchored by position to
 * the bottom-right of the viewport, with `hidePaper` so Owlbear paints no
 * frame of its own and the card is entirely ours to style.
 *
 * The popover is opened when there is something to show and closed when the
 * toast expires: left mounted it would sit over the map as an empty region
 * even with nothing in it.
 */
export async function openToastPopover(): Promise<void> {
  // window.innerWidth here is the panel iframe, not the screen, so ask
  // Owlbear for the real viewport instead.
  const [viewportWidth, viewportHeight] = await Promise.all([
    OBR.viewport.getWidth(),
    OBR.viewport.getHeight(),
  ]);

  await OBR.popover.open({
    id: TOAST_POPOVER_ID,
    url: asset("toasts.html"),
    width: WIDTH,
    height: INITIAL_HEIGHT,
    anchorReference: "POSITION",
    anchorPosition: {
      left: viewportWidth - MARGIN_RIGHT,
      top: viewportHeight - MARGIN_BOTTOM,
    },
    anchorOrigin: { horizontal: "RIGHT", vertical: "BOTTOM" },
    transformOrigin: { horizontal: "RIGHT", vertical: "BOTTOM" },
    // No frame: the toast cards provide their own surface.
    hidePaper: true,
    // Clicking the map must not dismiss the stack.
    disableClickAway: true,
  });
}

export async function closeToastPopover(): Promise<void> {
  await OBR.popover.close(TOAST_POPOVER_ID).catch(() => undefined);
}

/**
 * Shrinks the popover frame to the height of its card.
 *
 * Owlbear sizes a popover from the values given at open time, so without
 * this the frame keeps its initial height and the unused part sits over the
 * map as a dead rectangle. Called by the toast page once it has measured
 * itself, since only it knows how tall the card ended up.
 */
export async function fitToastPopover(height: number): Promise<void> {
  if (height <= 0) return;

  // Clamped so a long card cannot grow the frame across the board.
  const clamped = Math.min(height, await maxToastHeight());
  await OBR.popover.setHeight(TOAST_POPOVER_ID, clamped).catch(() => undefined);
}

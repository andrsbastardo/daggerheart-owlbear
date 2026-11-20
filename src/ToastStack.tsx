import { useEffect, useRef, useState } from "react";
import { DUALITY_LABELS, describeRollToast } from "./domain/dice";
import { useObrReady, useRoomState } from "./obr/useObr";
import {
  closeToastPopover,
  fitToastPopover,
  maxToastHeight,
} from "./obr/toastPopover";

/**
 * The floating toast, rendered in its own popover over the map.
 *
 * This page only draws the newest log entry. Deciding when a toast appears
 * and expires belongs to the panel, which opens and closes the popover —
 * leaving it mounted would sit an empty region over the board between
 * rolls, and a page cannot open its own popover before it exists.
 */
export function ToastStack() {
  const ready = useObrReady();
  const state = useRoomState(ready);

  /** Set when the viewer taps the card to dismiss it early. */
  const [dismissed, setDismissed] = useState<string>();

  const stack = useRef<HTMLDivElement>(null);

  // The log is newest-first.
  const current = state.log[0];
  const showing = current && current.id !== dismissed ? current : undefined;

  /*
   * Publish the cap to CSS, so the stylesheet that clips the card and the
   * logic that sizes the frame cannot disagree.
   *
   * The cap scales with the map viewport, which the iframe cannot measure
   * itself — `vh` here would be the frame, not the screen — so it comes
   * from Owlbear and is refreshed when the window resizes.
   */
  const [cap, setCap] = useState<number>();

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;

    const publish = async () => {
      const next = await maxToastHeight();
      if (cancelled) return;
      document.documentElement.style.setProperty(
        "--max-toast-height",
        `${next}px`,
      );
      setCap(next);
    };

    void publish();

    window.addEventListener("resize", publish);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", publish);
    };
  }, [ready]);

  /*
   * Fit the popover to the card.
   *
   * The popover is a fixed-size frame Owlbear places over the map, so a
   * frame taller than its content leaves an empty region sitting on the
   * board, and one shorter clips the card. Measuring after layout keeps the
   * frame matched to whatever the entry contains — up to the viewport-based
   * cap, beyond which the card clips its own text instead of covering the
   * map.
   */
  useEffect(() => {
    if (!ready) return;

    const element = stack.current;
    if (!element) return;

    const resize = () =>
      void fitToastPopover(Math.ceil(element.getBoundingClientRect().height));

    resize();

    // Text can reflow after fonts load or on a long entry wrapping.
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
    // `cap` is a dependency so the frame is re-fitted once the cap is known
    // and whenever the window resizes, not just when the entry changes.
  }, [ready, showing?.id, cap]);

  if (!showing) {
    return <div ref={stack} className="toast-stack" />;
  }

  const duality = showing.roll?.duality;

  return (
    <div ref={stack} className="toast-stack">
      <button
        // Keyed by entry so React remounts it, replaying the entry animation
        // when one toast replaces another.
        key={showing.id}
        type="button"
        className={`toast${duality ? ` ${duality.outcome}` : ""}`}
        // The flat summary is the accessible name; the visible layout splits
        // the same information across coloured spans.
        title={`${describeRollToast(showing)} — pulsa para descartar`}
        onClick={() => {
          // Remember the dismissal too: closing the popover alone would let
          // this same entry reappear if the panel reopens it.
          setDismissed(showing.id);
          void closeToastPopover();
        }}
      >
        <div className="toast-head">
          <strong className="toast-actor">{showing.actorName}</strong>
          <span className="toast-title">{showing.title}</span>
        </div>

        {showing.roll ? (
          <div className="toast-roll">
            <span className="toast-dice">
              {showing.roll.values.map((value, index) => (
                <span
                  key={index}
                  className={`die${
                    duality
                      ? index === 0
                        ? " hope"
                        : index === 1
                          ? " fear"
                          : ""
                      : ""
                  }`}
                >
                  {value}
                </span>
              ))}
            </span>

            {/*
              Show the modifier rather than folding it silently into the
              total: "7 9 18" leaves the table doing arithmetic to work out
              where the extra 2 came from.
            */}
            {showing.roll.modifier !== 0 && (
              <span className="toast-modifier">
                {showing.roll.modifier > 0 ? "+" : "−"}
                {Math.abs(showing.roll.modifier)}
              </span>
            )}

            <span
              className={`toast-total${duality ? ` ${duality.outcome}` : ""}`}
            >
              {showing.roll.total}
            </span>

            {duality && (
              <span className={`toast-outcome ${duality.outcome}`}>
                {DUALITY_LABELS[duality.outcome]}
              </span>
            )}
          </div>
        ) : (
          showing.text && <div className="toast-text">{showing.text}</div>
        )}
      </button>
    </div>
  );
}

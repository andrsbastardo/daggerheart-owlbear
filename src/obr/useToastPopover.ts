import { useEffect, useRef } from "react";
import type { RoomState } from "../domain/types";
import { closeToastPopover, openToastPopover } from "./toastPopover";
import { TOAST_LIFETIME_MS } from "./constants";

/**
 * Shows the floating toast only while there is something to show.
 *
 * The popover is an iframe Owlbear lays over the map, so leaving it mounted
 * would keep a dead region sitting on the board between rolls. Opening on a
 * new log entry and closing when it expires keeps the map clear.
 *
 * Driven from the panel rather than from inside the toast page, because a
 * page cannot close its own popover before it exists.
 */
export function useToastPopover(ready: boolean, state: RoomState): void {
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!ready) return;

    // The log already holds the session's history on first load; adopt it
    // as seen so opening the panel does not replay old entries.
    if (!primed.current) {
      for (const entry of state.log) seen.current.add(entry.id);
      primed.current = true;
      return;
    }

    const fresh = state.log.filter((entry) => !seen.current.has(entry.id));
    if (fresh.length === 0) return;

    for (const entry of fresh) seen.current.add(entry.id);

    void openToastPopover();

    // Restart the countdown: a new entry replaces whatever was showing, so
    // it gets the full lifetime rather than the remainder of the old one.
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void closeToastPopover();
    }, TOAST_LIFETIME_MS);
  }, [ready, state.log]);

  // Closing on unmount stops a popover outliving the panel that opened it.
  useEffect(() => {
    return () => {
      clearTimeout(timer.current);
      void closeToastPopover();
    };
  }, []);
}

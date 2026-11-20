import { useEffect, useRef, useState } from "react";
import type { Sheet } from "../domain/types";
import { saveSheet } from "./sheets";

const SAVE_DELAY_MS = 400;

/**
 * Sheet edits are held locally and flushed to their store after a pause.
 *
 * Without this, every keystroke would be a round trip that re-broadcasts the
 * state to the table. The local copy also means the input does not
 * fight the incoming sync while someone is still typing.
 */
export function useDebouncedSheet(remote: Sheet | undefined) {
  const [draft, setDraft] = useState<Sheet | undefined>(remote);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dirty = useRef(false);

  // Adopt incoming changes only when we have no unsaved local edits,
  // so a teammate's update never overwrites what is being typed.
  useEffect(() => {
    if (!dirty.current) setDraft(remote);
  }, [remote]);

  // Switching to a different sheet discards any pending debounce target.
  useEffect(() => {
    dirty.current = false;
    setDraft(remote);
  }, [remote?.id]);

  useEffect(() => {
    return () => clearTimeout(timer.current);
  }, []);

  const edit = (next: Sheet) => {
    dirty.current = true;
    setDraft(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void saveSheet(next).finally(() => {
        dirty.current = false;
      });
    }, SAVE_DELAY_MS);
  };

  return { draft, edit };
}

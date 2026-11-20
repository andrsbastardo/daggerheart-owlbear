import { useEffect, useRef, useState } from "react";
import { STANCE_LABELS, type RollStance } from "../domain/dice";

interface Props {
  label: string;
  disabled?: boolean;
  onRoll: (stance: RollStance) => void;
}

const STANCES: RollStance[] = ["normal", "advantage", "disadvantage"];

/**
 * The die button beside a trait.
 *
 * Opens a small menu rather than rolling on the first tap, because which
 * stance applies is a decision the table makes per roll — rolling straight
 * away would get it wrong more often than not.
 */
export function TraitRoller({ label, disabled, onRoll }: Props) {
  const [open, setOpen] = useState(false);
  /** Which edge the menu hangs from, so it never leaves the panel. */
  const [align, setAlign] = useState<"left" | "right">("right");
  const container = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  /*
   * Flip the menu to whichever side keeps it inside the panel.
   *
   * Hanging from the button's right edge works for the right-hand columns
   * but pushes the menu off-screen on the left one, since the panel is only
   * a few hundred pixels wide. Measuring after it opens handles any column
   * count without hardcoding which trait sits where.
   */
  useEffect(() => {
    if (!open) return;

    const element = menu.current;
    if (!element) return;

    const bounds = element.getBoundingClientRect();
    if (bounds.left < 0) setAlign("left");
    else if (bounds.right > document.documentElement.clientWidth) {
      setAlign("right");
    }
  }, [open, align]);

  // Reset on close so the next open measures from the default side.
  useEffect(() => {
    if (!open) setAlign("right");
  }, [open]);

  // Close on an outside click or Escape, the way a menu is expected to behave.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="trait-roller" ref={container}>
      <button
        type="button"
        className="trait-die"
        disabled={disabled}
        aria-label={`Tirar ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`Tirar ${label}`}
        onClick={() => setOpen(!open)}
      >
        🎲
      </button>

      {open && (
        <div ref={menu} className={`trait-menu ${align}`} role="menu">
          {STANCES.map((stance) => (
            <button
              key={stance}
              type="button"
              role="menuitem"
              className={`trait-menu-item ${stance}`}
              onClick={() => {
                setOpen(false);
                onRoll(stance);
              }}
            >
              {STANCE_LABELS[stance]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

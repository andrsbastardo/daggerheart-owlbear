import { useState } from "react";
import type { DiceSlot } from "../domain/types";
import { parseFormula } from "../domain/dice";

interface Props {
  slots: DiceSlot[];
  onRoll: (slot: DiceSlot) => void;
  onChange: (slots: DiceSlot[]) => void;
}

/**
 * The dice bar pinned to the bottom of the panel.
 *
 * Six slots, each a one-tap roll. Editing is behind a toggle so a mis-tap
 * during play rolls dice rather than silently rewriting a button.
 */
export function DiceBar({ slots, onRoll, onChange }: Props) {
  const [editing, setEditing] = useState(false);

  const patchSlot = (slotId: string, changes: Partial<DiceSlot>) =>
    onChange(
      slots.map((slot) =>
        slot.id === slotId ? { ...slot, ...changes } : slot,
      ),
    );

  return (
    <div className="dice-bar">
      <div className="row spread" style={{ marginBottom: 6 }}>
        <h3>Dados</h3>
        <button
          type="button"
          className="icon"
          aria-pressed={editing}
          onClick={() => setEditing(!editing)}
        >
          {editing ? "Listo" : "Configurar"}
        </button>
      </div>

      {editing ? (
        <div className="col">
          {slots.map((slot) => {
            const parsed = parseFormula(slot.formula);

            return (
              <div key={slot.id} className="dice-edit-row">
                <input
                  type="text"
                  value={slot.label}
                  aria-label="Nombre del botón"
                  placeholder="Nombre"
                  onChange={(event) =>
                    patchSlot(slot.id, { label: event.target.value })
                  }
                />
                <input
                  type="text"
                  value={slot.formula}
                  aria-label="Fórmula"
                  placeholder="2d12"
                  style={{
                    borderColor: parsed.ok ? undefined : "var(--hp)",
                  }}
                  onChange={(event) =>
                    patchSlot(slot.id, { formula: event.target.value })
                  }
                />
                <label
                  className="row small"
                  style={{ gap: 4, marginBottom: 0, whiteSpace: "nowrap" }}
                  title="El primer d12 cuenta como Esperanza y el segundo como Miedo"
                >
                  <input
                    type="checkbox"
                    checked={slot.duality}
                    style={{ width: "auto" }}
                    onChange={(event) =>
                      patchSlot(slot.id, { duality: event.target.checked })
                    }
                  />
                  Dualidad
                </label>

                {!parsed.ok && (
                  <div className="dice-error small">
                    {parsed.error.message}
                  </div>
                )}
              </div>
            );
          })}

          <div className="small muted">
            Marca «Dualidad» para que la tirada sume Esperanza o Miedo sola.
          </div>
        </div>
      ) : (
        <div className="dice-row">
          {slots.map((slot) => {
            const parsed = parseFormula(slot.formula);

            return (
              <button
                key={slot.id}
                type="button"
                className={`dice-button${slot.duality ? " duality" : ""}`}
                disabled={!parsed.ok}
                title={
                  parsed.ok
                    ? `Tirar ${slot.formula}`
                    : parsed.error.message
                }
                onClick={() => onRoll(slot)}
              >
                <span className="dice-label">{slot.label || "—"}</span>
                <span className="dice-formula">{slot.formula}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

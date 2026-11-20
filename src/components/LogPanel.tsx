import type { LogEntry, LogRoll } from "../domain/types";
import { DUALITY_LABELS } from "../domain/dice";

interface Props {
  entries: LogEntry[];
  canClear: boolean;
  onClear: () => void;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Renders the dice of one roll.
 *
 * A duality roll colours its first two dice as Hope and Fear so the result
 * reads at a glance; everything else is a plain die.
 */
function RollDetail({ roll }: { roll: LogRoll }) {
  const duality = roll.duality;

  return (
    <>
      <div className="roll-dice">
        {roll.values.map((value, index) => {
          const flavour = duality
            ? index === 0
              ? " hope"
              : index === 1
                ? " fear"
                : ""
            : "";

          return (
            <span
              key={index}
              className={`die${flavour}`}
              title={
                duality && index < 2
                  ? index === 0
                    ? "Esperanza"
                    : "Miedo"
                  : undefined
              }
            >
              {value}
            </span>
          );
        })}

        {roll.modifier !== 0 && (
          <span className="small muted">
            {roll.modifier > 0 ? `+${roll.modifier}` : roll.modifier}
          </span>
        )}

        <span
          className={`roll-total${duality ? ` ${duality.outcome}` : ""}`}
        >
          = {roll.total}
        </span>

        {duality && (
          <span className={`roll-outcome ${duality.outcome}`}>
            {DUALITY_LABELS[duality.outcome]}
          </span>
        )}
      </div>

      <div className="small muted" style={{ marginTop: 4 }}>
        {roll.formula}
      </div>
    </>
  );
}

/**
 * The table log. Owlbear has no chat, so this is where played cards and
 * adversary features land — stored with the room, so everyone sees the same
 * list and it survives a reload.
 */
export function LogPanel({ entries, canClear, onClear }: Props) {
  if (entries.length === 0) {
    return (
      <div className="empty">
        Aún no hay nada en el registro. Tira unos dados o pulsa una carta de
        dominio para enviarla aquí.
      </div>
    );
  }

  return (
    <div className="col">
      {canClear && (
        <div className="row spread">
          <span className="small muted">
            {entries.length}{" "}
            {entries.length === 1 ? "entrada" : "entradas"}
          </span>
          <button type="button" className="icon danger" onClick={onClear}>
            Vaciar registro
          </button>
        </div>
      )}

      {entries.map((entry) => (
        <div key={entry.id} className="list-item readonly">
          <div className="row spread">
            <strong className="grow">{entry.title}</strong>
            <span className="small muted">{formatTime(entry.playedAt)}</span>
          </div>

          <div className="small muted">
            {entry.actorName}
            {entry.sheetName && entry.sheetName !== entry.actorName
              ? ` · ${entry.sheetName}`
              : ""}
            {entry.subtitle ? ` · ${entry.subtitle}` : ""}
          </div>

          {entry.roll && <RollDetail roll={entry.roll} />}

          {entry.text && (
            <div
              className="small"
              style={{ marginTop: 6, whiteSpace: "pre-wrap" }}
            >
              {entry.text}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

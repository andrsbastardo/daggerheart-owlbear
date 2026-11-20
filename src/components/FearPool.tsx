import { MAX_FEAR } from "../domain/types";

interface Props {
  fear: number;
  /** Players see the pool but cannot spend it. */
  readOnly: boolean;
  onChange: (fear: number) => void;
}

export function FearPool({ fear, readOnly, onChange }: Props) {
  const set = (index: number) => {
    const target = index + 1;
    onChange(fear === target ? index : target);
  };

  return (
    <div className="card">
      <div className="row spread">
        <h3>Miedo</h3>
        <span className="small muted">
          {fear}/{MAX_FEAR}
        </span>
      </div>
      <div className="track track-fear" style={{ marginTop: 6 }}>
        {Array.from({ length: MAX_FEAR }, (_, index) => (
          <button
            key={index}
            type="button"
            className={`pip${index < fear ? " on" : ""}`}
            disabled={readOnly}
            aria-label={`Miedo ${index + 1}`}
            aria-pressed={index < fear}
            onClick={() => set(index)}
          />
        ))}
      </div>
      {readOnly && (
        <div className="small muted" style={{ marginTop: 6 }}>
          Solo el DJ puede gastar Miedo.
        </div>
      )}
    </div>
  );
}

import type { Track as TrackModel } from "../domain/types";

interface TrackProps {
  label: string;
  flavour: "hp" | "stress" | "hope" | "armor" | "fear";
  track: TrackModel;
  disabled?: boolean;
  onChange: (next: TrackModel) => void;
  /** Hide the max-pips input (e.g. for the GM's Fear pool). */
  fixedMax?: boolean;
}

/**
 * A row of clickable pips. Clicking a pip marks up to and including it;
 * clicking the last marked pip clears it, which is how players actually
 * tick damage and stress up and down at the table.
 */
export function Track({
  label,
  flavour,
  track,
  disabled,
  onChange,
  fixedMax,
}: TrackProps) {
  const setMarked = (index: number) => {
    const target = index + 1;
    onChange({ ...track, marked: track.marked === target ? index : target });
  };

  const setMax = (max: number) => {
    const clamped = Math.max(1, Math.min(20, max));
    onChange({ max: clamped, marked: Math.min(track.marked, clamped) });
  };

  return (
    <div className="field">
      <div className="row spread">
        <label>
          {label} <span className="small">{track.marked}/{track.max}</span>
        </label>
        {!fixedMax && (
          <input
            className="field-sm"
            type="number"
            min={1}
            max={20}
            value={track.max}
            disabled={disabled}
            aria-label={`${label} máximo`}
            onChange={(event) => setMax(Number(event.target.value))}
            style={{ width: 52, padding: "2px 4px", fontSize: 11 }}
          />
        )}
      </div>
      <div className={`track track-${flavour}`}>
        {Array.from({ length: track.max }, (_, index) => (
          <button
            key={index}
            type="button"
            className={`pip${index < track.marked ? " on" : ""}`}
            disabled={disabled}
            aria-label={`${label} ${index + 1}`}
            aria-pressed={index < track.marked}
            onClick={() => setMarked(index)}
          />
        ))}
      </div>
    </div>
  );
}

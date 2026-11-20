import type { EnvironmentSheet } from "../domain/types";
import { NumberField, TextAreaField, TextField } from "./Field";
import { FeatureList, type Feature } from "./FeatureList";
import { CategoryField } from "./CategoryField";

interface Props {
  sheet: EnvironmentSheet;
  readOnly: boolean;
  onChange: (sheet: EnvironmentSheet) => void;
  onPlayFeature: (feature: Feature) => void;
  /** Categories already in use, offered as suggestions. */
  categories: string[];
}

/** The environment's type from the rules, not the GM's own grouping. */
const ENVIRONMENT_TYPES = ["Exploration", "Social", "Traversal", "Event"];

export function EnvironmentEditor({
  sheet,
  readOnly,
  onChange,
  onPlayFeature,
  categories,
}: Props) {
  const patch = (changes: Partial<EnvironmentSheet>) =>
    onChange({ ...sheet, ...changes });


  return (
    <div className="col">
      <div className="card">
        <TextField
          label="Nombre"
          value={sheet.name}
          disabled={readOnly}
          onChange={(name) => patch({ name })}
        />
        <div style={{ marginTop: 6 }}>
          <CategoryField
            value={sheet.category}
            suggestions={categories}
            disabled={readOnly}
            onChange={(category) => patch({ category })}
          />
        </div>
        <div className="grid-3" style={{ marginTop: 6 }}>
          <NumberField
            label="Nivel (tier)"
            value={sheet.tier}
            min={1}
            max={4}
            disabled={readOnly}
            onChange={(tier) => patch({ tier })}
          />
          <div className="field">
            <label>Tipo</label>
            <select
              value={sheet.environmentType}
              disabled={readOnly}
              onChange={(event) =>
                patch({ environmentType: event.target.value })
              }
            >
              {ENVIRONMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <NumberField
            label="Dificultad"
            value={sheet.difficulty}
            min={0}
            disabled={readOnly}
            onChange={(difficulty) => patch({ difficulty })}
          />
        </div>
      </div>

      <div className="card">
        <TextAreaField
          label="Impulsos"
          value={sheet.impulses}
          rows={2}
          disabled={readOnly}
          placeholder="Qué quiere este entorno, cómo presiona a los PJ"
          onChange={(impulses) => patch({ impulses })}
        />
      </div>

      <FeatureList
        title="Rasgos del entorno"
        features={sheet.features}
        readOnly={readOnly}
        onChange={(features) => patch({ features })}
        onPlay={onPlayFeature}
      />

      <div className="card">
        <TextAreaField
          label="Notas del DJ"
          value={sheet.notes}
          rows={3}
          disabled={readOnly}
          onChange={(notes) => patch({ notes })}
        />
      </div>
    </div>
  );
}

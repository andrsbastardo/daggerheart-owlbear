import type { AdversarySheet } from "../domain/types";
import { NumberField, TextAreaField, TextField } from "./Field";
import { Track } from "./Track";
import { FeatureList, type Feature } from "./FeatureList";
import { CategoryField } from "./CategoryField";

interface Props {
  sheet: AdversarySheet;
  readOnly: boolean;
  onChange: (sheet: AdversarySheet) => void;
  onPlayFeature: (feature: Feature) => void;
  /** Categories already in use, offered as suggestions. */
  categories: string[];
}

const ROLES = [
  "Bruiser",
  "Horde",
  "Leader",
  "Minion",
  "Ranged",
  "Skulk",
  "Social",
  "Solo",
  "Standard",
  "Support",
];

export function AdversaryEditor({
  sheet,
  readOnly,
  onChange,
  onPlayFeature,
  categories,
}: Props) {
  const patch = (changes: Partial<AdversarySheet>) =>
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
            <label>Rol</label>
            <select
              value={sheet.role}
              disabled={readOnly}
              onChange={(event) => patch({ role: event.target.value })}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
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
        <h3>Estado</h3>
        <div className="grid-2" style={{ marginTop: 6 }}>
          <NumberField
            label="Umbral mayor"
            value={sheet.thresholds.major}
            min={0}
            disabled={readOnly}
            onChange={(major) =>
              patch({ thresholds: { ...sheet.thresholds, major } })
            }
          />
          <NumberField
            label="Umbral severo"
            value={sheet.thresholds.severe}
            min={0}
            disabled={readOnly}
            onChange={(severe) =>
              patch({ thresholds: { ...sheet.thresholds, severe } })
            }
          />
        </div>
        <div className="col" style={{ marginTop: 10 }}>
          <Track
            label="Vida"
            flavour="hp"
            track={sheet.hp}
            disabled={readOnly}
            onChange={(hp) => patch({ hp })}
          />
          <Track
            label="Estrés"
            flavour="stress"
            track={sheet.stress}
            disabled={readOnly}
            onChange={(stress) => patch({ stress })}
          />
        </div>
      </div>

      <div className="card">
        <h3>Ataque estándar</h3>
        <div style={{ marginTop: 6 }}>
          <TextField
            label="Nombre"
            value={sheet.attack.name}
            disabled={readOnly}
            onChange={(name) => patch({ attack: { ...sheet.attack, name } })}
          />
        </div>
        <div className="grid-3" style={{ marginTop: 6 }}>
          <NumberField
            label="Modificador"
            value={sheet.attack.modifier}
            disabled={readOnly}
            onChange={(modifier) =>
              patch({ attack: { ...sheet.attack, modifier } })
            }
          />
          <div className="field">
            <label>Alcance</label>
            <input
              type="text"
              value={sheet.attack.range}
              disabled={readOnly}
              onChange={(event) =>
                patch({ attack: { ...sheet.attack, range: event.target.value } })
              }
            />
          </div>
          <div className="field">
            <label>Daño</label>
            <input
              type="text"
              value={sheet.attack.damage}
              disabled={readOnly}
              onChange={(event) =>
                patch({
                  attack: { ...sheet.attack, damage: event.target.value },
                })
              }
            />
          </div>
        </div>
      </div>

      <FeatureList
        title="Rasgos y acciones"
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

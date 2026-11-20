import {
  MAX_SHEET_TEXT,
  TRAITS,
  TRAIT_LABELS,
  type CharacterSheet,
  type DomainCard,
  type Trait,
  type Weapon,
} from "../domain/types";
import { parseFormula, type RollStance } from "../domain/dice";
import type { Viewer } from "../domain/permissions";
import { newId } from "../domain/factories";
import { NumberField, TextAreaField, TextField } from "./Field";
import { Track } from "./Track";
import { DomainCards } from "./DomainCards";
import { TraitRoller } from "./TraitRoller";

interface Props {
  sheet: CharacterSheet;
  readOnly: boolean;
  viewer: Viewer;
  onChange: (sheet: CharacterSheet) => void;
  onPlayCard: (card: DomainCard) => void;
  onRollTrait: (trait: Trait, modifier: number, stance: RollStance) => void;
  onRollAttack: (weapon: Weapon, stance: RollStance) => void;
  onRollDamage: (weapon: Weapon) => void;
  onPlayWeapon: (weapon: Weapon) => void;
}

export function CharacterEditor({
  sheet,
  readOnly,
  viewer,
  onChange,
  onPlayCard,
  onRollTrait,
  onRollAttack,
  onRollDamage,
  onPlayWeapon,
}: Props) {
  const patch = (changes: Partial<CharacterSheet>) =>
    onChange({ ...sheet, ...changes });

  const patchWeapon = (weaponId: string, changes: Partial<Weapon>) =>
    patch({
      weapons: sheet.weapons.map((weapon) =>
        weapon.id === weaponId ? { ...weapon, ...changes } : weapon,
      ),
    });

  const addWeapon = () =>
    patch({
      weapons: [
        ...sheet.weapons,
        {
          id: newId(),
          name: "Arma nueva",
          trait: "agility",
          range: "Melee",
          damage: "1d8",
          type: "phy",
          text: "",
        },
      ],
    });

  return (
    <div className="col">
      <div className="card">
        <TextField
          label="Nombre"
          value={sheet.name}
          disabled={readOnly}
          onChange={(name) => patch({ name })}
        />
        <div className="grid-2" style={{ marginTop: 6 }}>
          <TextField
            label="Pronombres"
            value={sheet.pronouns}
            disabled={readOnly}
            onChange={(pronouns) => patch({ pronouns })}
          />
          <NumberField
            label="Nivel"
            value={sheet.level}
            min={1}
            max={10}
            disabled={readOnly}
            onChange={(level) => patch({ level })}
          />
        </div>
        <div className="grid-3" style={{ marginTop: 6 }}>
          <TextField
            label="Herencia"
            value={sheet.heritage}
            disabled={readOnly}
            onChange={(heritage) => patch({ heritage })}
          />
          <TextField
            label="Clase"
            value={sheet.characterClass}
            disabled={readOnly}
            onChange={(characterClass) => patch({ characterClass })}
          />
          <TextField
            label="Subclase"
            value={sheet.subclass}
            disabled={readOnly}
            onChange={(subclass) => patch({ subclass })}
          />
        </div>
      </div>

      <div className="card">
        <h3>Rasgos</h3>
        <div className="grid-traits" style={{ marginTop: 6 }}>
          {TRAITS.map((trait) => (
            <div key={trait} className="field">
              <label htmlFor={`trait-${trait}`}>{TRAIT_LABELS[trait]}</label>
              <div className="trait-row">
                <input
                  id={`trait-${trait}`}
                  type="number"
                  value={sheet.traits[trait]}
                  min={-5}
                  max={10}
                  disabled={readOnly}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (!Number.isNaN(value)) {
                      patch({ traits: { ...sheet.traits, [trait]: value } });
                    }
                  }}
                />
                <TraitRoller
                  label={TRAIT_LABELS[trait]}
                  onRoll={(stance) =>
                    onRollTrait(trait, sheet.traits[trait], stance)
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Defensa</h3>
        <div className="grid-3" style={{ marginTop: 6 }}>
          <NumberField
            label="Evasión"
            value={sheet.evasion}
            min={0}
            disabled={readOnly}
            onChange={(evasion) => patch({ evasion })}
          />
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
          <Track
            label="Esperanza"
            flavour="hope"
            track={sheet.hope}
            disabled={readOnly}
            onChange={(hope) => patch({ hope })}
          />
          <Track
            label="Armadura"
            flavour="armor"
            track={sheet.armor}
            disabled={readOnly}
            onChange={(armor) => patch({ armor })}
          />
        </div>
      </div>

      <div className="card">
        <div className="row spread">
          <h3>Armas</h3>
          {!readOnly && (
            <button type="button" className="icon" onClick={addWeapon}>
              + Añadir
            </button>
          )}
        </div>
        {sheet.weapons.length === 0 ? (
          <div className="empty">Sin armas</div>
        ) : (
          <div className="col" style={{ marginTop: 6 }}>
            {sheet.weapons.map((weapon) => (
              <div key={weapon.id} className="list-item readonly">
                <div className="row">
                  <div className="grow">
                    <input
                      type="text"
                      value={weapon.name}
                      disabled={readOnly}
                      aria-label="Nombre del arma"
                      onChange={(event) =>
                        patchWeapon(weapon.id, { name: event.target.value })
                      }
                    />
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      className="icon danger"
                      aria-label={`Eliminar ${weapon.name}`}
                      onClick={() =>
                        patch({
                          weapons: sheet.weapons.filter(
                            (candidate) => candidate.id !== weapon.id,
                          ),
                        })
                      }
                    >
                      X
                    </button>
                  )}
                </div>
                <div className="grid-3" style={{ marginTop: 6 }}>
                  <div className="field">
                    <label>Rasgo</label>
                    <div className="trait-row">
                      <select
                        value={weapon.trait}
                        disabled={readOnly}
                        onChange={(event) =>
                          patchWeapon(weapon.id, {
                            trait: event.target.value as Weapon["trait"],
                          })
                        }
                      >
                        {TRAITS.map((trait) => (
                          <option key={trait} value={trait}>
                            {TRAIT_LABELS[trait]}
                          </option>
                        ))}
                      </select>
                      {/*
                        The attack roll sits beside the trait because the
                        trait is what it rolls with: 2d12 + the trait's
                        modifier, taken live from the sheet above.
                      */}
                      <TraitRoller
                        label={`ataque de ${weapon.name || "arma"} con ${
                          TRAIT_LABELS[weapon.trait]
                        }`}
                        disabled={readOnly}
                        onRoll={(stance) => onRollAttack(weapon, stance)}
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label>Alcance</label>
                    <input
                      type="text"
                      value={weapon.range}
                      disabled={readOnly}
                      onChange={(event) =>
                        patchWeapon(weapon.id, { range: event.target.value })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Daño</label>
                    <div className="trait-row">
                      <input
                        type="text"
                        value={weapon.damage}
                        disabled={readOnly}
                        onChange={(event) =>
                          patchWeapon(weapon.id, { damage: event.target.value })
                        }
                      />
                      <button
                        type="button"
                        className="trait-die"
                        disabled={!parseFormula(weapon.damage).ok}
                        aria-label={`Tirar daño de ${weapon.name}`}
                        title={(() => {
                          const parsed = parseFormula(weapon.damage);
                          // Say what is wrong, not just that something is:
                          // a disabled button with no reason is a dead end.
                          return parsed.ok
                            ? `Tirar ${weapon.damage}`
                            : `No se puede tirar: ${parsed.error.message}`;
                        })()}
                        onClick={() => onRollDamage(weapon)}
                      >
                        🎲
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 6 }}>
                  <div className="row spread" style={{ marginBottom: 2 }}>
                    <label style={{ marginBottom: 0 }}>Texto del arma</label>
                    <button
                      type="button"
                      className="icon"
                      disabled={!weapon.text.trim()}
                      title={
                        weapon.text.trim()
                          ? "Enviar el texto al registro"
                          : "Escribe algo para poder enviarlo"
                      }
                      onClick={() => onPlayWeapon(weapon)}
                    >
                      Enviar
                    </button>
                  </div>
                  <textarea
                    value={weapon.text}
                    rows={2}
                    maxLength={MAX_SHEET_TEXT}
                    disabled={readOnly}
                    placeholder="Propiedad del arma, tal como quieras que salga en el registro"
                    aria-label={`Texto de ${weapon.name}`}
                    onChange={(event) =>
                      patchWeapon(weapon.id, { text: event.target.value })
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DomainCards
        sheet={sheet}
        readOnly={readOnly}
        viewer={viewer}
        onChange={onChange}
        onPlay={onPlayCard}
      />

      <div className="card">
        <TextAreaField
          label="Experiencias"
          value={sheet.experiences.join("\n")}
          disabled={readOnly}
          placeholder="Una por línea, p. ej. Ladrona de camino +2"
          onChange={(value) => patch({ experiences: value.split("\n") })}
        />
        <div style={{ marginTop: 6 }}>
          <TextAreaField
            label="Notas"
            value={sheet.notes}
            rows={4}
            disabled={readOnly}
            onChange={(notes) => patch({ notes })}
          />
        </div>
      </div>
    </div>
  );
}

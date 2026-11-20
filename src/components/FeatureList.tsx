import { useState } from "react";
import { newId } from "../domain/factories";
import { MAX_SHEET_TEXT } from "../domain/types";

export interface Feature {
  id: string;
  name: string;
  text: string;
}

interface Props {
  title: string;
  features: Feature[];
  readOnly: boolean;
  onChange: (features: Feature[]) => void;
  /** Publishes the feature's text to the table log. */
  onPlay: (feature: Feature) => void;
}

/**
 * Adversary and environment features, shared by both GM sheet editors.
 *
 * Same interaction as domain cards: tapping the name publishes the text to
 * the log, so the GM can narrate a feature without retyping it each time.
 */
export function FeatureList({
  title,
  features,
  readOnly,
  onChange,
  onPlay,
}: Props) {
  const [expandedId, setExpandedId] = useState<string>();

  const patchFeature = (featureId: string, changes: Partial<Feature>) =>
    onChange(
      features.map((feature) =>
        feature.id === featureId ? { ...feature, ...changes } : feature,
      ),
    );

  const addFeature = () =>
    onChange([...features, { id: newId(), name: "Rasgo nuevo", text: "" }]);

  return (
    <div className="card">
      <div className="row spread">
        <h3>{title}</h3>
        {!readOnly && (
          <button type="button" className="icon" onClick={addFeature}>
            + Añadir
          </button>
        )}
      </div>

      {features.length === 0 ? (
        <div className="empty">Sin rasgos</div>
      ) : (
        <div className="col" style={{ marginTop: 6 }}>
          {features.map((feature) => {
            const isExpanded = expandedId === feature.id;

            return (
              <div key={feature.id} className="list-item readonly">
                <div className="row">
                  <button
                    type="button"
                    className="grow"
                    style={{
                      textAlign: "left",
                      background: "none",
                      border: "none",
                      padding: 0,
                    }}
                    disabled={readOnly}
                    title="Enviar el texto al registro"
                    onClick={() => onPlay(feature)}
                  >
                    <strong>{feature.name || "Sin nombre"}</strong>
                  </button>

                  <div className="row" style={{ gap: 4 }}>
                    <button
                      type="button"
                      className="icon"
                      aria-label={`Ver texto de ${feature.name}`}
                      aria-expanded={isExpanded}
                      onClick={() =>
                        setExpandedId(isExpanded ? undefined : feature.id)
                      }
                    >
                      {isExpanded ? "▲" : "▼"}
                    </button>
                    {!readOnly && (
                      <button
                        type="button"
                        className="icon danger"
                        aria-label={`Eliminar ${feature.name}`}
                        onClick={() =>
                          onChange(
                            features.filter(
                              (candidate) => candidate.id !== feature.id,
                            ),
                          )
                        }
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 6 }}>
                    <input
                      type="text"
                      value={feature.name}
                      disabled={readOnly}
                      aria-label="Nombre del rasgo"
                      onChange={(event) =>
                        patchFeature(feature.id, { name: event.target.value })
                      }
                    />
                    <textarea
                      style={{ marginTop: 6 }}
                      value={feature.text}
                      rows={3}
                      maxLength={MAX_SHEET_TEXT}
                      disabled={readOnly}
                      placeholder="Texto del rasgo"
                      aria-label={`Texto de ${feature.name}`}
                      onChange={(event) =>
                        patchFeature(feature.id, { text: event.target.value })
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!readOnly && features.length > 0 && (
        <div className="small muted" style={{ marginTop: 8 }}>
          Pulsa el nombre de un rasgo para enviarlo al registro.
        </div>
      )}
    </div>
  );
}

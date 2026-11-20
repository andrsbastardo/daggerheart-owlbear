import { useState } from "react";
import {
  MAX_SHEET_TEXT,
  type CharacterSheet,
  type DomainCard,
} from "../domain/types";
import type { Viewer } from "../domain/permissions";
import { canViewCard } from "../domain/permissions";
import { newId } from "../domain/factories";

interface Props {
  sheet: CharacterSheet;
  readOnly: boolean;
  viewer: Viewer;
  onChange: (sheet: CharacterSheet) => void;
  /** Publishes the card's text to the table log. */
  onPlay: (card: DomainCard) => void;
}

/**
 * Domain cards are reference text the player types in themselves.
 *
 * Tapping a card's name plays it: the text goes to the shared log and a toast
 * flashes to the table. Editing is behind a separate toggle so a mis-tap
 * during combat cannot silently rewrite a card.
 */
export function DomainCards({
  sheet,
  readOnly,
  viewer,
  onChange,
  onPlay,
}: Props) {
  const [editingId, setEditingId] = useState<string>();
  const [expandedId, setExpandedId] = useState<string>();

  const patchCard = (cardId: string, changes: Partial<DomainCard>) =>
    onChange({
      ...sheet,
      domainCards: sheet.domainCards.map((card) =>
        card.id === cardId ? { ...card, ...changes } : card,
      ),
    });

  const addCard = () => {
    const card: DomainCard = {
      id: newId(),
      name: "Carta nueva",
      domain: "",
      text: "",
      visibleToParty: true,
      inVault: false,
    };
    onChange({ ...sheet, domainCards: [...sheet.domainCards, card] });
    setEditingId(card.id);
  };

  const removeCard = (cardId: string) =>
    onChange({
      ...sheet,
      domainCards: sheet.domainCards.filter((card) => card.id !== cardId),
    });

  const readable = sheet.domainCards.filter((card) =>
    canViewCard(card, sheet, viewer),
  );
  const hiddenCount = sheet.domainCards.length - readable.length;

  const loadout = readable.filter((card) => !card.inVault);
  const vault = readable.filter((card) => card.inVault);

  const renderCard = (card: DomainCard) => {
    const isEditing = editingId === card.id;
    const isExpanded = expandedId === card.id;

    if (isEditing) {
      return (
        <div key={card.id} className="list-item readonly">
          <div className="row">
            <div className="grow">
              <input
                type="text"
                value={card.name}
                aria-label="Nombre de la carta"
                onChange={(event) =>
                  patchCard(card.id, { name: event.target.value })
                }
              />
            </div>
            <button
              type="button"
              className="icon"
              onClick={() => setEditingId(undefined)}
            >
              Listo
            </button>
          </div>

          <div style={{ marginTop: 6 }}>
            <input
              type="text"
              value={card.domain}
              placeholder="Dominio, nivel, coste de recuerdo…"
              aria-label="Dominio"
              onChange={(event) =>
                patchCard(card.id, { domain: event.target.value })
              }
            />
          </div>

          <div style={{ marginTop: 6 }}>
            <textarea
              value={card.text}
              rows={4}
              maxLength={MAX_SHEET_TEXT}
              placeholder="Texto de la carta, tal como quieras que salga en el registro"
              aria-label="Texto de la carta"
              onChange={(event) =>
                patchCard(card.id, { text: event.target.value })
              }
            />
            <div className="row spread small muted" style={{ marginTop: 2 }}>
              <span>
                {card.text.length === MAX_SHEET_TEXT
                  ? "Límite alcanzado"
                  : ""}
              </span>
              <span>
                {card.text.length}/{MAX_SHEET_TEXT}
              </span>
            </div>
          </div>

          <div className="row row-wrap" style={{ marginTop: 8, gap: 10 }}>
            <label className="row small" style={{ gap: 5, marginBottom: 0 }}>
              <input
                type="checkbox"
                checked={card.visibleToParty}
                style={{ width: "auto" }}
                onChange={(event) =>
                  patchCard(card.id, { visibleToParty: event.target.checked })
                }
              />
              Visible a la mesa
            </label>
            <label className="row small" style={{ gap: 5, marginBottom: 0 }}>
              <input
                type="checkbox"
                checked={card.inVault}
                style={{ width: "auto" }}
                onChange={(event) =>
                  patchCard(card.id, { inVault: event.target.checked })
                }
              />
              En la bóveda
            </label>
            <button
              type="button"
              className="icon danger"
              onClick={() => {
                removeCard(card.id);
                setEditingId(undefined);
              }}
            >
              Eliminar
            </button>
          </div>
        </div>
      );
    }

    return (
      <div key={card.id} className="list-item readonly">
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
            title={
              readOnly
                ? "Solo su dueño puede jugar esta carta"
                : "Jugar: envía el texto al registro"
            }
            onClick={() => onPlay(card)}
          >
            <strong>{card.name || "Sin nombre"}</strong>
            {card.domain && (
              <span className="small muted"> · {card.domain}</span>
            )}
          </button>

          <div className="row" style={{ gap: 4 }}>
            {!card.visibleToParty && (
              <span className="badge" title="Solo tú y el DJ veis el texto">
                Privada
              </span>
            )}
            <button
              type="button"
              className="icon"
              aria-label={`Ver texto de ${card.name}`}
              aria-expanded={isExpanded}
              onClick={() =>
                setExpandedId(isExpanded ? undefined : card.id)
              }
            >
              {isExpanded ? "▲" : "▼"}
            </button>
            {!readOnly && (
              <button
                type="button"
                className="icon"
                aria-label={`Editar ${card.name}`}
                onClick={() => setEditingId(card.id)}
              >
                ✎
              </button>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="small" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
            {card.text || <span className="muted">Sin texto</span>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="card">
      <div className="row spread">
        <h3>Cartas de dominio</h3>
        {!readOnly && (
          <button type="button" className="icon" onClick={addCard}>
            + Añadir
          </button>
        )}
      </div>

      {readable.length === 0 ? (
        <div className="empty">
          {hiddenCount > 0
            ? `${hiddenCount} ${hiddenCount === 1 ? "carta privada" : "cartas privadas"}`
            : "Sin cartas"}
        </div>
      ) : (
        <>
          <div className="col" style={{ marginTop: 6 }}>
            {loadout.map(renderCard)}
          </div>

          {vault.length > 0 && (
            <>
              <h3 style={{ marginTop: 10 }}>Bóveda</h3>
              <div className="col" style={{ marginTop: 6 }}>
                {vault.map(renderCard)}
              </div>
            </>
          )}

          {hiddenCount > 0 && (
            <div className="small muted" style={{ marginTop: 8 }}>
              {hiddenCount}{" "}
              {hiddenCount === 1
                ? "carta privada oculta"
                : "cartas privadas ocultas"}
            </div>
          )}

          {!readOnly && (
            <div className="small muted" style={{ marginTop: 8 }}>
              Pulsa el nombre de una carta para enviarla al registro.
            </div>
          )}
        </>
      )}
    </div>
  );
}

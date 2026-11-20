import type { Sheet } from "../domain/types";
import type { Viewer } from "../domain/permissions";
import { canEdit } from "../domain/permissions";
import { groupByCategory } from "../domain/categories";

interface Props {
  sheets: Sheet[];
  viewer: Viewer;
  selectedId?: string;
  emptyMessage: string;
  onSelect: (sheetId: string) => void;
  /**
   * Split the list under category headings.
   *
   * Off for characters, which have no categories: a single "Sin categoría"
   * heading over the whole party would be noise.
   */
  grouped?: boolean;
}

function summary(sheet: Sheet): string {
  switch (sheet.kind) {
    case "character":
      return [sheet.characterClass, sheet.heritage]
        .filter(Boolean)
        .join(" / ") || `Nivel ${sheet.level}`;
    case "adversary":
      return `${sheet.role} - Tier ${sheet.tier} - Dif ${sheet.difficulty}`;
    case "environment":
      return `${sheet.environmentType} - Tier ${sheet.tier} - Dif ${sheet.difficulty}`;
  }
}

export function SheetList({
  sheets,
  viewer,
  selectedId,
  emptyMessage,
  onSelect,
  grouped = false,
}: Props) {
  if (sheets.length === 0) {
    return <div className="empty">{emptyMessage}</div>;
  }

  if (grouped) {
    const groups = groupByCategory(sheets);

    /*
     * One group means nothing to separate, so the heading is skipped: a
     * lone "Sin categoría" over every sheet is noise, not structure.
     */
    if (groups.length > 1) {
      return (
        <div className="col">
          {groups.map((group) => (
            <div key={group.name} className="sheet-group">
              <div
                className={`sheet-group-head${
                  group.ungrouped ? " ungrouped" : ""
                }`}
              >
                <span>{group.name}</span>
                <span className="small muted">{group.sheets.length}</span>
              </div>
              <SheetList
                sheets={group.sheets}
                viewer={viewer}
                selectedId={selectedId}
                emptyMessage={emptyMessage}
                onSelect={onSelect}
              />
            </div>
          ))}
        </div>
      );
    }
  }

  return (
    <div className="col">
      {sheets.map((sheet) => {
        const mine =
          sheet.kind === "character" && sheet.ownerId === viewer.id;
        const editable = canEdit(sheet, viewer);

        return (
          <button
            key={sheet.id}
            type="button"
            className="list-item"
            style={{
              textAlign: "left",
              width: "100%",
              borderColor:
                sheet.id === selectedId ? "var(--accent)" : undefined,
            }}
            onClick={() => onSelect(sheet.id)}
          >
            <div className="row spread">
              <strong className="grow">{sheet.name || "Sin nombre"}</strong>
              <div className="row" style={{ gap: 4 }}>
                {mine && <span className="badge mine">Tu PJ</span>}
                {sheet.tokenId && <span className="badge token">Token</span>}
                {!editable && <span className="badge">Solo lectura</span>}
              </div>
            </div>
            <div className="small muted">{summary(sheet)}</div>
          </button>
        );
      })}
    </div>
  );
}

import type { Sheet } from "../domain/types";
import type { Viewer } from "../domain/permissions";
import { playCard, playFeature, playWeapon } from "../obr/play";
import { rollAttack, rollDamage, rollTrait } from "../obr/roll";
import { usedCategories } from "../domain/categories";
import { CharacterEditor } from "./CharacterEditor";
import { AdversaryEditor } from "./AdversaryEditor";
import { EnvironmentEditor } from "./EnvironmentEditor";

interface Props {
  sheet: Sheet;
  readOnly: boolean;
  viewer: Viewer;
  onChange: (sheet: Sheet) => void;
  /** Every sheet in the room, so a roll can find the viewer's own character. */
  sheets: Sheet[];
}

/**
 * Picks the right editor for a sheet and wires up playing to the log.
 *
 * Both the main panel and the token popover render sheets, so keeping this in
 * one place stops the two surfaces from drifting apart.
 */
export function SheetEditor({
  sheet,
  readOnly,
  viewer,
  onChange,
  sheets,
}: Props) {
  // Suggest what the GM has already typed, so one group does not split in
  // two over a stray capital.
  const categories = usedCategories(sheets);

  switch (sheet.kind) {
    case "character":
      return (
        <CharacterEditor
          sheet={sheet}
          readOnly={readOnly}
          viewer={viewer}
          onChange={onChange}
          onPlayCard={(card) => void playCard(sheet, card, viewer)}
          onRollTrait={(trait, modifier, stance) =>
            void rollTrait(trait, modifier, stance, viewer, sheets)
          }
          onRollAttack={(weapon, stance) =>
            // The modifier is read from the sheet, so editing a trait
            // changes every weapon that uses it.
            void rollAttack(
              weapon.name,
              weapon.trait,
              sheet.traits[weapon.trait],
              stance,
              viewer,
              sheets,
            )
          }
          onRollDamage={(weapon) =>
            void rollDamage(weapon.name, weapon.damage, viewer, sheets)
          }
          onPlayWeapon={(weapon) => void playWeapon(sheet, weapon, viewer)}
        />
      );
    case "adversary":
      return (
        <AdversaryEditor
          sheet={sheet}
          readOnly={readOnly}
          onChange={onChange}
          categories={categories}
          onPlayFeature={(feature) => void playFeature(sheet, feature, viewer)}
        />
      );
    case "environment":
      return (
        <EnvironmentEditor
          sheet={sheet}
          readOnly={readOnly}
          onChange={onChange}
          categories={categories}
          onPlayFeature={(feature) => void playFeature(sheet, feature, viewer)}
        />
      );
  }
}

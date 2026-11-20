import { useId } from "react";
import { MAX_CATEGORY } from "../domain/types";

interface Props {
  value: string;
  /** Categories already in use, offered as suggestions. */
  suggestions: string[];
  disabled?: boolean;
  onChange: (category: string) => void;
}

/**
 * The GM's own grouping for an adversary or environment.
 *
 * A free text input with a datalist rather than a select: the categories a
 * table wants change per session, so anything can be typed, while the
 * suggestions keep "Bosque" from becoming "bosque" and "Bosques" and
 * splitting one group into three.
 */
export function CategoryField({
  value,
  suggestions,
  disabled,
  onChange,
}: Props) {
  // Several sheets can be open across surfaces, so the list needs an id
  // that cannot collide with another instance's.
  const listId = useId();

  return (
    <div className="field">
      <label htmlFor={`${listId}-input`}>Categoría</label>
      <input
        id={`${listId}-input`}
        type="text"
        list={listId}
        value={value}
        maxLength={MAX_CATEGORY}
        placeholder="Sin categoría"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id={listId}>
        {suggestions.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>
    </div>
  );
}

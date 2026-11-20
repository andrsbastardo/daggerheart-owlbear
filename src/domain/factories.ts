import {
  DICE_SLOT_COUNT,
  type AdversarySheet,
  type CharacterSheet,
  type DiceSlot,
  type EnvironmentSheet,
  type Trait,
  TRAITS,
} from "./types";

/**
 * A short random id.
 *
 * Not a UUID: ids are stored in the room's 16 KB of metadata, shared with
 * every other extension, and a sheet carries one per card and weapon. Eight
 * base-36 characters give ~2.8 trillion values — ample for one room, at a
 * fifth of a UUID's size.
 */
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(2));
  return (
    bytes[0]!.toString(36).padStart(4, "0").slice(0, 4) +
    bytes[1]!.toString(36).padStart(4, "0").slice(0, 4)
  );
}

function zeroTraits(): Record<Trait, number> {
  return TRAITS.reduce(
    (acc, trait) => ({ ...acc, [trait]: 0 }),
    {} as Record<Trait, number>,
  );
}

export function createCharacter(
  name: string,
  ownerId: string,
): CharacterSheet {
  return {
    id: newId(),
    kind: "character",
    name,
    ownerId,
    notes: "",
    updatedAt: Date.now(),
    pronouns: "",
    heritage: "",
    characterClass: "",
    subclass: "",
    level: 1,
    traits: zeroTraits(),
    evasion: 10,
    hp: { marked: 0, max: 6 },
    stress: { marked: 0, max: 6 },
    hope: { marked: 2, max: 6 },
    armor: { marked: 0, max: 6 },
    thresholds: { major: 7, severe: 14 },
    weapons: [],
    experiences: [],
    gold: { handfuls: 0, bags: 0, chest: false },
    domainCards: [],
  };
}

export function createAdversary(name: string): AdversarySheet {
  return {
    id: newId(),
    kind: "adversary",
    name,
    notes: "",
    updatedAt: Date.now(),
    category: "",
    tier: 1,
    role: "Standard",
    difficulty: 11,
    hp: { marked: 0, max: 5 },
    stress: { marked: 0, max: 3 },
    thresholds: { major: 6, severe: 12 },
    attack: { name: "Ataque", modifier: 1, range: "Melee", damage: "1d8+2" },
    features: [],
    visibleToPlayers: false,
  };
}

/**
 * The dice bar a player starts with.
 *
 * Seeded with Daggerheart's common rolls so the bar is useful before anyone
 * configures it; every slot is editable, so these are only a starting point.
 */
export function createDefaultDiceSlots(): DiceSlot[] {
  const presets: Omit<DiceSlot, "id">[] = [
    { label: "Dualidad", formula: "2d12", duality: true },
    { label: "d20", formula: "1d20", duality: false },
    { label: "Daño d8", formula: "1d8", duality: false },
    { label: "d6", formula: "1d6", duality: false },
    { label: "Ventaja", formula: "1d6", duality: false },
    { label: "d4", formula: "1d4", duality: false },
  ];

  // Index-based ids: a slot only needs to be unique within one bar, and a
  // UUID each cost more than the slots themselves.
  return presets.slice(0, DICE_SLOT_COUNT).map((preset, index) => ({
    ...preset,
    id: `s${index}`,
  }));
}

export function createEnvironment(name: string): EnvironmentSheet {
  return {
    id: newId(),
    kind: "environment",
    name,
    notes: "",
    updatedAt: Date.now(),
    category: "",
    tier: 1,
    environmentType: "Exploration",
    difficulty: 11,
    impulses: "",
    features: [],
    visibleToPlayers: false,
  };
}

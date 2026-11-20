/**
 * Daggerheart domain model.
 *
 * Three kinds of sheet live in a room:
 *  - character  : owned by one player, editable by that player and the GM
 *  - adversary   : GM only, hidden from players
 *  - environment : GM only, hidden from players
 */

export type SheetKind = "character" | "adversary" | "environment";

/** The six Daggerheart character traits. */
export const TRAITS = [
  "agility",
  "strength",
  "finesse",
  "instinct",
  "presence",
  "knowledge",
] as const;

export type Trait = (typeof TRAITS)[number];

export const TRAIT_LABELS: Record<Trait, string> = {
  agility: "Agilidad",
  strength: "Fuerza",
  finesse: "Destreza",
  instinct: "Instinto",
  presence: "Presencia",
  knowledge: "Conocimiento",
};

/** A depleting resource drawn as a pip track (HP, Stress, Hope, Armor). */
export interface Track {
  /** Pips currently marked. */
  marked: number;
  /** Total pips available. */
  max: number;
}

export interface Threshold {
  major: number;
  severe: number;
}

export interface Weapon {
  id: string;
  name: string;
  trait: Trait;
  range: string;
  damage: string;
  /** e.g. "phy" | "mag" */
  type: string;
  /**
   * Free-text feature, published to the log like a domain card.
   *
   * For a weapon's special property — "on a critical, mark a Stress to…" —
   * so it can be narrated without retyping it each time.
   */
  text: string;
}

/**
 * A domain card on a character sheet.
 *
 * Reference text the player types in themselves — this extension ships no
 * card database, so anything from the SRD or homebrew works the same way.
 */
export interface DomainCard {
  id: string;
  name: string;
  /** Free text: domain, level, recall cost, whatever the player wants. */
  domain: string;
  /** The card's rules text, published to the log when played. */
  text: string;
  /**
   * Whether other players may read this card on the sheet.
   *
   * Private cards stay visible to their owner and the GM only, so a player
   * can keep an unplayed hand hidden. Playing a card publishes its text to
   * the whole table regardless — that is the point of playing it.
   */
  visibleToParty: boolean;
  /** Cards in the vault are held back rather than loaded for play. */
  inVault: boolean;
}

/** Base fields shared by every sheet kind. */
interface SheetBase {
  id: string;
  kind: SheetKind;
  name: string;
  /** Owlbear player id that owns this sheet. Undefined for GM-owned sheets. */
  ownerId?: string;
  /** Scene item (token) this sheet is linked to, if any. */
  tokenId?: string;
  notes: string;
  /** Last writer, for conflict debugging. */
  updatedAt: number;
}

export interface CharacterSheet extends SheetBase {
  kind: "character";
  pronouns: string;
  heritage: string;
  characterClass: string;
  subclass: string;
  level: number;
  traits: Record<Trait, number>;
  evasion: number;
  hp: Track;
  stress: Track;
  hope: Track;
  armor: Track;
  thresholds: Threshold;
  weapons: Weapon[];
  /** Free-text experiences, "name +mod" style. */
  experiences: string[];
  gold: { handfuls: number; bags: number; chest: boolean };
  domainCards: DomainCard[];
}

export interface AdversarySheet extends SheetBase {
  kind: "adversary";
  /**
   * The GM's own grouping for this sheet, e.g. "Bosque" or "Acto 2".
   *
   * Free text rather than a fixed list: how a table wants its adversaries
   * grouped changes per session, and a stored list of categories would cost
   * room metadata for no gain. Empty means ungrouped.
   */
  category: string;
  tier: number;
  /** e.g. "Bruiser", "Horde", "Leader" */
  role: string;
  difficulty: number;
  hp: Track;
  stress: Track;
  thresholds: Threshold;
  attack: { name: string; modifier: number; range: string; damage: string };
  features: { id: string; name: string; text: string }[];
  /** Adversaries are never visible to players. */
  visibleToPlayers: false;
}

export interface EnvironmentSheet extends SheetBase {
  kind: "environment";
  /** The GM's own grouping, as on an adversary. Empty means ungrouped. */
  category: string;
  tier: number;
  /**
   * The environment's type from the rules: "Exploration", "Social",
   * "Traversal", "Event". Distinct from `category`, which is the GM's own
   * filing.
   */
  environmentType: string;
  difficulty: number;
  impulses: string;
  features: { id: string; name: string; text: string }[];
  visibleToPlayers: false;
}

export type Sheet = CharacterSheet | AdversarySheet | EnvironmentSheet;

/**
 * One configurable button on the dice bar.
 *
 * Slots belong to a player rather than to a sheet, so they survive switching
 * characters and are the same whichever sheet is open.
 */
export interface DiceSlot {
  /**
   * Short id, unique only within one player's bar.
   *
   * A full UUID here cost more than the rest of the slot put together, and
   * the room's metadata budget is shared with every other extension.
   */
  id: string;
  label: string;
  /** Dice notation, e.g. "2d12" or "1d8+3". */
  formula: string;
  /**
   * Marks this slot as Daggerheart's duality roll.
   *
   * Plain notation cannot say which d12 is Hope and which is Fear, so the
   * flag is what declares the intent: the first die counts as Hope, the
   * second as Fear, and the result adjusts Hope or Fear automatically.
   */
  duality: boolean;
}

/** Every player gets this many slots, no more. */
export const DICE_SLOT_COUNT = 6;

/** Which side of a duality roll won. */
export type DualityOutcomeValue = "hope" | "fear" | "critical";

/** The dice detail carried by a roll entry, for rendering in the log. */
export interface LogRoll {
  formula: string;
  /** Each die's face value, in roll order. */
  values: number[];
  modifier: number;
  total: number;
  /** Present only for duality rolls. */
  duality?: {
    hope: number;
    fear: number;
    outcome: DualityOutcomeValue;
  };
}

/**
 * One published entry in the table log.
 *
 * Owlbear has no chat of its own, so playing a card or rolling dice writes
 * here instead: the entry is stored with the room, so everyone sees it and
 * it survives a reload.
 */
export interface LogEntry {
  id: string;
  /** What produced this entry. */
  source: "card" | "feature" | "roll";
  /** Card, feature, or dice slot name. */
  title: string;
  /** Rules text as it stood when played. Empty for rolls. */
  text: string;
  /** Extra context, e.g. the card's domain or the adversary's name. */
  subtitle: string;
  /** Display name of whoever played it. */
  actorName: string;
  /** Sheet the entry came from, for grouping. */
  sheetName: string;
  playedAt: number;
  /** Set when source is "roll". */
  roll?: LogRoll;
}

/**
 * Entries older than this are dropped.
 *
 * Owlbear gives the whole room 16 KB of metadata, shared with every other
 * extension in it, and the sheets need most of it. Fifty entries ate nearly
 * the entire budget and left nothing to save a sheet with, so the log keeps
 * only a short tail — it is a feed of what just happened, not an archive.
 */
export const MAX_LOG_ENTRIES = 8;

/**
 * Rules text is truncated at this length before being logged.
 *
 * The log is a feed, not an archive: the full wording stays on the sheet
 * the entry came from, so a short excerpt is enough to recognise it and
 * costs a fraction of the room's shared metadata budget.
 */
export const MAX_LOG_TEXT = 120;

/**
 * Longest text a single card, weapon or feature may hold.
 *
 * Everything in a room shares Owlbear's 16 KB of metadata, so unbounded
 * text on a sheet eventually makes every write fail. Measured against four
 * players holding six cards each plus six adversaries: 150 characters
 * leaves about a kilobyte spare, 200 does not fit. A visible limit in the
 * editor beats saves that stop working with no explanation.
 */
export const MAX_SHEET_TEXT = 150;

/**
 * A category is a heading, not a description.
 *
 * Short enough to read as a group title in the list and to cost nothing
 * worth measuring, since it repeats on every sheet that uses it.
 */
export const MAX_CATEGORY = 24;

/** Everything the extension stores in room metadata, under one key. */
export interface RoomState {
  /** Schema version, so future releases can migrate safely. */
  version: 1;
  sheets: Record<string, Sheet>;
  /** The GM's Fear pool — a table-wide resource. */
  fear: number;
  /** Newest first. Capped at MAX_LOG_ENTRIES. */
  log: LogEntry[];
  /**
   * Dice bar slots per player id.
   *
   * Kept in room metadata rather than player metadata so a player's bar
   * survives a reload and follows them back into the room.
   */
  diceSlots: Record<string, DiceSlot[]>;
}

export const MAX_FEAR = 12;

export const EMPTY_STATE: RoomState = {
  version: 1,
  sheets: {},
  fear: 0,
  log: [],
  diceSlots: {},
};

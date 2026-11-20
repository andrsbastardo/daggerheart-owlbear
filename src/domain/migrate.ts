import {
  DICE_SLOT_COUNT,
  EMPTY_STATE,
  TRAITS,
  MAX_LOG_ENTRIES,
  type DiceSlot,
  type LogEntry,
  type LogRoll,
  type RoomState,
  type Sheet,
  type Trait,
} from "./types";

/**
 * Normalises whatever is in room metadata into a usable RoomState.
 *
 * Rooms written by an earlier version are missing fields added since (domain
 * cards, the log), and metadata is writable by anyone in the room, so it can
 * also be malformed. Filling gaps here means the rest of the app can treat
 * every sheet as complete rather than guarding each field at the point of use.
 */

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function migrateSheet(raw: unknown): Sheet | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;

  const sheet = raw as Sheet;
  if (!sheet.id || !sheet.kind) return undefined;

  if (sheet.kind === "character") {
    return {
      ...sheet,
      // Added after the first release.
      domainCards: asArray<unknown>(sheet.domainCards).flatMap((card) => {
        if (typeof card !== "object" || card === null) return [];
        const candidate = card as Record<string, unknown>;
        const id = asString(candidate.id);
        if (!id) return [];
        return [
          {
            id,
            name: asString(candidate.name, "Carta"),
            domain: asString(candidate.domain),
            text: asString(candidate.text),
            visibleToParty: asBoolean(candidate.visibleToParty, true),
            inVault: asBoolean(candidate.inVault, false),
          },
        ];
      }),
      // `text` was added to weapons after the first release.
      weapons: asArray<unknown>(sheet.weapons).flatMap((weapon) => {
        if (typeof weapon !== "object" || weapon === null) return [];
        const candidate = weapon as Record<string, unknown>;
        const id = asString(candidate.id);
        if (!id) return [];

        const trait = candidate.trait;
        return [
          {
            id,
            name: asString(candidate.name, "Arma"),
            trait: TRAITS.includes(trait as Trait)
              ? (trait as Trait)
              : "agility",
            range: asString(candidate.range, "Melee"),
            damage: asString(candidate.damage, "1d8"),
            type: asString(candidate.type, "phy"),
            text: asString(candidate.text),
          },
        ];
      }),
    };
  }

  if (sheet.kind === "environment") {
    /*
     * `category` used to hold the environment's type from the rules. It now
     * holds the GM's own grouping, and the rules type moved to
     * `environmentType`, so an older sheet's value is carried across rather
     * than being silently reinterpreted as a group name.
     */
    const raw = sheet as unknown as Record<string, unknown>;
    const moved = sheet.environmentType === undefined;

    return {
      ...sheet,
      category: moved ? "" : asString(sheet.category),
      environmentType: moved
        ? asString(raw.category, "Exploration")
        : asString(sheet.environmentType, "Exploration"),
    };
  }

  if (sheet.kind === "adversary") {
    // Added after the first release; an older sheet has no grouping.
    return { ...sheet, category: asString(sheet.category) };
  }

  return sheet;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function migrateRoll(raw: unknown): LogRoll | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const candidate = raw as Record<string, unknown>;

  const values = asArray<unknown>(candidate.values)
    .filter((value): value is number => typeof value === "number");

  const roll: LogRoll = {
    formula: asString(candidate.formula),
    values,
    modifier: asNumber(candidate.modifier),
    total: asNumber(candidate.total),
  };

  const duality = candidate.duality;
  if (typeof duality === "object" && duality !== null) {
    const entry = duality as Record<string, unknown>;
    const outcome = entry.outcome;
    if (outcome === "hope" || outcome === "fear" || outcome === "critical") {
      roll.duality = {
        hope: asNumber(entry.hope),
        fear: asNumber(entry.fear),
        outcome,
      };
    }
  }

  return roll;
}

function migrateLogEntry(raw: unknown): LogEntry | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const candidate = raw as Record<string, unknown>;
  const id = asString(candidate.id);
  if (!id) return undefined;

  const source =
    candidate.source === "feature"
      ? "feature"
      : candidate.source === "roll"
        ? "roll"
        : "card";

  const entry: LogEntry = {
    id,
    source,
    title: asString(candidate.title, "Sin titulo"),
    text: asString(candidate.text),
    subtitle: asString(candidate.subtitle),
    actorName: asString(candidate.actorName, "Alguien"),
    sheetName: asString(candidate.sheetName),
    playedAt: asNumber(candidate.playedAt),
  };

  if (source === "roll") {
    const roll = migrateRoll(candidate.roll);
    // A roll entry with no dice detail is meaningless, so drop it.
    if (!roll) return undefined;
    entry.roll = roll;
  }

  return entry;
}

function migrateDiceSlot(raw: unknown): DiceSlot | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const candidate = raw as Record<string, unknown>;
  const id = asString(candidate.id);
  if (!id) return undefined;

  return {
    id,
    label: asString(candidate.label, "Dados"),
    formula: asString(candidate.formula, "1d20"),
    duality: asBoolean(candidate.duality, false),
  };
}

export function migrateState(raw: unknown): RoomState {
  if (typeof raw !== "object" || raw === null) return EMPTY_STATE;

  const candidate = raw as Partial<RoomState>;
  if (candidate.version !== 1) return EMPTY_STATE;

  const sheets: Record<string, Sheet> = {};
  for (const value of Object.values(candidate.sheets ?? {})) {
    const sheet = migrateSheet(value);
    if (sheet) sheets[sheet.id] = sheet;
  }

  const log = asArray<unknown>(candidate.log)
    .flatMap((entry) => {
      const migrated = migrateLogEntry(entry);
      return migrated ? [migrated] : [];
    })
    .sort((a, b) => b.playedAt - a.playedAt)
    .slice(0, MAX_LOG_ENTRIES);

  const diceSlots: Record<string, DiceSlot[]> = {};
  const rawSlots = candidate.diceSlots;
  if (typeof rawSlots === "object" && rawSlots !== null) {
    for (const [playerId, value] of Object.entries(rawSlots)) {
      const slots = asArray<unknown>(value)
        .flatMap((slot) => {
          const migrated = migrateDiceSlot(slot);
          return migrated ? [migrated] : [];
        })
        .slice(0, DICE_SLOT_COUNT);

      if (slots.length > 0) diceSlots[playerId] = slots;
    }
  }

  return {
    version: 1,
    sheets,
    fear: typeof candidate.fear === "number" ? candidate.fear : 0,
    log,
    diceSlots,
  };
}

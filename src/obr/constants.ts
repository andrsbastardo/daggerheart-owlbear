/**
 * Every key written into Owlbear Rodeo metadata must be namespaced with the
 * extension id, or it will collide with other extensions in the same room.
 */
export const EXTENSION_ID = "rodeo.owlbear.daggerheart";

export const ROOM_STATE_KEY = `${EXTENSION_ID}/state`;
/** Points a token at a character sheet held in room metadata. */
export const ITEM_SHEET_KEY = `${EXTENSION_ID}/sheetId`;

/**
 * A GM sheet stored on the token itself.
 *
 * Adversaries and environments live here rather than in room metadata,
 * which is capped at 16 KB for the whole room and shared with every other
 * extension.
 */
export const ITEM_SHEET_DATA_KEY = `${EXTENSION_ID}/sheet`;

export const CONTEXT_MENU_LINK_ID = `${EXTENSION_ID}/link-token`;

/**
 * Keys the owlbear-persistence extension carries between scenes.
 *
 * That extension (com.desain.persistence) snapshots a token's metadata while
 * a scene is open and restores it onto a matching token in the next one,
 * which is how our sheets survive a scene change.
 *
 * Declaring our keys here is not strictly required — it saves everything in
 * a token's metadata — but it is the documented contract, it states our
 * intent, and the value must be an array of strings or persistence stops
 * recognising the item as a token at all.
 */
export const PERSISTENCE_KEYS_KEY = "com.desain.persistence/persistedKeys";

/**
 * How long we wait before auto-linking a freshly dropped token.
 *
 * owlbear-persistence only restores a metadata key that is *absent*
 * (`canClobberValues || !(key in token.metadata)`), so writing our own
 * pointer straight away would permanently block it from returning the
 * token's real sheet. Yielding first lets a returning token recover what it
 * had; only a genuinely new token is still empty afterwards.
 */
export const AUTO_LINK_GRACE_MS = 1200;

/** The floating toast anchored to the bottom-right of the viewport. */
export const TOAST_POPOVER_ID = `${EXTENSION_ID}/toasts`;

/**
 * How long a toast stays up.
 *
 * Shared by the toast page (which clears its content) and the panel (which
 * closes the popover), so the two cannot drift apart.
 */
export const TOAST_LIFETIME_MS = 20000;

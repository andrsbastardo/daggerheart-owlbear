import OBR from "@owlbear-rodeo/sdk";
import { CONTEXT_MENU_LINK_ID, ITEM_SHEET_KEY } from "./constants";
import { asset } from "./asset";

/**
 * Adds "Ficha de Daggerheart" to a token's right-click menu.
 *
 * The menu embeds sheet.html directly, so OBR renders the sheet in the
 * popover without us managing its lifecycle. Two icon entries let OBR pick
 * the label itself based on whether the token already has a sheet linked.
 */
export async function registerTokenContextMenu(): Promise<void> {
  await OBR.contextMenu.create({
    id: CONTEXT_MENU_LINK_ID,
    icons: [
      {
        icon: asset("icon.svg"),
        label: "Ficha de Daggerheart",
        filter: {
          // Only for a single token that already has a sheet.
          max: 1,
          every: [{ key: ["metadata", ITEM_SHEET_KEY], operator: "!=", value: undefined }],
        },
      },
      {
        icon: asset("icon.svg"),
        label: "Vincular ficha",
        filter: {
          max: 1,
          every: [{ key: ["metadata", ITEM_SHEET_KEY], value: undefined }],
        },
      },
    ],
    embed: {
      url: asset("sheet.html"),
      height: 520,
    },
  });
}

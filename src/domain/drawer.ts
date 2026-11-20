/**
 * Choosing which connected client draws the token markers.
 *
 * The markers are scene items, shared by everyone. If two clients drew
 * them, each would delete and re-add the other's work on every change and
 * the display would flicker between their versions — which is exactly what
 * happens with a second tab open.
 *
 * So exactly one draws. The rule has to be something every client works out
 * for itself and agrees on without talking: the lowest connection id among
 * the connected GMs. Ids are stable while a client is connected, so the
 * choice only moves when that client leaves.
 *
 * `connectionId` rather than player id: one person with two tabs open is
 * two clients, and both would otherwise think they were the chosen one.
 */
export interface Connected {
  connectionId: string;
  role: "GM" | "PLAYER";
}

export function shouldDraw(
  myConnectionId: string,
  myRole: "GM" | "PLAYER",
  others: Connected[],
): boolean {
  // Only a GM ever draws.
  if (myRole !== "GM") return false;

  /*
   * The local client is added explicitly rather than trusted to appear in
   * the list: Owlbear's party listing is the other players, and relying on
   * it to include us would make a lone GM find no GM at all.
   */
  const gms = [
    myConnectionId,
    ...others
      .filter((player) => player.role === "GM")
      .map((player) => player.connectionId),
  ].sort();

  return gms[0] === myConnectionId;
}

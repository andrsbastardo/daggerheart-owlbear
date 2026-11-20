import { useEffect, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { EMPTY_STATE, type RoomState } from "../domain/types";
import type { Role, Viewer } from "../domain/permissions";
import { onStateChange, readState } from "./store";

/** Resolves once OBR has handshaked with the embedding page. */
export function useObrReady(): boolean {
  const [ready, setReady] = useState(OBR.isReady);

  useEffect(() => {
    if (OBR.isReady) {
      setReady(true);
      return;
    }
    OBR.onReady(() => setReady(true));
  }, []);

  return ready;
}

/** The local player's id and role, which drives every permission check. */
export function useViewer(ready: boolean): Viewer | undefined {
  const [viewer, setViewer] = useState<Viewer>();

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;

    void (async () => {
      const [id, role] = await Promise.all([
        OBR.player.getId(),
        OBR.player.getRole(),
      ]);
      if (!cancelled) setViewer({ id, role });
    })();

    // Role can change mid-session if the GM promotes someone.
    const unsubscribe = OBR.player.onChange((player) => {
      setViewer({ id: player.id, role: player.role as Role });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [ready]);

  return viewer;
}

/** Live room state, kept in sync for every connected player. */
export function useRoomState(ready: boolean): RoomState {
  const [state, setState] = useState<RoomState>(EMPTY_STATE);

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;
    void readState()
      .then((initial) => {
        if (!cancelled) setState(initial);
      })
      // A read in flight when the room goes away is not an error worth
      // surfacing: the subscription below re-reads on reconnect.
      .catch(() => undefined);

    const unsubscribe = onStateChange(setState);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [ready]);

  return state;
}

/** Ids of the scene items the local player currently has selected. */
export function useSelection(ready: boolean): string[] {
  const [selection, setSelection] = useState<string[]>([]);

  useEffect(() => {
    if (!ready) return;

    void OBR.player
      .getSelection()
      .then((ids) => setSelection(ids ?? []))
      .catch(() => undefined);

    const unsubscribe = OBR.player.onChange((player) => {
      setSelection(player.selection ?? []);
    });

    return unsubscribe;
  }, [ready]);

  return selection;
}

/**
 * Whether a scene is open. Sheets live in room metadata so they work without
 * one, but every scene.items call (token linking) requires a ready scene.
 */
export function useSceneReady(ready: boolean): boolean {
  const [sceneReady, setSceneReady] = useState(false);

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;
    void OBR.scene
      .isReady()
      .then((value) => {
        if (!cancelled) setSceneReady(value);
      })
      .catch(() => undefined);

    const unsubscribe = OBR.scene.onReadyChange(setSceneReady);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [ready]);

  return sceneReady;
}

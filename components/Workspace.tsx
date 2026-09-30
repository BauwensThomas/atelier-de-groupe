"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClientSideSuspense, LiveblocksProvider, RoomProvider } from "@liveblocks/react/suspense";
import { getUserId, loadIdentity, type Identity } from "@/lib/identity";
import { DocumentApp } from "./DocumentApp";
import { Loading } from "./Loading";

type Props = { roomId: string; projectName: string };

export function Workspace({ roomId, projectName }: Props) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [ready, setReady] = useState(false);
  const identityRef = useRef<Identity | null>(null);

  // Le localStorage n'existe que dans le navigateur : on le lit après le premier rendu.
  useEffect(() => {
    const stored = loadIdentity();
    identityRef.current = stored;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIdentity(stored);
    setReady(true);
  }, []);

  const changeIdentity = useCallback((next: Identity) => {
    identityRef.current = next;
    setIdentity(next);
  }, []);

  const authEndpoint = useCallback(async (room?: string) => {
    const res = await fetch("/api/liveblocks-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room,
        userId: getUserId(),
        name: identityRef.current?.name,
        color: identityRef.current?.color,
      }),
    });
    if (res.status === 401 || res.status === 403) {
      window.location.href = `/?projet=${encodeURIComponent(roomId)}`;
      return { error: "forbidden" as const, reason: "Session expirée" };
    }
    if (!res.ok) throw new Error("Autorisation Liveblocks impossible");
    return res.json();
  }, [roomId]);

  if (!ready) return <Loading text="Chargement…" />;

  return (
    <LiveblocksProvider
      authEndpoint={authEndpoint}
      lostConnectionTimeout={4000}
      // Onglet en arrière-plan depuis 5 minutes : on se déconnecte (reconnexion au retour).
      backgroundKeepAliveTimeout={5 * 60 * 1000}
    >
      <RoomProvider
        id={roomId}
        initialPresence={{ name: identity?.name ?? "", color: identity?.color ?? "" }}
      >
        <ClientSideSuspense fallback={<Loading text="Connexion au document…" />}>
          <DocumentApp
            identity={identity}
            identityRef={identityRef}
            onIdentityChange={changeIdentity}
            project={{ slug: roomId, name: projectName }}
          />
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}

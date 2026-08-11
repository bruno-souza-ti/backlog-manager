import { useCallback, useEffect, useRef, useState } from "react";
import type { ProfileRole, TeamMemberAdmin } from "../types";
import { authGetJson, authPatchJson, authPostJson } from "../lib/apiClient";

interface TeamUsersResponse {
  users: TeamMemberAdmin[];
}

interface TeamUserResponse {
  user: TeamMemberAdmin;
  replayed?: boolean;
  resent?: boolean;
}

function createEventKey(action: string): string {
  const uuid = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${action}:${uuid}`;
}

function sortMembers(users: TeamMemberAdmin[]): TeamMemberAdmin[] {
  return [...users].sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));
}

export function useTeamAdministration(enabled: boolean) {
  const [users, setUsers] = useState<TeamMemberAdmin[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const eventKeysRef = useRef(new Map<string, string>());
  const inFlightRef = useRef(new Map<string, Promise<TeamMemberAdmin>>());

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const response = await authGetJson<TeamUsersResponse>("/api/admin/users");
      setUsers(sortMembers(response.users));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Não foi possível carregar a administração da equipe.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) void load();
    else {
      setUsers([]);
      setLoading(false);
      setError(null);
    }
  }, [enabled, load]);

  const run = useCallback((key: string, operation: (eventKey: string) => Promise<TeamUserResponse>) => {
    const existing = inFlightRef.current.get(key);
    if (existing) return existing;

    const eventKey = eventKeysRef.current.get(key) || createEventKey(key.split(":")[0]);
    eventKeysRef.current.set(key, eventKey);

    const promise = (async () => {
      setPendingKey(key);
      setError(null);
      try {
        const response = await operation(eventKey);
        if (!response.user) throw new Error("A operação foi concluída, mas o perfil não pôde ser recarregado.");
        setUsers((previous) => sortMembers([
          ...previous.filter((user) => user.id !== response.user.id),
          response.user,
        ]));
        eventKeysRef.current.delete(key);
        return response.user;
      } catch (operationError) {
        const message = operationError instanceof Error ? operationError.message : "Não foi possível concluir a operação.";
        setError(message);
        // Keep the same event key for a retry. If the server completed the
        // first request but the response was lost, the audit pre-check turns
        // the retry into a safe replay instead of sending a second invite.
        throw operationError;
      } finally {
        inFlightRef.current.delete(key);
        setPendingKey(null);
      }
    })();

    inFlightRef.current.set(key, promise);
    return promise;
  }, []);

  const invite = useCallback((input: { email: string; fullName: string; role: ProfileRole }) => {
    const key = `invite:${input.email.toLowerCase()}`;
    return run(key, (eventKey) => authPostJson<TeamUserResponse>("/api/admin/users/invite", {
      ...input,
      eventKey,
    }));
  }, [run]);

  const resendInvite = useCallback((userId: string) => run(`resend:${userId}`, (eventKey) =>
    authPostJson<TeamUserResponse>(`/api/admin/users/${userId}/resend`, {
      eventKey,
    })
  ), [run]);

  const changeRole = useCallback((userId: string, role: ProfileRole) => run(`role:${userId}`, (eventKey) =>
    authPatchJson<TeamUserResponse>(`/api/admin/users/${userId}`, {
      action: "role",
      role,
      eventKey,
    })
  ), [run]);

  const setActive = useCallback((userId: string, active: boolean) => run(`active:${userId}`, (eventKey) =>
    authPatchJson<TeamUserResponse>(`/api/admin/users/${userId}`, {
      action: active ? "activate" : "deactivate",
      eventKey,
    })
  ), [run]);

  return {
    users,
    loading,
    error,
    pendingKey,
    reload: load,
    invite,
    resendInvite,
    changeRole,
    setActive,
  };
}

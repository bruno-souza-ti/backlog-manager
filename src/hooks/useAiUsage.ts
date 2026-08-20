import { useCallback, useState } from "react";
import { authGetJson } from "../lib/apiClient";

export interface AiRouteUsage {
  route: string;
  label: string;
  hourlyUsed: number;
  hourlyLimit: number;
  dailyCharsUsed: number;
  dailyCharLimit: number;
}

export interface AiUsageSummary {
  routes: AiRouteUsage[];
  hourResetsAt: string;
  dayResetsAt: string;
}

/** Loads the caller's own AI quota usage on demand — shown in Configurações > Integrações. */
export function useAiUsage() {
  const [usage, setUsage] = useState<AiUsageSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authGetJson<AiUsageSummary>("/api/ai/usage");
      setUsage(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o uso de IA.");
    } finally {
      setLoading(false);
    }
  }, []);

  return { usage, loading, error, fetchUsage };
}

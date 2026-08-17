export type GeminiProviderState =
  | "available"
  | "disabled"
  | "not_configured"
  | "authentication_failed"
  | "permission_denied"
  | "quota_exceeded"
  | "model_unavailable"
  | "request_rejected"
  | "timeout"
  | "unavailable";

export interface GeminiPlatformStatus {
  enabled: boolean;
  configured: boolean;
  available: boolean;
  state: GeminiProviderState;
  model: string;
  checkedAt: string;
  retryable: boolean;
}

export interface GeminiStatusPresentation {
  badge: string;
  description: string;
  operational: boolean;
}

export function describeGeminiStatus(status: GeminiPlatformStatus | null): GeminiStatusPresentation {
  if (!status) {
    return {
      badge: "Verificando",
      description: "Validando a configuração e o acesso ao modelo no servidor.",
      operational: false,
    };
  }
  if (status.available) {
    return {
      badge: "Operacional",
      description: `A conexão com o modelo ${status.model} foi validada pelo servidor.`,
      operational: true,
    };
  }

  const descriptions: Readonly<Record<Exclude<GeminiProviderState, "available">, string>> = {
    disabled: "As funções de IA foram desativadas administrativamente no servidor.",
    not_configured: "A chave GEMINI_API_KEY não foi detectada no servidor.",
    authentication_failed: "A chave configurada não foi aceita pelo provedor.",
    permission_denied: "A chave não possui permissão para acessar o provedor ou o modelo.",
    quota_exceeded: "A cota do provedor está temporariamente indisponível.",
    model_unavailable: `O modelo configurado (${status.model}) não está disponível.`,
    request_rejected: "O provedor rejeitou a configuração da verificação.",
    timeout: "A verificação do provedor excedeu o tempo máximo permitido.",
    unavailable: "O provedor de IA não respondeu à verificação de disponibilidade.",
  };
  return {
    badge: status.state === "disabled" ? "Desativado" : status.state === "not_configured" ? "Não configurado" : "Indisponível",
    description: status.state === "available" ? "O estado do provedor é inconsistente." : descriptions[status.state],
    operational: false,
  };
}

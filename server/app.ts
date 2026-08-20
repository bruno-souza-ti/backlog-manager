import express from "express";
import { Type } from "@google/genai";
import dotenv from "dotenv";
import { requireActiveUser, requirePermission } from "./middleware/authorization.js";
import adminUsersRouter from "./routes/adminUsers.js";
import { ApiError, requestContext, sendApiError } from "./lib/apiErrors.js";
import { AI_INPUT_LIMITS, measureInputCharacters, optionalBoundedText, requireBoundedText } from "./lib/aiValidation.js";
import { auditDeterministicAiResponse, getUsageSummary, runGuardedAiRequest } from "./lib/aiUsage.js";
import { getGeminiModel, getGeminiProviderHealth, requireGeminiClient } from "./lib/geminiClient.js";
import {
  buildOperationalAnalyticsPrompt,
  loadOperationalAnalyticsContext,
  resolveDeterministicAnalyticsAnswer,
} from "./lib/operationalAnalytics.js";

// Vite reads .env.local automatically, but the standalone Express server does
// not. Load it explicitly for local server-only secrets, then fall back to
// .env without overriding variables injected by the hosting platform.
dotenv.config({ path: ".env.local" });
dotenv.config();

const DEFAULT_SYSTEM_PROMPT =
  "Você é o orquestrador inteligente da agência de inteligência artificial. Seu objetivo é ajudar a resumir atas de reuniões, identificar ações acionáveis e responder dúvidas técnicas sobre documentos de clientes.";

const app = express();
app.use(requestContext);
app.use(express.json({ limit: "2mb" }));
app.use("/api/admin", adminUsersRouter);

function sendAiFailure(res: express.Response, error: unknown) {
  if (error instanceof ApiError) return sendApiError(res, error);
  return sendApiError(res, new ApiError(502, "AI_PROVIDER_UNAVAILABLE", "O provedor de IA está temporariamente indisponível."));
}

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  hangoutLink?: string;
  htmlLink?: string;
  conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> };
  attendees?: Array<{ email?: string; displayName?: string }>;
}

interface GoogleCalendarListResponse {
  items?: GoogleCalendarEvent[];
}

// API endpoints
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    time: new Date().toISOString()
  });
});

app.get("/api/platform/status", requireActiveUser, requirePermission("platform.status"), async (req, res) => {
  try {
    return res.json(await getGeminiProviderHealth(req.query.refresh === "true"));
  } catch (error) {
    return sendAiFailure(res, error);
  }
});

app.get("/api/ai/usage", requireActiveUser, async (req, res) => {
  try {
    return res.json(await getUsageSummary(res.locals.authUserId as string));
  } catch (error) {
    return sendAiFailure(res, error);
  }
});

app.post("/api/extract-tasks", requireActiveUser, requirePermission("ai.extract_tasks"), async (req, res) => {
  try {
    const notes = requireBoundedText(req.body?.notes, AI_INPUT_LIMITS.longText, "Notas da reunião");
    const systemPrompt = optionalBoundedText(req.body?.systemPrompt, AI_INPUT_LIMITS.shortText, "Prompt de sistema");
    const sysInstruction = systemPrompt || DEFAULT_SYSTEM_PROMPT;
    const prompt = `${sysInstruction}

Analise as seguintes anotações de reunião e extraia uma lista de tarefas claras e acionáveis para o Kanban.
Cada tarefa deve ter:
- Um título conciso e profissional em português.
- Uma descrição curta.
- Um deadline estimado (formato AAAA-MM-DD), use uma data futura razoável (por exemplo, nos próximos 3 a 7 dias).
- A coluna sugerida no Kanban (pode ser "todo", "doing" ou "done").

Anotações da Reunião:
"${notes}"`;

    const data = await runGuardedAiRequest({
      userId: res.locals.authUserId,
      requestId: res.locals.requestId,
      route: "/api/extract-tasks",
      inputChars: measureInputCharacters([notes, systemPrompt]),
      execute: async (signal, timeoutMs) => {
        const client = requireGeminiClient();
        const response = await client.models.generateContent({
          model: getGeminiModel("task_extraction"),
          contents: prompt,
          config: {
            abortSignal: signal,
            httpOptions: { timeout: timeoutMs },
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                tasks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING, description: "Título da tarefa" },
                      description: { type: Type.STRING, description: "Descrição detalhada" },
                      deadline: { type: Type.STRING, description: "Data de entrega no formato YYYY-MM-DD" },
                      column: { type: Type.STRING, description: "Coluna: todo, doing, ou done" }
                    },
                    required: ["title", "description", "deadline", "column"]
                  }
                }
              },
              required: ["tasks"]
            }
          },
        });
        if (!response.text) throw new Error("empty_ai_response");
        return JSON.parse(response.text) as { tasks: unknown[] };
      },
    });
    return res.json(data);
  } catch (error: unknown) {
    return sendAiFailure(res, error);
  }
});

app.post("/api/chat-document", requireActiveUser, requirePermission("ai.document_chat"), async (req, res) => {
  try {
    const fileContent = requireBoundedText(req.body?.fileContent, AI_INPUT_LIMITS.longText, "Conteúdo do arquivo");
    const message = requireBoundedText(req.body?.message, AI_INPUT_LIMITS.shortText, "Mensagem");
    const fileName = optionalBoundedText(req.body?.fileName, AI_INPUT_LIMITS.shortText, "Nome do arquivo") || "Documento";
    const systemPrompt = optionalBoundedText(req.body?.systemPrompt, AI_INPUT_LIMITS.shortText, "Prompt de sistema");
    const chatHistory = req.body?.chatHistory;
    if (chatHistory !== undefined && !Array.isArray(chatHistory)) {
      throw new ApiError(400, "INVALID_PAYLOAD", "Histórico de conversa em formato inválido.");
    }
    const historyParts = ((chatHistory || []) as Array<{ sender?: string; text?: string }>).map((msg) => {
      return `${msg.sender === "user" ? "Usuário" : "Assistente"}: ${msg.text}`;
    }).join("\n");

    const sysInstruction = systemPrompt || DEFAULT_SYSTEM_PROMPT;

    const prompt = `${sysInstruction}

Você tem acesso ao documento "${fileName}" com o seguinte CONTEÚDO REAL:
"""
${fileContent}
"""

Histórico da conversa:
${historyParts}

Pergunta do usuário:
"${message}"

IMPORTANTE: Responda estritamente com base no CONTEÚDO REAL do documento acima. Não invente números, prazos ou dados financeiros que não estejam presentes no texto.`;

    const result = await runGuardedAiRequest({
      userId: res.locals.authUserId,
      requestId: res.locals.requestId,
      route: "/api/chat-document",
      inputChars: measureInputCharacters([fileContent, message, chatHistory, systemPrompt]),
      execute: async (signal, timeoutMs) => {
        const client = requireGeminiClient();
        return client.models.generateContent({
          model: getGeminiModel("document_chat"),
          contents: prompt,
          config: { abortSignal: signal, httpOptions: { timeout: timeoutMs } },
        });
      },
    });

    return res.json({ answer: result.text || "Não consegui analisar o documento." });
  } catch (error: unknown) {
    return sendAiFailure(res, error);
  }
});

// Operational AI analysis — answers questions about the full operational context
app.post("/api/analyze", requireActiveUser, requirePermission("analytics.global"), async (req, res) => {
  try {
    const question = requireBoundedText(req.body?.question, AI_INPUT_LIMITS.analyzeQuestion, "Pergunta");
    const requestClient = res.locals.supabaseClient;
    if (!requestClient) {
      throw new ApiError(503, "OPERATIONAL_CONTEXT_UNAVAILABLE", "Não foi possível consultar os dados operacionais.");
    }
    const contextStartedAt = performance.now();
    const context = await loadOperationalAnalyticsContext(requestClient);
    const deterministicAnswer = resolveDeterministicAnalyticsAnswer(question, context);
    if (deterministicAnswer) {
      await auditDeterministicAiResponse({
        request_id: res.locals.requestId,
        user_id: res.locals.authUserId,
        route: "/api/analyze",
        input_chars: question.length,
        duration_ms: Math.max(0, Math.round(performance.now() - contextStartedAt)),
        status_code: 200,
        outcome: "deterministic_success",
      });
      return res.json({ answer: deterministicAnswer, mode: "deterministic", asOf: context.asOf });
    }
    const prompt = buildOperationalAnalyticsPrompt(question, context);

    const result = await runGuardedAiRequest({
      userId: res.locals.authUserId,
      requestId: res.locals.requestId,
      route: "/api/analyze",
      inputChars: prompt.length,
      execute: async (signal, timeoutMs) => {
        const client = requireGeminiClient();
        return client.models.generateContent({
          model: getGeminiModel("analytics"),
          contents: prompt,
          config: { abortSignal: signal, httpOptions: { timeout: timeoutMs } },
        });
      },
    });
    return res.json({ answer: result.text || "Não foi possível gerar uma análise.", mode: "generative", asOf: context.asOf });
  } catch (error: unknown) {
    return sendAiFailure(res, error);
  }
});

// Google Calendar integration route (Real Google Calendar API)
app.get("/api/google-calendar/events", requireActiveUser, requirePermission("calendar.read_self"), async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      const timeMin = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(timeMin)}&maxResults=25`;

      const calendarRes = await fetch(calendarUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (calendarRes.ok) {
        const calData = await calendarRes.json() as GoogleCalendarListResponse;
        const items = (calData.items || []).map((evt) => ({
          id: evt.id,
          summary: evt.summary || "Reunião de Alinhamento",
          description: evt.description || evt.summary || "Sem descrição disponível.",
          start: evt.start?.dateTime || evt.start?.date || new Date().toISOString(),
          end: evt.end?.dateTime || evt.end?.date || new Date().toISOString(),
          meetLink: evt.hangoutLink || evt.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === "video")?.uri || (evt.htmlLink || ""),
          attendees: (evt.attendees || []).map((a) => a.email || a.displayName || "")
        }));
        return res.json({ events: items, source: "live_google_calendar", authenticated: true });
      } else {
        const errData = await calendarRes.json().catch(() => ({})) as { error?: { message?: string } };
        console.error("Google Calendar API returned non-200:", calendarRes.status, errData);
        return res.status(calendarRes.status).json({
          events: [],
          authenticated: false,
          error: errData.error?.message || "Não foi possível buscar agendas da sua conta do Google."
        });
      }
    } catch (err) {
      console.error("Google Calendar API Exception:", err);
      return res.status(500).json({ events: [], authenticated: false, error: "Erro ao buscar eventos do Google Calendar." });
    }
  }

  return res.json({
    events: [],
    authenticated: false,
    message: "Por favor, conecte a sua Conta do Google para sincronizar as reuniões reais da sua agenda."
  });
});

// Summarize meeting transcript for Bloco de Notas & Reuniões
app.post("/api/meet/summarize-transcript", requireActiveUser, requirePermission("ai.meeting_summary"), async (req, res) => {
  const { transcript, meetingTitle, clientName, systemPrompt } = req.body;

  const transcriptIsValidArray = Array.isArray(transcript) && transcript.length > 0 && transcript.length <= AI_INPUT_LIMITS.transcriptItems;
  if (!transcriptIsValidArray && typeof transcript !== "string") {
    return sendApiError(res, new ApiError(400, "INVALID_PAYLOAD", "Transcrição deve ser um texto ou uma lista não vazia."));
  }
  if (Array.isArray(transcript) && transcript.length > AI_INPUT_LIMITS.transcriptItems) {
    return sendApiError(res, new ApiError(413, "PAYLOAD_TOO_LARGE", "Transcrição excede o limite de itens permitido."));
  }
  try {
    optionalBoundedText(meetingTitle, AI_INPUT_LIMITS.shortText, "Título da reunião");
    optionalBoundedText(clientName, AI_INPUT_LIMITS.shortText, "Nome do cliente");
    optionalBoundedText(systemPrompt, AI_INPUT_LIMITS.shortText, "Prompt de sistema");
  } catch (error) {
    return sendAiFailure(res, error);
  }

  const transcriptText = Array.isArray(transcript)
    ? (transcript as Array<{ timestamp?: string; speaker?: string; text?: string }>)
        .map((t) => `[${t.timestamp}] ${t.speaker}: ${t.text}`)
        .join("\n")
    : typeof transcript === "string" ? transcript : "";

  if (transcriptText.trim().length === 0) {
    return sendApiError(res, new ApiError(400, "INVALID_PAYLOAD", "Transcrição não pode estar vazia."));
  }
  if (transcriptText.length > AI_INPUT_LIMITS.longText) {
    return sendApiError(res, new ApiError(413, "PAYLOAD_TOO_LARGE", "Transcrição excede o limite de caracteres permitido."));
  }

  let client;
  try {
    client = requireGeminiClient();
  } catch (error) {
    return sendAiFailure(res, error);
  }
  if (!client) {
    /* Legacy demo response retained only as a migration reference.
    const dateStr = new Date().toLocaleDateString("pt-BR");
    const summaryNotes = `📌 **REUNIÃO GOOGLE MEET: ${meetingTitle || "Alinhamento Técnico"}**
📅 **Data:** ${dateStr}
🏢 **Cliente:** ${clientName || "Cliente"}
🤖 **Transcritor:** Bot Meet (Demonstração Local)

---

### 📝 **RESUMO EXECUTIVO**
Durante a reunião no Google Meet, foram debatidos os requisitos chave do projeto e alinhamento de entregáveis com o cliente.

### 💡 **PONTOS DEBATEDOS**
- Transcrição capturada via microfone / áudio da sessão.
- Revisão do backlog e encaminhamentos para a equipe.

---
*Notas estruturadas no modo demonstração sem chave Gemini.*`;
    return res.json({ notes: summaryNotes }); */
  }

  try {
    const sysInstruction = systemPrompt || DEFAULT_SYSTEM_PROMPT;
    const prompt = `${sysInstruction}

Sua função é ler a transcrição de uma reunião realizada no Google Meet com o cliente "${clientName || "Cliente"}" (Título da reunião: "${meetingTitle || "Reunião no Google Meet"}").

Retorne um objeto JSON estrito com dois campos:
1. "notes": Uma string com a anotação completa e profissional em Markdown para o Bloco de Notas do cliente no seguinte formato:
📌 **REUNIÃO GOOGLE MEET: ${meetingTitle || "Alinhamento Técnico"}**
📅 **Data:** [Data de Hoje]
🏢 **Cliente:** ${clientName || "Cliente"}
🤖 **Transcritor:** Bot Meet AI Assistant

---

### 📝 **RESUMO EXECUTIVO**
[3-4 frases resumindo o objetivo principal e resultado com base na transcrição]

### 💡 **PRINCIPAIS PONTOS DEBATEDOS**
- [Ponto 1 da transcrição]
- [Ponto 2 da transcrição]

### 🎯 **DECISÕES TOMADAS**
- [Decisão tomada]

### 📋 **PRÓXIMOS PASSOS E ENTREGÁVEIS**
- [Próximo passo]

2. "extractedTasks": Uma lista de objetos com tarefas extraídas da reunião para a esteira Kanban. Cada objeto de tarefa deve ter:
- "title": Título curto da tarefa (ex: "Configurar guardrails no chatbot")
- "description": Descrição técnica da tarefa
- "deadline": Data no formato AAAA-MM-DD (usar datas realistas próximas de hoje)
- "urgency": "Muito Urgente", "Urgente" ou "Sem Urgência"

Transcrição da reunião:
"${transcriptText}"`;

    const response = await runGuardedAiRequest({
      userId: res.locals.authUserId,
      requestId: res.locals.requestId,
      route: "/api/meet/summarize-transcript",
      inputChars: measureInputCharacters([transcriptText, meetingTitle, clientName, systemPrompt]),
      execute: async (signal, timeoutMs) => {
        const response = await client.models.generateContent({
          model: getGeminiModel("meeting_summary"),
          contents: prompt,
          config: {
            abortSignal: signal,
            httpOptions: { timeout: timeoutMs },
            responseMimeType: "application/json",
          },
        });
        const parsed = JSON.parse(response.text || "{}");
        return {
          notes: parsed.notes || response.text || "Notas geradas com sucesso.",
          extractedTasks: parsed.extractedTasks || [],
        };
      },
    });
    return res.json(response);
  } catch (err: unknown) {
    return sendAiFailure(res, err);
    /* Legacy demo response retained only as a migration reference.
    const dateStr = new Date().toLocaleDateString("pt-BR");
    const summaryNotes = `📌 **REUNIÃO GOOGLE MEET: ${meetingTitle || "Alinhamento"}**
📅 **Data:** ${dateStr}
🏢 **Cliente:** ${clientName || "Cliente"}
🤖 **Transcritor:** Bot Meet AI Assistant

---

### 📝 **RESUMO EXECUTIVO**
Reunião realizada via Google Meet. Discutidos os prazos e entregáveis da sprint técnica.

---
*Transcrito e formatado pelo Bot da Reunião.*`;
    return res.json({ notes: summaryNotes }); */
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error && typeof error === "object" && (error as { type?: string }).type === "entity.too.large") {
    return sendApiError(res, new ApiError(413, "PAYLOAD_TOO_LARGE", "O corpo da requisição excede o limite permitido."));
  }
  next(error);
});

export default app;

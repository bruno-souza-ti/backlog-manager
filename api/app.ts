import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { requireActiveUser, requirePermission } from "./middleware/authorization";

dotenv.config();

const GEMINI_MODEL = "gemini-2.5-flash";

// Generous but bounded limits: large enough for a real meeting transcript or
// document chat message, small enough to stop a single request from turning
// into an outsized Gemini bill.
const MAX_LONG_TEXT_LENGTH = 200_000;
const MAX_SHORT_TEXT_LENGTH = 4_000;

const DEFAULT_SYSTEM_PROMPT =
  "Você é o orquestrador inteligente da agência de inteligência artificial. Seu objetivo é ajudar a resumir atas de reuniões, identificar ações acionáveis e responder dúvidas técnicas sobre documentos de clientes.";

const app = express();
app.use(express.json({ limit: "2mb" }));

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
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

// Initialize Gemini client lazily
let ai: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!ai && process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
  }
  return ai;
}

// API endpoints
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    time: new Date().toISOString()
  });
});

app.get("/api/platform/status", requireActiveUser, requirePermission("platform.status"), (_req, res) => {
  res.json({ geminiConfigured: !!process.env.GEMINI_API_KEY });
});

app.post("/api/extract-tasks", requireActiveUser, requirePermission("ai.extract_tasks"), async (req, res) => {
  const { notes, systemPrompt } = req.body;
  if (!isNonEmptyString(notes, MAX_LONG_TEXT_LENGTH)) {
    return res.status(400).json({ error: "Notas de reunião vazias ou excedem o tamanho máximo permitido." });
  }
  if (systemPrompt !== undefined && !isNonEmptyString(systemPrompt, MAX_SHORT_TEXT_LENGTH)) {
    return res.status(400).json({ error: "Prompt de sistema inválido." });
  }

  const client = getGeminiClient();
  if (!client) {
    console.log("Gemini API key not found. Simulating task extraction...");
    const simulatedTasks = simulateTaskExtraction(notes);
    return res.json({ tasks: simulatedTasks });
  }

  try {
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

    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
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
      }
    });

    const text = response.text;
    if (text) {
      const data = JSON.parse(text);
      return res.json(data);
    } else {
      throw new Error("Resposta vazia do Gemini");
    }
  } catch (error: unknown) {
    console.error("Erro na extração de tarefas:", error);
    const simulatedTasks = simulateTaskExtraction(notes);
    return res.json({ tasks: simulatedTasks, notice: "Simulado devido a erro na API" });
  }
});

app.post("/api/chat-document", requireActiveUser, requirePermission("ai.document_chat"), async (req, res) => {
  const { fileName, fileContent, message, chatHistory, systemPrompt } = req.body;

  if (!isNonEmptyString(fileContent, MAX_LONG_TEXT_LENGTH)) {
    return res.status(400).json({
      error: "O conteúdo do arquivo está vazio, não pôde ser lido ou excede o tamanho máximo permitido.",
      answer: `Não foi possível ler o conteúdo do arquivo "${fileName || "Documento"}". Certifique-se de que o arquivo contém texto legível.`
    });
  }
  if (!isNonEmptyString(message, MAX_SHORT_TEXT_LENGTH)) {
    return res.status(400).json({ error: "Mensagem inválida." });
  }
  if (chatHistory !== undefined && !Array.isArray(chatHistory)) {
    return res.status(400).json({ error: "Histórico de conversa em formato inválido." });
  }
  if (systemPrompt !== undefined && !isNonEmptyString(systemPrompt, MAX_SHORT_TEXT_LENGTH)) {
    return res.status(400).json({ error: "Prompt de sistema inválido." });
  }

  const client = getGeminiClient();
  if (!client) {
    console.log("Gemini API key not found. Simulating document chat...");
    const simulatedAnswer = simulateDocumentChat(fileName, fileContent, message);
    return res.json({ answer: simulatedAnswer });
  }

  try {
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

    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    return res.json({ answer: response.text || "Não consegui analisar o documento." });
  } catch (error: unknown) {
    console.error("Erro no chat com documento:", error);
    const simulatedAnswer = simulateDocumentChat(fileName, fileContent, message);
    return res.json({ answer: simulatedAnswer, notice: "Simulado devido a erro na API" });
  }
});

// Operational AI analysis — answers questions about the full operational context
app.post("/api/analyze", requireActiveUser, requirePermission("analytics.global"), async (req, res) => {
  const { question, context } = req.body;

  if (!isNonEmptyString(question, MAX_SHORT_TEXT_LENGTH)) {
    return res.status(400).json({ error: "Pergunta inválida ou muito longa." });
  }
  if (!context || typeof context !== "object") {
    return res.status(400).json({ error: "Contexto operacional ausente ou inválido." });
  }

  const client = getGeminiClient();
  if (!client) {
    return res.json({
      answer:
        "⚠️ A IA Analítica requer a chave GEMINI_API_KEY configurada no servidor.\n\nConfigure a variável de ambiente e reinicie o servidor para habilitar esta funcionalidade.",
    });
  }

  const contextDate = (context as { dataDate?: string }).dataDate ?? new Date().toISOString().slice(0, 10);

  const prompt = `Você é o analista operacional da Geniality IA, especializado em projetos de agência.

Regras obrigatórias:
- Responda sempre em português brasileiro
- Seja direto e específico — cite nomes reais de clientes e tarefas presentes nos dados
- Baseie-se APENAS nos dados fornecidos — nunca invente informações
- Use bullet points e formatação clara para respostas com múltiplos itens
- Inclua recomendações de ação concretas quando pertinente

Dados operacionais da agência em ${contextDate}:
${JSON.stringify(context, null, 2)}

Pergunta: ${question}`;

  try {
    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });
    return res.json({ answer: response.text || "Não foi possível gerar uma análise." });
  } catch (err: unknown) {
    console.error("Erro na análise operacional:", err);
    return res.json({
      answer: "Ocorreu um erro ao consultar a IA. Tente novamente em instantes.",
    });
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

  const transcriptIsValidArray = Array.isArray(transcript) && transcript.length > 0 && transcript.length <= 5_000;
  const transcriptIsValidString = isNonEmptyString(transcript, MAX_LONG_TEXT_LENGTH);
  if (!transcriptIsValidArray && !transcriptIsValidString) {
    return res.status(400).json({ error: "Transcrição vazia ou excede o tamanho máximo permitido." });
  }
  if (meetingTitle !== undefined && !isNonEmptyString(meetingTitle, MAX_SHORT_TEXT_LENGTH)) {
    return res.status(400).json({ error: "Título da reunião inválido." });
  }
  if (clientName !== undefined && !isNonEmptyString(clientName, MAX_SHORT_TEXT_LENGTH)) {
    return res.status(400).json({ error: "Nome do cliente inválido." });
  }
  if (systemPrompt !== undefined && !isNonEmptyString(systemPrompt, MAX_SHORT_TEXT_LENGTH)) {
    return res.status(400).json({ error: "Prompt de sistema inválido." });
  }

  const transcriptText = Array.isArray(transcript)
    ? (transcript as Array<{ timestamp?: string; speaker?: string; text?: string }>)
        .map((t) => `[${t.timestamp}] ${t.speaker}: ${t.text}`)
        .join("\n")
    : String(transcript);

  const client = getGeminiClient();
  if (!client) {
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
    return res.json({ notes: summaryNotes });
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

    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json({
      notes: parsed.notes || response.text || "Notas geradas com sucesso.",
      extractedTasks: parsed.extractedTasks || [],
    });
  } catch (err: unknown) {
    console.error("Erro na sumarização de reunião:", err);
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
    return res.json({ notes: summaryNotes });
  }
});

// Helpers
interface SimulatedTaskDTO {
  title: string;
  description: string;
  deadline: string;
  column: "todo" | "doing" | "done";
}

function simulateTaskExtraction(notes: string): SimulatedTaskDTO[] {
  const lowercase = notes.toLowerCase();
  const tasks: SimulatedTaskDTO[] = [];

  if (lowercase.includes("contrato") || lowercase.includes("proposta")) {
    tasks.push({
      title: "Revisar termos do contrato comercial",
      description: "Verificar as cláusulas de SLA e escopo de automações de IA.",
      deadline: getFutureDate(3),
      column: "todo"
    });
  }
  if (lowercase.includes("site") || lowercase.includes("frontend") || lowercase.includes("design") || lowercase.includes("layout")) {
    tasks.push({
      title: "Desenvolver protótipo da interface",
      description: "Criar layout responsivo no Figma e revisar com o cliente.",
      deadline: getFutureDate(5),
      column: "doing"
    });
  }
  if (lowercase.includes("prompt") || lowercase.includes("agente") || lowercase.includes("chatbot") || lowercase.includes("llm")) {
    tasks.push({
      title: "Otimizar prompts de atendimento",
      description: "Ajustar temperature e system instruction para evitar alucinações.",
      deadline: getFutureDate(2),
      column: "doing"
    });
  }
  if (lowercase.includes("reunião") || lowercase.includes("call") || lowercase.includes("alinhamento")) {
    tasks.push({
      title: "Agendar próxima call de acompanhamento",
      description: "Enviar invite para a equipe técnica e o Product Owner.",
      deadline: getFutureDate(1),
      column: "todo"
    });
  }
  if (lowercase.includes("banco") || lowercase.includes("dados") || lowercase.includes("api") || lowercase.includes("banco de dados")) {
    tasks.push({
      title: "Configurar API de integração de dados",
      description: "Desenvolver rotas de webhook para alimentar o banco de dados.",
      deadline: getFutureDate(4),
      column: "todo"
    });
  }

  if (tasks.length === 0) {
    tasks.push({
      title: "Revisar notas e planejar sprints",
      description: "Organizar as anotações e delegar tarefas para a equipe técnica.",
      deadline: getFutureDate(2),
      column: "todo"
    });
  }

  return tasks;
}

function simulateDocumentChat(fileName: string, fileContent: string, message: string): string {
  if (!fileContent || fileContent.trim() === "") {
    return `[Modo Simulação] O arquivo "${fileName}" não possui texto legível extraído.`;
  }

  const snippet = fileContent.length > 250 ? fileContent.substring(0, 250) + "..." : fileContent;

  return `[Simulação — API Key do Gemini não configurada no servidor]

Trecho do documento "${fileName}":
"${snippet}"

Sobre a sua pergunta ("${message}"): Para obter análises semânticas em tempo real, configure a chave GEMINI_API_KEY.`;
}

function getFutureDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

export default app;

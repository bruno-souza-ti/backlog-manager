import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Client, ClientFile, ClientLifecycleAction, NewClientInput, NotesHistoryItem } from "../types";
import { useToast } from "../components/common/ToastProvider";
import { getCurrentDateStr } from "../utils";

interface ClientRow {
  id: string;
  name: string;
  logo_color: string;
  notes: string | null;
  status: Client["status"];
  deleted_at: string | null;
}

interface NotesHistoryRow {
  id: string;
  date?: string;
  created_at?: string;
  content: string;
}

interface ClientFileRow {
  id: string;
  name: string;
  size_bytes: number | null;
  uploaded_at: string;
  content_text: string | null;
}

function formatFileSize(bytes: number | null): string | undefined {
  if (bytes == null) return undefined;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function mapClientRow(row: ClientRow, current?: Client): Client {
  return {
    id: row.id,
    name: row.name,
    logoColor: row.logo_color,
    notes: row.notes || "",
    status: row.status,
    deletedAt: row.deleted_at,
    notesHistory: current?.notesHistory ?? [],
    files: current?.files ?? [],
  };
}

/**
 * Owns the `clients` slice of app state: the client list itself, plus the
 * CRUD handlers for notes/files/history. Notes history and files are loaded
 * lazily per-client (fetchClientDetails) instead of eagerly for every client
 * at login — the previous behavior shipped every client's full file text and
 * note history on every page load, which doesn't scale past a handful of
 * clients.
 */
export function useClientsData(userId?: string) {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [detailsLoadingId, setDetailsLoadingId] = useState<string | null>(null);
  const { showToast } = useToast();

  const fetchClients = useCallback(async () => {
    setClientsLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, logo_color, notes, status, deleted_at")
      .order("name", { ascending: true });
    if (error) {
      console.error("Erro ao carregar clientes:", error);
      showToast("Não foi possível carregar a lista de clientes.", "error");
      setClientsLoading(false);
      return;
    }
    setClients(
      (data as ClientRow[]).map((row) => mapClientRow(row))
    );
    setClientsLoading(false);
  }, [showToast]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`clients-lifecycle:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const deleted = payload.old as { id: string };
          setClients((current) => current.filter((client) => client.id !== deleted.id));
          return;
        }

        const row = payload.new as ClientRow;
        setClients((current) => {
          const existing = current.find((client) => client.id === row.id);
          const mapped = mapClientRow(row, existing);
          return existing
            ? current.map((client) => client.id === row.id ? mapped : client)
            : [...current, mapped].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchClientDetails = useCallback(async (clientId: string) => {
    setDetailsLoadingId(clientId);
    const [notesResult, filesResult] = await Promise.all([
      supabase
        .from("client_notes_history")
        .select("id, created_at, content")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
      supabase
        .from("client_files")
        .select("id, name, size_bytes, uploaded_at, content_text")
        .eq("client_id", clientId)
        .order("uploaded_at", { ascending: false }),
    ]);

    if (notesResult.error || filesResult.error) {
      console.error("Erro ao carregar detalhes do cliente:", notesResult.error || filesResult.error);
      showToast("Não foi possível carregar o histórico de notas ou os arquivos deste cliente.", "error");
    }

    const notesHistory: NotesHistoryItem[] = ((notesResult.data as NotesHistoryRow[]) || []).map((n) => ({
      id: n.id,
      date: (n.created_at || n.date || getCurrentDateStr()).slice(0, 10),
      content: n.content,
    }));
    const files: ClientFile[] = ((filesResult.data as ClientFileRow[]) || []).map((f) => ({
      id: f.id,
      name: f.name,
      size: formatFileSize(f.size_bytes),
      uploadDate: f.uploaded_at.slice(0, 10),
      extractedContent: f.content_text || "",
    }));

    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, notesHistory, files } : c)));
    setDetailsLoadingId(null);
  }, [showToast]);

  const handleAddClient = useCallback(async (newClientData: NewClientInput) => {
    const { data, error } = await supabase
      .from("clients")
      .insert({
        name: newClientData.name,
        logo_color: newClientData.logoColor,
        notes: newClientData.notes,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error("Erro ao adicionar cliente no Supabase:", error);
      showToast("Não foi possível criar o cliente. Tente novamente.", "error");
      return;
    }

    if (data) {
      const createdClient = mapClientRow(data as ClientRow);
      setClients((prev) => prev.some((client) => client.id === createdClient.id)
        ? prev.map((client) => client.id === createdClient.id ? createdClient : client)
        : [...prev, createdClient].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
      showToast(`Cliente "${createdClient.name}" criado com sucesso.`, "success");
    }
  }, [userId, showToast]);

  const handleSetClientLifecycle = useCallback(async (clientId: string, action: ClientLifecycleAction) => {
    const eventKey = crypto.randomUUID();
    const { data, error } = await supabase.rpc("set_client_lifecycle", {
      p_client_id: clientId,
      p_action: action,
      p_event_key: eventKey,
    });

    if (error) {
      console.error("Erro ao alterar ciclo de vida do cliente:", error);
      showToast(error.message || "Não foi possível alterar o status do cliente.", "error");
      return false;
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (result) {
      setClients((current) => current.map((client) => client.id === clientId
        ? { ...client, status: result.status, deletedAt: result.deleted_at }
        : client));
    }

    showToast("Ciclo de vida do cliente atualizado.", "success");
    return true;
  }, [showToast]);

  const handleUpdateClientNotes = useCallback(async (clientId: string, newNotes: string) => {
    let prevNotes = "";
    setClients((prev) =>
      prev.map((c) => {
        if (c.id === clientId) {
          prevNotes = c.notes;
          return { ...c, notes: newNotes };
        }
        return c;
      })
    );

    const { error } = await supabase.from("clients").update({ notes: newNotes }).eq("id", clientId);
    if (error) {
      console.error("Erro ao atualizar notas no Supabase:", error);
      showToast("Não foi possível salvar as notas. Suas últimas alterações podem ter sido perdidas.", "error");
      setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, notes: prevNotes } : c)));
    }
  }, [showToast]);

  const handleSaveNotesToHistory = useCallback(async (clientId: string, noteContent: string) => {
    const { data, error } = await supabase
      .from("client_notes_history")
      .insert({
        client_id: clientId,
        content: noteContent,
        author_id: userId,
      })
      .select()
      .single();

    if (error) {
      console.error("Erro ao salvar histórico de notas no Supabase:", error);
      showToast("Não foi possível arquivar a anotação no histórico.", "error");
      return;
    }

    if (data) {
      const historyItem: NotesHistoryItem = {
        id: data.id,
        date: (data.created_at || getCurrentDateStr()).slice(0, 10),
        content: data.content,
      };

      setClients((prev) =>
        prev.map((c) =>
          c.id === clientId
            ? { ...c, notesHistory: [historyItem, ...c.notesHistory], notes: "" }
            : c
        )
      );

      const { error: clearErr } = await supabase.from("clients").update({ notes: "" }).eq("id", clientId);
      if (clearErr) {
        console.error("Erro ao limpar campo de notas no cliente:", clearErr);
      }
      showToast("Anotação salva no histórico com sucesso.", "success");
    }
  }, [userId, showToast]);

  const handleUploadFile = useCallback(async (clientId: string, fileName: string, fileContent: string) => {
    const { data, error } = await supabase
      .from("client_files")
      .insert({
        client_id: clientId,
        name: fileName,
        size_bytes: fileContent.length,
        content_text: fileContent,
        uploaded_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error("Erro ao fazer upload do arquivo no Supabase:", error);
      showToast("Não foi possível salvar o arquivo.", "error");
      return;
    }

    if (data) {
      const newFile: ClientFile = {
        id: data.id,
        name: data.name,
        size: formatFileSize(data.size_bytes),
        uploadDate: (data.uploaded_at || getCurrentDateStr()).slice(0, 10),
        extractedContent: data.content_text,
      };

      setClients((prev) =>
        prev.map((c) => (c.id === clientId ? { ...c, files: [newFile, ...c.files] } : c))
      );
      showToast(`Arquivo "${fileName}" anexado com sucesso.`, "success");

    }
  }, [userId, showToast]);

  const handleDeleteFile = useCallback(async (clientId: string, fileId: string) => {
    let removedFile: ClientFile | undefined;
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;
        removedFile = c.files.find((f) => f.id === fileId);
        return { ...c, files: c.files.filter((f) => f.id !== fileId) };
      })
    );

    const { error } = await supabase.from("client_files").delete().eq("id", fileId);
    if (error) {
      console.error("Erro ao excluir arquivo no Supabase:", error);
      showToast("Não foi possível excluir o arquivo.", "error");
      if (removedFile) {
        const fileToRestore = removedFile;
        setClients((prev) =>
          prev.map((c) => (c.id === clientId ? { ...c, files: [fileToRestore, ...c.files] } : c))
        );
      }
    }
  }, [showToast]);

  const handleDepositNotes = useCallback(async (clientId: string, newNotes: string) => {
    const { error: clientErr } = await supabase.from("clients").update({ notes: newNotes }).eq("id", clientId);
    if (clientErr) {
      console.error("Erro ao atualizar notas do cliente via Bot:", clientErr);
    }

    const { data: histData, error: histErr } = await supabase
      .from("client_notes_history")
      .insert({ client_id: clientId, content: newNotes, author_id: userId })
      .select()
      .single();

    if (histErr) {
      console.error("Erro ao salvar histórico de notas via Bot:", histErr);
    }

    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;
        const newHistory = histData
          ? [{ id: histData.id, date: (histData.created_at || getCurrentDateStr()).slice(0, 10), content: histData.content }, ...c.notesHistory]
          : c.notesHistory;
        return { ...c, notes: newNotes, notesHistory: newHistory };
      })
    );
  }, [userId]);

  return {
    clients,
    setClients,
    clientsLoading,
    detailsLoadingId,
    fetchClients,
    fetchClientDetails,
    handleAddClient,
    handleUpdateClientNotes,
    handleSaveNotesToHistory,
    handleUploadFile,
    handleDeleteFile,
    handleDepositNotes,
    handleSetClientLifecycle,
  };
}

import { useMemo, useState } from "react";
import { Client, Task } from "../types";
import { isOverdue, formatDate } from "../utils";
import { ChevronLeft, ChevronRight, ChevronsUpDown, FileDown, FileBarChart, Printer } from "lucide-react";
import { useTeamProfiles } from "../hooks/useTeamProfiles";

interface ReportsProps {
  clients: Client[];
  tasks: Task[];
}

type DateBasis = "createdAt" | "deadline";
type SortKey = "title" | "client" | "assignee" | "status" | "deadline" | "overdue";

function escapeCsvField(value: string): string {
  if (/[",\n;]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csvContent = rows.map((row) => row.map(escapeCsvField).join(";")).join("\r\n");
  // Prefix with BOM so Excel opens UTF-8 accented characters correctly
  const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const COLUMN_LABELS: Record<string, string> = {
  todo: "A Fazer",
  doing: "Fazendo",
  blocked: "Em Espera",
  done: "Feito",
};

export default function Reports({ clients, tasks }: ReportsProps) {
  const { profiles } = useTeamProfiles();
  const [dateBasis, setDateBasis] = useState<DateBasis>("deadline");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("deadline");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const clientsById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const profilesById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (clientFilter === "internal" && t.clientId) return false;
      if (clientFilter !== "all" && clientFilter !== "internal" && t.clientId !== clientFilter) return false;

      const basisDate = dateBasis === "createdAt" ? t.createdAt?.slice(0, 10) : t.deadline;
      if (startDate && (!basisDate || basisDate < startDate)) return false;
      if (endDate && (!basisDate || basisDate > endDate)) return false;

      return true;
    });
  }, [tasks, clientFilter, dateBasis, startDate, endDate]);

  // Shared row enrichment (client/assignee lookup + overdue flag) reused by
  // both the CSV export and the preview table, instead of recomputing twice.
  const enrichedTasks = useMemo(() => {
    return filteredTasks.map((t) => ({
      task: t,
      client: t.clientId ? clientsById.get(t.clientId) : undefined,
      assignee: t.assigneeId ? profilesById.get(t.assigneeId) : undefined,
      overdue: isOverdue(t.deadline, t.column),
    }));
  }, [filteredTasks, clientsById, profilesById]);

  const sortedTasks = useMemo(() => [...enrichedTasks].sort((a, b) => {
    const values: Record<SortKey, [string | number, string | number]> = {
      title: [a.task.title, b.task.title],
      client: [a.client?.name || "Backlog Geral", b.client?.name || "Backlog Geral"],
      assignee: [a.assignee?.full_name || "", b.assignee?.full_name || ""],
      status: [COLUMN_LABELS[a.task.column] || a.task.column, COLUMN_LABELS[b.task.column] || b.task.column],
      deadline: [a.task.deadline || "9999-12-31", b.task.deadline || "9999-12-31"],
      overdue: [Number(a.overdue), Number(b.overdue)],
    };
    const [left, right] = values[sortKey];
    const comparison = typeof left === "number" ? left - Number(right) : String(left).localeCompare(String(right), "pt-BR");
    return sortDirection === "asc" ? comparison : -comparison;
  }), [enrichedTasks, sortDirection, sortKey]);
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(sortedTasks.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedTasks = sortedTasks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (key: SortKey) => {
    setPage(1);
    if (key === sortKey) setSortDirection((current) => current === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDirection("asc"); }
  };

  const handleExportCsv = () => {
    const header = ["Título", "Cliente", "Responsável", "Status", "Prazo", "Atrasada"];
    const rows = sortedTasks.map(({ task: t, client, assignee, overdue }) => [
      t.title,
      client ? client.name : "Sem Cliente / Backlog Geral",
      assignee?.full_name || "Sem responsável",
      COLUMN_LABELS[t.column] || t.column,
      t.deadline ? formatDate(t.deadline) : "-",
      overdue ? "Sim" : "Não",
    ]);

    downloadCsv(`relatorio-tarefas-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <FileBarChart className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          <div>
            <h2 className="font-display font-bold text-lg text-slate-900 dark:text-white">Relatórios</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Exporte as tarefas de todos os clientes em CSV, com filtros por período e cliente.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-slate-100 dark:border-zinc-800 pt-5">
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
              Filtrar Período Por
            </label>
            <select
              value={dateBasis}
              onChange={(e) => setDateBasis(e.target.value as DateBasis)}
              className="w-full px-3 py-2.5 text-xs text-slate-900 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:border-teal-500"
            >
              <option value="deadline">Prazo</option>
              <option value="createdAt">Data de Criação</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
              De
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2.5 text-xs text-slate-900 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
              Até
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2.5 text-xs text-slate-900 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
              Cliente
            </label>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="w-full px-3 py-2.5 text-xs text-slate-900 dark:text-zinc-200 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:border-teal-500"
            >
              <option value="all">Todos os Clientes</option>
              <option value="internal">Sem Cliente / Backlog Geral</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 dark:border-zinc-800 pt-4">
          <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
            {filteredTasks.length} {filteredTasks.length === 1 ? "tarefa encontrada" : "tarefas encontradas"}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              disabled={filteredTasks.length === 0}
              title="Abre o diálogo de impressão do navegador — escolha 'Salvar como PDF' como destino"
              className="px-4 py-2.5 bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-50 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Exportar PDF</span>
            </button>
            <button
              onClick={handleExportCsv}
              disabled={filteredTasks.length === 0}
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow transition-all cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Print-only view: every filtered row, unpaginated, no app chrome —
          only rendered onto the page when printing (see .print-area in
          index.css), triggered by "Exportar PDF" above via window.print(). */}
      <div className="print-area hidden print:block p-6">
        <div className="flex items-center justify-between mb-4 border-b border-slate-300 pb-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Relatório de Tarefas — Backlog Manager</h1>
            <p className="text-xs text-slate-600 mt-1">
              {clientFilter === "all" ? "Todos os clientes" : clientFilter === "internal" ? "Sem cliente / Backlog Geral" : clientsById.get(clientFilter)?.name || "Cliente"}
              {(startDate || endDate) && ` · ${dateBasis === "deadline" ? "Prazo" : "Criação"} de ${startDate ? formatDate(startDate) : "sempre"} até ${endDate ? formatDate(endDate) : "hoje"}`}
            </p>
          </div>
          <span className="text-[10px] text-slate-500">Gerado em {new Date().toLocaleString("pt-BR")}</span>
        </div>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-400 text-left">
              <th className="p-2">Título</th>
              <th className="p-2">Cliente</th>
              <th className="p-2">Responsável</th>
              <th className="p-2">Status</th>
              <th className="p-2">Prazo</th>
              <th className="p-2">Atrasada</th>
            </tr>
          </thead>
          <tbody>
            {sortedTasks.map(({ task: t, client, assignee, overdue }) => (
              <tr key={t.id} className="border-b border-slate-200">
                <td className="p-2 font-medium text-slate-900">{t.title}</td>
                <td className="p-2 text-slate-700">{client ? client.name : "Backlog Geral"}</td>
                <td className="p-2 text-slate-700">{assignee?.full_name || "-"}</td>
                <td className="p-2 text-slate-700">{COLUMN_LABELS[t.column] || t.column}</td>
                <td className="p-2 text-slate-700">{t.deadline ? formatDate(t.deadline) : "-"}</td>
                <td className="p-2 text-slate-700">{overdue ? "Sim" : "Não"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Preview Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 dark:bg-zinc-950 z-10">
              <tr className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 text-left">
                {([['title', 'Título'], ['client', 'Cliente'], ['assignee', 'Responsável'], ['status', 'Status'], ['deadline', 'Prazo'], ['overdue', 'Atrasada']] as [SortKey, string][]).map(([key, label]) => (
                  <th key={key} className="p-3 font-bold text-slate-500 dark:text-zinc-400 uppercase text-[10px]">
                    <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 hover:text-teal-600 dark:hover:text-teal-400" aria-label={`Ordenar por ${label}`}>
                      {label}<ChevronsUpDown className="h-3 w-3" />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 dark:text-zinc-500 italic">
                    Nenhuma tarefa encontrada com os filtros atuais.
                  </td>
                </tr>
              ) : (
                paginatedTasks.map(({ task: t, client, assignee, overdue }) => {
                  return (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-zinc-950/40">
                      <td className="p-3 text-slate-800 dark:text-zinc-200 font-medium">{t.title}</td>
                      <td className="p-3 text-slate-600 dark:text-zinc-400">{client ? client.name : "Backlog Geral"}</td>
                      <td className="p-3 text-slate-600 dark:text-zinc-400">{assignee?.full_name || "-"}</td>
                      <td className="p-3 text-slate-600 dark:text-zinc-400">{COLUMN_LABELS[t.column] || t.column}</td>
                      <td className="p-3 text-slate-600 dark:text-zinc-400">{t.deadline ? formatDate(t.deadline) : "-"}</td>
                      <td className="p-3">
                        {overdue ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/40">
                            Sim
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
                            Não
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filteredTasks.length > pageSize && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
            <span>Página {currentPage} de {totalPages}</span>
            <div className="flex gap-2">
              <button type="button" aria-label="Página anterior" disabled={currentPage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40 dark:border-zinc-800"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" aria-label="Próxima página" disabled={currentPage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40 dark:border-zinc-800"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

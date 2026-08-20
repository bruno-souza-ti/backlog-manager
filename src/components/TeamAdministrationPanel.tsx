import { useState, type FormEvent } from "react";
import {
  MailPlus,
  RefreshCw,
  ShieldCheck,
  Terminal,
  UserCheck,
  UserMinus,
  X,
  Loader2,
} from "lucide-react";
import type { ProfileRole, TeamMemberAdmin } from "../types";
import { ROLE_LABELS } from "../lib/permissions";
import { useTeamAdministration } from "../hooks/useTeamAdministration";
import { useToast } from "./common/ToastProvider";
import ConfirmDialog from "./common/ConfirmDialog";
import { describeGeminiStatus, type GeminiPlatformStatus } from "../lib/platformStatus";

interface TeamAdministrationPanelProps {
  currentUserId: string;
  currentUserRole: ProfileRole;
  geminiStatus?: GeminiPlatformStatus | null;
  showPlatformStatus?: boolean;
}

interface PendingConfirmation {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  action: () => Promise<unknown>;
}

const STATUS_META = {
  active: { label: "Ativo", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  pending: { label: "Convite pendente", className: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  inactive: { label: "Inativo", className: "bg-slate-200 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400" },
} as const;

function formatAccessDate(value: string | null): string {
  if (!value) return "Nunca";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default function TeamAdministrationPanel({ currentUserId, currentUserRole, geminiStatus = null, showPlatformStatus = false }: TeamAdministrationPanelProps) {
  const administration = useTeamAdministration(true);
  const { showToast } = useToast();
  const geminiPresentation = describeGeminiStatus(geminiStatus);
  const [showInvite, setShowInvite] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ProfileRole>("member");
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);

  const availableRoles: ProfileRole[] = currentUserRole === "owner"
    ? ["member", "admin", "owner"]
    : ["member", "admin"];

  const runConfirmedAction = async () => {
    const pending = confirmation;
    if (!pending) return;
    setConfirmation(null);
    try {
      await pending.action();
      showToast("Acesso atualizado com sucesso.", "success");
    } catch {
      // The hook exposes a sanitized inline error in the panel.
    }
  };

  const handleInvite = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    try {
      await administration.invite({ email, fullName, role });
      setFullName("");
      setEmail("");
      setRole("member");
      setShowInvite(false);
      showToast("Convite enviado e acesso preparado com sucesso.", "success");
    } catch (inviteError) {
      setFormError(inviteError instanceof Error ? inviteError.message : "Não foi possível enviar o convite.");
    }
  };

  const canManage = (user: TeamMemberAdmin) => {
    if (user.id === currentUserId) return false;
    return currentUserRole === "owner" || user.role !== "owner";
  };

  return (
    <div className="space-y-5">
      {showPlatformStatus && (
        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h2 className="font-display font-bold text-lg text-slate-900 dark:text-white">Status da Plataforma</h2>
          </div>
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${geminiPresentation.operational ? "bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-900/40" : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40"}`}>
            <Terminal className={`w-5 h-5 shrink-0 mt-0.5 ${geminiPresentation.operational ? "text-teal-600 dark:text-teal-400" : "text-amber-600 dark:text-amber-400"}`} />
            <div>
              <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                Conexão com Gemini API
                <span className={`text-[10px] px-2 py-0.5 rounded border ${geminiPresentation.operational ? "bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-900/40" : "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40"}`}>{geminiPresentation.badge}</span>
              </span>
              <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-1">
                {geminiPresentation.description}
              </p>
            </div>
          </div>
        </section>
      )}

    <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h2 className="font-display font-bold text-lg text-slate-900 dark:text-white">Acessos da equipe</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Convites, papéis e bloqueio de acesso centralizados.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors cursor-pointer"
        >
          <MailPlus className="w-4 h-4" />
          Convidar integrante
        </button>
      </div>

      {(administration.error || formError) && (
        <div role="alert" className="flex items-center justify-between gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300">
          <span>{formError || administration.error}</span>
          <button type="button" onClick={() => void administration.reload()} className="font-bold underline cursor-pointer">Tentar novamente</button>
        </div>
      )}

      {administration.loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {administration.users.map((user) => {
            const status = STATUS_META[user.invitationStatus];
            const manageable = canManage(user);
            const isPending = administration.pendingKey?.endsWith(user.id) === true;
            return (
              <article key={user.id} className="border border-slate-200 dark:border-zinc-800 rounded-xl p-4 space-y-4 bg-slate-50/60 dark:bg-zinc-950/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{user.fullName || "Nome não informado"}</h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">{user.email}</p>
                  </div>
                  <span className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold ${status.className}`}>{status.label}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[10px] text-slate-500 dark:text-zinc-400">
                  <div><span className="block font-semibold text-slate-700 dark:text-zinc-300">Último acesso</span>{formatAccessDate(user.lastSignInAt)}</div>
                  <div><span className="block font-semibold text-slate-700 dark:text-zinc-300">Convite</span>{formatAccessDate(user.invitedAt)}</div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <label className="flex-1 text-[10px] font-semibold text-slate-600 dark:text-zinc-400">
                    Papel
                    <select
                      value={user.role}
                      disabled={!manageable || isPending}
                      onChange={(event) => {
                        const nextRole = event.target.value as ProfileRole;
                        setConfirmation({
                          title: "Alterar papel de acesso?",
                          message: `${user.fullName} passará de ${ROLE_LABELS[user.role]} para ${ROLE_LABELS[nextRole]}.`,
                          confirmLabel: "Alterar papel",
                          danger: nextRole === "owner" || user.role === "owner",
                          action: () => administration.changeRole(user.id, nextRole),
                        });
                      }}
                      className="mt-1 w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs disabled:opacity-60"
                    >
                      {availableRoles.map((option) => <option key={option} value={option}>{ROLE_LABELS[option]}</option>)}
                      {!availableRoles.includes(user.role) && <option value={user.role}>{ROLE_LABELS[user.role]}</option>}
                    </select>
                  </label>

                  <div className="flex gap-2 sm:self-end">
                    {user.invitationStatus === "pending" && manageable && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => void administration.resendInvite(user.id).then(() => showToast("Convite reenviado.", "success")).catch(() => undefined)}
                        className="p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 disabled:opacity-50 cursor-pointer"
                        title="Reenviar convite"
                        aria-label={`Reenviar convite para ${user.fullName}`}
                      >
                        <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
                      </button>
                    )}
                    {manageable && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => setConfirmation({
                          title: user.isActive ? "Desativar acesso?" : "Reativar acesso?",
                          message: user.isActive
                            ? `${user.fullName} perderá imediatamente o acesso aos dados operacionais.`
                            : `${user.fullName} voltará a acessar a plataforma com o papel ${ROLE_LABELS[user.role]}.`,
                          confirmLabel: user.isActive ? "Desativar" : "Reativar",
                          danger: user.isActive,
                          action: () => administration.setActive(user.id, !user.isActive),
                        })}
                        className={`p-2.5 rounded-lg border disabled:opacity-50 cursor-pointer ${user.isActive ? "border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400" : "border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400"}`}
                        title={user.isActive ? "Desativar acesso" : "Reativar acesso"}
                        aria-label={`${user.isActive ? "Desativar" : "Reativar"} acesso de ${user.fullName}`}
                      >
                        {user.isActive ? <UserMinus className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                {user.id === currentUserId && <p className="text-[10px] text-slate-400 italic">Seu próprio acesso não pode ser alterado por esta tela.</p>}
              </article>
            );
          })}
        </div>
      )}

      {showInvite && (
        <div className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form role="dialog" aria-modal="true" aria-labelledby="invite-title" onSubmit={handleInvite} className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="invite-title" className="font-display font-bold text-lg text-slate-900 dark:text-white">Convidar integrante</h3>
                <p className="text-xs text-slate-500 mt-1">O integrante receberá um link para concluir o cadastro.</p>
              </div>
              <button type="button" onClick={() => setShowInvite(false)} aria-label="Fechar convite" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Nome completo
              <input autoFocus required value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={120} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm" />
            </label>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">E-mail
              <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm" />
            </label>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Papel inicial
              <select value={role} onChange={(event) => setRole(event.target.value as ProfileRole)} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm">
                {availableRoles.map((option) => <option key={option} value={option}>{ROLE_LABELS[option]}</option>)}
              </select>
            </label>
            {formError && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{formError}</p>}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
              <button type="button" onClick={() => setShowInvite(false)} className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-semibold cursor-pointer">Cancelar</button>
              <button type="submit" disabled={administration.pendingKey?.startsWith("invite:")} className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer inline-flex items-center gap-2">
                {administration.pendingKey?.startsWith("invite:") && <Loader2 className="w-4 h-4 animate-spin" />}
                Enviar convite
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmation && (
        <ConfirmDialog
          title={confirmation.title}
          message={confirmation.message}
          confirmLabel={confirmation.confirmLabel}
          danger={confirmation.danger}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => void runConfirmedAction()}
        />
      )}
    </section>
    </div>
  );
}

# Auditoria de níveis de acesso

Data da análise original: 2026-08-07. Atualizada em 2026-08-11.

## Contexto

O sistema possui três papéis em `profiles.role`: `owner`, `admin` e `member`. O acesso à plataforma também depende de `profiles.is_active`.

Antes desta rodada, o produto distinguia corretamente usuário ativo de usuário inativo, mas não usava o papel para montar menus, proteger telas ou autorizar endpoints. Admin e member recebiam a mesma experiência e as mesmas operações.

No inventário remoto realizado durante a análise havia um admin ativo, dois members ativos e nenhum owner.

## Implementado depois da análise original

- O gate de acesso agora reage a alterações de `role` e `is_active` por Realtime e limpa os dados operacionais em memória quando o acesso é revogado.
- Dashboard, navegação e API usam capabilities centralizadas. Relatórios globais, criação de clientes, IA analítica global e status técnico são administrativos.
- O ciclo de vida de clientes (`active`, `inactive`, `frozen` e remoção lógica por `deleted_at`) foi integrado à interface e ao Realtime.
- Alterações de ciclo de vida usam a RPC idempotente `set_client_lifecycle`; members não podem chamá-la nem criar clientes.
- Clientes congelados ou removidos são somente leitura no frontend e no banco para tarefas, notas e arquivos.
- Grants do papel `anon` foram removidos das tabelas/views operacionais; funções de trigger deixaram de ser RPCs públicas.
- Policies marcadas pelo advisor foram ajustadas para evitar reavaliação de `auth.uid()` por linha, e foreign keys operacionais receberam índices.

## Decisão arquitetural

A autorização da aplicação passa a ser expressa por capabilities centralizadas, em vez de condicionais `role === "admin"` espalhadas pelos componentes.

O frontend usa as capabilities para navegação e experiência. O servidor repete a autorização para endpoints internos. RLS e RPCs continuam sendo a autoridade final para operações de banco; esconder uma tela nunca é considerado uma barreira de segurança.

## Matriz inicial

### Member

- Dashboard operacional;
- Backlog Geral;
- Equipe em modo operacional/somente leitura;
- configurações pessoais;
- extração de tarefas por IA;
- chat de documentos;
- resumo de reuniões.

### Admin e owner

Herdam as capacidades de member e recebem:

- relatório global e exportação;
- criação de clientes;
- IA analítica global;
- status técnico da plataforma;
- futura administração da equipe.

`owner` permanece equivalente a admin nesta primeira fundação. A distinção entre eles deve ser implementada junto da administração de usuários: somente owner gerencia owners, ninguém remove o último owner e um admin não promove alguém para owner.

## Telas e ações que exigem evolução posterior

- A tela Equipe ainda precisa receber convite, reenvio, alteração de papel e desativação, sempre via endpoint server-side.
- Members ainda operam todas as linhas de clientes, tarefas, reuniões, notas e arquivos porque as policies atuais usam `can_access_app()`. Escopo por responsável/autor exige nova decisão de negócio e migration específica.
- Exclusão de tarefa e arquivo deve futuramente ser limitada a admin, autor ou responsável.
- A IA analítica deve montar o contexto autorizado no servidor; o navegador não deve ser a fonte oficial do contexto global.
- Relatórios pessoais podem ser criados futuramente para members. O relatório global permanece administrativo.
- A policy de UPDATE em `profiles` é ampla por coluna. A administração deve usar endpoints/RPCs com allowlist e regras de owner/admin.
- Ainda não existe um `owner` cadastrado; a distinção owner/admin será efetivada junto da administração por convite.
- A proteção contra senhas vazadas e o bloqueio de cadastro público devem ser confirmados no painel do Supabase Auth.

## Regra de manutenção

Toda nova tela ou operação sensível deve declarar uma capability em `src/lib/permissions.ts`, ser guardada no ponto de entrada do frontend, validada novamente no servidor quando houver endpoint e protegida no banco quando houver acesso direto via Supabase Data API.

# Genia Backlog Manager

Centro operacional da Geniality para clientes, backlog, equipe, timeline e IA analítica.

View your app in AI Studio: https://ai.studio/apps/11974c8e-41cf-4722-b3ef-43f17af1ae9f

## Executar localmente

**Pré-requisitos:** Node.js 22 ou superior.


1. Instale as dependências:
   `npm install`
2. Copie `.env.example` para `.env.local` e configure as variáveis necessárias.
3. Execute a aplicação:
   `npm run dev`

## Variáveis de ambiente

Variáveis expostas ao frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Variáveis exclusivas do servidor:

- `GEMINI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` — chave moderna `sb_secret_...` recomendada;
- `SUPABASE_SERVICE_ROLE_KEY` — fallback legado, quando a chave moderna ainda não estiver disponível;
- `AUTH_INVITE_REDIRECT_URL` — URL autorizada no Supabase Auth para conclusão do convite.

Nunca use o prefixo `VITE_` em uma chave secreta ou `service_role`. Tudo que começa com `VITE_` é incorporado ao bundle do navegador.

## Administração de equipe

Usuários com papel `owner` ou `admin` podem acessar a área **Equipe → Acessos da equipe** para:

- convidar integrantes por e-mail;
- definir `member`, `admin` ou, quando o solicitante for owner, `owner`;
- reenviar convites pendentes;
- alterar papéis;
- ativar e desativar acessos.

As rotas `/api/admin/users` validam o JWT e o perfil ativo antes de usar o cliente administrativo do Supabase. O navegador nunca recebe a chave secreta. Alterações são executadas por RPCs disponíveis apenas para `service_role` e registradas no `activity_log` com `event_key` idempotente.

Regras principais:

- members não administram acessos;
- admins não gerenciam owners nem atribuem esse papel;
- ninguém altera o próprio acesso pela interface;
- o último owner ativo não pode ser removido, rebaixado ou desativado;
- desativar `profiles.is_active` bloqueia imediatamente API e RLS, mesmo enquanto um JWT antigo ainda for válido.

Para entrega de convites em produção, configure SMTP no Supabase Auth e inclua `AUTH_INVITE_REDIRECT_URL` na lista de Redirect URLs permitidas.

## Verificação

Antes de integrar qualquer branch:

```text
npm test
npm run lint
npm run build
```

As migrations ficam em `supabase/migrations` e migrations já aplicadas nunca devem ser editadas.

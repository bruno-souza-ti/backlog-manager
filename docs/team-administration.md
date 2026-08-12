# Administração de usuários por convite

## Fluxo

1. O frontend envia o JWT da sessão para `/api/admin/users/*`.
2. `requireActiveUser` valida o token no Supabase e lê o papel do perfil real.
3. `requirePermission("team.manage")` permite somente owner/admin.
4. O servidor usa `SUPABASE_SECRET_KEY` ou o fallback legado `SUPABASE_SERVICE_ROLE_KEY`.
5. Auth Admin envia ou reenvia o convite.
6. RPCs disponíveis somente para `service_role` alteram o perfil e gravam a auditoria.
7. RLS consulta `profiles.is_active`; uma desativação bloqueia o usuário imediatamente.

## Endpoints

- `GET /api/admin/users`
- `POST /api/admin/users/invite`
- `POST /api/admin/users/:id/resend`
- `PATCH /api/admin/users/:id`

Toda mutation exige `eventKey` único. O servidor normaliza e-mail e nome e não confia em papel, identidade ou status enviados pelo navegador.

## Configuração operacional

No ambiente de hospedagem do servidor, configure:

- `SUPABASE_URL`;
- `SUPABASE_SECRET_KEY`;
- `AUTH_INVITE_REDIRECT_URL`, apontando para `/auth/setup-password`.

O aceite do convite cria uma sessão temporária e a aplicação bloqueia o Dashboard
até que o integrante defina a primeira senha. A recuperação usa
`/auth/update-password` e também exige a gravação de uma nova senha antes de
liberar o fluxo normal.

No Supabase Auth:

- mantenha cadastro público desabilitado;
- adicione a URL de convite às Redirect URLs;
- configure SMTP próprio para entregabilidade e volume previsíveis;
- ajuste a expiração de OTP/convite ao risco operacional;
- habilite proteção contra senhas vazadas.

## Segurança

- `profiles` não concede INSERT/UPDATE/DELETE a `authenticated`.
- Presença própria continua isolada na RPC `update_my_presence`.
- `register_team_invitation` e `manage_team_member` concedem EXECUTE somente a `service_role`.
- A chave secreta não pode ter prefixo `VITE_`.
- Falha após a criação do usuário no Auth deixa o perfil inativo pelo trigger; portanto, não abre acesso parcial.
- A desativação não depende de claims de papel no JWT. O backend e as políticas consultam o perfil persistido.

## Limitação de sessões

A versão inicial não remove fisicamente sessões do Supabase Auth. Isso não mantém acesso operacional: `can_access_app()` e todas as políticas RLS relevantes exigem `is_active = true`. A sessão pode continuar existindo até expirar, mas requisições ao app e ao banco são rejeitadas imediatamente.

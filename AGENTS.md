# Política de desenvolvimento

Estas regras se aplicam a toda alteração funcional, correção de bug ou melhoria neste repositório.

1. Trabalhe em uma branch exclusiva, criada a partir da `main` atualizada. O nome deve começar pelo propósito da alteração, como `feature/`, `fix/`, `hotfix/`, `refactor/` ou `chore/`.
2. Preserve alterações preexistentes e não misture mudanças sem relação com o objetivo da branch.
3. Antes de integrar, execute toda a suíte automatizada aplicável, incluindo no mínimo `npm test`, `npm run lint` e `npm run build` quando esses scripts existirem.
4. Realize também smoke tests manuais dos fluxos alterados, em desktop e mobile quando houver impacto de interface. Registre o que foi verificado e qualquer limitação do ambiente.
5. Só faça commit e merge na `main` depois que os testes estiverem aprovados. Não faça push, deploy nem aplique migrations em produção sem autorização explícita.
6. Para Supabase, crie migrations novas e aditivas; não altere migrations já aplicadas. Registre migrations pendentes e valide RLS, grants, funções e advisors quando forem afetados.
7. Após o merge, reexecute os gates essenciais na `main` e entregue um relatório com arquivos, decisões, testes, migrations e limitações.

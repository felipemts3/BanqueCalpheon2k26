# Bolão do Banquete de Calpheon 2026

React + Vite + TypeScript + Tailwind, com backend no Supabase (login próprio por Nome de Família + senha de 4 dígitos via RPC).

## Configuração
1. Crie `.env` na raiz (nunca commite):
   ```
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=SUA_ANON_KEY
   ```
2. Aplique TODAS as migrations de `supabase/migrations` em ordem (SQL Editor do Supabase), incluindo
   `20261124200000_security_and_logic_fixes.sql`.
3. `npm install && npm run dev`

## Senha do Master (obrigatório)
O Master é criado com PIN `0000`, mas o login do Master exige **6 ou mais caracteres**, então ele não consegue entrar
até você definir uma senha nova. Rode no SQL Editor (troque o texto):

```sql
UPDATE players
SET pin_hash = extensions.crypt('SUA_SENHA_FORTE', extensions.gen_salt('bf'))
WHERE family_name_lower = 'master';
```

## Regras
- Acerto +10, erro -5, sem resposta 0 (valores na tabela `settings`).
- Prazo: 12/12/2026 02:55 (America/Sao_Paulo), validado no servidor.
- Palpites dos outros: visíveis só após o prazo. Gabarito e ranking: só após "Publicar resultado".

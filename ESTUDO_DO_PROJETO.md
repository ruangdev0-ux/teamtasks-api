# Estudo do projeto: TeamTasks API

Guia para entender e explicar o projeto. Leia com o código aberto ao lado: cada seção aponta os arquivos.

---

## 1. Arquitetura em uma frase

Uma API REST em **Express** que recebe a requisição, **valida** com Zod, **autentica** com JWT, aplica as **regras de negócio** em services e funções puras e grava no **PostgreSQL** via **Drizzle ORM**.

### As camadas e o papel de cada uma

| Camada      | Arquivo de exemplo   | Responsabilidade                                                             | Não deve                  |
| ----------- | -------------------- | ---------------------------------------------------------------------------- | ------------------------- |
| Rotas       | `src/routes.ts`      | ligar URL + método ao controller, aplicar `authenticate` e `validate`        | ter regra de negócio      |
| Schemas     | `task.schemas.ts`    | descrever o formato válido da entrada (Zod)                                  | acessar o banco           |
| Controller  | `task.controller.ts` | ler `req`, chamar o service, escolher o status HTTP                          | decidir regras            |
| Service     | `task.service.ts`    | orquestrar o caso de uso: carregar dados, chamar as regras, abrir transações | montar SQL na mão         |
| Regras      | `task-rules.ts`      | funções puras que dizem "pode" ou lançam erro                                | depender de banco ou HTTP |
| Repository  | `task.repository.ts` | consultas SQL com Drizzle                                                    | conhecer HTTP ou regras   |
| Middlewares | `error-handler.ts`   | tratar o que é comum a todas as rotas                                        | —                         |

Por que separar assim? Cada parte muda por um motivo diferente. Se a regra de status mudar, mexo só em `task-rules.ts`. Se a tabela mudar, mexo no repository. E as regras puras podem ser testadas sem subir banco.

---

## 2. Fluxo de uma requisição (exemplo real)

`PATCH /tasks/:taskId/status` com `{ "status": "DONE" }`:

1. **`express.json()`** transforma o corpo em objeto (JSON inválido vira 400).
2. **`authenticate`** lê `Authorization: Bearer <token>`, verifica a assinatura com `JWT_SECRET` e coloca `req.user = { id, email }`. Sem token ou token inválido: 401.
3. **`validate({ params: taskParams, body: changeStatusSchema })`** confere se `taskId` é UUID e se `status` é um dos 5 valores. Erro: 400 com os campos.
4. **`taskController.changeStatus`** pega o id do usuário e os dados validados e chama o service.
5. **`taskService.changeStatus`**:
   - `loadTaskForMember`: busca a tarefa, o projeto e a participação do usuário na equipe. Se faltar qualquer um: 404.
   - `assertProjectIsActive`: projeto arquivado, 422.
   - `assertCanEditTask`: MEMBER que não criou nem é responsável, 403.
   - `assertValidTransition`: confere na tabela `ALLOWED_TRANSITIONS`. Ex.: TODO → DONE, 422.
   - abre uma **transação**: atualiza `status` e `completedAt` e grava o histórico. Se uma das duas falhar, nenhuma fica salva.
6. O controller responde **200** com a tarefa atualizada.
7. Se algo lançou um `AppError` no caminho, o **`errorHandler`** transforma no JSON padrão `{ error: { code, message, details } }`.

Detalhe importante: no **Express 5**, erros lançados dentro de funções `async` chegam sozinhos ao `errorHandler`. No Express 4 seria preciso `try/catch` ou um wrapper em cada rota.

---

## 3. Banco de dados

Tabelas (veja `src/db/schema.ts` e `drizzle/0000_init.sql`):

- **users**: `email` é `UNIQUE`; a senha é guardada só como `password_hash`.
- **teams** e **team_members**: relação muitos-para-muitos entre usuários e equipes, com o papel (`OWNER`, `ADMIN`, `MEMBER`) na tabela do meio. Chave primária composta `(team_id, user_id)`, então a mesma pessoa não entra duas vezes.
- **projects**: pertence a uma equipe; `status` é `ACTIVE` ou `ARCHIVED`.
- **tasks**: pertence a um projeto; tem `status`, `priority`, `due_date`, `assignee_id` e `completed_at`.
- **task_history**: uma linha por campo alterado (`field`, `old_value`, `new_value`, `actor_id`).

Conceitos para saber explicar:

- **Enums do PostgreSQL** (`task_status`, `task_priority`…): o banco recusa valores fora da lista. Como a ordem é LOW < MEDIUM < HIGH < URGENT, dá para ordenar por prioridade direto no SQL.
- **Chaves estrangeiras e `ON DELETE`**: apagar um projeto apaga as tarefas (`cascade`); apagar um usuário deixa o responsável da tarefa como `NULL` (`set null`).
- **Índices**: `(project_id, status)` acelera a listagem filtrada por status; também há índices em `assignee_id` e `due_date`.
- **Migrations**: o `schema.ts` é a fonte; `npm run db:generate` compara com a última migration e gera um `.sql` novo; `npm run db:migrate` aplica as que faltam e registra quais já rodaram numa tabela de controle.
- **Transação**: um bloco de escritas que vale inteiro ou não vale. Usada em: criar equipe + OWNER, mudar status + histórico, remover membro + desatribuir tarefas.

---

## 4. Autenticação e autorização

- **Cadastro** (`auth.service.ts`): normaliza o e-mail para minúsculas, recusa duplicado (409) e salva `bcrypt.hash(senha, BCRYPT_ROUNDS)`.
- **Por que bcrypt?** É lento de propósito e usa _salt_ aleatório: o mesmo texto gera hashes diferentes, e testar milhões de senhas fica caro.
- **Login**: `bcrypt.compare`. E-mail inexistente e senha errada recebem **a mesma mensagem**, para não revelar quem tem conta.
- **JWT** (`lib/jwt.ts`): token assinado com HS256 contendo `sub` (id do usuário) e `email`, com validade de `JWT_EXPIRES_IN`. O servidor não guarda sessão: valida a assinatura a cada requisição.
- **Autenticação ≠ autorização**: o JWT diz **quem é** o usuário. O que ele **pode fazer** depende do papel na equipe, conferido no banco a cada ação (`requireMembership` e as funções `assertCan...`).
- **404 em vez de 403 para quem é de fora**: assim ninguém descobre se uma equipe existe só testando IDs. O 403 aparece quando a pessoa é membro, mas o papel não permite a ação.

---

## 5. Regras de negócio (e onde estão)

1. Só membros veem a equipe e o que há nela: `team.service.ts` (`requireMembership`), `project.service.ts` (`loadProjectForMember`).
2. Gerenciar projeto: OWNER/ADMIN ou o criador. `assertCanManageProject`.
3. Projeto com tarefas abertas não é excluído (422 com `openTasks`). `assertCanDeleteProject`.
4. Projeto arquivado é somente leitura. `assertProjectIsActive`.
5. Máquina de estados do status, `ALLOWED_TRANSITIONS`: DONE só volta para IN_PROGRESS; CANCELLED só é reaberta por OWNER/ADMIN.
6. Responsável precisa ser da equipe; ao sair, as tarefas abertas dele ficam sem responsável e isso vai para o histórico. `assertAssigneeIsMember` e `teamService.removeMember`.
7. MEMBER só edita o que criou ou o que está com ele. `assertCanEditTask`.
8. A equipe sempre tem pelo menos um OWNER. `assertCanChangeRole` e `assertCanRemoveMember`.
9. Hierarquia de papéis: só OWNER muda papéis e cria ADMIN/OWNER. `assertCanAddMember`.
10. Prazo não pode estar no passado (comparação por dia, em UTC). `assertDueDateNotInPast`.

**Histórico:** `diffTask` (`task-history.ts`) compara o antes e o depois e cria uma linha só para os campos que mudaram. Datas são comparadas pelo valor em ISO, não pela referência do objeto.

---

## 6. Testes

- **Unitários** (`tests/unit`, 35 testes): testam as funções de regra diretamente, sem banco nem HTTP. Ex.: "DONE → TODO lança 422 com `allowed: ['IN_PROGRESS']`".
- **Integração** (`tests/integration`, 35 testes): sobem o app em memória com **Supertest** e usam um **PostgreSQL de verdade** (`teamtasks_test`). Antes de todos os testes, `global-setup.ts` aplica as migrations; antes de cada teste, `resetDatabase` faz `TRUNCATE` das tabelas.
- `scenario()` cria o cenário padrão: OWNER, ADMIN, MEMBER, uma pessoa de fora, uma equipe e um projeto.
- Os arquivos rodam em sequência (`fileParallelism: false`) porque compartilham o mesmo banco.
- **Cobertura**: cerca de 97% das linhas e 100% dos módulos de regras (`npm run test:coverage`).
- **Os testes pegam erros de verdade?** Conferi quebrando o código de propósito: liberei DONE → TODO e removi a desatribuição de tarefas ao remover membro. Nos dois casos os testes falharam, como deveriam.

---

## 7. CI/CD

`.github/workflows/ci.yml` roda a cada push e pull request:

1. sobe um **serviço PostgreSQL 16** dentro do runner do GitHub;
2. `npm ci` instala exatamente as versões do `package-lock.json`;
3. ESLint, Prettier (`--check`) e `tsc --noEmit`;
4. `npm test` (unitários e integração);
5. `npm run build`;
6. regenera `docs/openapi.json` e falha se ele estiver diferente do versionado, ou seja, se alguém mudou uma rota e esqueceu de atualizar a documentação.

Qualquer passo com erro faz o job falhar, e o push aparece com ❌ no GitHub.

**Deploy (CD):** `render.yaml` descreve o serviço no Render (plano gratuito). O build compila o TypeScript; ao iniciar, roda `db:migrate:prod` e depois `npm start`. O banco fica no Neon (PostgreSQL gerenciado). `DATABASE_URL` e `JWT_SECRET` são configurados no painel do Render, nunca no código.

---

## 8. Decisões técnicas (e o porquê)

| Decisão                                | Motivo                                                        | Alternativa                                            |
| -------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------ |
| Express 5                              | o mais pedido em vagas Node; trata erros `async`              | Fastify (mais rápido, menos comum em vagas de estágio) |
| Drizzle ORM                            | tipado, perto do SQL, migrations em `.sql` legível            | Prisma (mais popular; ver seção 9)                     |
| Zod como fonte única                   | o mesmo schema valida e gera o OpenAPI                        | escrever a documentação à mão (desatualiza)            |
| Regras em funções puras                | testes rápidos e regra fácil de achar                         | regras espalhadas nos services                         |
| 422 para regra de negócio              | separa "dados errados" (400) de "ação proibida agora" (422)   | usar 400 para tudo                                     |
| UUID nas chaves                        | não expõe a quantidade de registros nem permite adivinhar IDs | inteiro autoincremento                                 |
| Paginação por `page/limit` com `total` | simples para o front montar a paginação                       | cursor (melhor para listas enormes)                    |

---

## 9. Problemas encontrados e como foram resolvidos

1. **Prisma não instalava os binários no ambiente de desenvolvimento.** O download do _schema engine_ era bloqueado pela rede, então as migrations não rodavam. Troquei para **Drizzle**, que é só TypeScript e gera SQL puro. Como o código acessa o banco só pelos repositories, a troca ficou concentrada nessa camada.
2. **Mensagens de validação em inglês.** O Zod 4 vem em inglês por padrão ("Too small…"). Ativei o locale em português com `z.config(z.locales.pt())` em `src/docs/zod.ts`.
3. **Erro de tipo no filtro por vírgula.** O helper `csv()` recebia um schema genérico e o TypeScript não aceitava. Restringi o tipo para `z.ZodType<unknown, string>`, porque o item precisa aceitar texto como entrada.
4. **`try/catch` escondendo erro de banco.** A primeira versão da checagem de membro fazia `try { ... } catch { throw 404 }`, o que transformaria até uma falha de conexão em "não encontrado". Troquei por uma checagem explícita: busca o projeto e a participação e só responde 404 se algum não existir.
5. **CI x Prettier na documentação gerada.** O Prettier reformatava o `docs/openapi.json`, e a checagem "documentação atualizada" do CI falharia sempre. Coloquei o arquivo gerado no `.prettierignore`.

---

## 10. Perguntas que um recrutador pode fazer

**1. O que o projeto faz?**
É uma API de tarefas para pequenas equipes: usuários com JWT, equipes com papéis, projetos, tarefas com status, prioridade, prazo e responsável, e histórico de alterações.

**2. Como a aplicação está organizada?**
Por módulos (auth, teams, projects, tasks), cada um com schemas, controller, service, regras e repository. O controller só lida com HTTP; o service orquestra; as regras são funções puras; o repository faz as consultas.

**3. Como funciona a autenticação?**
No cadastro a senha vira hash bcrypt. No login comparo com `bcrypt.compare` e gero um JWT assinado com o id do usuário. O middleware `authenticate` valida o token em cada requisição e coloca o usuário em `req.user`.

**4. Qual a diferença entre autenticação e autorização no seu projeto?**
Autenticação é o JWT dizendo quem é a pessoa. Autorização é o papel dela na equipe (OWNER, ADMIN, MEMBER), conferido no banco a cada ação.

**5. Por que devolver 404 em vez de 403 para quem não é da equipe?**
Para não confirmar que o recurso existe. Com 403, alguém poderia testar IDs e descobrir quais equipes existem.

**6. Dê um exemplo de regra de negócio que você implementou.**
Uma tarefa concluída não volta direto para "não iniciada": só pode ser reaberta para IN_PROGRESS. Isso fica numa tabela de transições permitidas, e qualquer outra mudança devolve 422 com a lista do que é permitido.

**7. Como você garante que a mudança de status e o histórico fiquem consistentes?**
Os dois ficam na mesma transação. Se gravar o histórico falhar, a mudança de status também é desfeita.

**8. Como funcionam os filtros e a paginação?**
Os filtros viram condições do `WHERE`: status e prioridade com `IN`, busca com `ILIKE`, atraso com `due_date < agora` e status aberto. A paginação usa `LIMIT/OFFSET` e uma consulta de `COUNT` para devolver `total` e `totalPages`.

**9. Como você valida as entradas?**
Com Zod no middleware `validate`, antes do controller. Ele converte tipos (ex.: `"10"` vira `10`) e, se der erro, devolve 400 com os campos inválidos. Os mesmos schemas geram a documentação OpenAPI.

**10. Como é o tratamento de erros?**
Os services lançam `AppError` com status e código (`NOT_FOUND`, `FORBIDDEN`, `BUSINESS_RULE_VIOLATION`…). Um único middleware converte tudo para `{ error: { code, message, details } }`; erros inesperados viram 500 sem expor detalhes internos.

**11. Que tipos de teste você escreveu?**
Unitários para as regras puras, que são rápidos e sem banco, e de integração com Supertest contra um PostgreSQL real, cobrindo os fluxos completos e as permissões. São 70 testes, com cerca de 97% de cobertura.

**12. Como você sabe que os testes realmente testam alguma coisa?**
Quebrei regras de propósito, por exemplo liberando DONE → TODO, e os testes falharam. Também rodo os testes contra um banco real no CI, não contra mocks.

**13. O que o pipeline de CI faz?**
Sobe um PostgreSQL, instala com `npm ci` e roda lint, formatação, checagem de tipos, testes e build. Também confere se a documentação OpenAPI está atualizada. Se qualquer passo falhar, o pipeline falha.

**14. Por que Drizzle e não Prisma?**
O Drizzle é tipado, fica perto do SQL e gera migrations em `.sql` legível. No meu ambiente de desenvolvimento os binários do Prisma não instalavam. Como o acesso ao banco está isolado nos repositories, a troca ficou concentrada nessa camada.

**15. O que você melhoraria?**
Refresh token e revogação de sessão, rate limiting no login, convite por e-mail para entrar na equipe, comentários nas tarefas e paginação por cursor se as listas crescerem muito.

---

## 11. Para estudar com mais calma

- O que é um JWT por dentro (header, payload, assinatura) e por que ele não é criptografado, só assinado.
- Por que o bcrypt usa salt e o que é o "custo" (`BCRYPT_ROUNDS`).
- Transações e o que significa ACID.
- Diferença entre `LIMIT/OFFSET` e paginação por cursor.
- Códigos HTTP: 400, 401, 403, 404, 409 e 422 e quando usar cada um.
- Índices: quando ajudam e quando atrapalham as escritas.
- Como o Express encadeia middlewares (`next`) e como o middleware de erro (4 parâmetros) é diferente.

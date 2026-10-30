# TeamTasks API

[![CI](https://github.com/ruangdev0-ux/teamtasks-api/actions/workflows/ci.yml/badge.svg)](https://github.com/ruangdev0-ux/teamtasks-api/actions/workflows/ci.yml)

API REST para gerenciar tarefas de pequenas equipes: contas com JWT, equipes com papéis, projetos, tarefas com prioridade, prazo, responsável e fluxo de status, além de histórico de alterações.

Projeto pessoal de portfólio para praticar desenvolvimento back-end com **TypeScript, Node.js, Express e PostgreSQL**. Todos os dados de exemplo são fictícios.

## O problema

Em times pequenos, tarefas costumam ficar espalhadas em conversas e planilhas: não fica claro quem é responsável, o que está atrasado e quem mudou o quê. A TeamTasks API organiza isso com regras explícitas: só membros veem o trabalho da equipe, cada mudança fica registrada e o status segue um fluxo definido.

## Funcionalidades

- Cadastro e login com **JWT**; senhas guardadas com **bcrypt**
- **Equipes** com três papéis: `OWNER`, `ADMIN` e `MEMBER`
- **Projetos** por equipe, que podem ser arquivados (ficam somente leitura)
- **Tarefas** com status, prioridade, prazo e responsável
- **Fluxo de status** validado (uma máquina de estados simples)
- **Histórico** de alterações de cada tarefa (quem mudou, qual campo, de quê para quê)
- **Filtros** por status, prioridade, responsável, intervalo de prazo, atraso e busca no título
- **Paginação** e ordenação nas listagens
- **Validação** de todas as entradas com Zod e **erros em formato padronizado**
- Documentação **OpenAPI/Swagger** gerada a partir dos mesmos schemas da validação

## Regras de negócio

| #   | Regra                                                                                                                                                                                           | Onde está                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 1   | Só membros da equipe veem a equipe, seus projetos e tarefas. Para quem é de fora a resposta é **404**, para não revelar que o recurso existe.                                                   | `requireMembership`, `loadProjectForMember` |
| 2   | Editar, arquivar ou excluir projeto: `OWNER`/`ADMIN` ou quem criou o projeto.                                                                                                                   | `project-rules.ts`                          |
| 3   | Projeto com tarefas abertas (`TODO`, `IN_PROGRESS`, `IN_REVIEW`) não pode ser excluído; a alternativa é arquivar.                                                                               | `assertCanDeleteProject`                    |
| 4   | Projeto arquivado é somente leitura: não aceita tarefas novas nem alterações.                                                                                                                   | `assertProjectIsActive`                     |
| 5   | Fluxo de status: `TODO → IN_PROGRESS → IN_REVIEW → DONE`. Tarefa concluída só reabre para `IN_PROGRESS`, nunca direto para `TODO`. `CANCELLED` só é reaberta (para `TODO`) por `OWNER`/`ADMIN`. | `task-rules.ts`                             |
| 6   | O responsável precisa ser membro da equipe. Ao remover um membro, as tarefas abertas dele ficam sem responsável e isso entra no histórico.                                                      | `assertAssigneeIsMember`, `removeMember`    |
| 7   | `MEMBER` só altera tarefas que criou ou que estão com ele; `OWNER`/`ADMIN` alteram qualquer uma.                                                                                                | `assertCanEditTask`                         |
| 8   | A equipe nunca fica sem `OWNER`: o último não pode ser rebaixado nem sair.                                                                                                                      | `team-rules.ts`                             |
| 9   | Só o `OWNER` muda papéis e adiciona `ADMIN`/`OWNER`; `ADMIN` gerencia apenas `MEMBER`.                                                                                                          | `team-rules.ts`                             |
| 10  | O prazo não pode estar no passado ao criar ou alterar a tarefa.                                                                                                                                 | `assertDueDateNotInPast`                    |

```
TODO ──► IN_PROGRESS ──► IN_REVIEW ──► DONE
 ▲ ◄────────┘  ▲ ◄───────────┘          │
 │             └────── reabrir ─────────┘
 └── CANCELLED (qualquer status aberto pode ser cancelado; só OWNER/ADMIN reabrem)
```

## Stack

| Área                | Tecnologia                                    |
| ------------------- | --------------------------------------------- |
| Linguagem           | TypeScript (strict)                           |
| Runtime e framework | Node.js 22 e Express 5                        |
| Banco de dados      | PostgreSQL 16                                 |
| ORM e migrations    | Drizzle ORM e drizzle-kit (migrations em SQL) |
| Autenticação        | JWT (`jsonwebtoken`) e `bcrypt`               |
| Validação           | Zod 4                                         |
| Documentação        | OpenAPI 3.1 com `zod-to-openapi` e Swagger UI |
| Testes              | Vitest e Supertest                            |
| Qualidade           | ESLint (typescript-eslint) e Prettier         |
| CI                  | GitHub Actions com serviço PostgreSQL         |
| Ambiente local      | Docker Compose                                |

## Arquitetura

O código é organizado por **módulo** (auth, teams, projects, tasks), e cada módulo segue as mesmas camadas:

```
src/
├── app.ts                 # monta o Express (middlewares, rotas, docs, erros)
├── server.ts              # sobe o servidor HTTP
├── routes.ts              # todas as rotas, com autenticação e validação
├── config/env.ts          # variáveis de ambiente validadas com Zod
├── db/
│   ├── schema.ts          # tabelas, enums e relações (Drizzle)
│   ├── client.ts          # pool de conexões
│   ├── migrate.ts         # aplica as migrations
│   └── seed.ts            # dados fictícios
├── middlewares/           # authenticate, validate, error-handler
├── errors/app-error.ts    # erros de aplicação (400, 401, 403, 404, 409, 422)
├── docs/                  # Zod com OpenAPI e o documento da API
└── modules/
    └── tasks/
        ├── task.schemas.ts     # validação da entrada (Zod)
        ├── task.controller.ts  # lê a requisição e devolve a resposta
        ├── task.service.ts     # casos de uso: aplica as regras, abre transações
        ├── task-rules.ts       # regras de negócio puras (sem banco), fáceis de testar
        ├── task-history.ts     # calcula o que mudou para o histórico
        └── task.repository.ts  # consultas SQL com Drizzle
```

Fluxo de uma requisição:

```
HTTP → routes (authenticate + validate) → controller → service → rules + repository → PostgreSQL
                                                         └─ erro? → error-handler → JSON padronizado
```

## Banco de dados

```mermaid
erDiagram
    users ||--o{ team_members : participa
    teams ||--o{ team_members : tem
    teams ||--o{ projects : possui
    projects ||--o{ tasks : contém
    users ||--o{ tasks : "é responsável"
    tasks ||--o{ task_history : registra
    users ||--o{ task_history : "fez a alteração"

    users {
        uuid id PK
        varchar name
        varchar email UK
        text password_hash
    }
    teams {
        uuid id PK
        varchar name
        uuid created_by_id FK
    }
    team_members {
        uuid team_id PK
        uuid user_id PK
        team_role role
    }
    projects {
        uuid id PK
        uuid team_id FK
        varchar name
        project_status status
    }
    tasks {
        uuid id PK
        uuid project_id FK
        varchar title
        task_status status
        task_priority priority
        timestamptz due_date
        uuid assignee_id FK
        timestamptz completed_at
    }
    task_history {
        uuid id PK
        uuid task_id FK
        uuid actor_id FK
        varchar field
        varchar old_value
        varchar new_value
    }
```

A migration inicial está em [`drizzle/0000_init.sql`](drizzle/0000_init.sql). Há índices para as consultas mais comuns: tarefas por projeto e status, por responsável e por prazo.

## Como executar

Pré-requisitos: Node.js 22 e Docker (ou um PostgreSQL 16 local).

```bash
git clone https://github.com/ruangdev0-ux/teamtasks-api.git
cd teamtasks-api
npm install
cp .env.example .env          # ajuste o JWT_SECRET
docker compose up -d          # sobe o PostgreSQL em localhost:5432
npm run db:migrate            # cria as tabelas
npm run db:seed               # dados fictícios (opcional)
npm run dev                   # http://localhost:3333 · docs em /docs
```

Usuários do seed (senha `demo12345`): `ana@exemplo.com` (OWNER), `bruno@exemplo.com` (ADMIN) e `carla@exemplo.com` (MEMBER).

### Scripts

| Script                                                        | O que faz                                       |
| ------------------------------------------------------------- | ----------------------------------------------- |
| `npm run dev`                                                 | servidor com recarga automática                 |
| `npm run build` / `npm start`                                 | compila para `dist/` e roda a versão compilada  |
| `npm run db:generate`                                         | gera uma nova migration a partir do `schema.ts` |
| `npm run db:migrate`                                          | aplica as migrations                            |
| `npm run db:seed`                                             | insere dados fictícios                          |
| `npm test`                                                    | testes unitários e de integração                |
| `npm run lint` / `npm run format:check` / `npm run typecheck` | qualidade de código                             |

## Variáveis de ambiente

| Variável         | Descrição                             | Padrão        |
| ---------------- | ------------------------------------- | ------------- |
| `DATABASE_URL`   | conexão do PostgreSQL                 | obrigatória   |
| `JWT_SECRET`     | segredo do JWT (mínimo 32 caracteres) | obrigatória   |
| `JWT_EXPIRES_IN` | validade do token                     | `1h`          |
| `BCRYPT_ROUNDS`  | custo do bcrypt                       | `10`          |
| `PORT`           | porta HTTP                            | `3333`        |
| `NODE_ENV`       | `development`, `test` ou `production` | `development` |

As variáveis são validadas na inicialização: se faltar alguma, a aplicação não sobe e mostra qual está errada.

## Rotas principais

Todas, exceto cadastro e login, exigem o header `Authorization: Bearer <token>`. A referência completa está no Swagger (`/docs`) e em `/openapi.json`.

| Método               | Rota                                          | Descrição                                        |
| -------------------- | --------------------------------------------- | ------------------------------------------------ |
| POST                 | `/auth/register`                              | cria uma conta                                   |
| POST                 | `/auth/login`                                 | devolve o token JWT                              |
| GET                  | `/auth/me`                                    | usuário autenticado                              |
| POST / GET           | `/teams`                                      | cria equipe (você vira OWNER) / lista as suas    |
| GET / PATCH / DELETE | `/teams/:teamId`                              | detalhe, edição e exclusão                       |
| GET / POST           | `/teams/:teamId/members`                      | lista / adiciona membro por e-mail               |
| PATCH / DELETE       | `/teams/:teamId/members/:userId`              | muda papel / remove membro                       |
| POST / GET           | `/teams/:teamId/projects`                     | cria / lista projetos (paginado)                 |
| GET / PATCH / DELETE | `/projects/:projectId`                        | detalhe com resumo de tarefas, edição e exclusão |
| POST                 | `/projects/:projectId/archive` e `/unarchive` | arquiva / desarquiva                             |
| POST / GET           | `/projects/:projectId/tasks`                  | cria / lista tarefas com filtros                 |
| GET                  | `/me/tasks`                                   | tarefas atribuídas a você                        |
| GET / PATCH / DELETE | `/tasks/:taskId`                              | detalhe, edição e exclusão                       |
| PATCH                | `/tasks/:taskId/status`                       | muda o status pelo fluxo permitido               |
| GET                  | `/tasks/:taskId/history`                      | histórico de alterações (paginado)               |
| GET                  | `/health`                                     | saúde da API e do banco                          |

### Filtros de tarefas

`GET /projects/:projectId/tasks?status=TODO,IN_PROGRESS&priority=HIGH,URGENT&assigneeId=me&dueFrom=2026-11-01&dueTo=2026-11-30&overdue=true&q=login&sort=dueDate&order=asc&page=1&limit=20`

- `status` e `priority` aceitam vários valores separados por vírgula
- `assigneeId` aceita um UUID, `me` ou `none` (sem responsável)
- `sort`: `createdAt`, `updatedAt`, `dueDate` ou `priority`; tarefas sem prazo ficam no fim
- `limit` vai até 100

## Exemplos

**Login**

```http
POST /auth/login
Content-Type: application/json

{ "email": "ana@exemplo.com", "password": "demo12345" }
```

```json
{
  "user": {
    "id": "0185d177-…",
    "name": "Ana Souza",
    "email": "ana@exemplo.com",
    "createdAt": "2026-10-29T12:08:39.683Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
}
```

**Criar tarefa**

```http
POST /projects/0dedcaaf-…/tasks
Authorization: Bearer <token>

{ "title": "Escrever testes do checkout", "priority": "HIGH", "dueDate": "2026-12-15" }
```

```json
{
  "id": "674960dd-…",
  "projectId": "0dedcaaf-…",
  "title": "Escrever testes do checkout",
  "description": null,
  "status": "TODO",
  "priority": "HIGH",
  "dueDate": "2026-12-15T00:00:00.000Z",
  "assigneeId": null,
  "createdById": "0185d177-…",
  "completedAt": null,
  "createdAt": "2026-10-29T12:14:09.852Z",
  "updatedAt": "2026-10-29T12:14:09.852Z"
}
```

**Regra de negócio violada** (pular etapas do fluxo)

```http
PATCH /tasks/674960dd-…/status
{ "status": "DONE" }
```

```json
{
  "error": {
    "code": "BUSINESS_RULE_VIOLATION",
    "message": "Não é permitido mudar o status de TODO para DONE.",
    "details": { "allowed": ["IN_PROGRESS", "CANCELLED"] }
  }
}
```

**Erro de validação**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos.",
    "details": {
      "email": ["endereço de e-mail inválido"],
      "password": ["A senha precisa ter pelo menos 8 caracteres."]
    }
  }
}
```

### Códigos de erro

| HTTP | `code`                    | Quando                                                    |
| ---- | ------------------------- | --------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`        | entrada inválida (Zod), JSON malformado, prazo no passado |
| 401  | `UNAUTHORIZED`            | token ausente, inválido ou expirado; login incorreto      |
| 403  | `FORBIDDEN`               | é membro, mas o papel não permite a ação                  |
| 404  | `NOT_FOUND`               | recurso não existe ou você não é da equipe                |
| 409  | `CONFLICT`                | e-mail já cadastrado, membro já adicionado                |
| 422  | `BUSINESS_RULE_VIOLATION` | regra de negócio impede a ação                            |

## Testes

```bash
npm test                  # todos
npm run test:unit         # só regras de negócio (sem banco)
npm run test:integration  # API completa contra o PostgreSQL de teste
npm run test:coverage     # relatório de cobertura
```

- **Unitários** (`tests/unit`): fluxo de status, permissões de papéis, regras de projeto, prazo e cálculo do histórico. São funções puras, sem banco.
- **Integração** (`tests/integration`): a API de verdade (Supertest) contra um PostgreSQL de teste. Cobrem autenticação, isolamento entre equipes, permissões, exclusão bloqueada, arquivamento, fluxo de status, histórico, filtros e paginação.

São 70 testes no total, com cerca de 97% de cobertura de linhas e 100% nos módulos de regras de negócio.

O banco de teste padrão é `postgresql://teamtasks:teamtasks@localhost:5432/teamtasks_test` (pode ser trocado com `TEST_DATABASE_URL`). As migrations rodam automaticamente antes dos testes, e as tabelas são limpas antes de cada teste.

## CI

O workflow [`ci.yml`](.github/workflows/ci.yml) roda a cada push e pull request:

1. instala as dependências (`npm ci`);
2. lint, formatação e checagem de tipos;
3. testes unitários e de integração, com um serviço PostgreSQL 16;
4. build.

Se qualquer etapa falhar, o pipeline falha.

## Decisões técnicas

- **Express 5**: é o framework Node mais pedido em vagas, e a versão 5 já repassa erros de funções `async` para o middleware de erro, sem `try/catch` em cada rota.
- **Drizzle ORM**: consultas tipadas próximas do SQL e migrations geradas como arquivos `.sql` legíveis, que são versionados.
- **Regras em funções puras** (`*-rules.ts`): a lógica de permissão e de status fica isolada do banco, então dá para testar cada regra em milissegundos.
- **404 para quem não é membro**: evita que alguém descubra, por tentativa, quais equipes ou projetos existem.
- **422 para regra de negócio**: diferencia "dados inválidos" (400) de "dados válidos, mas a ação não é permitida agora" (422).
- **Transações** nas operações com mais de uma escrita (criar equipe + OWNER, mudar status + histórico, remover membro + desatribuir tarefas).
- **Zod como fonte única**: o mesmo schema valida a requisição e gera a documentação OpenAPI.
- **Mesma mensagem para e-mail inexistente e senha errada** no login, para não revelar quais e-mails têm conta.

## Limitações

- Não há refresh token nem logout no servidor: o JWT vale até expirar.
- Não há convite por e-mail: o membro é adicionado se já tiver conta.
- Não há limite de requisições (rate limiting) nem recuperação de senha.
- O histórico guarda os valores como texto; não há "desfazer" automático.

## Próximos passos

- Refresh token e revogação de sessões
- Comentários em tarefas e anexos
- Rate limiting no login
- Notificações de prazo próximo
- Um front-end simples consumindo a API

## Autor

**Ruan Gomes**, estudante de Análise e Desenvolvimento de Sistemas (Unifran).

- GitHub: [github.com/ruangdev0-ux](https://github.com/ruangdev0-ux)
- LinkedIn: [linkedin.com/in/ruan-gomes-805029393](https://www.linkedin.com/in/ruan-gomes-805029393)

Licença [MIT](LICENSE).

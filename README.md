# Leonardo e Rafael Piciani — Cadastro de Apoiadores

Site de cadastro de apoiadores para a iniciativa "Ajude o Esporte de Rio das Ostras a Melhorar", com painel administrativo completo.

## Rodando localmente

```
npm install
npm start
```

Acesse `http://localhost:3000` para o site público e `http://localhost:3000/admin` para o painel administrativo.

Crie um arquivo `.env` na raiz com base nas variáveis abaixo antes de rodar.

## Credenciais do administrador

Definidas no arquivo `.env` (`ADMIN_USERNAME` e `ADMIN_PASSWORD`). Elas só são usadas na **primeira execução** para criar o admin no banco — depois disso, altere a senha diretamente no banco (ou peça para recriar o hash).

**Troque a senha padrão antes de divulgar o site publicamente.**

## Lideranças

No painel administrativo, aba "Lideranças", o administrador pode:
- Criar lideranças (nome + telefone opcional) — cada uma recebe um link exclusivo (`?lider=codigo`).
- Compartilhar esse link com a liderança; todo cadastro feito por ele é atribuído automaticamente a ela.
- Ver a árvore de cadastros de cada liderança, editar, excluir e exportar.

## Estrutura

- `src/server.js` — servidor Express (API pública + administrativa)
- `src/db.js` — banco SQLite (better-sqlite3), criado automaticamente em `data/piciani.db`
- `public/` — frontend (HTML/CSS/JS puro, sem build step)

## Variáveis de ambiente (`.env`)

| Variável | Descrição |
|---|---|
| `PORT` | Porta do servidor (padrão 3000) |
| `SESSION_SECRET` | Segredo para assinar cookies de sessão — troque em produção |
| `ADMIN_USERNAME` | Usuário do admin inicial |
| `ADMIN_PASSWORD` | Senha do admin inicial |
| `NODE_ENV` | `production` em produção (ativa cookies seguros) |

## Hospedagem (produção)

Este é um app Node.js com banco SQLite em arquivo — precisa de um host que mantenha **disco persistente** (senão os cadastros somem a cada deploy). Opções recomendadas:

- **Render.com** — já incluso `render.yaml` neste projeto (disco persistente de 1GB). Conecte o repositório e o Render detecta a configuração automaticamente.
- **Railway.app** — adicione um volume persistente apontando para a pasta `data/`.
- **Fly.io** — use `fly volumes create` e monte em `/app/data`.

Em qualquer opção, configure as variáveis de ambiente do `.env` no painel do host (nunca suba o `.env` para o repositório).

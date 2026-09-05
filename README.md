# Leonardo e Rafael Picciani — Cadastro de Apoiadores

Site hospedado no **GitHub Pages**, com banco de dados e login administrativo no **Firebase** (Firestore + Authentication).

🔗 **Site ao vivo:** https://lucasdebuh.github.io/leonardo-rafael-piciani/
🔗 **Painel administrativo:** https://lucasdebuh.github.io/leonardo-rafael-piciani/admin.html

## Como funciona

Este é um site 100% estático (HTML/CSS/JS puro, sem servidor próprio). Toda a lógica de cadastro, login e dados roda direto no navegador via SDK do Firebase:

- **Cadastro público** (`index.html` / `js/cadastro.js`): grava direto na coleção `participantes` do Firestore. O ID do documento é o telefone (somente dígitos), o que impede cadastros duplicados nativamente pelas regras de segurança.
- **Painel administrativo** (`admin.html` / `js/admin.js`): login via Firebase Authentication (e-mail/senha). Depois de autenticado, lê e escreve nas coleções `participantes` e `liderancas` em tempo real (as mudanças aparecem na hora, sem precisar recarregar a página).
- **Lideranças**: cada liderança tem um "código" (slug do nome) que vira o link `?lider=codigo`. Um cadastro feito por esse link grava esse código no campo `lideranca_codigo`, sem precisar de leitura pública da coleção de lideranças.

## Segurança

- Os dados dos cadastros **não são públicos**: as regras do Firestore só permitem `create` (cadastro) publicamente; leitura, edição e exclusão exigem estar autenticado como administrador.
- A senha do administrador é gerenciada pelo Firebase Authentication (nunca armazenada em texto simples).
- A `apiKey` do Firebase que aparece em `js/firebase-config.js` **não é um segredo** — é uma chave pública de identificação do projeto. A segurança real está nas regras do Firestore (arquivo de regras configurado diretamente no console do Firebase).

## Nota sobre o nome do repositório

O repositório e o projeto Firebase foram criados como `leonardo-rafael-piciani` (identificadores técnicos, não podem ser renomeados depois de criados sem quebrar a URL atual). O nome correto exibido no site é **Picciani** (com dois "c") — já corrigido em todo o conteúdo visível.

## Estrutura

```
index.html          — página pública de cadastro
admin.html           — painel administrativo
privacidade.html      — política de privacidade
css/                  — estilos
js/
  firebase-config.js  — configuração do projeto Firebase
  util.js, mask.js    — utilitários (máscara de telefone, formatação)
  cadastro.js         — lógica do formulário público
  admin.js            — lógica completa do painel (auth, CRUD, lideranças, exportação)
public/img/           — foto de Leonardo e Rafael Picciani
```

## Rodando localmente

Como é um site estático com módulos ES (`import`/`export`), não pode ser aberto direto como arquivo (`file://`) — precisa de um servidor HTTP simples:

```bash
python -m http.server 8080
```

Depois acesse `http://localhost:8080`.

## Gerenciando o Firebase

Projeto: `leonardo-rafael-piciani` no [console do Firebase](https://console.firebase.google.com/project/leonardo-rafael-piciani).

- **Firestore Database** → coleções `participantes` e `liderancas`.
- **Authentication** → usuários administradores (adicione mais e-mails de admin por ali, se precisar de mais de um acesso).
- **Regras do Firestore** → aba "Regras" dentro do Firestore Database.

## Alterando a senha do administrador

No [console do Firebase](https://console.firebase.google.com/project/leonardo-rafael-piciani/authentication/users) → Authentication → Users, clique nos três pontinhos ao lado do usuário e escolha "Reset password" (envia um e-mail de redefinição), ou edite diretamente.

## Legado: versão Node.js/Express

Este projeto também contém uma versão alternativa com backend Node.js + SQLite (pastas `src/`, `package.json`, `render.yaml`) que **não está em uso** — foi a primeira versão, substituída pela arquitetura estática + Firebase acima para permitir hospedagem gratuita direto no GitHub Pages. Pode ser ignorada ou removida.

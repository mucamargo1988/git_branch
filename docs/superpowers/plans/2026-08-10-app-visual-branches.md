# App Visual de Branches — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir um app de projetor, sem build e offline, onde o professor executa commit/branch/checkout/merge/reset ao vivo e vê o grafo do repositório reagir, com cores por branch e uma pessoa dona de cada linha de trabalho.

**Architecture:** Fluxo de dados unidirecional — ação do usuário → `repo.js` (funções puras que devolvem estado novo) → `storage.js` salva → `layout.js` (puro) converte estado em coordenadas → `graph.js` desenha o SVG e `ui.js` pinta os painéis. Toda a lógica difícil (ancestralidade, fast-forward, órfãos, empilhamento de etiquetas) vive nos dois módulos puros, que não tocam no DOM e por isso são testáveis de verdade.

**Tech Stack:** HTML + CSS + JavaScript puro, em scripts clássicos. SVG desenhado à mão. Sem build, sem dependências, sem CDN, sem framework de teste. Node v24 apenas como executor de testes durante o desenvolvimento — **não** é requisito para usar o app.

## Global Constraints

Estas regras valem para **todas** as tarefas.

- **Sem build, sem dependências, sem CDN.** Nenhum `npm install`, nenhum `package.json` de runtime, nenhuma tag `<script src="https://...">`. O app abre com duplo clique no `index.html`.
- **Sintaxe ES5, métodos nativos modernos permitidos.** Como não há transpilação, a
  **sintaxe** fica em ES5: use `var` (nunca `let`/`const`), `function` (nunca arrow),
  concatenação de strings (nunca template literal), sem desestruturação e sem
  `class`. Isso mantém os arquivos uniformes e legíveis para alunos que vão abrir o
  código. **Métodos nativos** modernos são permitidos e usados de propósito —
  `String.prototype.padStart`, `String.prototype.normalize`, `Math.imul` — porque
  existem em todo navegador desde 2017 e no Node 24. Isto **não** é uma contradição
  com o item acima: a restrição é de sintaxe, não de biblioteca padrão.
- **Scripts clássicos, nunca módulos ES.** Nada de `import`/`export`/`type="module"`. Módulos ES são bloqueados por CORS em `file://` e quebrariam o duplo clique. Cada módulo usa o padrão de global abaixo, que funciona no navegador **e** via `require()` no Node:
  ```js
  (function (raiz) {
    "use strict";
    // ...
    raiz.NomeDoModulo = { /* API pública */ };
  })(typeof globalThis !== "undefined" ? globalThis : this);
  ```
- **`repo.js` e `layout.js` não podem referenciar `document`, `window`, `localStorage` ou qualquer API de DOM.** São puros. Se um teste em Node quebrar por causa de DOM, o módulo está errado.
- **Funções puras devolvem estado novo, nunca mutam a entrada.** Clone com `JSON.parse(JSON.stringify(estado))` antes de alterar.
- **Nenhuma fonte de não-determinismo em `repo.js`:** proibido `Date.now()`, `new Date()`, `Math.random()`. Os SHAs são derivados de um contador. Isso é o que torna os testes possíveis.
- **Idioma:** identificadores de código, comentários, textos de interface e mensagens de erro em português. Comandos Git registrados no histórico permanecem em inglês (`git checkout -b feature/login`).
- **Nenhum `alert()`, `confirm()` ou `prompt()` do navegador**, com uma única exceção: o `confirm()` do botão Reiniciar (Task 10).
- **A branch inicial se chama `master`** (pedido explícito do professor), com a nota de interface sobre `main` prevista na Task 9.
- **Sem conflitos de merge.** Merge sempre dá certo. Commits não têm arquivos nem conteúdo.
- **Toda mensagem visível ao usuário em português**, sem jargão desnecessário, exceto os textos que o Git real produz e que o aluno vai reconhecer: `Fast-forward` e `Already up to date.`

---

## Estrutura de arquivos

Todos na raiz do projeto, ao lado de `docs/`.

| Arquivo | Responsabilidade | Toca DOM? |
|---|---|---|
| `repo.js` | Modelo do repositório: estado, commit, branch, checkout, merge, reset, ancestralidade, órfãos | Não |
| `layout.js` | Estado → nós, arestas, etiquetas e faixas com coordenadas x/y | Não |
| `mini-teste.js` | Micro-harness de asserção (`teste`, `igual`, `verdade`, `rodar`) | Não |
| `testes.js` | Os casos de teste de `repo.js` e `layout.js`; auto-executa no Node | Não |
| `testes.html` | Roda os mesmos testes no navegador com ✅/❌ | Sim |
| `index.html` | Estrutura das três colunas | — |
| `styles.css` | Paleta, tipografia de projetor, animações | — |
| `graph.js` | Desenha e atualiza o SVG a partir do layout | Sim |
| `ui.js` | Controles, validação, painéis EQUIPE e HISTÓRICO | Sim |
| `storage.js` | `localStorage` + pilha de desfazer | Sim |
| `main.js` | Composição: liga ação → estado → salvar → redesenhar | Sim |

### Nota de arquitetura: onde mora a faixa fantasma

O spec diz que commits órfãos "migram para uma faixa fantasma". A implementação mantém
`commit.faixa` **imutável** em `repo.js` e deixa `layout.js` calcular a faixa efetiva
(`faixaFantasma` se o commit for órfão, senão `commit.faixa`). O contrato visual do spec
é atendido na íntegra, e `repo.js` continua sendo puro dado — posicionamento é
responsabilidade de quem posiciona.

---

## Task 1: Estado inicial e harness de testes

**Files:**
- Create: `mini-teste.js`
- Create: `testes.js`
- Create: `repo.js`

**Interfaces:**
- Consumes: nada (primeira tarefa)
- Produces:
  - `MiniTeste.teste(nome, fn)`, `MiniTeste.igual(recebido, esperado, msg)`, `MiniTeste.verdade(valor, msg)`, `MiniTeste.rodar(aoTerminar)` onde `aoTerminar(linhas, total, falhas)` e `linhas` é `[{ok: boolean, nome: string, erro?: string}]`
  - `Repo.CORES` → `string[]` (cores hex, índice = faixa)
  - `Repo.gerarId(n: number)` → `string` de 6 hex, determinístico
  - `Repo.estadoInicial()` → `Estado`
  - `Repo.clonar(estado)` → `Estado`
  - `Repo.acharBranch(estado, nome)` → objeto branch ou `null`
  - `Repo.acharCommit(estado, id)` → objeto commit ou `null`
  - `Repo.branchAtual(estado)` → objeto branch

**Formato do Estado** (usado por todas as tarefas seguintes):

```js
{
  commits: [{ id: "a1b2c3", mensagem: "header", pais: ["f0e1d2"], autorId: "ana", faixa: 0, ordem: 3 }],
  branches: [{ nome: "master", pontaId: "a1b2c3", cor: "#2563eb", donoId: "voce", faixa: 0 }],
  HEAD: { branch: "master" },
  devs: [{ id: "voce", nome: "Você", emoji: "🧑‍💻" }],
  historico: [{ n: 1, comando: "git init" }],
  proximoId: 1,
  proximaFaixa: 1
}
```

**Formato de retorno das operações** (Tasks 2–5): sempre um destes dois:
- `{ ok: true, estado: Estado, comando: string, tipo?: string, aviso?: string }`
- `{ ok: false, erro: string }`

- [ ] **Step 1: Escreva o harness de testes**

Criar `mini-teste.js`:

```js
(function (raiz) {
  "use strict";

  var casos = [];

  function teste(nome, fn) {
    casos.push({ nome: nome, fn: fn });
  }

  function igual(recebido, esperado, msg) {
    var a = JSON.stringify(recebido);
    var b = JSON.stringify(esperado);
    if (a !== b) {
      throw new Error((msg || "valores diferentes") +
        "\n    esperado: " + b +
        "\n    recebido: " + a);
    }
  }

  function verdade(valor, msg) {
    if (!valor) throw new Error(msg || "esperava verdadeiro, veio " + JSON.stringify(valor));
  }

  function rodar(aoTerminar) {
    var linhas = [];
    var falhas = 0;
    for (var i = 0; i < casos.length; i++) {
      try {
        casos[i].fn();
        linhas.push({ ok: true, nome: casos[i].nome });
      } catch (err) {
        falhas++;
        linhas.push({ ok: false, nome: casos[i].nome, erro: err.message });
      }
    }
    aoTerminar(linhas, casos.length, falhas);
  }

  raiz.MiniTeste = { teste: teste, igual: igual, verdade: verdade, rodar: rodar };
})(typeof globalThis !== "undefined" ? globalThis : this);
```

- [ ] **Step 2: Escreva o teste que falha**

Criar `testes.js`:

```js
if (typeof require !== "undefined") {
  require("./mini-teste.js");
  require("./repo.js");
}

var teste = MiniTeste.teste;
var igual = MiniTeste.igual;
var verdade = MiniTeste.verdade;

// ---------- repo.js: estado inicial ----------

teste("estado inicial: repositório vazio na master", function () {
  var e = Repo.estadoInicial();
  igual(e.commits.length, 0, "não deve haver commits");
  igual(e.branches.length, 1, "só a master existe");
  igual(e.branches[0].nome, "master");
  igual(e.branches[0].pontaId, null, "master não aponta para nada");
  igual(e.branches[0].faixa, 0, "master é a faixa 0");
  igual(e.HEAD.branch, "master");
});

teste("estado inicial: histórico já começa com git init", function () {
  var e = Repo.estadoInicial();
  igual(e.historico.length, 1);
  igual(e.historico[0].n, 1);
  igual(e.historico[0].comando, "git init");
});

teste("estado inicial: master tem um dono padrão editável", function () {
  var e = Repo.estadoInicial();
  igual(e.devs.length, 1);
  igual(e.devs[0].id, "voce");
  verdade(e.devs[0].nome.length > 0, "o dono padrão precisa de nome");
  verdade(e.devs[0].emoji.length > 0, "o dono padrão precisa de emoji");
  igual(e.branches[0].donoId, "voce");
});

teste("gerarId é determinístico e devolve 6 hex", function () {
  igual(Repo.gerarId(1), Repo.gerarId(1), "mesmo n deve dar mesmo id");
  verdade(Repo.gerarId(1) !== Repo.gerarId(2), "n diferente deve dar id diferente");
  verdade(/^[0-9a-f]{6}$/.test(Repo.gerarId(7)), "id deve ser 6 caracteres hex");
});

teste("clonar não deixa a origem ser mutada", function () {
  var e = Repo.estadoInicial();
  var copia = Repo.clonar(e);
  copia.branches[0].nome = "outra";
  igual(e.branches[0].nome, "master", "o estado original não pode mudar");
});

teste("acharBranch, acharCommit e branchAtual", function () {
  var e = Repo.estadoInicial();
  igual(Repo.acharBranch(e, "master").nome, "master");
  igual(Repo.acharBranch(e, "nao-existe"), null);
  igual(Repo.acharCommit(e, "nao-existe"), null);
  igual(Repo.branchAtual(e).nome, "master");
});

// ---------- executor no Node ----------

if (typeof window === "undefined") {
  MiniTeste.rodar(function (linhas, total, falhas) {
    for (var i = 0; i < linhas.length; i++) {
      if (linhas[i].ok) {
        console.log("  ok    " + linhas[i].nome);
      } else {
        console.log("  FALHA " + linhas[i].nome + "\n        " + linhas[i].erro);
      }
    }
    console.log("\n" + (total - falhas) + "/" + total + " passaram");
    if (falhas > 0) process.exit(1);
  });
}
```

- [ ] **Step 3: Rode os testes e confirme que falham**

Run: `node testes.js`
Expected: FALHA — `Cannot find module './repo.js'`

- [ ] **Step 4: Implemente `repo.js`**

Criar `repo.js`:

```js
(function (raiz) {
  "use strict";

  // Cores por faixa. Índice 0 = master. Escolhidas para contraste alto em projetor
  // e para permanecerem distinguíveis entre si mesmo com matiz distorcida.
  var CORES = [
    "#2563eb", // azul
    "#e11d48", // rosa
    "#16a34a", // verde
    "#d97706", // âmbar
    "#7c3aed", // roxo
    "#0891b2", // ciano
    "#b45309", // marrom
    "#4d7c0f"  // oliva
  ];

  // SHA falso: hash FNV-1a do contador. Parece um sha de verdade e é determinístico,
  // o que é o que permite testar o resto do módulo.
  function gerarId(n) {
    var h = 0x811c9dc5;
    var s = "commit" + n;
    for (var i = 0; i < s.length; i++) {
      h = h ^ s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0").slice(0, 6);
  }

  function estadoInicial() {
    return {
      commits: [],
      branches: [{ nome: "master", pontaId: null, cor: CORES[0], donoId: "voce", faixa: 0 }],
      HEAD: { branch: "master" },
      devs: [{ id: "voce", nome: "Você", emoji: "🧑‍💻" }],
      historico: [{ n: 1, comando: "git init" }],
      proximoId: 1,
      proximaFaixa: 1
    };
  }

  function clonar(estado) {
    return JSON.parse(JSON.stringify(estado));
  }

  function acharBranch(estado, nome) {
    for (var i = 0; i < estado.branches.length; i++) {
      if (estado.branches[i].nome === nome) return estado.branches[i];
    }
    return null;
  }

  function acharCommit(estado, id) {
    for (var i = 0; i < estado.commits.length; i++) {
      if (estado.commits[i].id === id) return estado.commits[i];
    }
    return null;
  }

  function branchAtual(estado) {
    return acharBranch(estado, estado.HEAD.branch);
  }

  function registrar(estado, comando) {
    estado.historico.push({ n: estado.historico.length + 1, comando: comando });
  }

  raiz.Repo = {
    CORES: CORES,
    gerarId: gerarId,
    estadoInicial: estadoInicial,
    clonar: clonar,
    acharBranch: acharBranch,
    acharCommit: acharCommit,
    branchAtual: branchAtual,
    registrar: registrar
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
```

- [ ] **Step 5: Rode os testes e confirme que passam**

Run: `node testes.js`
Expected: `6/6 passaram`

- [ ] **Step 6: Commit**

```bash
git add mini-teste.js testes.js repo.js
git commit -m "$(cat <<'EOF'
Adiciona estado inicial do repositório e harness de testes

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Criar commits

**Files:**
- Modify: `repo.js` (adicionar `commit` ao módulo)
- Modify: `testes.js` (adicionar seção de testes de commit)

**Interfaces:**
- Consumes: `Repo.estadoInicial`, `Repo.clonar`, `Repo.branchAtual`, `Repo.gerarId`, `Repo.registrar` (Task 1)
- Produces: `Repo.commit(estado, mensagem)` → `{ok:true, estado, comando}` ou `{ok:false, erro}`

- [ ] **Step 1: Escreva os testes que falham**

Adicionar em `testes.js`, **antes** do bloco `if (typeof window === "undefined")`:

```js
// ---------- repo.js: commit ----------

teste("commit em repositório vazio cria o commit raiz", function () {
  var r = Repo.commit(Repo.estadoInicial(), "primeiro");
  verdade(r.ok, "deveria ter dado certo");
  igual(r.estado.commits.length, 1);
  igual(r.estado.commits[0].pais, [], "o commit raiz não tem pai");
  igual(r.estado.commits[0].mensagem, "primeiro");
  igual(r.estado.commits[0].ordem, 0);
  igual(r.estado.commits[0].faixa, 0, "nasce na faixa da branch atual");
});

teste("commit move a ponta da branch e o HEAD acompanha", function () {
  var r1 = Repo.commit(Repo.estadoInicial(), "um");
  var r2 = Repo.commit(r1.estado, "dois");
  var id1 = r1.estado.commits[0].id;
  var id2 = r2.estado.commits[1].id;
  igual(r2.estado.commits[1].pais, [id1], "o segundo commit aponta para o primeiro");
  igual(Repo.acharBranch(r2.estado, "master").pontaId, id2, "a etiqueta andou");
  igual(r2.estado.HEAD.branch, "master", "HEAD continua na master");
});

teste("commit registra o comando no histórico", function () {
  var r = Repo.commit(Repo.estadoInicial(), "header");
  igual(r.comando, 'git commit -m "header"');
  igual(r.estado.historico.length, 2, "git init + o commit");
  igual(r.estado.historico[1], { n: 2, comando: 'git commit -m "header"' });
});

teste("commit sem mensagem é rejeitado", function () {
  var r = Repo.commit(Repo.estadoInicial(), "   ");
  igual(r.ok, false);
  verdade(r.erro.length > 0, "precisa explicar o erro");
});

teste("commit não muta o estado recebido", function () {
  var e = Repo.estadoInicial();
  Repo.commit(e, "x");
  igual(e.commits.length, 0, "o estado original tem que continuar vazio");
});

teste("commit usa o dono da branch atual como autor", function () {
  var r = Repo.commit(Repo.estadoInicial(), "x");
  igual(r.estado.commits[0].autorId, "voce");
});
```

- [ ] **Step 2: Rode os testes e confirme que falham**

Run: `node testes.js`
Expected: FALHA — `Repo.commit is not a function`

- [ ] **Step 3: Implemente `commit`**

Em `repo.js`, adicionar a função antes do bloco `raiz.Repo = {...}`:

```js
  function commit(estado, mensagem) {
    mensagem = (mensagem || "").trim();
    if (!mensagem) {
      return { ok: false, erro: "Escreva uma mensagem para o commit." };
    }

    var e = clonar(estado);
    var br = branchAtual(e);
    var id = gerarId(e.proximoId);

    e.commits.push({
      id: id,
      mensagem: mensagem,
      pais: br.pontaId ? [br.pontaId] : [],
      autorId: br.donoId,
      faixa: br.faixa,
      ordem: e.proximoId - 1
    });
    e.proximoId = e.proximoId + 1;
    br.pontaId = id;

    var comando = 'git commit -m "' + mensagem + '"';
    registrar(e, comando);
    return { ok: true, estado: e, comando: comando };
  }
```

E acrescentar `commit: commit,` ao objeto `raiz.Repo`.

- [ ] **Step 4: Rode os testes e confirme que passam**

Run: `node testes.js`
Expected: `12/12 passaram`

- [ ] **Step 5: Commit**

```bash
git add repo.js testes.js
git commit -m "$(cat <<'EOF'
Adiciona criação de commits ao modelo do repositório

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Criar branch e trocar de branch

**Files:**
- Modify: `repo.js`
- Modify: `testes.js`

**Interfaces:**
- Consumes: tudo de Tasks 1–2
- Produces:
  - `Repo.criarBranch(estado, nome, dono, jaMudar)` — `dono` é `{nome: string, emoji: string}`, `jaMudar` é boolean
  - `Repo.checkout(estado, nome)`
  - `Repo.registrarDev(estado, dono)` → `donoId: string` (muta o estado recebido; só é chamada com estados já clonados)

- [ ] **Step 1: Escreva os testes que falham**

Adicionar em `testes.js`, antes do bloco executor:

```js
// ---------- repo.js: branch e checkout ----------

function comUmCommit() {
  return Repo.commit(Repo.estadoInicial(), "inicial").estado;
}

teste("criarBranch aponta para o commit atual e ganha faixa nova", function () {
  var e = comUmCommit();
  var r = Repo.criarBranch(e, "feature/login", { nome: "Ana", emoji: "👩" }, false);
  verdade(r.ok, r.erro);
  var nova = Repo.acharBranch(r.estado, "feature/login");
  igual(nova.pontaId, e.commits[0].id, "nasce no commit onde estávamos");
  igual(nova.faixa, 1, "master é 0, a nova é 1");
  igual(r.estado.proximaFaixa, 2);
  verdade(nova.cor !== Repo.acharBranch(r.estado, "master").cor, "cores devem diferir");
});

teste("git branch sem checkout: não move HEAD, não cria commit, duas etiquetas no mesmo commit", function () {
  var e = comUmCommit();
  var r = Repo.criarBranch(e, "feature/login", { nome: "Ana", emoji: "👩" }, false);
  igual(r.estado.HEAD.branch, "master", "HEAD não pode ter se movido");
  igual(r.estado.commits.length, 1, "criar branch não cria commit");
  igual(r.comando, "git branch feature/login");
  igual(
    Repo.acharBranch(r.estado, "master").pontaId,
    Repo.acharBranch(r.estado, "feature/login").pontaId,
    "as duas branches apontam para o MESMO commit"
  );
});

teste("checkout -b cria e já muda de branch", function () {
  var r = Repo.criarBranch(comUmCommit(), "feature/x", { nome: "Bruno", emoji: "👨" }, true);
  igual(r.estado.HEAD.branch, "feature/x");
  igual(r.comando, "git checkout -b feature/x");
});

teste("criarBranch registra o dono na equipe", function () {
  var r = Repo.criarBranch(comUmCommit(), "feature/x", { nome: "Ana", emoji: "👩" }, false);
  igual(r.estado.devs.length, 2, "o dono padrão mais a Ana");
  igual(Repo.acharBranch(r.estado, "feature/x").donoId, "ana");
  igual(r.estado.devs[1], { id: "ana", nome: "Ana", emoji: "👩" });
});

teste("dono já existente é reaproveitado, não duplicado", function () {
  var r1 = Repo.criarBranch(comUmCommit(), "a", { nome: "Ana", emoji: "👩" }, false);
  var r2 = Repo.criarBranch(r1.estado, "b", { nome: "Ana", emoji: "👩" }, false);
  igual(r2.estado.devs.length, 2, "Ana não pode aparecer duas vezes");
});

teste("nomes acentuados diferentes não viram a mesma pessoa", function () {
  var r1 = Repo.criarBranch(comUmCommit(), "a", { nome: "José", emoji: "👨" }, false);
  var r2 = Repo.criarBranch(r1.estado, "b", { nome: "Josué", emoji: "🧔" }, false);
  igual(r2.estado.devs.length, 3, "o dono padrão, o José e o Josué");
  var idA = Repo.acharBranch(r2.estado, "a").donoId;
  var idB = Repo.acharBranch(r2.estado, "b").donoId;
  verdade(idA !== idB, "José e Josué não podem compartilhar id");

  var nomes = {};
  r2.estado.devs.forEach(function (d) { nomes[d.id] = d.nome; });
  igual(nomes[idA], "José");
  igual(nomes[idB], "Josué", "o projetor mostraria o nome errado do aluno");
});

teste("nome de branch repetido é rejeitado", function () {
  var r1 = Repo.criarBranch(comUmCommit(), "x", { nome: "Ana", emoji: "👩" }, false);
  var r2 = Repo.criarBranch(r1.estado, "x", { nome: "Bruno", emoji: "👨" }, false);
  igual(r2.ok, false);
});

teste("nome de branch vazio ou com espaço é rejeitado", function () {
  igual(Repo.criarBranch(comUmCommit(), "  ", { nome: "Ana", emoji: "👩" }, false).ok, false);
  igual(Repo.criarBranch(comUmCommit(), "meu login", { nome: "Ana", emoji: "👩" }, false).ok, false);
});

teste("não dá para criar branch em repositório sem commits", function () {
  var r = Repo.criarBranch(Repo.estadoInicial(), "x", { nome: "Ana", emoji: "👩" }, false);
  igual(r.ok, false);
});

teste("checkout move o HEAD e registra o comando", function () {
  var r1 = Repo.criarBranch(comUmCommit(), "x", { nome: "Ana", emoji: "👩" }, false);
  var r2 = Repo.checkout(r1.estado, "x");
  verdade(r2.ok, r2.erro);
  igual(r2.estado.HEAD.branch, "x");
  igual(r2.comando, "git checkout x");
});

teste("checkout para branch inexistente ou para a branch atual é rejeitado", function () {
  var e = comUmCommit();
  igual(Repo.checkout(e, "nao-existe").ok, false);
  igual(Repo.checkout(e, "master").ok, false);
});
```

- [ ] **Step 2: Rode os testes e confirme que falham**

Run: `node testes.js`
Expected: FALHA — `Repo.criarBranch is not a function`

- [ ] **Step 3: Implemente `registrarDev`, `criarBranch` e `checkout`**

Em `repo.js`, antes do bloco `raiz.Repo`:

```js
  // Muta o estado recebido de propósito: só é chamada de dentro de criarBranch,
  // que já trabalha sobre um clone.
  function registrarDev(estado, dono) {
    var nome = ((dono && dono.nome) || "").trim() || "Dev";
    var emoji = ((dono && dono.emoji) || "").trim() || "🧑‍💻";

    // Tira os acentos ANTES de gerar o id. Sem isto, "José" e "Josué" viram os dois
    // "jos", o segundo aluno é confundido com o primeiro e o projetor mostra o nome
    // errado no meio da aula. `normalize` é método de String — não quebra a pureza
    // do módulo nem depende de DOM.
    var semAcento = nome.normalize("NFD").replace(/[̀-ͯ]/g, "");
    var base = semAcento.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "dev";

    var id = base;
    var sufixo = 2;
    while (true) {
      var achado = null;
      for (var i = 0; i < estado.devs.length; i++) {
        if (estado.devs[i].id === id) achado = estado.devs[i];
      }
      if (!achado) break;
      // Mesmo id E mesmo nome: é a mesma pessoa, reaproveita.
      if (achado.nome === nome) {
        achado.emoji = emoji;
        return id;
      }
      // Mesmo id, nome diferente: pessoa diferente, precisa de id próprio.
      id = base + "-" + sufixo;
      sufixo = sufixo + 1;
    }

    estado.devs.push({ id: id, nome: nome, emoji: emoji });
    return id;
  }

  function criarBranch(estado, nome, dono, jaMudar) {
    nome = (nome || "").trim();
    if (!nome) {
      return { ok: false, erro: "Dê um nome para a branch." };
    }
    if (/\s/.test(nome)) {
      return { ok: false, erro: "Nome de branch não pode ter espaço. Use traço ou barra: feature/login" };
    }
    if (acharBranch(estado, nome)) {
      return { ok: false, erro: "Já existe uma branch chamada " + nome + "." };
    }
    if (!branchAtual(estado).pontaId) {
      return { ok: false, erro: "Faça pelo menos um commit antes de criar uma branch." };
    }

    var e = clonar(estado);
    var atual = branchAtual(e);
    var donoId = registrarDev(e, dono);

    e.branches.push({
      nome: nome,
      pontaId: atual.pontaId,
      cor: CORES[e.proximaFaixa % CORES.length],
      donoId: donoId,
      faixa: e.proximaFaixa
    });
    e.proximaFaixa = e.proximaFaixa + 1;

    var comando;
    if (jaMudar) {
      e.HEAD.branch = nome;
      comando = "git checkout -b " + nome;
    } else {
      comando = "git branch " + nome;
    }

    registrar(e, comando);
    return { ok: true, estado: e, comando: comando };
  }

  function checkout(estado, nome) {
    if (!acharBranch(estado, nome)) {
      return { ok: false, erro: "A branch " + nome + " não existe." };
    }
    if (estado.HEAD.branch === nome) {
      return { ok: false, erro: "Você já está em " + nome + "." };
    }

    var e = clonar(estado);
    e.HEAD.branch = nome;
    var comando = "git checkout " + nome;
    registrar(e, comando);
    return { ok: true, estado: e, comando: comando };
  }
```

Acrescentar `registrarDev: registrarDev, criarBranch: criarBranch, checkout: checkout,` ao objeto `raiz.Repo`.

- [ ] **Step 4: Rode os testes e confirme que passam**

Run: `node testes.js`
Expected: `23/23 passaram`

- [ ] **Step 5: Commit**

```bash
git add repo.js testes.js
git commit -m "$(cat <<'EOF'
Adiciona criação de branch e checkout

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Merge — fast-forward e commit de merge

**Files:**
- Modify: `repo.js`
- Modify: `testes.js`

**Interfaces:**
- Consumes: tudo de Tasks 1–3
- Produces:
  - `Repo.alcancaveis(estado, commitId)` → objeto usado como conjunto: `{ id: true }`
  - `Repo.ehAncestral(estado, idA, idB)` → boolean. **Atenção:** um commit é ancestral de si mesmo por esta definição.
  - `Repo.merge(estado, nomeOrigem)` → `{ok:true, estado, comando, tipo, aviso?}` onde `tipo` ∈ `"fast-forward" | "commit-de-merge" | "atualizado"`

- [ ] **Step 1: Escreva os testes que falham**

Adicionar em `testes.js`, antes do bloco executor:

```js
// ---------- repo.js: ancestralidade e merge ----------

// master: c0 -> c1 ; feature: nasce em c0 e ganha c2
// Devolve { estado, c0, c1, c2 }
function cenarioDivergente() {
  var e = Repo.commit(Repo.estadoInicial(), "c0").estado;
  var c0 = e.commits[0].id;
  e = Repo.criarBranch(e, "feature", { nome: "Ana", emoji: "👩" }, true).estado;
  e = Repo.commit(e, "c2").estado;
  var c2 = e.commits[1].id;
  e = Repo.checkout(e, "master").estado;
  e = Repo.commit(e, "c1").estado;
  var c1 = e.commits[2].id;
  return { estado: e, c0: c0, c1: c1, c2: c2 };
}

teste("ehAncestral reconhece a cadeia de pais", function () {
  var c = cenarioDivergente();
  verdade(Repo.ehAncestral(c.estado, c.c0, c.c1), "c0 é ancestral de c1");
  verdade(Repo.ehAncestral(c.estado, c.c0, c.c2), "c0 é ancestral de c2");
  verdade(!Repo.ehAncestral(c.estado, c.c1, c.c2), "c1 e c2 são irmãos, não ancestrais");
  verdade(Repo.ehAncestral(c.estado, c.c1, c.c1), "um commit é ancestral de si mesmo");
});

teste("merge fast-forward: só anda a etiqueta, sem criar commit", function () {
  var e = Repo.commit(Repo.estadoInicial(), "c0").estado;
  e = Repo.criarBranch(e, "feature", { nome: "Ana", emoji: "👩" }, true).estado;
  e = Repo.commit(e, "c1").estado;
  var pontaFeature = Repo.acharBranch(e, "feature").pontaId;
  e = Repo.checkout(e, "master").estado;

  var r = Repo.merge(e, "feature");
  verdade(r.ok, r.erro);
  igual(r.tipo, "fast-forward");
  igual(r.estado.commits.length, 2, "fast-forward NÃO cria commit");
  igual(Repo.acharBranch(r.estado, "master").pontaId, pontaFeature, "a etiqueta pulou para a ponta da feature");
  igual(r.comando, "git merge feature");
});

teste("merge com os dois lados avançados cria commit de merge com dois pais", function () {
  var c = cenarioDivergente();
  var r = Repo.merge(c.estado, "feature");
  verdade(r.ok, r.erro);
  igual(r.tipo, "commit-de-merge");
  igual(r.estado.commits.length, 4, "os 3 originais mais o de merge");
  var m = r.estado.commits[3];
  igual(m.pais, [c.c1, c.c2], "primeiro pai é a branch atual, segundo é a origem");
  igual(m.faixa, 0, "o commit de merge nasce na faixa da branch de destino");
  igual(Repo.acharBranch(r.estado, "master").pontaId, m.id);
});

teste("merge sem nada a trazer avisa Already up to date e não cria commit", function () {
  var e = Repo.commit(Repo.estadoInicial(), "c0").estado;
  e = Repo.criarBranch(e, "feature", { nome: "Ana", emoji: "👩" }, false).estado;
  e = Repo.commit(e, "c1").estado; // avança só a master

  var r = Repo.merge(e, "feature");
  verdade(r.ok, r.erro);
  igual(r.tipo, "atualizado");
  igual(r.estado.commits.length, 2, "não pode criar commit");
  igual(r.aviso, "Already up to date.");
  igual(r.estado.historico[r.estado.historico.length - 1].comando, "git merge feature",
    "o comando entra no histórico mesmo assim, porque é o que o Git faz");
});

teste("merge funciona no sentido inverso: master dentro da feature", function () {
  var c = cenarioDivergente();
  var e = Repo.checkout(c.estado, "feature").estado;
  var r = Repo.merge(e, "master");
  verdade(r.ok, r.erro);
  igual(r.tipo, "commit-de-merge");
  var m = r.estado.commits[3];
  igual(m.pais, [c.c2, c.c1], "agora a feature é o primeiro pai");
  igual(m.faixa, 1, "nasce na faixa da feature, que é o destino");
  igual(Repo.acharBranch(r.estado, "feature").pontaId, m.id);
});

teste("merge de uma branch nela mesma ou inexistente é rejeitado", function () {
  var c = cenarioDivergente();
  igual(Repo.merge(c.estado, "master").ok, false);
  igual(Repo.merge(c.estado, "nao-existe").ok, false);
});
```

- [ ] **Step 2: Rode os testes e confirme que falham**

Run: `node testes.js`
Expected: FALHA — `Repo.ehAncestral is not a function`

- [ ] **Step 3: Implemente ancestralidade e `merge`**

Em `repo.js`, antes do bloco `raiz.Repo`:

```js
  // Percorre a cadeia de pais e devolve o conjunto de ids alcançáveis,
  // incluindo o próprio commitId.
  function alcancaveis(estado, commitId) {
    var vistos = {};
    var pilha = commitId ? [commitId] : [];
    while (pilha.length > 0) {
      var id = pilha.pop();
      if (!id || vistos[id]) continue;
      vistos[id] = true;
      var c = acharCommit(estado, id);
      if (c) {
        for (var i = 0; i < c.pais.length; i++) pilha.push(c.pais[i]);
      }
    }
    return vistos;
  }

  function ehAncestral(estado, idA, idB) {
    if (!idA || !idB) return false;
    return alcancaveis(estado, idB)[idA] === true;
  }

  function merge(estado, nomeOrigem) {
    var origem = acharBranch(estado, nomeOrigem);
    if (!origem) {
      return { ok: false, erro: "A branch " + nomeOrigem + " não existe." };
    }
    var atual = branchAtual(estado);
    if (origem.nome === atual.nome) {
      return { ok: false, erro: "Não dá para mesclar uma branch nela mesma." };
    }
    if (!origem.pontaId) {
      return { ok: false, erro: "A branch " + nomeOrigem + " ainda não tem commits." };
    }

    var comando = "git merge " + nomeOrigem;

    // Nada a trazer: a ponta da origem já faz parte da história da branch atual.
    if (atual.pontaId && ehAncestral(estado, origem.pontaId, atual.pontaId)) {
      var eA = clonar(estado);
      registrar(eA, comando);
      return {
        ok: true, estado: eA, comando: comando,
        tipo: "atualizado", aviso: "Already up to date."
      };
    }

    // Fast-forward: a branch atual não andou desde a ramificação.
    if (!atual.pontaId || ehAncestral(estado, atual.pontaId, origem.pontaId)) {
      var eF = clonar(estado);
      acharBranch(eF, atual.nome).pontaId = origem.pontaId;
      registrar(eF, comando);
      return {
        ok: true, estado: eF, comando: comando,
        tipo: "fast-forward", aviso: "Fast-forward: a etiqueta só andou para frente."
      };
    }

    // Os dois lados avançaram: nasce um commit com dois pais.
    var e = clonar(estado);
    var destino = branchAtual(e);
    var id = gerarId(e.proximoId);

    e.commits.push({
      id: id,
      mensagem: "Merge branch '" + nomeOrigem + "' into " + destino.nome,
      pais: [destino.pontaId, origem.pontaId],
      autorId: destino.donoId,
      faixa: destino.faixa,
      ordem: e.proximoId - 1
    });
    e.proximoId = e.proximoId + 1;
    destino.pontaId = id;

    registrar(e, comando);
    return { ok: true, estado: e, comando: comando, tipo: "commit-de-merge" };
  }
```

Acrescentar `alcancaveis: alcancaveis, ehAncestral: ehAncestral, merge: merge,` ao objeto `raiz.Repo`.

- [ ] **Step 4: Rode os testes e confirme que passam**

Run: `node testes.js`
Expected: `29/29 passaram`

- [ ] **Step 5: Commit**

```bash
git add repo.js testes.js
git commit -m "$(cat <<'EOF'
Adiciona merge com fast-forward, commit de merge e already-up-to-date

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Reset e commits órfãos

**Files:**
- Modify: `repo.js`
- Modify: `testes.js`

**Interfaces:**
- Consumes: tudo de Tasks 1–4
- Produces:
  - `Repo.reset(estado, commitId)`
  - `Repo.orfaos(estado)` → `string[]` de ids inalcançáveis a partir de qualquer branch
  - `Repo.commitsAlcancaveis(estado)` → `[{id, mensagem}]` da branch atual, do mais novo para o mais antigo, **excluindo a ponta atual** (é o que alimenta o dropdown de reset)

- [ ] **Step 1: Escreva os testes que falham**

Adicionar em `testes.js`, antes do bloco executor:

```js
// ---------- repo.js: reset e órfãos ----------

function tresCommits() {
  var e = Repo.commit(Repo.estadoInicial(), "c1").estado;
  e = Repo.commit(e, "c2").estado;
  e = Repo.commit(e, "c3").estado;
  return e;
}

teste("reset move a ponta para trás e registra o comando", function () {
  var e = tresCommits();
  var c1 = e.commits[0].id;
  var r = Repo.reset(e, c1);
  verdade(r.ok, r.erro);
  igual(Repo.acharBranch(r.estado, "master").pontaId, c1);
  igual(r.estado.commits.length, 3, "os commits continuam existindo, só ficaram órfãos");
  igual(r.comando, "git reset --hard " + c1);
});

teste("reset deixa os commits posteriores órfãos", function () {
  var e = tresCommits();
  igual(Repo.orfaos(e), [], "sem reset não há órfãos");
  var r = Repo.reset(e, e.commits[0].id);
  igual(Repo.orfaos(r.estado), [e.commits[1].id, e.commits[2].id]);
});

teste("commit órfão alcançável por outra branch não conta como órfão", function () {
  var e = tresCommits();
  e = Repo.criarBranch(e, "salva", { nome: "Ana", emoji: "👩" }, false).estado;
  var r = Repo.reset(e, e.commits[0].id);
  igual(Repo.orfaos(r.estado), [], "a branch salva ainda segura c2 e c3");
});

teste("reset para commit fora do histórico da branch atual é rejeitado", function () {
  var c = cenarioDivergente(); // estamos na master; c2 é da feature
  igual(Repo.reset(c.estado, c.c2).ok, false);
  igual(Repo.reset(c.estado, "nao-existe").ok, false);
});

teste("reset para a própria ponta atual é rejeitado", function () {
  var e = tresCommits();
  igual(Repo.reset(e, e.commits[2].id).ok, false);
});

teste("commitsAlcancaveis lista do mais novo ao mais antigo, sem a ponta atual", function () {
  var e = tresCommits();
  igual(Repo.commitsAlcancaveis(e), [
    { id: e.commits[1].id, mensagem: "c2" },
    { id: e.commits[0].id, mensagem: "c1" }
  ]);
});

teste("commitsAlcancaveis em repositório vazio devolve lista vazia", function () {
  igual(Repo.commitsAlcancaveis(Repo.estadoInicial()), []);
});
```

- [ ] **Step 2: Rode os testes e confirme que falham**

Run: `node testes.js`
Expected: FALHA — `Repo.reset is not a function`

- [ ] **Step 3: Implemente `reset`, `orfaos` e `commitsAlcancaveis`**

Em `repo.js`, antes do bloco `raiz.Repo`:

```js
  function reset(estado, commitId) {
    var atual = branchAtual(estado);
    if (!acharCommit(estado, commitId)) {
      return { ok: false, erro: "Esse commit não existe." };
    }
    if (commitId === atual.pontaId) {
      return { ok: false, erro: "Você já está nesse commit." };
    }
    if (!alcancaveis(estado, atual.pontaId)[commitId]) {
      return { ok: false, erro: "Esse commit não faz parte do histórico de " + atual.nome + "." };
    }

    var e = clonar(estado);
    acharBranch(e, atual.nome).pontaId = commitId;
    var comando = "git reset --hard " + commitId;
    registrar(e, comando);
    return { ok: true, estado: e, comando: comando };
  }

  // Commits que nenhuma branch alcança mais. São desenhados na faixa fantasma.
  function orfaos(estado) {
    var vivos = {};
    for (var i = 0; i < estado.branches.length; i++) {
      var alc = alcancaveis(estado, estado.branches[i].pontaId);
      for (var id in alc) {
        if (Object.prototype.hasOwnProperty.call(alc, id)) vivos[id] = true;
      }
    }
    var lista = [];
    for (var j = 0; j < estado.commits.length; j++) {
      if (!vivos[estado.commits[j].id]) lista.push(estado.commits[j].id);
    }
    return lista;
  }

  // Alimenta o dropdown de reset: histórico da branch atual, do mais novo para o
  // mais antigo, sem a ponta atual (resetar para ela seria um comando sem efeito).
  function commitsAlcancaveis(estado) {
    var atual = branchAtual(estado);
    if (!atual || !atual.pontaId) return [];
    var alc = alcancaveis(estado, atual.pontaId);
    var lista = [];
    for (var i = estado.commits.length - 1; i >= 0; i--) {
      var c = estado.commits[i];
      if (alc[c.id] && c.id !== atual.pontaId) {
        lista.push({ id: c.id, mensagem: c.mensagem });
      }
    }
    return lista;
  }
```

Acrescentar `reset: reset, orfaos: orfaos, commitsAlcancaveis: commitsAlcancaveis,` ao objeto `raiz.Repo`.

- [ ] **Step 4: Rode os testes e confirme que passam**

Run: `node testes.js`
Expected: `36/36 passaram`

- [ ] **Step 5: Commit**

```bash
git add repo.js testes.js
git commit -m "$(cat <<'EOF'
Adiciona reset e identificação de commits órfãos

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Layout — coordenadas, faixa fantasma e empilhamento de etiquetas

**Files:**
- Create: `layout.js`
- Modify: `testes.js`

**Interfaces:**
- Consumes: `Repo.orfaos`, `Repo.acharCommit`, `Repo.acharBranch` (Tasks 1–5)
- Produces: `Layout.calcular(estado)` → objeto com esta forma exata (Tasks 7 e 8 dependem dela):

```js
{
  nos: [{ id, x, y, cor, emoji, mensagem, orfao, faixa }],
  arestas: [{ de, para, x1, y1, x2, y2, tipo: "reta"|"curva", cor }],
  etiquetas: [{ nome, cor, emoji, commitId, x, y, ehHead }],
  faixas: [{ indice, y, nome, cor, ativa, fantasma }],
  largura, altura, vazio: boolean
}
```
- Constantes exportadas para `graph.js`: `Layout.RAIO`, `Layout.ESPACO_X`, `Layout.ESPACO_Y`, `Layout.MARGEM_X`, `Layout.MARGEM_Y`

- [ ] **Step 1: Escreva os testes que falham**

Adicionar em `testes.js`, no topo, dentro do bloco `require`:

```js
  require("./layout.js");
```

E adicionar os casos antes do bloco executor:

```js
// ---------- layout.js ----------

function acharNo(l, id) {
  for (var i = 0; i < l.nos.length; i++) if (l.nos[i].id === id) return l.nos[i];
  return null;
}

teste("layout de repositório vazio", function () {
  var l = Layout.calcular(Repo.estadoInicial());
  igual(l.vazio, true);
  igual(l.nos, []);
  igual(l.arestas, []);
});

teste("X segue a ordem de criação, Y segue a faixa", function () {
  var c = cenarioDivergente(); // c0 e c1 na faixa 0, c2 na faixa 1
  var l = Layout.calcular(c.estado);
  var n0 = acharNo(l, c.c0), n1 = acharNo(l, c.c1), n2 = acharNo(l, c.c2);
  verdade(n0.x < n2.x && n2.x < n1.x, "X cresce com a ordem de criação");
  igual(n0.y, n1.y, "c0 e c1 estão na mesma faixa");
  verdade(n2.y > n0.y, "a feature fica abaixo da master");
});

teste("aresta na mesma faixa é reta, entre faixas é curva", function () {
  var c = cenarioDivergente();
  var l = Layout.calcular(c.estado);
  var tipos = {};
  for (var i = 0; i < l.arestas.length; i++) {
    tipos[l.arestas[i].para + "<-" + l.arestas[i].de] = l.arestas[i].tipo;
  }
  igual(tipos[c.c1 + "<-" + c.c0], "reta", "c0->c1 fica tudo na faixa 0");
  igual(tipos[c.c2 + "<-" + c.c0], "curva", "c0->c2 desce de faixa");
});

teste("a faixa do commit não muda depois de um merge", function () {
  var c = cenarioDivergente();
  var antes = Layout.calcular(c.estado);
  var depois = Layout.calcular(Repo.merge(c.estado, "feature").estado);
  igual(acharNo(depois, c.c2).y, acharNo(antes, c.c2).y, "c2 não pode ter se mexido");
  igual(acharNo(depois, c.c1).y, acharNo(antes, c.c1).y, "c1 não pode ter se mexido");
});

teste("órfãos vão para a faixa fantasma, abaixo de todas as outras", function () {
  var e = tresCommits();
  var r = Repo.reset(e, e.commits[0].id);
  var l = Layout.calcular(r.estado);
  var vivo = acharNo(l, e.commits[0].id);
  var morto = acharNo(l, e.commits[2].id);
  igual(morto.orfao, true);
  igual(vivo.orfao, false);
  verdade(morto.y > vivo.y, "a faixa fantasma fica abaixo de tudo");
  verdade(l.faixas[l.faixas.length - 1].fantasma, "a última faixa é a fantasma");
});

teste("commit após reset: a aresta pai->filho não atravessa nenhum commit desenhado", function () {
  var e = tresCommits();
  e = Repo.reset(e, e.commits[0].id).estado;
  e = Repo.commit(e, "c4").estado;
  var l = Layout.calcular(e);

  var aresta = null;
  for (var i = 0; i < l.arestas.length; i++) {
    if (l.arestas[i].para === e.commits[3].id) aresta = l.arestas[i];
  }
  verdade(aresta, "a aresta c1->c4 precisa existir");
  igual(aresta.tipo, "reta");

  // nenhum nó desenhado pode estar sobre o segmento
  for (var j = 0; j < l.nos.length; j++) {
    var n = l.nos[j];
    if (n.id === aresta.de || n.id === aresta.para) continue;
    var noSegmento = n.y === aresta.y1 && n.x > aresta.x1 && n.x < aresta.x2;
    verdade(!noSegmento, "o commit " + n.mensagem + " está em cima da aresta");
  }
});

teste("duas etiquetas no mesmo commit ficam ambas visíveis e não se sobrepõem", function () {
  var e = Repo.commit(Repo.estadoInicial(), "c0").estado;
  e = Repo.criarBranch(e, "feature", { nome: "Ana", emoji: "👩" }, false).estado;
  var l = Layout.calcular(e);

  igual(l.etiquetas.length, 2, "as duas branches precisam de etiqueta");
  igual(l.etiquetas[0].commitId, l.etiquetas[1].commitId, "ancoradas no mesmo commit");
  verdade(l.etiquetas[0].y !== l.etiquetas[1].y, "empilhadas, não sobrepostas");
  igual(l.etiquetas[0].x, l.etiquetas[1].x, "mesma coluna");
});

teste("a etiqueta é ancorada no commit-ponta, não na faixa da branch", function () {
  var e = Repo.commit(Repo.estadoInicial(), "c0").estado;
  e = Repo.criarBranch(e, "feature", { nome: "Ana", emoji: "👩" }, false).estado;
  var l = Layout.calcular(e);
  var no = acharNo(l, e.commits[0].id);
  // Limiar de meia faixa: rejeita sem ambiguidade a etiqueta desenhada em
  // branch.faixa * ESPACO_Y (o bug que este teste existe para pegar) e aceita
  // o deslocamento normal do empilhamento.
  for (var i = 0; i < l.etiquetas.length; i++) {
    verdade(Math.abs(l.etiquetas[i].y - no.y) < Layout.ESPACO_Y / 2,
      "a etiqueta " + l.etiquetas[i].nome + " flutuou para longe do commit");
  }
});

teste("exatamente uma etiqueta é marcada como HEAD", function () {
  var e = Repo.commit(Repo.estadoInicial(), "c0").estado;
  e = Repo.criarBranch(e, "feature", { nome: "Ana", emoji: "👩" }, true).estado;
  var l = Layout.calcular(e);
  var comHead = 0, nomeHead = null;
  for (var i = 0; i < l.etiquetas.length; i++) {
    if (l.etiquetas[i].ehHead) { comHead++; nomeHead = l.etiquetas[i].nome; }
  }
  igual(comHead, 1);
  igual(nomeHead, "feature");
});

teste("nós carregam a cor da faixa e o emoji do autor", function () {
  var e = Repo.commit(Repo.estadoInicial(), "c0").estado;
  e = Repo.criarBranch(e, "feature", { nome: "Ana", emoji: "👩" }, true).estado;
  e = Repo.commit(e, "c1").estado;
  var l = Layout.calcular(e);
  var n = acharNo(l, e.commits[1].id);
  igual(n.cor, Repo.acharBranch(e, "feature").cor);
  igual(n.emoji, "👩");
});
```

- [ ] **Step 2: Rode os testes e confirme que falham**

Run: `node testes.js`
Expected: FALHA — `Cannot find module './layout.js'`

- [ ] **Step 3: Implemente `layout.js`**

Criar `layout.js`:

```js
(function (raiz) {
  "use strict";

  var Repo = raiz.Repo;
  if (!Repo && typeof require !== "undefined") {
    require("./repo.js");
    Repo = raiz.Repo;
  }

  var RAIO = 18;
  var ESPACO_X = 96;
  var ESPACO_Y = 96;
  var MARGEM_X = 90;
  var MARGEM_Y = 70;
  var DESLOC_ETIQUETA_X = 34;  // etiqueta fica à direita do commit-ponta
  var ALTURA_ETIQUETA = 30;    // passo do empilhamento
  var ESPACO_ETIQUETAS = 240;  // folga à direita para caber as etiquetas
  var COR_FANTASMA = "#9ca3af";

  function calcular(estado) {
    var orfaos = {};
    var listaOrfaos = Repo.orfaos(estado);
    for (var i = 0; i < listaOrfaos.length; i++) orfaos[listaOrfaos[i]] = true;

    // A faixa fantasma fica sempre abaixo de todas as faixas de branch.
    var maiorFaixa = 0;
    for (var b = 0; b < estado.branches.length; b++) {
      if (estado.branches[b].faixa > maiorFaixa) maiorFaixa = estado.branches[b].faixa;
    }
    var faixaFantasma = maiorFaixa + 1;

    var corDaFaixa = {};
    var emojiDoDev = {};
    for (var d = 0; d < estado.devs.length; d++) emojiDoDev[estado.devs[d].id] = estado.devs[d].emoji;
    for (var k = 0; k < estado.branches.length; k++) corDaFaixa[estado.branches[k].faixa] = estado.branches[k].cor;

    // ----- nós -----
    var pos = {};
    var nos = [];
    for (var c = 0; c < estado.commits.length; c++) {
      var commit = estado.commits[c];
      var orfao = orfaos[commit.id] === true;
      var faixa = orfao ? faixaFantasma : commit.faixa;
      var x = MARGEM_X + commit.ordem * ESPACO_X;
      var y = MARGEM_Y + faixa * ESPACO_Y;
      pos[commit.id] = { x: x, y: y, faixa: faixa };
      nos.push({
        id: commit.id,
        x: x,
        y: y,
        cor: orfao ? COR_FANTASMA : (corDaFaixa[commit.faixa] || COR_FANTASMA),
        emoji: emojiDoDev[commit.autorId] || "🧑‍💻",
        mensagem: commit.mensagem,
        orfao: orfao,
        faixa: faixa
      });
    }

    // ----- arestas -----
    var arestas = [];
    for (var n = 0; n < estado.commits.length; n++) {
      var filho = estado.commits[n];
      for (var p = 0; p < filho.pais.length; p++) {
        var pai = filho.pais[p];
        if (!pos[pai] || !pos[filho.id]) continue;
        arestas.push({
          de: pai,
          para: filho.id,
          x1: pos[pai].x,
          y1: pos[pai].y,
          x2: pos[filho.id].x,
          y2: pos[filho.id].y,
          tipo: pos[pai].faixa === pos[filho.id].faixa ? "reta" : "curva",
          cor: pos[filho.id].faixa === faixaFantasma ? COR_FANTASMA : (corDaFaixa[filho.faixa] || COR_FANTASMA)
        });
      }
    }

    // ----- etiquetas -----
    // Ancoradas no commit-ponta. branch.faixa decide onde nascem commits futuros,
    // não onde a etiqueta é desenhada. Etiquetas no mesmo commit empilham.
    var porPonta = {};
    var ordemPonta = [];
    for (var q = 0; q < estado.branches.length; q++) {
      var br = estado.branches[q];
      if (!br.pontaId) continue;
      if (!porPonta[br.pontaId]) { porPonta[br.pontaId] = []; ordemPonta.push(br.pontaId); }
      porPonta[br.pontaId].push(br);
    }

    var etiquetas = [];
    for (var o = 0; o < ordemPonta.length; o++) {
      var pontaId = ordemPonta[o];
      var grupo = porPonta[pontaId];
      var centro = ((grupo.length - 1) * ALTURA_ETIQUETA) / 2;
      for (var g = 0; g < grupo.length; g++) {
        etiquetas.push({
          nome: grupo[g].nome,
          cor: grupo[g].cor,
          emoji: emojiDoDev[grupo[g].donoId] || "🧑‍💻",
          commitId: pontaId,
          x: pos[pontaId].x + DESLOC_ETIQUETA_X,
          y: pos[pontaId].y + g * ALTURA_ETIQUETA - centro,
          ehHead: estado.HEAD.branch === grupo[g].nome
        });
      }
    }

    // ----- faixas -----
    var faixas = [];
    for (var f = 0; f < estado.branches.length; f++) {
      var bf = estado.branches[f];
      faixas.push({
        indice: bf.faixa,
        y: MARGEM_Y + bf.faixa * ESPACO_Y,
        nome: bf.nome,
        cor: bf.cor,
        ativa: estado.HEAD.branch === bf.nome,
        fantasma: false
      });
    }
    faixas.sort(function (a, z) { return a.indice - z.indice; });
    if (listaOrfaos.length > 0) {
      faixas.push({
        indice: faixaFantasma,
        y: MARGEM_Y + faixaFantasma * ESPACO_Y,
        nome: "commits abandonados",
        cor: COR_FANTASMA,
        ativa: false,
        fantasma: true
      });
    }

    var maiorX = MARGEM_X;
    for (var m = 0; m < nos.length; m++) if (nos[m].x > maiorX) maiorX = nos[m].x;
    var ultimaFaixa = faixas.length > 0 ? faixas[faixas.length - 1].indice : 0;

    return {
      nos: nos,
      arestas: arestas,
      etiquetas: etiquetas,
      faixas: faixas,
      largura: maiorX + ESPACO_ETIQUETAS,
      altura: MARGEM_Y + (ultimaFaixa + 1) * ESPACO_Y,
      vazio: nos.length === 0
    };
  }

  raiz.Layout = {
    calcular: calcular,
    RAIO: RAIO,
    ESPACO_X: ESPACO_X,
    ESPACO_Y: ESPACO_Y,
    MARGEM_X: MARGEM_X,
    MARGEM_Y: MARGEM_Y,
    COR_FANTASMA: COR_FANTASMA
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
```

- [ ] **Step 4: Rode os testes e confirme que passam**

Run: `node testes.js`
Expected: `46/46 passaram`

- [ ] **Step 5: Commit**

```bash
git add layout.js testes.js
git commit -m "$(cat <<'EOF'
Adiciona cálculo de layout com faixa fantasma e empilhamento de etiquetas

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Página de testes no navegador

**Files:**
- Create: `testes.html`

**Interfaces:**
- Consumes: `MiniTeste.rodar`, `repo.js`, `layout.js`, `testes.js`
- Produces: nada consumido por outras tarefas

Esta tarefa é curta de propósito: entrega ao professor uma forma de conferir a saúde do
app sem terminal, e valida que os módulos realmente funcionam como scripts clássicos em
`file://` — o pressuposto central de todo o projeto. Descobrir isso agora, e não na
Task 10, é o motivo de ela existir aqui.

- [ ] **Step 1: Crie a página**

Criar `testes.html`:

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Testes — App de Branches</title>
  <style>
    body { font: 16px/1.6 system-ui, sans-serif; margin: 40px auto; max-width: 760px; color: #111827; }
    h1 { font-size: 22px; }
    #resumo { font-size: 20px; font-weight: 700; padding: 12px 16px; border-radius: 8px; margin: 20px 0; }
    .tudo-ok { background: #dcfce7; color: #166534; }
    .tem-falha { background: #fee2e2; color: #991b1b; }
    li { list-style: none; padding: 4px 0; }
    pre { background: #f3f4f6; padding: 10px; border-radius: 6px; overflow-x: auto; font-size: 13px; }
  </style>
</head>
<body>
  <h1>Testes do app de branches</h1>
  <div id="resumo">rodando…</div>
  <ul id="lista"></ul>

  <script src="mini-teste.js"></script>
  <script src="repo.js"></script>
  <script src="layout.js"></script>
  <script src="testes.js"></script>
  <script>
    MiniTeste.rodar(function (linhas, total, falhas) {
      var resumo = document.getElementById("resumo");
      resumo.textContent = (total - falhas) + " de " + total + " passaram";
      resumo.className = falhas === 0 ? "tudo-ok" : "tem-falha";

      var lista = document.getElementById("lista");
      linhas.forEach(function (l) {
        var li = document.createElement("li");
        li.textContent = (l.ok ? "✅ " : "❌ ") + l.nome;
        if (!l.ok) {
          var pre = document.createElement("pre");
          pre.textContent = l.erro;
          li.appendChild(pre);
        }
        lista.appendChild(li);
      });
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Abra no navegador e confira**

Abrir `testes.html` com duplo clique (protocolo `file://`, **não** por servidor local).

Expected:
- Faixa verde: `46 de 46 passaram`
- Console do navegador (F12) **sem nenhum erro**. Se aparecer erro de CORS ou de módulo, algum arquivo virou módulo ES — corrija para script clássico antes de seguir.

- [ ] **Step 3: Commit**

```bash
git add testes.html
git commit -m "$(cat <<'EOF'
Adiciona página de testes no navegador

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Estrutura da página, estilos e desenho do grafo

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `graph.js`

**Interfaces:**
- Consumes: `Layout.calcular`, `Layout.RAIO`, `Layout.COR_FANTASMA` (Task 6)
- Produces:
  - `Graph.montar(elementoSvg)` — guarda a referência, cria os grupos `<g>` em ordem de pintura
  - `Graph.desenhar(layout)` — idempotente, redesenha tudo a partir do layout
- IDs do DOM que `ui.js` e `main.js` (Tasks 9–10) vão usar: `#grafo`, `#dica-vazio`, `#painel-equipe`, `#lista-historico`, `#barra-head`, `#avisos`, `#msg-commit`, `#btn-commit`, `#nome-branch`, `#nome-dono`, `#emoji-dono`, `#ja-mudar`, `#btn-branch`, `#sel-checkout`, `#btn-checkout`, `#sel-merge`, `#btn-merge`, `#sel-reset`, `#btn-reset`, `#btn-desfazer`, `#btn-reiniciar`, `#erro-commit`, `#erro-branch`, `#erro-checkout`, `#erro-merge`, `#erro-reset`

- [ ] **Step 1: Crie `index.html`**

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Branches na prática</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>

<header class="topo">
  <div class="topo-titulo">meu-projeto</div>
  <div class="topo-head" id="barra-head"></div>
  <div class="topo-acoes">
    <button id="btn-desfazer" class="botao-secundario" disabled>↶ Desfazer</button>
    <button id="btn-reiniciar" class="botao-secundario">Reiniciar</button>
  </div>
</header>

<main class="colunas">

  <aside class="coluna-esquerda">
    <section class="bloco">
      <h2>Equipe</h2>
      <div id="painel-equipe"></div>
      <p class="nota">No GitHub, a branch principal costuma se chamar <code>main</code>.</p>
    </section>

    <section class="bloco">
      <h2>Ações</h2>

      <div class="acao">
        <label for="msg-commit">Mensagem do commit</label>
        <input id="msg-commit" type="text" placeholder="ex: cria o cabeçalho">
        <button id="btn-commit" class="botao">+ Commit</button>
        <p class="erro" id="erro-commit"></p>
      </div>

      <div class="acao">
        <label for="nome-branch">Nova branch</label>
        <input id="nome-branch" type="text" placeholder="ex: feature/login">
        <div class="dupla">
          <input id="nome-dono" type="text" placeholder="Quem trabalha nela">
          <input id="emoji-dono" type="text" placeholder="👩" maxlength="4">
        </div>
        <label class="checkbox"><input id="ja-mudar" type="checkbox" checked> Já mudar pra ela</label>
        <button id="btn-branch" class="botao">+ Branch</button>
        <p class="erro" id="erro-branch"></p>
      </div>

      <div class="acao">
        <label for="sel-checkout">Mudar de branch</label>
        <select id="sel-checkout"></select>
        <button id="btn-checkout" class="botao">Checkout</button>
        <p class="erro" id="erro-checkout"></p>
      </div>

      <div class="acao">
        <label for="sel-merge">Mesclar na branch atual</label>
        <select id="sel-merge"></select>
        <button id="btn-merge" class="botao">Merge</button>
        <p class="erro" id="erro-merge"></p>
      </div>

      <div class="acao">
        <label for="sel-reset">Voltar para o commit</label>
        <select id="sel-reset"></select>
        <button id="btn-reset" class="botao">Reset</button>
        <p class="erro" id="erro-reset"></p>
      </div>
    </section>
  </aside>

  <section class="coluna-centro">
    <div id="avisos"></div>
    <div class="area-grafo">
      <p id="dica-vazio">Repositório vazio — clique em <strong>+ Commit</strong> para começar.</p>
      <svg id="grafo" xmlns="http://www.w3.org/2000/svg"></svg>
    </div>
  </section>

  <aside class="coluna-direita">
    <h2>Histórico</h2>
    <ol id="lista-historico"></ol>
  </aside>

</main>

<script src="repo.js"></script>
<script src="layout.js"></script>
<script src="graph.js"></script>
<script src="storage.js"></script>
<script src="ui.js"></script>
<script src="main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Crie `styles.css`**

```css
/* Fundo claro de propósito: sala de aula com luz acesa. Tipografia grande para
   leitura no fundo da sala. */

:root {
  --texto: #111827;
  --texto-suave: #6b7280;
  --borda: #e5e7eb;
  --fundo: #ffffff;
  --fundo-painel: #f9fafb;
  --destaque: #2563eb;
  --erro: #b91c1c;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font: 17px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
  color: var(--texto);
  background: var(--fundo);
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ---------- topo ---------- */

.topo {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 12px 20px;
  border-bottom: 2px solid var(--borda);
  background: var(--fundo-painel);
  flex: 0 0 auto;
}
.topo-titulo { font-weight: 700; font-size: 19px; }
.topo-head { font-size: 19px; flex: 1; }
.topo-head strong { color: var(--destaque); }
.topo-acoes { display: flex; gap: 8px; }

/* ---------- colunas ---------- */

.colunas {
  display: grid;
  grid-template-columns: 300px 1fr 320px;
  flex: 1 1 auto;
  min-height: 0;
}

.coluna-esquerda, .coluna-direita {
  overflow-y: auto;
  padding: 16px;
  background: var(--fundo-painel);
}
.coluna-esquerda { border-right: 2px solid var(--borda); }
.coluna-direita { border-left: 2px solid var(--borda); }

.coluna-centro {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

h2 {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--texto-suave);
  margin: 0 0 12px;
}

.bloco { margin-bottom: 28px; }

/* ---------- controles ---------- */

.acao { margin-bottom: 18px; }
.acao label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 4px; }

input[type="text"], select {
  width: 100%;
  padding: 8px 10px;
  font: inherit;
  font-size: 15px;
  border: 1px solid var(--borda);
  border-radius: 6px;
  background: #fff;
  margin-bottom: 6px;
}

.dupla { display: grid; grid-template-columns: 1fr 68px; gap: 6px; }
.dupla input { margin-bottom: 6px; }

.checkbox {
  font-weight: 400 !important;
  font-size: 14px !important;
  display: flex !important;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.checkbox input { width: auto; }

.botao {
  width: 100%;
  padding: 9px 12px;
  font: inherit;
  font-weight: 600;
  color: #fff;
  background: var(--destaque);
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.botao:hover { filter: brightness(1.1); }
.botao:disabled { background: #cbd5e1; cursor: not-allowed; }

.botao-secundario {
  padding: 7px 14px;
  font: inherit;
  font-size: 15px;
  background: #fff;
  border: 1px solid var(--borda);
  border-radius: 6px;
  cursor: pointer;
}
.botao-secundario:disabled { color: #cbd5e1; cursor: not-allowed; }

.erro {
  color: var(--erro);
  font-size: 13px;
  margin: 4px 0 0;
  min-height: 1px;
}

.nota { font-size: 13px; color: var(--texto-suave); margin-top: 14px; }
.nota code { background: #e5e7eb; padding: 1px 5px; border-radius: 4px; }

/* ---------- equipe ---------- */

.dev {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border-radius: 6px;
  border-left: 5px solid transparent;
  margin-bottom: 4px;
}
.dev.ativo { background: #eff6ff; font-weight: 600; }
.dev-emoji { font-size: 24px; line-height: 1; }
.dev-nome { font-size: 15px; }
.dev-branch { font-size: 13px; color: var(--texto-suave); }

/* ---------- histórico ---------- */

#lista-historico { margin: 0; padding-left: 26px; font-size: 14px; }
#lista-historico li { margin-bottom: 8px; }
#lista-historico code {
  font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
  font-size: 13.5px;
  color: #111827;
  word-break: break-word;
}
#lista-historico li.recente code { background: #fef9c3; font-weight: 700; }

/* ---------- avisos ---------- */

#avisos { padding: 0 20px; flex: 0 0 auto; }
.aviso {
  margin: 10px 0 0;
  padding: 9px 14px;
  border-radius: 6px;
  font-size: 15px;
  background: #fef9c3;
  border-left: 5px solid #ca8a04;
}

/* ---------- grafo ---------- */

.area-grafo { flex: 1 1 auto; overflow: auto; position: relative; padding: 10px 20px 20px; }
#grafo { display: block; }
#dica-vazio { color: var(--texto-suave); font-size: 19px; padding: 50px 10px; }

.faixa-fundo { fill: transparent; }
.faixa-fundo.ativa { fill: #eff6ff; }
.faixa-nome { font-size: 14px; font-weight: 700; fill: #6b7280; }

.aresta { fill: none; stroke-width: 4; transition: d 300ms ease, stroke 300ms ease; }
.aresta.fantasma { stroke-dasharray: 7 6; }

.no { transition: transform 300ms ease; }
.no-circulo { stroke: #fff; stroke-width: 3; }
.no.fantasma .no-circulo { stroke-dasharray: 5 4; opacity: 0.55; }
.no-emoji { font-size: 19px; text-anchor: middle; dominant-baseline: central; }
.no-msg { font-size: 13px; fill: #4b5563; text-anchor: middle; }
.no.fantasma .no-msg { fill: #9ca3af; }

.etiqueta { transition: transform 300ms ease; }
.etiqueta-fundo { rx: 6; ry: 6; }
.etiqueta-texto { font-size: 15px; font-weight: 700; fill: #fff; dominant-baseline: central; }
.etiqueta-linha { stroke-width: 2; }
.marca-head {
  font-size: 13px; font-weight: 800; fill: #111827; dominant-baseline: central;
}

@media (prefers-reduced-motion: reduce) {
  .aresta, .no, .etiqueta { transition: none; }
}
```

- [ ] **Step 3: Crie `graph.js`**

```js
(function (raiz) {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var svg = null;
  var grupos = {};

  // Elementos reaproveitados entre desenhos, indexados por chave estável:
  // commits por id, etiquetas por nome de branch.
  //
  // Isto NÃO é otimização — é o que faz a animação existir. Transição CSS só
  // dispara quando um elemento JÁ ESTAVA na tela com outro valor. Se recriássemos
  // tudo a cada desenho, a etiqueta teletransportaria em vez de deslizar, e o
  // principal recurso didático do app iria embora.
  var vistos = { nos: {}, etiquetas: {} };

  function criar(tag, atributos) {
    var el = document.createElementNS(NS, tag);
    for (var k in atributos) {
      if (Object.prototype.hasOwnProperty.call(atributos, k)) el.setAttribute(k, atributos[k]);
    }
    return el;
  }

  function limpar(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  // Ordem de criação = ordem de pintura. Faixas ficam por baixo de tudo,
  // etiquetas por cima de tudo.
  function montar(elementoSvg) {
    svg = elementoSvg;
    limpar(svg);
    vistos = { nos: {}, etiquetas: {} };
    ["faixas", "arestas", "nos", "etiquetas"].forEach(function (nome) {
      grupos[nome] = criar("g", { "class": "grupo-" + nome });
      svg.appendChild(grupos[nome]);
    });
  }

  // Descarta os elementos cuja chave sumiu do layout (ex.: reiniciar, desfazer).
  function podar(cache, grupo, presentes) {
    for (var chave in cache) {
      if (!Object.prototype.hasOwnProperty.call(cache, chave)) continue;
      if (!presentes[chave]) {
        grupo.removeChild(cache[chave].g);
        delete cache[chave];
      }
    }
  }

  function desenharFaixas(layout) {
    limpar(grupos.faixas);
    layout.faixas.forEach(function (f) {
      grupos.faixas.appendChild(criar("rect", {
        "class": "faixa-fundo" + (f.ativa ? " ativa" : ""),
        x: 0, y: f.y - 44, width: layout.largura, height: 88
      }));
      var texto = criar("text", { "class": "faixa-nome", x: 10, y: f.y - 26 });
      texto.textContent = f.nome;
      texto.setAttribute("fill", f.cor);
      grupos.faixas.appendChild(texto);
    });
  }

  function desenharArestas(layout) {
    limpar(grupos.arestas);
    layout.arestas.forEach(function (a) {
      var d;
      if (a.tipo === "reta") {
        d = "M " + a.x1 + " " + a.y1 + " L " + a.x2 + " " + a.y2;
      } else {
        // Bézier cúbica: sai na horizontal do pai e chega na horizontal do filho,
        // o que deixa a ramificação com cara de trilho de trem.
        var meio = (a.x1 + a.x2) / 2;
        d = "M " + a.x1 + " " + a.y1 +
            " C " + meio + " " + a.y1 + ", " + meio + " " + a.y2 + ", " + a.x2 + " " + a.y2;
      }
      grupos.arestas.appendChild(criar("path", {
        "class": "aresta" + (a.cor === Layout.COR_FANTASMA ? " fantasma" : ""),
        d: d,
        stroke: a.cor
      }));
    });
  }

  // Reaproveita o <g> de cada commit (chave = id) para que a descida até a faixa
  // fantasma, no reset, seja animada em vez de instantânea.
  function desenharNos(layout) {
    var presentes = {};

    layout.nos.forEach(function (n) {
      presentes[n.id] = true;
      var item = vistos.nos[n.id];

      if (!item) {
        item = {
          g: criar("g", { "class": "no" }),
          circulo: criar("circle", { "class": "no-circulo", r: Layout.RAIO }),
          emoji: criar("text", { "class": "no-emoji", x: 0, y: 1 }),
          msg: criar("text", { "class": "no-msg", x: 0, y: Layout.RAIO + 20 }),
          titulo: criar("title", {})
        };
        item.g.appendChild(item.circulo);
        item.g.appendChild(item.emoji);
        item.g.appendChild(item.msg);
        item.g.appendChild(item.titulo);
        // Posiciona ANTES de entrar no DOM: assim o commit novo aparece no lugar
        // certo, e só os movimentos posteriores é que animam.
        item.g.setAttribute("transform", "translate(" + n.x + "," + n.y + ")");
        grupos.nos.appendChild(item.g);
        vistos.nos[n.id] = item;
      }

      item.g.setAttribute("class", "no" + (n.orfao ? " fantasma" : ""));
      item.g.setAttribute("transform", "translate(" + n.x + "," + n.y + ")");
      item.circulo.setAttribute("fill", n.cor);
      item.emoji.textContent = n.emoji;
      item.msg.textContent = n.mensagem.length > 16 ? n.mensagem.slice(0, 15) + "…" : n.mensagem;
      item.titulo.textContent = n.id + " — " + n.mensagem;
    });

    podar(vistos.nos, grupos.nos, presentes);
  }

  // A chave é o NOME da branch, não o commit. É exatamente por isso que a etiqueta
  // desliza: quando um commit novo entra, o mesmo <g> continua na tela e só muda de
  // transform — que é o momento "a master não copiou nada, ela só andou".
  function desenharEtiquetas(layout) {
    var presentes = {};

    layout.etiquetas.forEach(function (e) {
      presentes[e.nome] = true;
      var item = vistos.etiquetas[e.nome];

      if (!item) {
        item = {
          g: criar("g", { "class": "etiqueta" }),
          linha: criar("line", { "class": "etiqueta-linha", x2: 0, y2: 0 }),
          fundo: criar("rect", { "class": "etiqueta-fundo", y: -13, height: 26 }),
          texto: criar("text", { "class": "etiqueta-texto", x: 11, y: 1 }),
          head: criar("text", { "class": "marca-head", y: 1 })
        };
        item.g.appendChild(item.linha);
        item.g.appendChild(item.fundo);
        item.g.appendChild(item.texto);
        item.g.appendChild(item.head);
        item.g.setAttribute("transform", "translate(" + e.x + "," + e.y + ")");
        grupos.etiquetas.appendChild(item.g);
        vistos.etiquetas[e.nome] = item;
      }

      var rotulo = e.emoji + " " + e.nome;
      var largura = 22 + rotulo.length * 9.5;

      item.g.setAttribute("transform", "translate(" + e.x + "," + e.y + ")");

      // Conector até o commit, em coordenadas locais do <g>. Deixa explícito em
      // qual bolinha a etiqueta está grudada.
      item.linha.setAttribute("x1", layoutXdoCommit(layout, e.commitId) - e.x);
      item.linha.setAttribute("y1", layoutYdoCommit(layout, e.commitId) - e.y);
      item.linha.setAttribute("stroke", e.cor);

      item.fundo.setAttribute("x", 0);
      item.fundo.setAttribute("width", largura);
      item.fundo.setAttribute("fill", e.cor);

      item.texto.textContent = rotulo;

      item.head.setAttribute("x", largura + 10);
      item.head.textContent = e.ehHead ? "◀ HEAD" : "";
    });

    podar(vistos.etiquetas, grupos.etiquetas, presentes);
  }

  function layoutXdoCommit(layout, id) {
    for (var i = 0; i < layout.nos.length; i++) if (layout.nos[i].id === id) return layout.nos[i].x;
    return 0;
  }

  function layoutYdoCommit(layout, id) {
    for (var i = 0; i < layout.nos.length; i++) if (layout.nos[i].id === id) return layout.nos[i].y;
    return 0;
  }

  function desenhar(layout) {
    svg.setAttribute("width", layout.largura);
    svg.setAttribute("height", layout.altura);
    svg.setAttribute("viewBox", "0 0 " + layout.largura + " " + layout.altura);
    desenharFaixas(layout);
    desenharArestas(layout);
    desenharNos(layout);
    desenharEtiquetas(layout);
  }

  raiz.Graph = { montar: montar, desenhar: desenhar };
})(typeof globalThis !== "undefined" ? globalThis : this);
```

- [ ] **Step 4: Verifique o desenho com um estado fixo**

Como `ui.js`, `storage.js` e `main.js` ainda não existem, o `index.html` vai reclamar
deles no console. Isso é esperado nesta tarefa.

Para conferir o desenho agora, crie um arquivo temporário `_conferir.html`:

```html
<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Conferência</title><link rel="stylesheet" href="styles.css"></head>
<body>
  <div class="area-grafo"><svg id="grafo"></svg></div>
  <script src="repo.js"></script>
  <script src="layout.js"></script>
  <script src="graph.js"></script>
  <script>
    var e = Repo.commit(Repo.estadoInicial(), "c0").estado;
    e = Repo.criarBranch(e, "feature/login", { nome: "Ana", emoji: "👩" }, true).estado;
    e = Repo.commit(e, "form de login").estado;
    e = Repo.checkout(e, "master").estado;
    e = Repo.commit(e, "ajusta header").estado;
    e = Repo.merge(e, "feature/login").estado;
    Graph.montar(document.getElementById("grafo"));
    Graph.desenhar(Layout.calcular(e));
  </script>
</body>
</html>
```

Abrir `_conferir.html` com duplo clique.

Expected — confira cada item:
- Faixa `master` no topo em azul, `feature/login` abaixo em rosa
- **Quatro** círculos (`c0`, `form de login`, `ajusta header` e o commit de merge), cada um com emoji dentro e mensagem embaixo
- A linha da `feature/login` **desce em curva** a partir de `c0` e **volta em curva** para o commit de merge
- O commit de merge está na faixa da `master`
- Duas etiquetas coloridas, cada uma ligada por um tracinho ao seu commit-ponta
- `◀ HEAD` aparece exatamente uma vez, ao lado de `master`
- Console (F12) sem erros vindos de `graph.js`, `repo.js` ou `layout.js`

- [ ] **Step 5: Apague o arquivo de conferência e faça o commit**

```bash
rm _conferir.html
git add index.html styles.css graph.js
git commit -m "$(cat <<'EOF'
Adiciona estrutura da página, estilos de projetor e desenho do grafo em SVG

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Persistência, composição e a primeira fatia funcionando ponta a ponta

**Files:**
- Create: `storage.js`
- Create: `main.js`
- Create: `ui.js`

**Interfaces:**
- Consumes: `Repo.*`, `Layout.calcular`, `Graph.montar`, `Graph.desenhar`
- Produces:
  - `Storage.salvar(estado)`, `Storage.carregar()` → `Estado|null`, `Storage.limpar()`
  - `Storage.empilhar(estado)`, `Storage.desempilhar()` → `Estado|null`, `Storage.podeDesfazer()` → boolean
  - `UI.montar(aoExecutar)` onde `aoExecutar(nomeAcao, parametros)`; `nomeAcao` ∈ `"commit"|"criarBranch"|"checkout"|"merge"|"reset"`
  - `UI.atualizar(estado)` — repinta barra do topo, equipe, histórico e dropdowns
  - `UI.mostrarErro(nomeAcao, mensagem)`, `UI.limparErros()`, `UI.mostrarAviso(mensagem)`

O objetivo desta tarefa é o app **inteiro funcionando** com as cinco ações. Ela é grande
porque as três peças não têm valor separadas: `storage` sem `main` não salva nada, e
`ui` sem `main` não dispara nada.

- [ ] **Step 1: Crie `storage.js`**

```js
(function (raiz) {
  "use strict";

  var CHAVE = "git-branch-aula/v1";
  var LIMITE_DESFAZER = 50;
  var pilha = [];

  function salvar(estado) {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(estado));
    } catch (err) {
      // Modo anônimo ou armazenamento cheio: o app continua funcionando,
      // só não sobrevive a um F5. Não vale interromper a aula por isso.
    }
  }

  function carregar() {
    try {
      var bruto = localStorage.getItem(CHAVE);
      if (!bruto) return null;
      var estado = JSON.parse(bruto);
      // Guarda contra um localStorage de versão antiga ou corrompido.
      if (!estado || !estado.branches || !estado.HEAD || !estado.historico) return null;
      return estado;
    } catch (err) {
      return null;
    }
  }

  function limpar() {
    try { localStorage.removeItem(CHAVE); } catch (err) { /* ver salvar() */ }
    pilha = [];
  }

  function empilhar(estado) {
    pilha.push(JSON.stringify(estado));
    if (pilha.length > LIMITE_DESFAZER) pilha.shift();
  }

  function desempilhar() {
    if (pilha.length === 0) return null;
    return JSON.parse(pilha.pop());
  }

  function podeDesfazer() {
    return pilha.length > 0;
  }

  raiz.Storage = {
    salvar: salvar,
    carregar: carregar,
    limpar: limpar,
    empilhar: empilhar,
    desempilhar: desempilhar,
    podeDesfazer: podeDesfazer
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
```

- [ ] **Step 2: Crie `ui.js`**

```js
(function (raiz) {
  "use strict";

  function pegar(id) { return document.getElementById(id); }

  function opcao(valor, rotulo) {
    var o = document.createElement("option");
    o.value = valor;
    o.textContent = rotulo;
    return o;
  }

  function preencher(select, itens, vazio) {
    var anterior = select.value;
    select.innerHTML = "";
    if (itens.length === 0) {
      select.appendChild(opcao("", vazio));
      select.disabled = true;
      return;
    }
    select.disabled = false;
    itens.forEach(function (i) { select.appendChild(opcao(i.valor, i.rotulo)); });
    for (var k = 0; k < itens.length; k++) {
      if (itens[k].valor === anterior) { select.value = anterior; return; }
    }
  }

  function montar(aoExecutar) {
    pegar("btn-commit").addEventListener("click", function () {
      aoExecutar("commit", { mensagem: pegar("msg-commit").value });
    });

    pegar("msg-commit").addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") pegar("btn-commit").click();
    });

    pegar("btn-branch").addEventListener("click", function () {
      aoExecutar("criarBranch", {
        nome: pegar("nome-branch").value,
        dono: { nome: pegar("nome-dono").value, emoji: pegar("emoji-dono").value },
        jaMudar: pegar("ja-mudar").checked
      });
    });

    pegar("btn-checkout").addEventListener("click", function () {
      aoExecutar("checkout", { nome: pegar("sel-checkout").value });
    });

    pegar("btn-merge").addEventListener("click", function () {
      aoExecutar("merge", { nome: pegar("sel-merge").value });
    });

    pegar("btn-reset").addEventListener("click", function () {
      aoExecutar("reset", { commitId: pegar("sel-reset").value });
    });
  }

  function limparCampos(nomeAcao) {
    if (nomeAcao === "commit") pegar("msg-commit").value = "";
    if (nomeAcao === "criarBranch") {
      pegar("nome-branch").value = "";
      pegar("nome-dono").value = "";
      pegar("emoji-dono").value = "";
    }
  }

  function limparErros() {
    ["commit", "branch", "checkout", "merge", "reset"].forEach(function (n) {
      pegar("erro-" + n).textContent = "";
    });
    pegar("avisos").innerHTML = "";
  }

  var MAPA_ERRO = {
    commit: "erro-commit",
    criarBranch: "erro-branch",
    checkout: "erro-checkout",
    merge: "erro-merge",
    reset: "erro-reset"
  };

  function mostrarErro(nomeAcao, mensagem) {
    var alvo = pegar(MAPA_ERRO[nomeAcao] || "erro-commit");
    alvo.textContent = mensagem;
  }

  function mostrarAviso(mensagem) {
    var p = document.createElement("p");
    p.className = "aviso";
    p.textContent = mensagem;
    pegar("avisos").appendChild(p);
  }

  function pintarBarra(estado) {
    var br = Repo.branchAtual(estado);
    var dono = null;
    for (var i = 0; i < estado.devs.length; i++) {
      if (estado.devs[i].id === br.donoId) dono = estado.devs[i];
    }
    pegar("barra-head").innerHTML =
      "HEAD → <strong>" + br.nome + "</strong> &nbsp; " +
      (dono ? dono.emoji + " " + dono.nome : "");
  }

  function pintarEquipe(estado) {
    var painel = pegar("painel-equipe");
    painel.innerHTML = "";
    estado.branches.forEach(function (br) {
      var dono = null;
      for (var i = 0; i < estado.devs.length; i++) {
        if (estado.devs[i].id === br.donoId) dono = estado.devs[i];
      }
      var div = document.createElement("div");
      div.className = "dev" + (estado.HEAD.branch === br.nome ? " ativo" : "");
      div.style.borderLeftColor = br.cor;
      div.innerHTML =
        '<span class="dev-emoji">' + (dono ? dono.emoji : "🧑‍💻") + "</span>" +
        '<span><span class="dev-nome">' + (dono ? dono.nome : "Dev") + "</span><br>" +
        '<span class="dev-branch">' + br.nome + "</span></span>";
      painel.appendChild(div);
    });
  }

  function pintarHistorico(estado) {
    var lista = pegar("lista-historico");
    lista.innerHTML = "";
    estado.historico.forEach(function (h, i) {
      var li = document.createElement("li");
      if (i === estado.historico.length - 1) li.className = "recente";
      var code = document.createElement("code");
      code.textContent = h.comando;
      li.appendChild(code);
      lista.appendChild(li);
    });
    lista.scrollTop = lista.scrollHeight;
  }

  function pintarDropdowns(estado) {
    var atual = estado.HEAD.branch;

    preencher(pegar("sel-checkout"), estado.branches
      .filter(function (b) { return b.nome !== atual; })
      .map(function (b) { return { valor: b.nome, rotulo: b.nome }; }),
      "só existe a branch atual");

    preencher(pegar("sel-merge"), estado.branches
      .filter(function (b) { return b.nome !== atual && b.pontaId; })
      .map(function (b) { return { valor: b.nome, rotulo: b.nome + " → " + atual }; }),
      "nada para mesclar");

    preencher(pegar("sel-reset"), Repo.commitsAlcancaveis(estado)
      .map(function (c) { return { valor: c.id, rotulo: c.id + "  " + c.mensagem }; }),
      "sem commit anterior");
  }

  function atualizar(estado) {
    pintarBarra(estado);
    pintarEquipe(estado);
    pintarHistorico(estado);
    pintarDropdowns(estado);

    pegar("btn-branch").disabled = !Repo.branchAtual(estado).pontaId;

    // Botão segue o select: sem opção para escolher, não há o que executar.
    // Sem isto, clicar em Merge no início da aula joga no projetor a mensagem
    // sem sentido "A branch  não existe."
    ["checkout", "merge", "reset"].forEach(function (n) {
      pegar("btn-" + n).disabled = pegar("sel-" + n).disabled;
    });

    pegar("dica-vazio").style.display = estado.commits.length === 0 ? "block" : "none";
  }

  raiz.UI = {
    montar: montar,
    atualizar: atualizar,
    limparCampos: limparCampos,
    limparErros: limparErros,
    mostrarErro: mostrarErro,
    mostrarAviso: mostrarAviso
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
```

- [ ] **Step 3: Crie `main.js`**

```js
(function (raiz) {
  "use strict";

  var estado = null;

  function redesenhar() {
    UI.atualizar(estado);
    Graph.desenhar(Layout.calcular(estado));
    document.getElementById("btn-desfazer").disabled = !Storage.podeDesfazer();
  }

  function aplicar(nomeAcao, resultado) {
    if (!resultado.ok) {
      UI.mostrarErro(nomeAcao, resultado.erro);
      return;
    }
    Storage.empilhar(estado);
    estado = resultado.estado;
    Storage.salvar(estado);
    UI.limparCampos(nomeAcao);
    if (resultado.aviso) UI.mostrarAviso(resultado.aviso);
    redesenhar();
  }

  function executar(nomeAcao, p) {
    UI.limparErros();

    if (nomeAcao === "commit") return aplicar(nomeAcao, Repo.commit(estado, p.mensagem));
    if (nomeAcao === "criarBranch") return aplicar(nomeAcao, Repo.criarBranch(estado, p.nome, p.dono, p.jaMudar));
    if (nomeAcao === "checkout") return aplicar(nomeAcao, Repo.checkout(estado, p.nome));
    if (nomeAcao === "merge") return aplicar(nomeAcao, Repo.merge(estado, p.nome));
    if (nomeAcao === "reset") return aplicar(nomeAcao, Repo.reset(estado, p.commitId));
  }

  function desfazer() {
    var anterior = Storage.desempilhar();
    if (!anterior) return;
    estado = anterior;
    Storage.salvar(estado);
    UI.limparErros();
    redesenhar();
  }

  function reiniciar() {
    if (!window.confirm("Apagar tudo e começar um repositório novo?")) return;
    Storage.limpar();
    estado = Repo.estadoInicial();
    Storage.salvar(estado);
    UI.limparErros();
    redesenhar();
  }

  function iniciar() {
    estado = Storage.carregar() || Repo.estadoInicial();
    Graph.montar(document.getElementById("grafo"));
    UI.montar(executar);
    document.getElementById("btn-desfazer").addEventListener("click", desfazer);
    document.getElementById("btn-reiniciar").addEventListener("click", reiniciar);
    redesenhar();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
```

- [ ] **Step 4: Verifique o app inteiro no navegador**

Abrir `index.html` com duplo clique e executar exatamente esta sequência:

| # | Ação | Resultado esperado |
|---|---|---|
| 1 | Estado inicial | Dica "Repositório vazio", histórico com `1 git init`, `+ Branch` desabilitado |
| 2 | Commit "c0" | Um círculo azul; etiqueta `master` grudada nele com `◀ HEAD`; `+ Branch` habilita |
| 3 | Nova branch `feature/login`, dono `Ana` 👩, **desmarcando** "já mudar" | Duas etiquetas **empilhadas** no mesmo círculo; `HEAD` continua na `master`; histórico mostra `git branch feature/login` |
| 4 | Checkout `feature/login` | `◀ HEAD` pula para a etiqueta rosa; barra do topo mostra 👩 Ana; faixa rosa acende |
| 5 | Commit "form" | Novo círculo na faixa rosa, com curva descendo do `c0`. **A etiqueta `feature/login` precisa DESLIZAR visivelmente** do círculo antigo para o novo, ao longo de ~0,3s. Se ela pular instantaneamente, o reaproveitamento por chave em `Graph` quebrou — pare e conserte, é o principal recurso didático do app |
| 6 | Checkout `master`, commit "header" | Círculo azul na faixa 0; as duas linhas agora divergem visivelmente |
| 7 | Merge `feature/login` | Aparece o commit de merge com **duas** linhas chegando nele |
| 8 | `↶ Desfazer` | O commit de merge some; clicando até o fim, o botão desabilita |
| 9 | Refazer o merge (passo 7) | Volta o commit de merge |
| 10 | Reset para o `c0`, depois commit "novo" | Os commits abandonados descem para a faixa cinza tracejada rotulada "commits abandonados"; a aresta do novo commit **não** atravessa nenhum círculo |
| 11 | Commit sem mensagem | Erro em vermelho embaixo do campo; nada muda no grafo |
| 12 | Branch com nome repetido | Erro em vermelho; nada muda no grafo |
| 13 | Recarregar a página (F5) | O grafo e o histórico continuam idênticos. **`↶ Desfazer` fica desabilitado** — a pilha de desfazer é só em memória e zera ao recarregar, por decisão de projeto: o que sobrevive ao F5 é o repositório, não o histórico de cliques |
| 14 | Console (F12) | Nenhum erro |

**Ordem importa:** o teste de Desfazer precisa vir antes do F5. A pilha vive em memória
e é esvaziada ao recarregar — testar na ordem inversa daria um falso negativo.

- [ ] **Step 5: Rode os testes de novo para garantir que nada quebrou**

Run: `node testes.js`
Expected: `46/46 passaram`

- [ ] **Step 6: Commit**

```bash
git add storage.js ui.js main.js
git commit -m "$(cat <<'EOF'
Liga controles, persistência e desfazer ao grafo

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Ajuste ao projetor, README e versão em arquivo único

**Files:**
- Create: `gerar-arquivo-unico.js`
- Create: `README.md`
- Modify: `main.js` (ajuste automático de zoom)
- Modify: `styles.css` (zoom do grafo)

**Interfaces:**
- Consumes: tudo das tarefas anteriores
- Produces: `branches-na-pratica.html` (gerado, não versionado à mão)

- [ ] **Step 1: Faça o grafo caber na tela do projetor**

O spec exige: o SVG se reescala para caber, e ao atingir um tamanho mínimo legível
para de encolher e passa a rolar na horizontal, acompanhando o commit mais recente.

Em `styles.css`, substituir a regra `#grafo { display: block; }` por:

```css
#grafo { display: block; transform-origin: 0 0; }
```

Em `main.js`, adicionar antes de `function redesenhar()`:

```js
  var ESCALA_MINIMA = 0.55; // abaixo disso o texto fica ilegível no projetor

  function ajustarZoom(layout) {
    var area = document.querySelector(".area-grafo");
    var svg = document.getElementById("grafo");
    var disponivel = area.clientWidth - 40;

    var escala = Math.min(1, disponivel / layout.largura);
    if (escala < ESCALA_MINIMA) escala = ESCALA_MINIMA;

    svg.style.transform = "scale(" + escala + ")";
    // O elemento encolhe visualmente mas não no fluxo: reservamos o espaço real
    // para que a rolagem horizontal funcione quando a escala trava no mínimo.
    svg.style.marginBottom = (layout.altura * (escala - 1)) + "px";
    svg.style.marginRight = (layout.largura * (escala - 1)) + "px";

    // Acompanha o commit mais recente.
    area.scrollLeft = area.scrollWidth;
  }
```

E, dentro de `redesenhar()`, substituir a linha `Graph.desenhar(Layout.calcular(estado));` por:

```js
    var layout = Layout.calcular(estado);
    Graph.desenhar(layout);
    ajustarZoom(layout);
```

Ainda em `main.js`, dentro de `iniciar()`, antes de `redesenhar();`:

```js
    window.addEventListener("resize", function () { redesenhar(); });
```

- [ ] **Step 2: Verifique o ajuste no navegador**

Abrir `index.html`, criar 12 commits seguidos e redimensionar a janela.

Expected:
- Com poucos commits, o grafo aparece em tamanho natural
- Conforme cresce, encolhe até caber
- Passando do limite, para de encolher e surge rolagem horizontal, já posicionada no commit mais recente
- Nenhum texto fica pequeno demais para ler a alguns metros da tela

- [ ] **Step 3: Escreva o gerador do arquivo único**

Criar `gerar-arquivo-unico.js`:

```js
// Gera branches-na-pratica.html: um único arquivo com CSS e JS embutidos,
// para o professor mandar por WhatsApp ou Classroom.
// Uso: node gerar-arquivo-unico.js
//
// A pasta é a fonte da verdade. Este arquivo é sempre derivado dela.

var fs = require("fs");

var SCRIPTS = ["repo.js", "layout.js", "graph.js", "storage.js", "ui.js", "main.js"];

var html = fs.readFileSync("index.html", "utf8");
var css = fs.readFileSync("styles.css", "utf8");

html = html.replace(
  '<link rel="stylesheet" href="styles.css">',
  "<style>\n" + css + "\n</style>"
);

SCRIPTS.forEach(function (arquivo) {
  var js = fs.readFileSync(arquivo, "utf8");
  html = html.replace(
    '<script src="' + arquivo + '"></script>',
    "<script>\n" + js + "\n</script>"
  );
});

if (html.indexOf('<script src="') !== -1 || html.indexOf('<link rel="stylesheet"') !== -1) {
  console.error("ERRO: sobrou referência externa no HTML. O arquivo único não ficaria autocontido.");
  process.exit(1);
}

fs.writeFileSync("branches-na-pratica.html", html);
console.log("branches-na-pratica.html gerado (" + Math.round(html.length / 1024) + " KB)");
```

- [ ] **Step 4: Gere e verifique o arquivo único**

Run: `node gerar-arquivo-unico.js`
Expected: `branches-na-pratica.html gerado (NN KB)`

Depois, **copie** (não mova — o original precisa continuar aqui para o commit do Step 7)
`branches-na-pratica.html` para outra pasta qualquer e abra a cópia por lá com duplo
clique. Esse passo é o teste de verdade: prova que o arquivo não depende de nenhum
vizinho.

```bash
cp branches-na-pratica.html ~/Desktop/_teste-arquivo-unico.html
```

Ao terminar a conferência, apague a cópia: `rm ~/Desktop/_teste-arquivo-unico.html`

Expected:
- O app funciona por completo, sozinho na pasta nova
- Console (F12) sem nenhum erro `404` nem `net::ERR_FILE_NOT_FOUND`
- Criar commit, branch, checkout e merge funciona igual à versão em pasta

- [ ] **Step 5: Escreva o README**

Criar `README.md`:

```markdown
# Branches na prática

App de projetor para explicar branches de Git em aula. Sem instalação, sem internet,
sem banco de dados.

## Como usar

Dê duplo clique em `index.html`.

Para levar em pendrive ou mandar para os alunos, use `branches-na-pratica.html` —
é o app inteiro num arquivo só.

## O que dá para fazer

| Botão | Comando Git equivalente |
|---|---|
| + Commit | `git commit -m "..."` |
| + Branch | `git branch nome` ou `git checkout -b nome` |
| Checkout | `git checkout nome` |
| Merge | `git merge nome` |
| Reset | `git reset --hard <sha>` |

Todo comando executado aparece numerado no painel da direita.

O app **não** simula conflitos de merge: todo merge dá certo. Ele também é só Git
local — não há push, pull nem Pull Request.

O trabalho fica salvo automaticamente no navegador. `↶ Desfazer` volta um passo
(é borracha de clique errado, não um `git revert`). `Reiniciar` apaga tudo.

## Desenvolvimento

Não há build. Editar os arquivos e recarregar o navegador basta.

- `repo.js` e `layout.js` são funções puras, sem DOM. Toda a lógica difícil está aí.
- `graph.js`, `ui.js`, `storage.js` e `main.js` cuidam da tela.

Rodar os testes:

    node testes.js

Ou abrir `testes.html` no navegador.

Regenerar o arquivo único depois de mexer no código:

    node gerar-arquivo-unico.js

Node é usado só para testes e para gerar o arquivo único. O app em si não precisa dele.
```

- [ ] **Step 6: Verificação final**

Run: `node testes.js`
Expected: `46/46 passaram`

Abrir `testes.html` no navegador.
Expected: faixa verde, `46 de 46 passaram`

- [ ] **Step 7: Commit**

```bash
git add main.js styles.css gerar-arquivo-unico.js README.md branches-na-pratica.html
git commit -m "$(cat <<'EOF'
Ajusta grafo ao projetor, adiciona README e gerador de arquivo único

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Verificação de cobertura do spec

| Requisito do spec | Onde é implementado |
|---|---|
| Branch é ponteiro; etiqueta desliza | Task 2 (`br.pontaId = id`), Task 6 (etiqueta ancorada na ponta), Task 8 (**reaproveitamento de elementos por chave** em `Graph`, sem o qual a transição CSS não dispara e a etiqueta teletransporta) |
| `HEAD` é marcador próprio | Task 6 (`ehHead`), Task 8 (`◀ HEAD`) |
| Pessoas por branch | Task 3 (`registrarDev`), Task 6 (`emoji` no nó e na etiqueta), Task 9 (painel EQUIPE) |
| Dois tipos de merge | Task 4 (`tipo`), Task 8 (curva de reencontro) |
| Cinco operações | Tasks 2–5 |
| Histórico numerado à direita | Task 1 (`registrar`), Task 9 (`pintarHistorico`) |
| Estado inicial vazio com `git init` | Task 1 |
| Dono padrão da `master` | Task 1 |
| Faixa nova nunca reaproveitada | Task 3 (`proximaFaixa` só cresce) |
| Faixa fantasma dos órfãos | Task 5 (`orfaos`), Task 6 (`faixaFantasma`) |
| Etiquetas empilhadas no mesmo commit | Task 6 |
| X por ordem de criação, Y por faixa | Task 6 |
| Faixa do commit imutável | Task 6 (teste explícito) |
| Ajuste ao projetor com rolagem | Task 10 |
| Cor nunca sozinha | Task 6 (nome + emoji na etiqueta), Task 8 (nome da faixa) |
| `localStorage` + Reiniciar | Task 9 |
| Desfazer apaga a linha do histórico | Task 9 (restaura o estado inteiro, histórico junto) |
| Desfazer desabilitado na pilha vazia | Task 9 (`podeDesfazer`) |
| Mensagens de erro inline, sem `alert` | Task 9 (`mostrarErro`) |
| `Already up to date` registra o comando | Task 4 (teste explícito) |
| Reset só oferece commits alcançáveis, sem a ponta | Task 5 (`commitsAlcancaveis`) |
| Testes no navegador com ✅/❌ | Task 7 |
| Nota sobre `main` vs `master` | Task 8 (`index.html`) |
| Versão em arquivo único | Task 10 |

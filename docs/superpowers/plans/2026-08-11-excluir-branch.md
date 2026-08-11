# Apagar uma branch — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao app a sexta operação — apagar uma branch — nas duas formas do Git real: `git branch -d` (recusa quando há trabalho a perder) e `git branch -D` (apaga abandonando os commits).

**Architecture:** Uma função pura nova em `repo.js`, `excluirBranch(estado, nome, forcar)`, que reusa `ehAncestral` para decidir se a branch está mesclada — a mesma condição que o `merge` já usa para dizer *"Already up to date"*. Como esta é a primeira operação que **tira** uma branch do estado, duas coisas em `layout.js` que dependiam de `estado.branches` só crescer precisam ser corrigidas: a cor/rótulo da faixa (resolvido por um rastro `faixasApagadas` no estado) e o índice da faixa fantasma (passa a vir de `proximaFaixa`). Na tela, um bloco `.acao` novo com dropdown + checkbox "Forçar (-D)", no padrão dos cinco que já existem.

**Tech Stack:** HTML + CSS + JavaScript ES5 puro. Sem build, sem dependências, sem CDN. Testes com o `MiniTeste` da casa, rodando em `node testes.js` e em `testes.html`.

**Spec:** `docs/superpowers/specs/2026-08-11-excluir-branch-design.md`

## Global Constraints

- **ES5 apenas.** Nada de `let`, `const`, arrow functions, template literals ou `class`. Todo o código existente usa `var` e `function`; siga.
- **Zero dependências.** Nenhum pacote npm, nenhuma tag de CDN. O app roda com duplo clique em `index.html`, offline.
- **Cada módulo é uma IIFE** no formato `(function (raiz) { "use strict"; ... raiz.Nome = {...}; })(typeof globalThis !== "undefined" ? globalThis : this);`
- **`repo.js` e `layout.js` são puros.** Nada de `document`, `window` ou `localStorage` dentro deles.
- **Operações de `repo.js` nunca mutam o estado recebido.** Clonam com `clonar(estado)` e devolvem `{ ok: true, estado: e, comando: "..." }` ou `{ ok: false, erro: "..." }`.
- **Código e comentários em português.** Comentários explicam *por quê*, não *o quê* — veja o estilo em `layout.js:96` e `ui.js:180`.
- **Mensagens de erro em português; comandos Git em inglês.** O texto da recusa cita `"Forçar (-D)"` (o nome do controle na tela), não "rode `git branch -D`" — não há terminal aqui.
- **Nomes exatos deste trabalho:** campo de estado `faixasApagadas`, função `excluirBranch`, ação `"excluirBranch"`, ids de tela `sel-excluir` / `forcar-exclusao` / `btn-excluir` / `erro-excluir`, sufixo de rótulo `" (apagada)"`.
- **Nenhum arquivo novo.** A lista `SCRIPTS` em `gerar-arquivo-unico.js` não muda.
- **`branches-na-pratica.html` é artefato derivado versionado.** Depois de mexer em `index.html`, `styles.css`, `repo.js`, `layout.js`, `graph.js`, `storage.js`, `ui.js` ou `main.js`, rode `node gerar-arquivo-unico.js` e comite o resultado junto (Task 6).
- **Rodar os testes:** `node testes.js`. Ele imprime `N de N passaram` e sai com código 1 se algo falhar.

---

## Task 1: `Repo.excluirBranch`

A operação inteira, pura e testável, antes de qualquer tela.

**Files:**
- Modify: `repo.js` (campo em `estadoInicial`, função `excluirBranch`, export)
- Test: `testes.js` (seção nova, inserida **antes** de `// ---------- layout.js ----------`, hoje na linha 401)

**Interfaces:**
- Consumes: `acharBranch`, `branchAtual`, `ehAncestral`, `clonar`, `registrar` — todos já existem em `repo.js`.
- Produces:
  - `Repo.excluirBranch(estado, nome, forcar)` → `{ ok: true, estado: <estado novo>, comando: "git branch -d nome" }` ou `{ ok: false, erro: "..." }`. `forcar` é booleano.
  - Campo de estado `faixasApagadas`: `Array<{ faixa: number, nome: string, cor: string }>`, **nesta ordem de chaves** (a Task 3 e os testes comparam com `JSON.stringify`).

**Contexto para quem nunca viu este projeto:** `repo.js` é o modelo do repositório — funções puras, sem DOM. Cada operação clona o estado, mexe no clone e devolve. `registrar(e, comando)` empurra a linha no histórico numerado que aparece na coluna da direita do app. `ehAncestral(estado, idA, idB)` responde "A é ancestral de B?" percorrendo a cadeia de pais. `Repo.orfaos(estado)` devolve os ids de commits que nenhuma branch alcança mais — é isso que faz um commit descer para a faixa cinza de "commits abandonados".

- [ ] **Step 1: Escrever os testes que devem falhar**

Em `testes.js`, insira esta seção inteira imediatamente **antes** da linha `// ---------- layout.js ----------`:

```js
// ---------- repo.js: excluirBranch ----------

// A feature de cenarioDivergente mesclada de volta na master. HEAD na master.
// Devolve { estado, c1, c2 } — c2 é o commit que só existia na feature.
function cenarioMesclado() {
  var c = cenarioDivergente();
  return { estado: Repo.merge(c.estado, "feature").estado, c1: c.c1, c2: c.c2 };
}

teste("estado inicial: nenhuma faixa apagada", function () {
  igual(Repo.estadoInicial().faixasApagadas, []);
});

teste("excluirBranch apaga branch mesclada sem tocar em commits nem devs", function () {
  var m = cenarioMesclado();
  var r = Repo.excluirBranch(m.estado, "feature", false);
  verdade(r.ok, r.erro);
  igual(Repo.acharBranch(r.estado, "feature"), null, "a etiqueta some");
  igual(r.estado.branches.length, 1, "só a master fica");
  igual(r.estado.commits.length, m.estado.commits.length, "nenhum commit se mexe");
  igual(r.estado.devs.length, m.estado.devs.length, "a dona continua na lista: os commits dela precisam do avatar");
  igual(Repo.orfaos(r.estado), [], "o merge já tinha trazido tudo para a master");
});

teste("excluirBranch guarda o rastro da faixa apagada", function () {
  var m = cenarioMesclado();
  var br = Repo.acharBranch(m.estado, "feature");
  var r = Repo.excluirBranch(m.estado, "feature", false);
  igual(r.estado.faixasApagadas, [{ faixa: br.faixa, nome: "feature", cor: br.cor }]);
});

teste("excluirBranch registra -d sem forçar e -D com forçar", function () {
  var m = cenarioMesclado();
  var r = Repo.excluirBranch(m.estado, "feature", false);
  igual(r.comando, "git branch -d feature");
  igual(r.estado.historico[r.estado.historico.length - 1].comando, "git branch -d feature");
  igual(Repo.excluirBranch(cenarioDivergente().estado, "feature", true).comando, "git branch -D feature");
});

teste("excluirBranch recusa a branch atual, e forçar não contorna", function () {
  var m = cenarioMesclado();
  igual(Repo.excluirBranch(m.estado, "master", false).ok, false);
  igual(Repo.excluirBranch(m.estado, "master", true).ok, false,
    "é isso que garante que nunca sobra repositório sem branch");
});

teste("excluirBranch recusa branch inexistente", function () {
  igual(Repo.excluirBranch(comUmCommit(), "nao-existe", false).ok, false);
});

teste("excluirBranch recusa branch não mesclada sem forçar", function () {
  var c = cenarioDivergente(); // a feature tem c2, que a master não alcança
  var r = Repo.excluirBranch(c.estado, "feature", false);
  igual(r.ok, false);
  verdade(r.erro.indexOf("Forçar") !== -1, "o erro precisa apontar para o controle da tela");
  igual(Repo.orfaos(c.estado), [], "recusar não pode mexer em nada");
});

teste("excluirBranch com forçar apaga a não mesclada e deixa os commits órfãos", function () {
  var c = cenarioDivergente();
  var r = Repo.excluirBranch(c.estado, "feature", true);
  verdade(r.ok, r.erro);
  igual(r.estado.commits.length, 3, "o commit continua existindo, só ficou inalcançável");
  igual(Repo.orfaos(r.estado), [c.c2], "c2 perdeu a única etiqueta que o alcançava");
});

teste("branch criada e nunca commitada é apagável sem forçar", function () {
  var e = Repo.criarBranch(comUmCommit(), "vazia", { nome: "Ana", emoji: "👩" }, false).estado;
  verdade(Repo.excluirBranch(e, "vazia", false).ok,
    "aponta para o mesmo commit da master: não há o que perder");
});

teste("master é apagável quando não é a branch atual", function () {
  var e = Repo.checkout(cenarioDivergente().estado, "feature").estado;
  e = Repo.merge(e, "master").estado; // agora a master está mesclada na feature
  verdade(Repo.excluirBranch(e, "master", false).ok, "master não é especial, é um ponteiro com nome combinado");
});

teste("excluirBranch não muta o estado recebido", function () {
  var m = cenarioMesclado();
  var antes = JSON.stringify(m.estado);
  Repo.excluirBranch(m.estado, "feature", false);
  igual(JSON.stringify(m.estado), antes, "o estado original não pode mudar");
});

teste("excluirBranch aceita estado antigo, sem o campo faixasApagadas", function () {
  var m = cenarioMesclado();
  delete m.estado.faixasApagadas; // como os do localStorage antigo e os da pilha de desfazer
  var r = Repo.excluirBranch(m.estado, "feature", false);
  verdade(r.ok, r.erro);
  igual(r.estado.faixasApagadas.length, 1, "o campo nasce na hora, sem quebrar");
});
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `node testes.js`
Expected: FAIL. Vários casos com `TypeError: Repo.excluirBranch is not a function`, e `estado inicial: nenhuma faixa apagada` reclamando `esperado: [] / recebido: undefined`.

- [ ] **Step 3: Acrescentar o campo em `estadoInicial`**

Em `repo.js`, na função `estadoInicial`, entre `historico` e `proximoId`:

```js
  function estadoInicial() {
    return {
      commits: [],
      branches: [{ nome: "master", pontaId: null, cor: CORES[0], donoId: "voce", faixa: 0 }],
      HEAD: { branch: "master" },
      devs: [{ id: "voce", nome: "Você", emoji: "🧑‍💻" }],
      historico: [{ n: 1, comando: "git init" }],
      faixasApagadas: [],
      proximoId: 1,
      proximaFaixa: 1
    };
  }
```

- [ ] **Step 4: Escrever `excluirBranch`**

Em `repo.js`, logo **depois** da função `criarBranch` e antes de `checkout`:

```js
  function excluirBranch(estado, nome, forcar) {
    var alvo = acharBranch(estado, nome);
    if (!alvo) {
      return { ok: false, erro: "A branch " + nome + " não existe." };
    }
    // O Git real também recusa. Aqui isso vale dobrado: é este bloqueio que
    // garante que nenhuma sequência de operações leva a um repositório sem
    // branch nenhuma, com o HEAD apontando para o vazio. Por isso não existe
    // versão forçada dele.
    if (estado.HEAD.branch === nome) {
      return { ok: false, erro: "Não dá para apagar a branch em que você está. Faça checkout em outra antes." };
    }

    // Mesmo teste que o merge usa para dizer "Already up to date": se a ponta do
    // alvo já é ancestral da ponta da atual, tudo que ele tinha continua
    // alcançável depois que a etiqueta sumir — não há o que perder. Branch sem
    // ponta cai no mesmo balde por não ter nada a perder de saída.
    var atual = branchAtual(estado);
    var mesclada = !alvo.pontaId || ehAncestral(estado, alvo.pontaId, atual.pontaId);
    if (!mesclada && !forcar) {
      return {
        ok: false,
        erro: "A branch " + nome + " não foi mesclada em " + atual.nome +
          ". Marque \"Forçar (-D)\" para apagar mesmo assim — os commits dela ficam abandonados."
      };
    }

    var e = clonar(estado);
    // Estados gravados antes desta feature (localStorage de uma aula em
    // andamento, pilha de desfazer) não têm o campo.
    if (!e.faixasApagadas) e.faixasApagadas = [];

    for (var i = 0; i < e.branches.length; i++) {
      if (e.branches[i].nome === nome) {
        // O rastro é o que mantém cor e rótulo da faixa depois que a única fonte
        // dos dois — a branch em e.branches — sai da lista. Sem ele, commits
        // VIVOS da faixa apareceriam cinzas, e cinza no app inteiro quer dizer
        // "abandonado".
        e.faixasApagadas.push({ faixa: e.branches[i].faixa, nome: nome, cor: e.branches[i].cor });
        e.branches.splice(i, 1);
        break;
      }
    }

    // Commits, devs e HEAD não são tocados: quem decide se algum commit vai para
    // a faixa fantasma é orfaos(), pela alcançabilidade, sem saber que houve um
    // delete.
    var comando = "git branch " + (forcar ? "-D " : "-d ") + nome;
    registrar(e, comando);
    return { ok: true, estado: e, comando: comando };
  }
```

- [ ] **Step 5: Exportar**

Em `repo.js`, no objeto `raiz.Repo`, na linha depois de `criarBranch`:

```js
    criarBranch: criarBranch,
    excluirBranch: excluirBranch,
    checkout: checkout,
```

- [ ] **Step 6: Rodar os testes e ver passar**

Run: `node testes.js`
Expected: PASS — todos os casos, inclusive os que já existiam.

- [ ] **Step 7: Commit**

```bash
git add repo.js testes.js
git commit -m "Apaga branch: git branch -d e -D no modelo"
```

---

## Task 2: A faixa fantasma não pode andar

Uma correção de uma linha em `layout.js`, com o teste de regressão que a justifica. É pré-requisito da Task 3: sem ela, apagar uma branch move commits que já estavam desenhados.

**Files:**
- Modify: `layout.js:26-31` (cálculo de `faixaFantasma`)
- Test: `testes.js` (fim da seção `// ---------- layout.js ----------`, logo antes de `// ---------- ui.js: largura das barras laterais ----------`)

**Interfaces:**
- Consumes: `Repo.excluirBranch` (Task 1).
- Produces: nada novo. Só muda de onde `Layout.calcular` tira o índice da faixa fantasma.

**Contexto:** `layout.js` traduz o estado em coordenadas. Cada branch tem uma **faixa** (linha horizontal), e commits abandonados são desenhados numa "faixa fantasma" desenhada abaixo de todas. Hoje esse índice é `maiorFaixa + 1`, varrendo as branches **vivas** — conta que só era estável enquanto branches apenas nasciam. `estado.proximaFaixa` é o contador que `criarBranch` incrementa e **ninguém decrementa**.

- [ ] **Step 1: Escrever o teste que deve falhar**

Em `testes.js`, no fim da seção de `layout.js` (imediatamente antes do comentário `// ---------- ui.js: largura das barras laterais ----------`):

```js
teste("apagar uma branch não faz os commits abandonados mudarem de faixa", function () {
  var e = tresCommits();
  e = Repo.reset(e, e.commits[0].id).estado;                                     // c2 e c3 viram órfãos
  e = Repo.criarBranch(e, "feature", { nome: "Ana", emoji: "👩" }, false).estado; // faixa 1, empurra a fantasma para baixo
  var antes = Layout.calcular(e);
  var depois = Layout.calcular(Repo.excluirBranch(e, "feature", false).estado);
  igual(acharNo(depois, e.commits[2].id).y, acharNo(antes, e.commits[2].id).y,
    "o commit abandonado não pode subir de linha só porque uma branch sumiu");
});
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `node testes.js`
Expected: FAIL neste caso, com dois `y` diferentes — o órfão sobe 96px (um `ESPACO_Y`) quando a faixa da feature deixa de existir.

- [ ] **Step 3: Trocar a origem do índice**

Em `layout.js`, no bloco que hoje termina com `var faixaFantasma = maiorFaixa + 1;`:

```js
    // A faixa fantasma fica sempre abaixo de todas as faixas de branch.
    var maiorFaixa = 0;
    for (var b = 0; b < estado.branches.length; b++) {
      if (estado.branches[b].faixa > maiorFaixa) maiorFaixa = estado.branches[b].faixa;
    }
    // proximaFaixa, e não maiorFaixa + 1: apagar uma branch DIMINUI maiorFaixa, e
    // a faixa fantasma subiria um degrau levando junto os commits abandonados que
    // já estavam na tela — a reorganização de desenho que a spec proíbe. proximaFaixa
    // só cresce. O max cobre um estado montado à mão em que ela tenha ficado para
    // trás, garantindo que a fantasma nunca caia em cima de uma faixa viva.
    var faixaFantasma = Math.max(estado.proximaFaixa || 0, maiorFaixa + 1);
```

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `node testes.js`
Expected: PASS, inclusive `órfãos vão para a faixa fantasma, abaixo de todas as outras` e `commit após reset: a aresta pai->filho não atravessa nenhum commit desenhado`, que já existiam. Em qualquer estado que o app de hoje produz, `proximaFaixa === maiorFaixa + 1`, então o valor não muda para eles.

- [ ] **Step 5: Commit**

```bash
git add layout.js testes.js
git commit -m "Faixa fantasma vem de proximaFaixa, que nunca decrementa"
```

---

## Task 3: O rastro da faixa apagada

Faz a faixa de uma branch apagada manter a cor e ganhar o rótulo `(apagada)` — enquanto ainda houver commit vivo nela.

**Files:**
- Modify: `layout.js` (`corDaFaixa`, bloco `----- faixas -----`)
- Test: `testes.js` (mesma posição da Task 2: fim da seção de `layout.js`)

**Interfaces:**
- Consumes: `estado.faixasApagadas` — `Array<{ faixa, nome, cor }>` (Task 1).
- Produces: entradas novas em `layout.faixas`, no mesmo formato das existentes: `{ indice, y, nome, cor, ativa, fantasma }`. `nome` vem com o sufixo `" (apagada)"`, `ativa: false`, `fantasma: false`.

**Contexto:** `graph.js` desenha cada entrada de `layout.faixas` como um retângulo de fundo mais um texto na lateral, usando só `f.y`, `f.nome`, `f.cor` e `f.ativa` — e limpa e redesenha o grupo inteiro a cada quadro. Por isso **nada em `graph.js` muda nesta task**: uma faixa nova aparece só por existir na lista. Os commits pegam a cor de `corDaFaixa[commit.faixa]`, com `|| COR_FANTASMA` como último recurso — é esse fallback que pintaria de cinza os commits vivos de uma branch apagada.

- [ ] **Step 1: Escrever os testes que devem falhar**

Em `testes.js`, junto do teste da Task 2 (fim da seção de `layout.js`):

```js
teste("faixa de branch apagada mantém a cor e ganha o rótulo (apagada)", function () {
  var m = cenarioMesclado();
  var br = Repo.acharBranch(m.estado, "feature");
  var l = Layout.calcular(Repo.excluirBranch(m.estado, "feature", false).estado);

  var no = acharNo(l, m.c2);
  igual(no.orfao, false, "o merge trouxe c2 para a master: ele está vivo");
  igual(no.cor, br.cor, "commit vivo não pode ficar cinza — cinza aqui quer dizer abandonado");

  var faixa = null;
  for (var i = 0; i < l.faixas.length; i++) if (l.faixas[i].indice === br.faixa) faixa = l.faixas[i];
  verdade(faixa !== null, "a faixa ainda tem commit vivo, então continua desenhada");
  igual(faixa.nome, "feature (apagada)");
  igual(faixa.cor, br.cor);
  igual(faixa.ativa, false);
  igual(faixa.fantasma, false, "apagada não é o mesmo que abandonada");
});

teste("faixa esvaziada pelo -D não é desenhada", function () {
  var c = cenarioDivergente();
  var faixaFeature = Repo.acharBranch(c.estado, "feature").faixa;
  var l = Layout.calcular(Repo.excluirBranch(c.estado, "feature", true).estado);
  igual(acharNo(l, c.c2).orfao, true, "c2 perdeu a etiqueta que o alcançava");
  for (var i = 0; i < l.faixas.length; i++) {
    verdade(l.faixas[i].indice !== faixaFeature,
      "a faixa ficou vazia: uma faixa rotulada e sem commit só esticaria a altura à toa");
  }
});

teste("Layout.calcular aceita estado antigo, sem o campo faixasApagadas", function () {
  var c = cenarioDivergente();
  delete c.estado.faixasApagadas;
  igual(Layout.calcular(c.estado).faixas.length, 2, "as duas branches continuam desenhadas");
});
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `node testes.js`
Expected: FAIL nos dois primeiros. O primeiro mostra o commit vivo com `#64748b` (`COR_FANTASMA`) em vez da cor da branch, e `faixa` chegando `null`. O terceiro já passa — é uma rede de proteção contra a implementação do Step 3 quebrar estados antigos.

- [ ] **Step 3: Ler o rastro em `corDaFaixa`**

Em `layout.js`, no bloco que monta `corDaFaixa` e `emojiDoDev`:

```js
    var corDaFaixa = {};
    var emojiDoDev = {};
    for (var d = 0; d < estado.devs.length; d++) emojiDoDev[estado.devs[d].id] = estado.devs[d].emoji;
    for (var k = 0; k < estado.branches.length; k++) corDaFaixa[estado.branches[k].faixa] = estado.branches[k].cor;

    // A faixa de uma branch apagada continua com a cor dela. Os commits que
    // sobraram ali são commits VIVOS — sem isto cairiam no || COR_FANTASMA lá
    // embaixo e o projetor diria "abandonado" sobre trabalho que está dentro da
    // master. Estados gravados antes desta feature não têm o campo.
    var apagadas = estado.faixasApagadas || [];
    for (var ka = 0; ka < apagadas.length; ka++) corDaFaixa[apagadas[ka].faixa] = apagadas[ka].cor;
```

- [ ] **Step 4: Marcar quais faixas têm commit vivo**

Ainda em `layout.js`, no laço `----- nós -----`. Declare o acumulador antes do laço:

```js
    // ----- nós -----
    var pos = {};
    var nos = [];
    var faixaTemVivo = {};
```

e, dentro do laço, logo depois do `pos[commit.id] = ...`:

```js
      pos[commit.id] = { x: x, y: y, faixa: faixa };
      if (!orfao) faixaTemVivo[faixa] = true;
```

- [ ] **Step 5: Desenhar as faixas apagadas ocupadas**

Ainda em `layout.js`, no bloco `----- faixas -----`, entre o laço que percorre `estado.branches` e a linha `faixas.sort(...)`:

```js
    for (var fa = 0; fa < apagadas.length; fa++) {
      // Só enquanto sobrar commit vivo na faixa. O -D manda os commits dela para
      // a faixa fantasma, e um reset posterior na master pode esvaziá-la depois:
      // nos dois casos a faixa some do desenho e sobra só o espaço vertical, em
      // vez de uma linha rotulada e vazia esticando a altura do canvas.
      if (!faixaTemVivo[apagadas[fa].faixa]) continue;
      faixas.push({
        indice: apagadas[fa].faixa,
        y: MARGEM_Y + apagadas[fa].faixa * ESPACO_Y,
        nome: apagadas[fa].nome + " (apagada)",
        cor: apagadas[fa].cor,
        ativa: false,
        fantasma: false
      });
    }
    faixas.sort(function (a, z) { return a.indice - z.indice; });
```

- [ ] **Step 6: Rodar os testes e ver passar**

Run: `node testes.js`
Expected: PASS em todos.

- [ ] **Step 7: Commit**

```bash
git add layout.js testes.js
git commit -m "Faixa de branch apagada mantem a cor e ganha o rotulo (apagada)"
```

---

## Task 4: Estados salvos antes desta feature

Uma linha em `storage.js` para o estado carregado já vir canônico.

**Files:**
- Modify: `storage.js:38-40` (dentro de `carregar`, depois do guard de coerência)

**Interfaces:**
- Consumes: nada.
- Produces: nada. Só garante que o estado devolvido por `Storage.carregar` sempre tem `faixasApagadas` como array.

**Por que isto não tem teste automatizado.** `storage.js` depende de `localStorage`, que não existe no Node — e `testes.html` roda na **mesma origem** do app, então um teste que escrevesse na chave real apagaria o repositório da aula de quem abrisse a página de testes. Por isso `storage.js` não entra em nenhuma das duas suítes. A proteção que **é** testada está em `repo.js` e `layout.js` (Tasks 1 e 3), que leem o campo defensivamente; esta linha só evita que o estado ande pelo app sem ele. A verificação é manual, no Step 3.

- [ ] **Step 1: Normalizar o campo na leitura**

Em `storage.js`, na função `carregar`, entre o guard de coerência e o `return estado;`:

```js
      if (!branchExiste || typeof estado.proximoId !== "number") return null;

      // Campo novo (apagar branch). Um estado gravado antes dele é perfeitamente
      // válido — só não tem a lista. Normaliza aqui, no ponto onde dado estranho
      // entra, em vez de somar o campo ao guard acima: aquele guard devolve null,
      // e devolver null aqui apagaria o repositório de uma aula em andamento na
      // primeira abertura depois da atualização.
      if (!Array.isArray(estado.faixasApagadas)) estado.faixasApagadas = [];

      return estado;
```

- [ ] **Step 2: Conferir que nada quebrou**

Run: `node testes.js`
Expected: PASS. `storage.js` não está na suíte; isto é só a confirmação de que a edição não derrubou nada por acidente.

- [ ] **Step 3: Verificar no navegador**

Abra `index.html` no navegador, faça dois commits e crie uma branch. Depois, no console do DevTools:

```js
var k = "git-branch-aula/v1";
var e = JSON.parse(localStorage.getItem(k));
delete e.faixasApagadas;                 // simula o estado salvo por uma versão anterior
localStorage.setItem(k, JSON.stringify(e));
location.reload();
```

Expected: o repositório continua na tela (não voltou ao zero), e o painel Ações continua funcionando. Se a tela voltar vazia, o campo foi parar no guard que devolve `null` — corrija a posição da linha.

- [ ] **Step 4: Commit**

```bash
git add storage.js
git commit -m "Estado salvo sem faixasApagadas continua valendo"
```

---

## Task 5: O bloco "Apagar branch" na tela

Liga a operação ao painel Ações. Depois desta task a feature está utilizável.

**Files:**
- Modify: `index.html:63-64` (bloco novo entre o `.acao` do Merge e o do Reset)
- Modify: `ui.js` (seis pontos: `montar`, `limparCampos`, `limparErros`, `MAPA_ERRO`, `pintarDropdowns`, `atualizar`)
- Modify: `main.js:79-80` (despacho em `executar`)

**Interfaces:**
- Consumes: `Repo.excluirBranch(estado, nome, forcar)` (Task 1).
- Produces: ação `"excluirBranch"` com parâmetros `{ nome: string, forcar: boolean }`, despachada pelo mesmo `executar(nomeAcao, p)` das outras cinco.

**Contexto:** o fluxo é sempre o mesmo — o clique chama `aoExecutar(nome, params)`, `main.js` chama a função de `repo.js`, e se der certo empilha o estado para o Desfazer, salva, limpa os campos e redesenha. Erro nenhum usa `alert()`: cada bloco tem um `<p class="erro">` próprio, escolhido pelo `MAPA_ERRO`. **Nenhum CSS novo é necessário** — `.acao`, `.checkbox`, `.botao` e `.erro` já existem em `styles.css` e são exatamente os do bloco "+ Branch".

- [ ] **Step 1: Acrescentar o bloco no HTML**

Em `index.html`, entre o `.acao` que termina com `<p class="erro" id="erro-merge"></p></div>` e o que começa com `<label for="sel-reset">`:

```html
      <div class="acao">
        <label for="sel-excluir">Apagar branch</label>
        <select id="sel-excluir"></select>
        <label class="checkbox"><input id="forcar-exclusao" type="checkbox"> Forçar (-D)</label>
        <button id="btn-excluir" class="botao">Apagar</button>
        <p class="erro" id="erro-excluir"></p>
      </div>
```

A posição segue o ciclo de vida de uma branch, que é a ordem em que o painel já está: nasce, muda-se pra ela, volta pra casa, morre. O Reset continua por último porque não é sobre branch, é sobre commit.

- [ ] **Step 2: Ligar o botão em `ui.js`**

Em `montar`, depois do listener de `btn-merge`:

```js
    pegar("btn-excluir").addEventListener("click", function () {
      aoExecutar("excluirBranch", {
        nome: pegar("sel-excluir").value,
        forcar: pegar("forcar-exclusao").checked
      });
    });
```

- [ ] **Step 3: Desmarcar a caixa depois de apagar**

Em `limparCampos`, no fim da função:

```js
    // Desmarca depois de um apagar bem-sucedido (limparCampos só roda quando dá
    // certo). Deixar a caixa armada faria o PRÓXIMO delete abandonar commits em
    // silêncio, sem a recusa que é justamente o ponto da lição.
    if (nomeAcao === "excluirBranch") pegar("forcar-exclusao").checked = false;
```

- [ ] **Step 4: Registrar o campo de erro**

Em `ui.js`, na lista de `limparErros` e no `MAPA_ERRO`:

```js
  function limparErros() {
    ["commit", "branch", "checkout", "merge", "excluir", "reset"].forEach(function (n) {
      pegar("erro-" + n).textContent = "";
    });
    pegar("avisos").innerHTML = "";
  }

  var MAPA_ERRO = {
    commit: "erro-commit",
    criarBranch: "erro-branch",
    checkout: "erro-checkout",
    merge: "erro-merge",
    excluirBranch: "erro-excluir",
    reset: "erro-reset",
    editarDev: "erro-branch"
  };
```

- [ ] **Step 5: Preencher o dropdown**

Em `pintarDropdowns`, depois do `preencher` do `sel-merge`:

```js
    preencher(pegar("sel-excluir"), estado.branches
      .filter(function (b) { return b.nome !== atual; })
      .map(function (b) { return { valor: b.nome, rotulo: b.nome }; }),
      "só existe a branch atual");
```

- [ ] **Step 6: Fazer o botão seguir o select**

Em `atualizar`, na lista que desabilita botão junto com o select:

```js
    ["checkout", "merge", "excluir", "reset"].forEach(function (n) {
      pegar("btn-" + n).disabled = pegar("sel-" + n).disabled;
    });
```

- [ ] **Step 7: Despachar a ação em `main.js`**

Em `executar`, depois da linha do `merge`:

```js
    if (nomeAcao === "excluirBranch") return aplicar(nomeAcao, Repo.excluirBranch(estado, p.nome, p.forcar));
```

- [ ] **Step 8: Rodar os testes**

Run: `node testes.js`
Expected: PASS. `ui.js` está na suíte por causa de `clampLargura`; isto confirma que as edições não quebraram o carregamento do módulo no Node.

- [ ] **Step 9: Verificar no navegador**

Abra `index.html` (**a pasta, não `branches-na-pratica.html`** — o arquivo único ainda não foi regerado) e clique em `Reiniciar` para começar limpo. Depois:

1. Dois commits na master. Criar a branch `feature` com dono `Ana 👩` e "já mudar pra ela" marcado. Um commit nela. `Checkout` de volta para `master`.
2. Em **Apagar branch**, escolher `feature` e clicar **Apagar**, com a caixa desmarcada.
   Expected: erro em vermelho no bloco — *"A branch feature não foi mesclada em master. Marque "Forçar (-D)"…"*. O grafo não muda e o histórico **não** ganha linha nova.
3. Marcar **Forçar (-D)** e clicar **Apagar**.
   Expected: a pílula `feature` some do grafo; o commit dela desce para a faixa cinza *commits abandonados*; o histórico ganha `git branch -D feature`; a caixa Forçar volta desmarcada sozinha; a linha da Ana some do painel Equipe, mas o emoji dela continua no commit abandonado.
4. Clicar **↶ Desfazer**.
   Expected: a branch, a pílula e a linha da Ana voltam.
5. Agora `Merge` da `feature` na `master`, e então **Apagar** a `feature` com a caixa desmarcada.
   Expected: a pílula some, os commits da feature **continuam coloridos** (não cinza), a faixa passa a se chamar `feature (apagada)`, e o histórico ganha `git branch -d feature`.
6. Com só a `master` restando: o dropdown mostra *"só existe a branch atual"* e o botão **Apagar** fica desabilitado.

- [ ] **Step 10: Commit**

```bash
git add index.html ui.js main.js
git commit -m "Bloco Apagar branch no painel Acoes"
```

---

## Task 6: README e arquivo único

Fecha o trabalho: documenta a operação para o professor e regenera o artefato derivado.

**Files:**
- Modify: `README.md:17-24` (uma linha na tabela) e a área logo abaixo dela (uma frase)
- Modify: `branches-na-pratica.html` (gerado, nunca editado à mão)

**Interfaces:**
- Consumes: tudo das tasks anteriores.
- Produces: nada em código.

- [ ] **Step 1: Acrescentar a linha na tabela do README**

Em `README.md`, na tabela de botões, entre a linha do Merge e a do Reset:

```markdown
| Merge | `git merge nome` |
| Apagar | `git branch -d nome` ou `git branch -D nome` |
| Reset | `git reset --hard <sha>` |
```

- [ ] **Step 2: Explicar o `-D` em uma frase**

Em `README.md`, logo depois da frase *"Todo comando executado aparece numerado no painel da direita."*, acrescente um parágrafo:

```markdown
Não dá para apagar a branch em que você está. Se a branch tiver commits que
mais ninguém alcança, é preciso marcar `Forçar (-D)` — e aí eles vão para a
faixa de commits abandonados, em cinza, em vez de sumir da tela.
```

Não mexa em mais nada do README: a frase sobre o app não simular conflitos nem ter push/pull continua verdadeira.

- [ ] **Step 3: Rodar a suíte inteira**

Run: `node testes.js`
Expected: PASS em todos os casos.

- [ ] **Step 4: Regenerar o arquivo único**

Run: `node gerar-arquivo-unico.js`
Expected: `branches-na-pratica.html gerado (NN KB)`. Este trabalho mexeu em `index.html`, `repo.js`, `layout.js`, `storage.js`, `ui.js` e `main.js` — todos embutidos nele.

- [ ] **Step 5: Conferir que o arquivo único recebeu a feature**

Run: `node -e "var h=require('fs').readFileSync('branches-na-pratica.html','utf8'); console.log(h.indexOf('excluirBranch') !== -1, h.indexOf('sel-excluir') !== -1);"`
Expected: `true true` — o JS entrou e o HTML entrou.

Só aspas simples dentro das duplas, de propósito: assim a linha roda igual no
PowerShell e no Git Bash. Não é preciso checar se sobrou referência externa —
`gerar-arquivo-unico.js` já falha com erro e código 1 se sobrar.

- [ ] **Step 6: Abrir o arquivo único e apagar uma branch**

Abra `branches-na-pratica.html` com duplo clique, faça um commit, crie uma branch, volte para a master e apague-a marcando Forçar. Expected: funciona igual à pasta. Este é o arquivo que vai para os alunos.

- [ ] **Step 7: Commit**

```bash
git add README.md branches-na-pratica.html
git commit -m "Documenta o apagar branch e regenera o arquivo unico"
```

---

## Verificação final

- [ ] `node testes.js` — todos passam
- [ ] `testes.html` aberto no navegador — mesmo resultado, sem erro no console
- [ ] `git status` limpo, sem arquivo novo não rastreado
- [ ] `index.html` e `branches-na-pratica.html` se comportam igual ao apagar uma branch

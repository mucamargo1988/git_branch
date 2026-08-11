# Barras laterais redimensionáveis — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir arrastar as bordas das duas barras laterais para redimensioná-las, garantindo por aritmética que a coluna do meio (o grafo) é sempre a maior.

**Architecture:** `.colunas` vira um grid de 5 colunas — `var(--col-esq) 8px 1fr 8px var(--col-dir)` — com dois `<div class="divisoria">` como células reais. O arraste usa eventos de ponteiro com `setPointerCapture` e só reescreve as duas variáveis CSS. Cada barra é limitada a `[220px, 30% da janela]`, o que deixa o miolo com no mínimo ~40% da largura. O arraste dispara um callback leve em `main.js` que reaplica só a escala do SVG.

**Tech Stack:** HTML + CSS + JavaScript ES5 puro. Sem build, sem dependências, sem CDN. Testes com o `MiniTeste` da casa, rodando em `node testes.js` e em `testes.html`.

## Global Constraints

- **ES5 apenas.** Nada de `let`, `const`, arrow functions, template literals ou `class`. Todo o código existente usa `var` e `function`; siga.
- **Zero dependências.** Nenhum pacote npm, nenhuma tag de CDN. O app roda com duplo clique em `index.html`, offline.
- **Cada módulo é uma IIFE** no formato `(function (raiz) { "use strict"; ... raiz.Nome = {...}; })(typeof globalThis !== "undefined" ? globalThis : this);`
- **Código e comentários em português.** Comentários explicam *por quê*, não *o quê* — veja o estilo em `main.js:24` e `ui.js:200`.
- **Larguras padrão:** esquerda `300px`, direita `320px`.
- **Limites:** teto de `30%` da largura da janela; piso de `220px`, que **cede para o teto** quando a janela não o comporta (abaixo de ~733px). Passo de teclado `16px`, divisória com `8px`.
- **`branches-na-pratica.html` é artefato derivado versionado.** Depois de qualquer mudança em `index.html`, `styles.css`, `ui.js` ou `main.js`, rode `node gerar-arquivo-unico.js` e comite o resultado junto.
- **Sem persistência.** As larguras voltam a 300/320 a cada abertura da página. Não escreva nada em `localStorage`.

---

## Task 1: `clampLargura` — a função que garante o miolo maior

O coração da feature é uma função pura. Ela entra primeiro, com testes, antes de qualquer HTML ou CSS.

**Files:**
- Modify: `ui.js` (adicionar constantes + `clampLargura`, exportar em `raiz.UI`)
- Modify: `testes.js:1-5` (adicionar `require("./ui.js")`)
- Modify: `testes.html:27` (adicionar `<script src="ui.js"></script>` antes de `testes.js`)
- Test: `testes.js` (nova seção no fim, antes do "executor no Node")

**Interfaces:**
- Consumes: nada.
- Produces: `UI.clampLargura(desejada, larguraJanela)` → `number`. Recebe a largura pretendida em px e a largura da janela em px; devolve a largura permitida em px. Usada pela Task 3 (arraste, teclado, duplo clique).

**Contexto para quem nunca viu este projeto:** `ui.js` é uma IIFE que expõe um objeto `UI`. Ela usa `document` dentro das funções, mas nunca no corpo da IIFE — por isso carrega no Node sem erro. Já foi verificado: `node -e "require('./ui.js')"` funciona. Isso é o que permite testar `clampLargura` no mesmo runner das funções puras.

- [ ] **Step 1: Ligar `ui.js` ao runner de testes**

Em `testes.js`, no bloco do topo:

```js
if (typeof require !== "undefined") {
  require("./mini-teste.js");
  require("./repo.js");
  require("./layout.js");
  require("./ui.js");
}
```

Em `testes.html`, na lista de scripts perto do fim do `<body>`, entre `layout.js` e `testes.js`:

```html
  <script src="mini-teste.js"></script>
  <script src="repo.js"></script>
  <script src="layout.js"></script>
  <script src="ui.js"></script>
  <script src="testes.js"></script>
```

- [ ] **Step 2: Escrever os testes que falham**

No fim de `testes.js`, **antes** do bloco `// ---------- executor no Node ----------`:

```js
// ---------- ui.js: largura das barras laterais ----------

teste("clampLargura deixa passar um valor no meio da faixa", function () {
  igual(UI.clampLargura(300, 1920), 300, "1920px de janela dá teto de 576px");
});

teste("clampLargura sobe qualquer valor abaixo do piso de 220", function () {
  igual(UI.clampLargura(150, 1920), 220);
  igual(UI.clampLargura(0, 1920), 220);
  igual(UI.clampLargura(-500, 1920), 220, "arrastar para fora da tela não vira negativo");
});

teste("clampLargura desce qualquer valor acima de 30% da janela", function () {
  igual(UI.clampLargura(900, 1000), 300, "30% de 1000 é 300");
  igual(UI.clampLargura(1e9, 1000), 300, "arrastar para o infinito trava no teto");
});

teste("clampLargura: em tela estreita o piso cede junto com o teto", function () {
  // 30% de 700 é 210, abaixo dos 220 nominais. O piso acompanha em vez de travar,
  // senão as duas barras somariam 440 e sufocariam o miolo.
  igual(UI.clampLargura(400, 700), 210, "trava no teto de 30%");
  igual(UI.clampLargura(100, 700), 210, "o piso cedeu para 210");
  igual(UI.clampLargura(150, 600), 180, "30% de 600");
});

teste("clampLargura nunca devolve NaN", function () {
  igual(UI.clampLargura(NaN, 1920), 220);
  igual(UI.clampLargura(undefined, 1920), 220);
  igual(UI.clampLargura(Infinity, 1920), 220);
  igual(UI.clampLargura("300", 1920), 220, "string não conta como número");
  igual(UI.clampLargura(300, NaN), 220, "janela invalida nao propaga NaN");
  igual(UI.clampLargura(300, undefined), 220, "janela ausente nao propaga NaN");
});

teste("clampLargura garante o miolo maior que qualquer barra, em toda largura", function () {
  // A propriedade que a feature inteira existe para preservar. A lista cruza os
  // DOIS regimes: acima de ~733px manda o teto de 30%; abaixo, o piso cede e as
  // barras encolhem junto. Sem as janelas estreitas aqui, o teste passaria mesmo
  // com o piso inteiramente quebrado.
  [400, 500, 600, 700, 733, 800, 1000, 1280, 1366, 1920, 2560, 3840].forEach(function (janela) {
    var esq = UI.clampLargura(1e9, janela);
    var dir = UI.clampLargura(1e9, janela);
    var miolo = janela - esq - dir - 16;
    verdade(miolo > esq, "janela " + janela + ": miolo " + miolo + " deve superar " + esq);
    verdade(miolo > dir, "janela " + janela + ": miolo " + miolo + " deve superar " + dir);
  });
});
```

- [ ] **Step 3: Rodar os testes e confirmar que falham**

```bash
node testes.js
```

Esperado: as 6 novas linhas aparecem como `FALHA` com `UI.clampLargura is not a function`. Todos os testes antigos continuam `ok`.

- [ ] **Step 4: Implementar `clampLargura`**

Em `ui.js`, logo depois de `"use strict";` e da declaração `var acaoAoExecutar = null;`:

```js
  // Cada barra lateral se limita SOZINHA a no máximo 30% da janela. Como as duas
  // juntas nunca passam de 60%, o miolo fica com ~40% e é sempre a maior coluna em
  // qualquer janela acima de 160px — aritmética, sem comparar uma barra com a outra.
  var LARGURA_MINIMA = 220;   // abaixo disto o campo de nome + emoji do painel Ações aperta
  var FRACAO_MAXIMA = 0.30;

  function clampLargura(desejada, larguraJanela) {
    // Sem uma janela válida não há teto a calcular.
    if (typeof larguraJanela !== "number" || !isFinite(larguraJanela)) return LARGURA_MINIMA;
    var teto = larguraJanela * FRACAO_MAXIMA;
    // O piso CEDE quando a janela é estreita demais para bancá-lo. Travar as duas
    // barras em 220px numa janela de 600px deixaria o miolo com 144px — menor que
    // elas, quebrando a única promessa da feature. Cedendo junto, as duas ficam em
    // 30% e o miolo continua com ~40%.
    var piso = Math.min(LARGURA_MINIMA, teto);
    if (typeof desejada !== "number" || !isFinite(desejada)) return piso;
    return Math.max(piso, Math.min(desejada, teto));
  }
```

E no objeto exportado no fim do arquivo:

```js
  raiz.UI = {
    montar: montar,
    atualizar: atualizar,
    limparCampos: limparCampos,
    limparErros: limparErros,
    mostrarErro: mostrarErro,
    mostrarAviso: mostrarAviso,
    clampLargura: clampLargura
  };
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

```bash
node testes.js
```

Esperado: `PASS` em tudo, e a última linha mostra 6 testes a mais do que antes.

- [ ] **Step 6: Commit**

```bash
git add ui.js testes.js testes.html
git commit -m "Adiciona clampLargura, o limite que mantem o miolo maior"
```

---

## Task 2: As divisórias na tela (HTML + CSS)

Estrutura visual, sem nenhum comportamento ainda. Ao fim desta task as divisórias aparecem e mostram o cursor `col-resize`, mas arrastar não faz nada.

**Files:**
- Modify: `index.html:20-87` (dois `<div class="divisoria">` dentro de `.colunas`)
- Modify: `styles.css:57-70` (grid de 5 colunas, regras `.divisoria`, bordas migradas)

**Interfaces:**
- Consumes: nada.
- Produces: dois elementos com `id="divisoria-esq"` e `id="divisoria-dir"`; o elemento `.colunas` carregando as variáveis CSS `--col-esq` e `--col-dir`. A Task 3 depende desses três nomes exatos.

- [ ] **Step 1: Inserir as divisórias no HTML**

Em `index.html`, dentro de `<main class="colunas">`: uma divisória entre `</aside>` (coluna esquerda) e `<section class="coluna-centro">`, outra entre `</section>` e `<aside class="coluna-direita">`.

```html
  <div class="divisoria" id="divisoria-esq"
       role="separator" aria-orientation="vertical" tabindex="0"
       aria-label="Ajustar largura do painel da esquerda"></div>

  <section class="coluna-centro">
    <div id="avisos"></div>
    <div class="area-grafo">
      <p id="dica-vazio">Repositório vazio — clique em <strong>+ Commit</strong> para começar.</p>
      <svg id="grafo" xmlns="http://www.w3.org/2000/svg"></svg>
    </div>
  </section>

  <div class="divisoria" id="divisoria-dir"
       role="separator" aria-orientation="vertical" tabindex="0"
       aria-label="Ajustar largura do painel da direita"></div>
```

`tabindex="0"` é o que põe a divisória na ordem de Tab; sem ele o ajuste por teclado da Task 3 é inalcançável.

- [ ] **Step 2: Trocar o grid de 3 para 5 colunas**

Em `styles.css`, substituir o bloco `.colunas` e as duas linhas de borda:

```css
.colunas {
  --col-esq: 300px;
  --col-dir: 320px;
  display: grid;
  grid-template-columns: var(--col-esq) 8px 1fr 8px var(--col-dir);
  flex: 1 1 auto;
  min-height: 0;
}
```

As variáveis ficam declaradas aqui, e não só como fallback dentro do `var()`, para que `getComputedStyle` sempre devolva um valor legível na Task 3.

Depois, remover as duas regras de borda que existem hoje:

```css
.coluna-esquerda { border-right: 2px solid var(--borda); }
.coluna-direita { border-left: 2px solid var(--borda); }
```

Elas somem porque a divisória passa a ser a linha divisória. Mantidas, ficariam duas linhas paralelas coladas.

- [ ] **Step 3: Estilizar a divisória**

Ainda em `styles.css`, logo depois do bloco `.coluna-centro`:

```css
/* ---------- divisórias ---------- */

.divisoria {
  background: var(--borda);
  cursor: col-resize;
  /* Sem isto o navegador trata o arraste como rolagem da página e o gesto
     nunca chega ao JS — quebra em lousa digital e em tela sensível ao toque. */
  touch-action: none;
}
.divisoria:hover, .divisoria.arrastando { background: var(--destaque); }
/* Uma faixa de 8px sem foco visível é impossível de operar por teclado.
   outline-offset negativo mantém o traço dentro da faixa em vez de invadir
   os painéis vizinhos. */
.divisoria:focus-visible { outline: 2px solid var(--destaque); outline-offset: -2px; }

/* Durante o arraste o cursor precisa valer para a página inteira: preso só à
   divisória, ele voltaria a ser seta assim que o ponteiro passasse por cima do
   grafo, no meio do próprio gesto. user-select impede que o arraste vá
   selecionando o texto dos painéis pelo caminho. */
body.redimensionando { cursor: col-resize; user-select: none; }
```

- [ ] **Step 4: Conferir no navegador**

Abrir `index.html`. Esperado: duas faixas verticais finas separando as colunas, azuis ao passar o mouse, com cursor de seta dupla horizontal. O layout continua em 300/1fr/320 e o grafo desenha normalmente. Arrastar ainda não faz nada — é o esperado nesta task.

- [ ] **Step 5: Commit**

```bash
git add index.html styles.css
git commit -m "Desenha as divisorias entre as colunas"
```

---

## Task 3: O arraste, o teclado e o reset

O comportamento. Ao fim desta task a feature funciona de ponta a ponta.

**Files:**
- Modify: `ui.js` (adicionar `montarDivisorias` e exportá-la)
- Modify: `main.js:15-42` (guardar as dimensões, criar `reajustar`), `main.js:92-100` (chamar no `iniciar`)

**Interfaces:**
- Consumes: `UI.clampLargura(desejada, larguraJanela)` da Task 1; os ids `divisoria-esq` / `divisoria-dir` e as variáveis `--col-esq` / `--col-dir` da Task 2.
- Produces: `UI.montarDivisorias(aoRedimensionar)` → `undefined`. Recebe uma função sem argumentos, chamada no máximo uma vez por quadro sempre que uma largura mudar.

**Contexto de por que existe um callback:** o zoom do grafo é calculado a partir da largura da coluna do meio — `ajustarZoom` em `main.js:18` lê `area.clientWidth`. Hoje isso só é refeito no `resize` da **janela** (`main.js:98`) e nas ações do professor. Arrastar uma divisória muda a largura da coluna sem disparar `resize` nenhum, então sem este callback o SVG ficaria na escala antiga até a próxima ação.

O callback é `reajustar`, e não `redesenhar`, de propósito: `Layout.calcular` depende só do estado do repositório, nunca do tamanho da tela, então nada além da escala precisa ser refeito. Rodar `redesenhar` a 60fps reconstruiria o SVG inteiro e repintaria Equipe e Histórico a cada quadro — caro à toa, e destruiria o editor inline de nome de dev (`ui.js:151`) se ele estivesse aberto durante o arraste.

- [ ] **Step 1: Criar o callback leve em `main.js`**

Guardar as dimensões do último desenho numa variável de módulo. Junto de `var ultimoCommitVisto = null;`:

```js
  var ultimasDims = null;
```

E em `redesenhar`, capturar o retorno de `Graph.desenhar` (que é `{ largura, altura }`) em vez de passá-lo direto:

```js
  function redesenhar() {
    UI.atualizar(estado);
    var commitAtual = commitMaisRecente(estado);
    var mudouCommit = commitAtual !== ultimoCommitVisto;
    ultimasDims = Graph.desenhar(Layout.calcular(estado));
    ajustarZoom(ultimasDims, mudouCommit);
    ultimoCommitVisto = commitAtual;
    document.getElementById("btn-desfazer").disabled = !Storage.podeDesfazer();
  }

  // Arrastar uma divisória muda a largura da coluna do meio sem disparar resize
  // nenhum. Só a ESCALA precisa ser refeita: Layout.calcular depende do estado
  // do repositório, não do tamanho da tela. Nunca rola a vista — arrastar não é
  // uma ação nova do professor.
  function reajustar() {
    if (ultimasDims) ajustarZoom(ultimasDims, false);
  }
```

- [ ] **Step 2: Escrever `montarDivisorias` em `ui.js`**

Depois da função `montar`, e antes de `limparCampos`:

```js
  var PADRAO_ESQ = 300;
  var PADRAO_DIR = 320;
  var PASSO_TECLADO = 16;

  function configurarDivisoria(alca, variavel, padrao, ehEsquerda, colunas, aoRedimensionar) {
    var pendente = false;
    var deslocamento = 0;

    // Distância do cursor até a borda externa da janela do lado desta barra.
    function larguraCrua(clientX) {
      var caixa = colunas.getBoundingClientRect();
      return ehEsquerda ? clientX - caixa.left : caixa.right - clientX;
    }

    function larguraAtual() {
      var valor = parseFloat(getComputedStyle(colunas).getPropertyValue(variavel));
      return isFinite(valor) ? valor : padrao;
    }

    function aplicar(desejada) {
      colunas.style.setProperty(variavel, clampLargura(desejada, window.innerWidth) + "px");
      // Um arraste dispara dezenas de pointermove por segundo. Uma vez por
      // quadro basta para o grafo parecer colado na divisória.
      if (pendente) return;
      pendente = true;
      requestAnimationFrame(function () {
        pendente = false;
        aoRedimensionar();
      });
    }

    alca.addEventListener("pointerdown", function (ev) {
      ev.preventDefault();
      // Sem captura, um arraste rápido tira o cursor da faixa de 8px antes do
      // próximo evento e o gesto "escapa" no meio do caminho.
      alca.setPointerCapture(ev.pointerId);
      alca.classList.add("arrastando");
      document.body.classList.add("redimensionando");
      // Guarda onde dentro da faixa o professor pegou, para a borda não pular
      // até o cursor no primeiro pixel de movimento.
      deslocamento = larguraAtual() - larguraCrua(ev.clientX);
    });

    alca.addEventListener("pointermove", function (ev) {
      if (!alca.hasPointerCapture(ev.pointerId)) return;
      aplicar(larguraCrua(ev.clientX) + deslocamento);
    });

    function soltar(ev) {
      if (alca.hasPointerCapture(ev.pointerId)) alca.releasePointerCapture(ev.pointerId);
      alca.classList.remove("arrastando");
      document.body.classList.remove("redimensionando");
    }
    alca.addEventListener("pointerup", soltar);
    alca.addEventListener("pointercancel", soltar);

    alca.addEventListener("dblclick", function () { aplicar(padrao); });

    alca.addEventListener("keydown", function (ev) {
      // Na barra da direita, mover a divisória para a direita ESTREITA a barra.
      // O sinal invertido é o que faz a seta concordar com o que se vê.
      var passo = ehEsquerda ? PASSO_TECLADO : -PASSO_TECLADO;
      if (ev.key === "ArrowRight") aplicar(larguraAtual() + passo);
      else if (ev.key === "ArrowLeft") aplicar(larguraAtual() - passo);
      else if (ev.key === "Home") aplicar(0);                    // clampLargura leva ao mínimo
      else if (ev.key === "End") aplicar(window.innerWidth);     // clampLargura leva ao máximo
      else return;
      ev.preventDefault();
    });

    // Devolve um jeito de reaplicar o limite sobre a largura atual, sem mexer nela
    // de propósito. Quem chama: a abertura da página e o resize da janela.
    return function () { aplicar(larguraAtual()); };
  }

  function montarDivisorias(aoRedimensionar) {
    var colunas = document.querySelector(".colunas");
    var reancorarEsq = configurarDivisoria(pegar("divisoria-esq"), "--col-esq", PADRAO_ESQ, true, colunas, aoRedimensionar);
    var reancorarDir = configurarDivisoria(pegar("divisoria-dir"), "--col-dir", PADRAO_DIR, false, colunas, aoRedimensionar);

    // As larguras padrão não passam pelo clamp sozinhas. Numa janela de 800px,
    // 300 + 320 + 16 deixa o miolo com 164px — menor que as duas barras, logo na
    // abertura e antes de qualquer arraste. O mesmo vale quando o professor
    // estreita a janela depois: o valor em px guardado continua sendo o antigo.
    // Sem estas duas chamadas a promessa da feature só passa a valer depois do
    // primeiro arraste.
    function reancorar() { reancorarEsq(); reancorarDir(); }
    reancorar();
    window.addEventListener("resize", reancorar);
  }
```

Este listener de `resize` convive com o que já existe em `main.js:98`. A ordem é a de registro, e `montarDivisorias` é chamada antes — então a largura já está corrigida quando `redesenhar` lê `clientWidth`. Mesmo fora de ordem o resultado se corrige sozinho, porque `aplicar` agenda `aoRedimensionar` no quadro seguinte.

E acrescentar ao objeto exportado:

```js
    clampLargura: clampLargura,
    montarDivisorias: montarDivisorias
```

- [ ] **Step 3: Ligar tudo em `iniciar`**

Em `main.js`, dentro de `iniciar()`, depois de `UI.montar(executar);`:

```js
    UI.montarDivisorias(reajustar);
```

- [ ] **Step 4: Confirmar que os testes antigos não quebraram**

```bash
node testes.js
```

Esperado: tudo `ok`. `montarDivisorias` só toca no DOM quando chamada, então `require("./ui.js")` continua carregando no Node.

- [ ] **Step 5: Verificar o comportamento no navegador**

Abrir `index.html`, criar dois ou três commits e uma branch para o grafo ter conteúdo, e conferir:

1. Arrastar a divisória esquerda para a direita alarga o painel Equipe/Ações; a borda acompanha o cursor sem pular no primeiro movimento.
2. Durante o arraste o grafo reescala junto, em tempo real — não só ao soltar.
3. Arrastando bem para a direita, a barra trava em 30% da janela; o miolo continua visivelmente o maior.
4. Arrastando bem para a esquerda, trava em 220px e os campos do painel Ações continuam legíveis.
5. Nada de texto sendo selecionado pelo caminho durante o arraste.
6. Duplo clique na divisória esquerda devolve os 300px sem mexer na direita.
7. `Tab` até a divisória mostra o contorno azul; `ArrowRight`/`ArrowLeft` movem 16px; `Home` vai ao mínimo, `End` ao máximo.
8. Na divisória direita, `ArrowRight` **estreita** a barra da direita.

- [ ] **Step 6: Commit**

```bash
git add ui.js main.js
git commit -m "Torna as barras laterais arrastaveis, com teclado e reset"
```

---

## Task 4: Barra de rolagem discreta

Pedido do usuário durante a execução. Entra antes da regeneração do arquivo único, senão ele teria que ser regerado duas vezes.

**Files:**
- Modify: `styles.css` (novo bloco no fim, depois de `.divisoria`)

**Interfaces:**
- Consumes: as variáveis de cor já existentes em `:root` (`--borda`, `--texto-apagado`).
- Produces: nada de código. Nenhuma outra task depende desta.

**Contexto:** três áreas rolam no app — `.coluna-esquerda`, `.coluna-direita` (ambas `overflow-y: auto`) e `.area-grafo` (`overflow: auto`, e a única que rola nos dois eixos). Hoje as três usam a barra padrão do sistema: larga e clara, e num projetor ela puxa atenção que devia ir para o grafo.

A escolha aqui é ser discreta **sem** desaparecer: uma barra invisível até o hover esconderia do professor que o painel rola. Fina, trilha transparente, polegar na cor da borda — e mais contraste só quando o cursor chega perto.

- [ ] **Step 1: Escrever o bloco de estilo**

No fim de `styles.css`, **antes** do bloco `@media (prefers-reduced-motion: reduce)`:

```css
/* ---------- barras de rolagem ---------- */

/* Discretas de propósito: num projetor, uma barra larga e clara rouba atenção do
   grafo, que é o objeto da aula. Fina, sem trilha visível, e com contraste maior
   só quando o cursor chega perto. Discreta, não invisível — sumir por completo
   esconderia do professor que o painel rola. */
.coluna-esquerda, .coluna-direita, .area-grafo {
  scrollbar-width: thin;
  scrollbar-color: var(--borda) transparent;
}

/* As duas de cima só valem em Firefox e Chrome recente. Sem este bloco, Safari e
   Chrome mais antigo continuariam com a barra cinza-clara do sistema — que é
   exatamente o que queremos evitar. */
.coluna-esquerda::-webkit-scrollbar,
.coluna-direita::-webkit-scrollbar,
.area-grafo::-webkit-scrollbar { width: 9px; height: 9px; }

.coluna-esquerda::-webkit-scrollbar-track,
.coluna-direita::-webkit-scrollbar-track,
.area-grafo::-webkit-scrollbar-track { background: transparent; }

.coluna-esquerda::-webkit-scrollbar-thumb,
.coluna-direita::-webkit-scrollbar-thumb,
.area-grafo::-webkit-scrollbar-thumb {
  background: var(--borda);
  border-radius: 6px;
}

.coluna-esquerda::-webkit-scrollbar-thumb:hover,
.coluna-direita::-webkit-scrollbar-thumb:hover,
.area-grafo::-webkit-scrollbar-thumb:hover { background: var(--texto-apagado); }

/* O quadradinho onde as barras horizontal e vertical se encontram, só na área do
   grafo. Sem isto ele fica com o cinza padrão e denuncia a barra que acabamos de
   discretizar. */
.area-grafo::-webkit-scrollbar-corner { background: transparent; }
```

- [ ] **Step 2: Conferir no navegador**

`http://localhost:8321/index.html` (`file://` está bloqueado no navegador controlado). Criar commits suficientes para o grafo estourar a área e as barras aparecerem, e conferir nas três áreas: barra fina, trilha invisível, polegar discreto mas achável, e o canto da área do grafo sem o quadrado cinza.

Confirmar também que `.area-grafo` continua rolando de fato — trilha transparente não pode virar "não rola".

**Não afirme nada sobre os valores do bloco `::-webkit-scrollbar`.** No Chromium, ter `scrollbar-width`/`scrollbar-color` definidos faz o bloco webkit ser ignorado — comportamento documentado, e é o desenhado: as propriedades padrão entregam a barra fina, e o bloco webkit é só o fallback para motores antigos. Uma asserção nos 9px ou em qualquer estilo computado de `::-webkit-scrollbar` falharia por artefato do ambiente, não por defeito. Verifique pelo valor computado de `scrollbar-width` e pelo olho: fina, trilha invisível, polegar achável.

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "Deixa as barras de rolagem discretas"
```

---

## Task 5: Verificação automatizada e arquivo único

**Files:**
- Modify: `README.md` (uma linha sobre o ajuste das barras)
- Regenerate: `branches-na-pratica.html`

**Interfaces:**
- Consumes: a feature completa das Tasks 1-4.
- Produces: nada de código.

- [x] **Step 1: Verificar o arraste com Playwright — JÁ EXECUTADO pelo controlador**

Este step está feito. O controlador rodou as checagens no navegador com injeção real de ponteiro (`page.mouse`), sobre a versão em pasta, e obteve:

| Checagem | Resultado |
|---|---|
| Arraste, janela 1280 | esquerda 300 → 384px; miolo 644 → 560px |
| `reajustar` correu | `transform` do `#grafo` foi de `scale(1)` a `scale(0.88061)` |
| Trava no teto | 384px, exatamente 30% de 1280 |
| Miolo continua o maior | 560 > 384 e > 320 |
| `body.redimensionando` | `true` durante o arraste, `false` depois |
| Duplo clique | volta a 300px e `scale(1)`, sem mexer na direita |
| Teclado, esquerda | 300 → 284 → 300; `Home` → 220; `End` → 384 |
| Teclado, direita | 320 → 304 (`ArrowRight` estreita, sinal correto) |
| Reancoragem, abertura 800px | 240/304/240 — sem ela seria 300/**164**/320 |
| Reancoragem, abertura 600px | 180/224/180 — o piso cedeu |
| Reancoragem, resize 1600→700 | 300/320 vira 210/210, miolo 264 |

Piso de 220px conferido a olho por screenshot: o painel Ações segue legível, `.dupla` não quebra (nome 104px + emoji 68px na mesma linha).

**Não repita estas checagens na versão em pasta.** O que falta verificar é o **arquivo único** — Step 4 — que é o artefato que vai para os alunos e o único estado ainda não exercitado.

As duas restrições do ambiente abaixo valem para o Step 4. Respeite as duas ou o teste falha por artefato, não por defeito do código:

1. **`file://` está bloqueado no navegador controlado.** Use o servidor estático local em `http://localhost:8321` (o script está em `scratchpad/servidor.js`; ele serve a pasta do projeto, inclusive `branches-na-pratica.html`).

2. **Não dispare `PointerEvent` sintético via `evaluate`.** O handler chama `setPointerCapture(ev.pointerId)`, e um `pointerId` de evento fabricado não corresponde a um ponteiro ativo: o navegador lança `NotFoundError`, o handler morre antes de aplicar a classe `arrastando`, e o arraste parece quebrado com o código correto. Use injeção real de input — `page.mouse.move` / `mouse.down` / `mouse.move({steps})` / `mouse.up` — que cria um ponteiro de verdade e faz a captura funcionar.

Antes de arrastar, criar dois ou três commits e uma branch pelos botões do app, para o grafo ter conteúdo — com o repositório vazio o SVG não tem escala a mudar e a checagem do `reajustar` não prova nada.

As três checagens a automatizar:

1. **Arraste normal.** Arrastar a divisória esquerda ~200px para a direita: a coluna esquerda cresce, a do meio encolhe, e a soma continua fechando com a largura da janela.
2. **`reajustar` correu.** O `transform` do `#grafo` mudou entre antes e depois do arraste. Esta é a prova de que o SVG não ficou na escala antiga — o defeito que o callback existe para evitar.
3. **A promessa, no extremo.** Arrastar a divisória esquerda ~2000px para a direita (bem além do limite): a coluna esquerda trava em 30% da janela, e a do meio continua sendo a maior das três. Repetir para a divisória direita.

Medição, rodada antes e depois de cada arraste:

```js
(function () {
  function larg(sel) { return document.querySelector(sel).getBoundingClientRect().width; }
  return {
    esq: larg(".coluna-esquerda"),
    centro: larg(".coluna-centro"),
    dir: larg(".coluna-direita"),
    escala: document.getElementById("grafo").style.transform
  };
})()
```

Arrastar com os passos de ponteiro do Playwright (`mouse.move` → `mouse.down` → `mouse.move` → `mouse.up`), não com um `drag` de um passo só: um único salto não gera os `pointermove` intermediários e não exercita o caminho real.

Asserções: depois de arrastar a divisória esquerda 200px para a direita, `esq` cresceu e `centro` encolheu; depois de arrastar 2000px para a direita, `centro > esq` e `centro > dir` continuam verdadeiros; e `escala` mudou entre as duas leituras — prova de que `reajustar` correu e o SVG não ficou na escala antiga.

- [ ] **Step 2: Documentar no README**

Na seção "O que dá para fazer", depois da tabela de botões:

```markdown
As duas barras laterais são ajustáveis: arraste a linha que separa cada uma do
grafo, ou dê Tab até ela e use as setas. Duplo clique volta à largura original.
O grafo nunca fica menor que as barras.
```

- [ ] **Step 3: Regenerar o arquivo único**

```bash
node gerar-arquivo-unico.js
```

Esperado: `branches-na-pratica.html gerado (NN KB)`. O script sai com erro se sobrar qualquer referência externa — sem saída de erro significa que ficou autocontido.

- [ ] **Step 4: Conferir que o arquivo único também funciona**

Abrir `http://localhost:8321/branches-na-pratica.html`. Este é o arquivo que vai para os alunos; ele precisa ser testado como artefato, não presumido correto. Repetir nele:

1. **Arraste normal** — arrastar a divisória esquerda alarga a coluna esquerda, e a borda acompanha o cursor sem pular no primeiro pixel.
2. **A promessa no extremo** — arrastando bem além do limite, a barra trava em 30% da janela e a coluna do meio continua a maior.
3. **Reset** — duplo clique na divisória esquerda devolve os 300px sem mexer na largura da direita.
4. **A barra de rolagem** — fina e discreta nas três áreas que rolam, como na versão em pasta.

O professor vai abri-lo por duplo clique, ou seja, em `file://` — que o navegador controlado bloqueia. O que o servidor não consegue provar é justamente isso, então confirme por leitura que o arquivo não tem nenhuma referência externa (o próprio `gerar-arquivo-unico.js` já falha se sobrar alguma) e registre no relatório que a abertura por `file://` não pôde ser exercitada aqui.

- [ ] **Step 5: Commit**

```bash
git add README.md branches-na-pratica.html
git commit -m "Regenera o arquivo unico e documenta as barras ajustaveis"
```

---

## Cobertura da spec

| Seção da spec | Onde é implementada |
|---|---|
| §1 Divisórias como células do grid | Task 2, Steps 1-3 |
| §2 Limites e o miolo sempre maior | Task 1 (função + testes) |
| §2 Caso de tela estreita | Task 1, Step 2 (teste dedicado) |
| §3 Arraste com captura de ponteiro | Task 3, Step 2 |
| §3 `touch-action` e cursor global | Task 2, Step 3 |
| §4 Grafo reagindo (`reajustar`) | Task 3, Steps 1 e 3 |
| §5 Teclado e acessibilidade | Task 2 Step 1 (atributos) + Task 3 Step 2 (teclas) |
| §6 Reset por duplo clique | Task 3, Step 2 |
| §7 Código em `ui.js` | Tasks 1 e 3 |
| Testes de unidade | Task 1, Step 2 |
| Testes de navegador | Task 5, Step 1 |
| Regenerar arquivo único | Task 5, Step 3 |

Fora da spec original, pedido durante a execução:

| Pedido | Onde |
|---|---|
| Barra de rolagem mais discreta | Task 4 |

# Design — Barras laterais redimensionáveis por arraste

**Data:** 2026-08-11
**Status:** aprovado

## Objetivo

Permitir que o professor arraste as bordas das duas barras laterais (Equipe/Ações à
esquerda, Histórico à direita) para alargá-las ou estreitá-las durante a aula, sem
que o grafo — a parte principal — deixe de ser a maior coluna da tela.

Hoje as três colunas são fixas: `grid-template-columns: 300px 1fr 320px` em
`styles.css`. Nada é ajustável.

### Por que isso importa

Projetores de sala variam muito de proporção e resolução. Numa tela 4:3 apertada, as
laterais de 620px somadas engolem o grafo; num ultrawide, sobra espaço morto nas
laterais enquanto as mensagens de commit do Histórico quebram em três linhas. Hoje o
professor não tem como corrigir isso — precisa aceitar o que a tela dele der.

## Escopo

### Dentro

- Arrastar as duas divisórias com mouse, caneta ou toque.
- Limites que garantem, por aritmética, que o miolo é sempre a maior coluna.
- Grafo reagindo ao novo espaço em tempo real durante o arraste.
- Ajuste por teclado (setas, Home/End) com foco na divisória.
- Duplo clique numa divisória para voltar ao padrão daquela barra.

### Fora (decidido explicitamente)

- **Persistência das larguras.** Decisão do usuário: toda abertura da página começa
  em 300/320. Sem `localStorage`, sem chave nova, sem migração.
- **Colapsar uma barra inteira** (largura zero). O piso de 220px é o limite; quem
  quiser o grafo enorme arrasta as duas até o mínimo.
- **Altura ajustável** ou qualquer arraste vertical.
- **Redimensionar o topo** ou a área de avisos.

## Decisões de design

### 1. Divisórias como células do grid

`.colunas` passa de três para cinco colunas:

```css
grid-template-columns: var(--col-esq, 300px) 8px 1fr 8px var(--col-dir, 320px);
```

e dois elementos `<div class="divisoria">` entram no HTML, entre as colunas. O arraste
não faz nada além de reescrever `--col-esq` e `--col-dir` no elemento `.colunas`.

Como as divisórias são células reais do grid, elas ocupam espaço próprio: nada se
sobrepõe, nada precisa de `position: absolute`, e o miolo continua sendo o `1fr` que
sobra depois das duas barras e das duas divisórias.

**Alternativas descartadas:**

- *Alças flutuantes sobre as bordas existentes* — mantém o grid de 3 colunas, mas
  exige recalcular `left`/`right` de cada alça a cada arraste e a cada resize da
  janela. Mais estado sincronizado à mão, pelo mesmo resultado visual.
- *Biblioteca de split panes (Split.js e similares)* — resolve em 5 linhas de
  configuração, mas o projeto é vanilla sem build e o `branches-na-pratica.html`
  precisa ser autocontido; a biblioteca inteira teria que ser embutida no arquivo
  único. Custo desproporcional para ~50 linhas de lógica.

A borda de 2px que hoje separa as colunas (`border-right` na esquerda,
`border-left` na direita) migra para a divisória, para não ficarem duas linhas
paralelas coladas.

### 2. Os limites — como "o miolo sempre maior" é garantido

Cada barra é limitada individualmente a:

- **mínimo 220px**
- **máximo 30% da largura da janela**

Se as duas barras juntas nunca passam de 60% da janela, o miolo nunca fica abaixo de
40% menos os 16px das duas divisórias — e portanto é sempre maior que qualquer uma
das duas, em qualquer largura de tela acima de 160px. É aritmética, não verificação
em tempo de execução: cada barra se limita sozinha, sem precisar consultar a outra.

O piso de 220px é o que os campos do painel Ações precisam para não quebrar; o caso
mais apertado é o `.dupla` (nome do dono + emoji, `grid-template-columns: 1fr 68px`).
O teto de 30% impede o caso patológico de arrastar tudo para um lado só.

**Caso de borda — telas estreitas:** abaixo de ~733px de janela, 30% é menor que
220px e os dois limites se cruzam. Nesse caso o piso vence (`Math.max` aplicado por
último), a barra fica travada em 220px e não se move. O comportamento degrada para
"não redimensionável", que é exatamente o que existe hoje. Nenhum erro, nenhum
valor negativo.

A função de clamp é pura e isolada:

```
clampLargura(desejada, larguraJanela) -> número
```

Sem DOM, sem efeitos colaterais. É o que torna o item testável em `testes.js`.

### 3. O arraste

`pointerdown` na divisória → `setPointerCapture`. A partir daí cada `pointermove`
calcula a largura desejada a partir da posição do cursor, passa por `clampLargura` e
escreve na variável CSS correspondente.

**Por que captura de ponteiro:** a divisória tem 8px. Num arraste rápido o cursor sai
da divisória antes do próximo `pointermove` e o arraste "escapa". A captura redireciona
todos os eventos de ponteiro para o elemento até o `pointerup`, independente de onde o
cursor esteja.

**Por que eventos de ponteiro e não de mouse:** cobre mouse, caneta e toque com o
mesmo código — relevante se a aula for numa lousa digital. Acompanha
`touch-action: none` na divisória, senão o navegador interpreta o arraste como
rolagem da página e o gesto nunca chega ao JS.

**Cursor:** `cursor: col-resize` na divisória em repouso e, durante o arraste, também
no `<body>`. Sem o segundo, o cursor volta a ser seta assim que o ponteiro passa por
cima do grafo, no meio do próprio arraste.

### 4. O grafo precisa reagir

O zoom do grafo é calculado a partir da largura da coluna do meio: `ajustarZoom` em
`main.js` lê `area.clientWidth`. Esse recálculo hoje só é disparado pelo evento
`resize` da **janela** e pelas ações do professor.

Arrastar uma divisória muda a largura da coluna **sem** disparar `resize` nenhum. Sem
tratamento explícito, o SVG ficaria na escala antiga — sobrando ou faltando espaço —
até a próxima ação.

Portanto o arraste dispara o recálculo, agendado por `requestAnimationFrame` para não
recalcular o layout inteiro a cada pixel de movimento. O grafo acompanha a divisória
em tempo real; é esse feedback que faz o ajuste parecer correto enquanto se arrasta.

O mesmo recálculo é disparado pelo ajuste via teclado e pelo duplo clique.

### 5. Teclado e acessibilidade

Cada divisória recebe:

- `role="separator"`
- `tabindex="0"`
- `aria-label` descritivo ("Ajustar largura do painel da esquerda" / "da direita")
- `aria-orientation="vertical"`

Com foco na divisória:

- **Seta esquerda / direita** — move 16px por toque
- **Home** — vai para o mínimo daquela barra
- **End** — vai para o máximo daquela barra

O teclado usa a mesma `clampLargura` e dispara o mesmo recálculo do grafo. Não é um
caminho paralelo — é a mesma lógica com outra entrada.

O indicador de foco precisa ser visível (`outline` usando `--destaque`): uma divisória
de 8px sem foco visível é impossível de operar por teclado.

### 6. Reset

Duplo clique numa divisória devolve **aquela** barra ao padrão (300px na esquerda,
320px na direita). A outra barra não é afetada.

Custa três linhas e resolve o "estraguei, e agora?" sem exigir F5 — que, sem
persistência, também resolveria, mas levaria junto o repositório da aula se o
`localStorage` estiver indisponível (modo anônimo, cota cheia — casos que
`storage.js` já trata engolindo o erro em silêncio).

### 7. Onde o código mora

Em `ui.js`, junto do resto da manipulação de tela. Expõe uma função —
`UI.montarDivisorias(aoRedimensionar)` — que `main.js` chama dentro de `iniciar()`,
passando `redesenhar` como callback.

Assim o módulo de arraste não sabe o que é um grafo: ele avisa "a largura mudou" e
quem se importa reage. A dependência aponta numa direção só.

Ficar em `ui.js` também evita criar um arquivo novo, o que obrigaria a mexer na lista
`SCRIPTS` em `gerar-arquivo-unico.js` e a acrescentar mais uma tag `<script>` em
`index.html`. São ~50 linhas; não justificam um módulo próprio.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `index.html` | Dois `<div class="divisoria">` dentro de `.colunas` |
| `styles.css` | `.colunas` para 5 colunas com variáveis; regras `.divisoria`; bordas migradas |
| `ui.js` | `montarDivisorias` + `clampLargura` exportadas |
| `main.js` | Chamada em `iniciar()` |
| `testes.js` | Testes de `clampLargura` |
| `branches-na-pratica.html` | Regerado (artefato derivado) |

## Testes

### Unidade (`testes.js`)

`clampLargura` é pura, então entra na suíte existente:

- Valor no meio da faixa passa intacto.
- Abaixo de 220 sobe para 220.
- Acima de 30% da janela desce para 30%.
- **Tela estreita** (janela 800px → teto 240px; janela 700px → teto 210px, abaixo do
  piso): o piso vence, resultado é 220.
- Entrada não-numérica ou `NaN` cai no padrão em vez de escrever `NaN` no CSS.

### Navegador (Playwright)

- Arrastar a divisória esquerda para a direita alarga a coluna esquerda e estreita o
  miolo; o miolo continua sendo a maior das três.
- Arrastar até o extremo trava no teto de 30% e o miolo continua o maior.
- Arrastar até o extremo oposto trava em 220px.
- Após o arraste, o `transform: scale()` do SVG mudou — prova de que o grafo
  recalculou e não ficou na escala antiga.
- Duplo clique restaura 300px sem afetar a barra direita.
- `Tab` até a divisória e `ArrowRight` alteram a largura.

### Verificação final

`node gerar-arquivo-unico.js` e conferir que `branches-na-pratica.html` foi regerado.
O arquivo único é artefato derivado versionado, e este trabalho mexe em `index.html`,
`styles.css`, `ui.js` e `main.js` — todos embutidos nele.

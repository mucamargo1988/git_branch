# Design — Apagar uma branch

**Data:** 2026-08-11
**Status:** aprovado

## Objetivo

Dar ao professor a sexta operação do app: apagar uma branch, nas duas formas do Git
real — `git branch -d` (recusa quando há trabalho a perder) e `git branch -D`
(apaga mesmo assim).

### Reversão de escopo

A spec original listou "deletar branch" explicitamente **fora de escopo**
(`2026-08-10-git-branch-visual-design.md`, seção *Fora*, junto de rebase,
cherry-pick e stash). Esta spec reverte aquela decisão, a pedido do usuário.

A reversão se justifica porque apagar branch não é mais uma operação avançada na
lista — é a outra metade da lição nº 1 do app:

> **Branch é um ponteiro, não uma cópia dos arquivos.** É o erro nº 1 do aluno.

Criar uma branch já mostra "um nome novo, nenhum arquivo copiado". Apagar fecha o
argumento pelo outro lado, e faz isso em dois desenhos opostos:

- **`-d` numa branch mesclada** — a etiqueta some e **nenhum commit se mexe**. Se a
  branch fosse uma cópia dos arquivos, apagá-la teria levado o trabalho junto. Não
  levou, porque ela era só um nome grudado num commit.
- **`-D` numa branch não mesclada** — os commits ficam inalcançáveis e caem na faixa
  fantasma que o `reset` já criou. É a mesma tela de "commits abandonados", chegando
  por outro caminho.

Rebase e cherry-pick continuam fora. Esta reversão é sobre uma operação só.

## Escopo

### Dentro

- `git branch -d <nome>` — recusa quando a branch não está mesclada na atual.
- `git branch -D <nome>` — apaga abandonando os commits, via checkbox "Forçar (-D)".
- Rastro visual da faixa que perdeu a dona, para os commits vivos dela não mudarem
  de cor nem ficarem sem rótulo.

### Fora (decidido explicitamente)

- **Apagar a branch atual.** O Git real recusa, e recusar aqui também é o que
  garante que o repositório nunca fica sem branch nenhuma (ver *Invariante*).
- **Apagar várias de uma vez.** Uma por vez, como o resto do painel.
- **`git branch -m` (renomear branch)**, remotes (`-r`), `--merged`/`--no-merged`
  como listagem.
- **Confirmação em `window.confirm`.** Nenhuma outra ação destrutiva do app pede
  (o `reset` abandona commits sem perguntar) e o Desfazer já cobre o clique errado.
  Uma confirmação a mais no meio da aula custa ritmo e não compra segurança nova.
- **Reaproveitar a faixa liberada** por uma branch apagada. A regra original — faixa
  nunca é reaproveitada, para linhas antigas não se deslocarem na tela — continua
  valendo, e agora vale com mais força (ver seção 4).

## Decisões de design

### 1. A operação em `repo.js`

Uma função nova no formato das existentes, pura e sem DOM:

```
excluirBranch(estado, nome, forcar) -> { ok, estado, comando } | { ok: false, erro }
```

Bloqueios, nesta ordem:

| Situação | Mensagem |
|---|---|
| Branch não existe | `A branch X não existe.` |
| É a branch atual | `Não dá para apagar a branch em que você está. Faça checkout em outra antes.` |
| Não mesclada, sem forçar | `A branch X não foi mesclada em <atual>. Marque "Forçar (-D)" para apagar mesmo assim — os commits que só ela alcançava ficam abandonados.` |

O primeiro é defensivo: o dropdown só oferece branches que existem. Vale a linha
porque `repo.js` é testado isoladamente e não pode confiar na tela.

**"Mesclada" é a condição que o merge já usa.** Uma branch está mesclada na atual
quando a ponta dela é ancestral da ponta da atual — literalmente o mesmo teste que
`merge` faz para responder *"Already up to date"* (`repo.js`, ramo `atual.pontaId &&
ehAncestral(estado, origem.pontaId, atual.pontaId)`). Nenhuma lógica nova para o
caso difícil; só uma segunda chamada de `ehAncestral(estado, alvo.pontaId,
atual.pontaId)`.

Casos que essa expressão já resolve sozinha, sem ramo especial:

- Branch criada e nunca commitada (aponta para o mesmo commit da atual):
  `ehAncestral(id, id)` é verdadeiro, porque `alcancaveis` inclui o próprio id.
  Apagar é seguro e o `-d` aceita — que é o comportamento do Git.
- Branch sem ponta (`pontaId: null`): só a `master` de um repositório vazio pode
  estar nesse estado, e ela é necessariamente a branch atual, então o bloqueio
  anterior já pegou. Ainda assim o código trata `!pontaId` como "nada a perder",
  para a função não depender dessa coincidência.

Efeito quando passa: remove a branch de `estado.branches`, grava o rastro da faixa
(seção 3), registra `git branch -d X` ou `git branch -D X` no histórico.

**`commits`, `devs` e `HEAD` não são tocados.** Os commits continuam exatamente
onde estavam — quem decide se eles somem para a faixa fantasma é `orfaos()`, pela
alcançabilidade, sem saber que houve um delete. Os devs ficam porque cada commit
guarda `autorId` e perderia o avatar.

#### Invariante: sempre sobra uma branch

Como a branch atual nunca pode ser apagada e `HEAD` sempre aponta para uma branch,
não existe sequência de operações que leve a `branches: []` ou a um `HEAD` órfão.
Isso não é efeito colateral feliz — é a razão de o bloqueio ser incondicional, sem
uma versão "forçada" que o contorne.

#### Apagar `master` é permitido

Quando `master` não é a branch atual, ela é apagável como qualquer outra. Três
motivos: o Git real permite; o Desfazer cobre o acidente; e "master não é especial,
é um ponteiro com um nome que a gente combinou" é exatamente o que a aula quer
dizer. O app já mostra que o nome é convenção — o painel Equipe traz a nota de que
no GitHub ela costuma se chamar `main`.

### 2. A tela

Um bloco `.acao` novo no painel Ações, **entre Mesclar e Voltar para o commit**:

```
Apagar branch
[ feature/login          ▾]
☐ Forçar (-D)
[ Apagar ]
```

A posição segue o ciclo de vida de uma branch, que é a ordem em que o painel já
está: nasce (+ Branch), muda-se pra ela (Checkout), volta para casa (Merge), morre
(Apagar). O Reset continua por último porque não é sobre branch — é sobre commit.

Ids seguem o padrão dos outros blocos: `sel-excluir`, `forcar-exclusao`,
`btn-excluir`, `erro-excluir`.

- O dropdown lista **todas as branches menos a atual**; vazio, mostra *"só existe a
  branch atual"* e fica desabilitado.
- O botão segue o `disabled` do select, como `checkout`, `merge` e `reset` já fazem.
- **A caixa "Forçar" desmarca sozinha depois de um apagar bem-sucedido.** Deixá-la
  armada faria o próximo delete abandonar commits em silêncio, sem a recusa que é o
  ponto pedagógico da coisa. Desmarcar entra em `limparCampos`, junto com os campos
  de commit e de branch nova.

#### O fluxo de dois tempos sai de graça

Não há UI condicional, nem botão que aparece depois do erro. O professor clica,
lê a recusa do Git no lugar onde os outros erros já aparecem, marca a caixa e clica
de novo. Duas telas, uma para cada metade da lição, com o mesmo botão.

O checkbox segue o padrão do "Já mudar pra ela" que o bloco + Branch já usa — é a
mesma ideia de flag ao lado do formulário, não um controle novo de aprender.

### 3. O rastro da faixa

`estado` ganha um campo:

```js
faixasApagadas: [ { faixa: 1, nome: "feature/login", cor: "#fb7185" } ]
```

**Sem ele, `layout.js` quebra em silêncio.** `corDaFaixa` e a lista `faixas` são
montadas percorrendo `estado.branches`. Apagar uma branch mesclada tira a única
fonte da cor e do rótulo daquela faixa, e os commits dela — que continuam **vivos**,
alcançáveis pela master através do commit de merge — cairiam no `|| COR_FANTASMA` de
`layout.js` e apareceriam cinzas, numa faixa sem nome.

Isso seria pior do que feio: no app inteiro, cinza quer dizer *commit abandonado*.
Pintar de cinza um commit que está dentro da master ensina o oposto do que a
operação acabou de demonstrar.

Com o rastro, a faixa mantém a cor, os commits mantêm a cor, e o rótulo lateral
passa a ser `feature/login (apagada)`. Nenhum CSS novo, nenhuma flag de estilo nova
em `graph.js`: o sufixo no nome carrega o recado, e `graph.js` já pinta `f.nome` e
`f.cor` como vêm.

**A faixa apagada só é desenhada enquanto houver commit vivo nela.** O `-D` esvazia
a faixa (os commits descem para a fantasma), e um `reset` posterior na master pode
esvaziar uma faixa que estava ocupada. Nos dois casos ela some do desenho, deixando
só o espaço vertical. Um registro que se desenha sozinho, sem checar ocupação,
deixaria uma faixa vazia rotulada pendurada, esticando `altura` à toa.

O filtro é sobre commits **vivos**: um commit órfão que por acaso tenha nascido
naquela faixa já foi realocado para a faixa fantasma e não conta como ocupação.

**Alternativa descartada:** gravar a cor em cada commit no momento da criação.
Resolveria a cor sem campo novo no estado, mas não resolve o rótulo da faixa, e
duplica em N commits um dado que hoje existe num lugar só. O rastro é uma entrada
por branch apagada.

### 4. A faixa fantasma não pode andar

`layout.js` calcula hoje `faixaFantasma = maiorFaixa + 1`, varrendo
`estado.branches`. Enquanto branches só nascem, `maiorFaixa` nunca diminui e a conta
é estável.

Apagar quebra isso. Apague a branch mais de baixo e `maiorFaixa` encolhe, a faixa
fantasma sobe um degrau, e **os commits abandonados que já estavam desenhados pulam
uma linha para cima sozinhos** — a reorganização de tela que a spec original proíbe
em duas seções diferentes ("reaproveitar faria linhas antigas se deslocarem",
"impede que o desenho inteiro se reorganize"). No projetor lê como defeito.

**Correção:** derivar de `estado.proximaFaixa`, que só incrementa e nunca é
decrementado por nada:

```js
var faixaFantasma = Math.max(estado.proximaFaixa || 0, maiorFaixa + 1);
```

Em qualquer estado gerado pelo app de hoje, `proximaFaixa === maiorFaixa + 1`, então
o valor é idêntico ao atual — nada muda para estados existentes nem para os testes já
escritos. O `Math.max` cobre um estado montado à mão (nos testes) em que
`proximaFaixa` tenha ficado para trás, garantindo que a faixa fantasma nunca caia em
cima de uma faixa de branch viva.

### 5. Estados salvos e a pilha de desfazer

O `localStorage` da aula em andamento e os estados empilhados pelo Desfazer foram
gravados sem `faixasApagadas`. `storage.carregar` normaliza o campo na leitura
(`if (!Array.isArray(estado.faixasApagadas)) estado.faixasApagadas = []`), e
`repo.js`/`layout.js` leem defensivamente, porque a pilha de desfazer não passa por
`carregar` e os testes montam estados à mão.

**O campo novo NÃO entra no guard que devolve `null`.** Aquele guard descarta o
estado inteiro e começa do zero; incluir `faixasApagadas` nele faria a primeira
abertura depois da atualização apagar o repositório de uma aula em andamento —
justamente o que o autosave existe para evitar.

### 6. Efeitos colaterais na tela, que não precisam de código

Vale registrar por que estes lugares **não** aparecem na tabela de arquivos:

- **Painel Equipe** — itera `estado.branches`, então a linha da pessoa some junto com
  a branch, sozinha. O dev continua em `estado.devs` e os commits dele mantêm o
  avatar.
- **Etiqueta no SVG** — `graph.js` indexa o cache de etiquetas pelo **nome da
  branch** e `podar` já remove as chaves que sumiram do layout, que é como o
  Reiniciar e o Desfazer já funcionam.
- **Dropdowns de checkout e merge** — montados a partir de `estado.branches` a cada
  desenho; a branch apagada some deles sozinha.
- **`gerar-arquivo-unico.js`** — a lista `SCRIPTS` não muda, porque a feature não
  cria arquivo novo. A operação inteira cabe nos módulos existentes.

## Modelo de dados — o delta

```js
{
  // ... campos existentes, inalterados ...
  faixasApagadas: [ { faixa: 1, nome: "feature/login", cor: "#fb7185" } ]
}
```

Único campo novo. `estadoInicial()` passa a devolvê-lo como `[]`.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `repo.js` | `excluirBranch`; `faixasApagadas: []` em `estadoInicial`; export |
| `layout.js` | `corDaFaixa` e `faixas` consideram `faixasApagadas`; faixa fantasma vem de `proximaFaixa` |
| `storage.js` | normaliza `faixasApagadas` em `carregar`, fora do guard que zera |
| `index.html` | bloco `.acao` de apagar branch, entre Merge e Reset |
| `ui.js` | listener, `MAPA_ERRO`, `limparErros`, `limparCampos`, `pintarDropdowns`, `atualizar` |
| `main.js` | despacho de `excluirBranch` em `executar` |
| `testes.js` | casos abaixo |
| `README.md` | linha na tabela de botões; a frase sobre o que o app não faz |
| `branches-na-pratica.html` | regerado (artefato derivado) |

## Testes

### Unidade (`testes.js`, entra na suíte existente)

- Apagar branch mesclada: some de `branches`, e `commits` e `devs` ficam intactos.
- Apagar a branch atual é recusado.
- Apagar branch inexistente é recusado.
- Não mesclada sem forçar é recusada — e **o estado não muda**.
- Não mesclada com forçar passa, e os commits dela aparecem em `Repo.orfaos`.
- Comando registrado é `git branch -d X` sem forçar e `git branch -D X` com.
- Branch criada e nunca commitada é apagável sem forçar (é mesclada por definição).
- `master` apagável quando não é a atual.
- Layout: faixa da branch apagada mantém a cor e ganha o sufixo `(apagada)` enquanto
  tiver commit vivo; os commits dela **não** ficam cinzas.
- Layout: faixa esvaziada pelo `-D` não é desenhada, e nenhuma faixa vazia sobra
  rotulada.
- Layout — **regressão da seção 4**: com commits órfãos na tela, apagar a branch de
  faixa mais alta não muda o `y` dos órfãos.
- Estado sem `faixasApagadas` (como os do `localStorage` antigo e os da pilha de
  desfazer) passa por `excluirBranch` e por `Layout.calcular` sem quebrar.

### Navegador

`testes.html` roda a mesma suíte, sem mudança além de já carregar os módulos.

Um cheque manual no navegador, porque é o que o unitário não vê: apagar uma branch
mesclada e confirmar que a pílula dela sai do SVG enquanto os círculos coloridos
continuam lá.

### Verificação final

`node testes.js` e `node gerar-arquivo-unico.js`, conferindo que
`branches-na-pratica.html` foi regerado — este trabalho mexe em cinco arquivos que
estão embutidos nele.

## Idioma

Rótulos e mensagens em português; comandos em inglês, como no resto do app. A
mensagem de recusa cita `"Forçar (-D)"` — o nome do controle na tela — em vez de
mandar rodar `git branch -D` num terminal que não existe aqui. O aluno vê a flag
real do Git no controle e no histórico; a instrução aponta para o botão.

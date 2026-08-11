# Design — App visual para ensinar branches de Git em aula

**Data:** 2026-08-10
**Status:** aprovado

## Objetivo

Ferramenta de projetor para o professor conduzir, ao vivo, uma aula sobre branches.
O professor executa ações (commit, branch, checkout, merge, reset) e o app desenha
imediatamente o que aconteceu no repositório, com cores por branch e uma pessoa
responsável por cada linha de trabalho.

O app **não** é um cliente Git real. É uma simulação didática do modelo de dados do
Git local, apresentada com a estética de um grafo de rede.

### O que o app precisa fazer o aluno entender

1. **Branch é um ponteiro, não uma cópia dos arquivos.** É o erro nº 1 do aluno.
   A etiqueta da branch é desenhada grudada num commit e **desliza** para o commit
   novo quando um commit é criado. Nada é copiado, e isso é visível.
2. **`HEAD` é um marcador próprio**, desenhado apontando para a etiqueta da branch —
   não para o commit. Torna `checkout` óbvio: `HEAD → branch → commit`.
3. **Trabalho em paralelo é feito por pessoas.** Cada branch tem um dono com nome e
   avatar, parado na ponta da linha dele.
4. **Existem dois tipos de merge** e eles são visualmente diferentes.

## Escopo

### Dentro

- Git **local** apenas, apresentado com aparência de GitHub.
- Cinco operações: `commit`, `branch` (criar), `checkout`, `merge`, `reset`.
- Merge nos dois sentidos (feature → master e master → feature).
- Histórico numerado dos comandos executados, à direita.
- Painel de equipe: quem é dono de qual branch.
- Persistência em `localStorage`; botões Desfazer e Reiniciar.

### Fora (decidido explicitamente)

- **Conflitos de merge.** Merge sempre dá certo. O objetivo do merge aqui é mostrar
  a forma do grafo se reunindo, não ensinar resolução de conflito.
- **Arquivos e conteúdo.** Commits carregam apenas mensagem, autor e pais.
- **Camada GitHub/nuvem:** sem push, pull, Pull Request, review, remotes.
- **Roteiro/tutorial pronto.** O professor conduz ao vivo; não há passo a passo guiado.
- `HEAD` destacado (detached HEAD), rebase, cherry-pick, stash, tags, deletar branch.
- Banco de dados, backend, autenticação, build step.

## Arquitetura

### Stack

HTML + CSS + JavaScript puro. Sem build, sem dependências, sem CDN. O professor abre
`index.html` com duplo clique e funciona offline.

Isso é requisito de sala de aula, não preferência: wi-fi de escola falha, e rodar um
servidor de desenvolvimento na frente da turma é um ponto de falha desnecessário.

O grafo é SVG desenhado à mão. Nenhuma biblioteca de grafos é necessária para
desenhar círculos, retas e curvas de Bézier.

**Restrição técnica:** os scripts devem ser scripts clássicos (`<script src="...">`),
**não** módulos ES. Módulos ES são bloqueados por CORS no protocolo `file://`, o que
quebraria o duplo clique.

**Alternativa descartada:** React + Vite. Introduz passo de build e `node_modules`
sem benefício num app deste tamanho.

### Arquivos

```
git_branch/
├── index.html      estrutura das 3 colunas
├── styles.css      paleta das branches, tipografia de projetor, animações
├── repo.js         modelo do repositório — funções puras, sem DOM
├── layout.js       estado → coordenadas x,y — funções puras, sem DOM
├── graph.js        desenha e atualiza o SVG a partir do layout
├── ui.js           controles, validação, painéis de equipe e histórico
├── storage.js      localStorage + pilha de desfazer
├── main.js         composição e inicialização
└── testes.html     roda os testes de repo.js e layout.js no navegador
```

As duas peças com lógica não trivial — `repo.js` e `layout.js` — são puras e não
tocam no DOM. É lá que ficam os casos difíceis (detectar fast-forward, achar
ancestral comum, identificar órfãos do reset), e é por isso que elas são testáveis
isoladamente.

### Fronteiras dos módulos

| Módulo | Faz | Depende de |
|---|---|---|
| `repo.js` | recebe estado + ação, devolve estado novo | nada |
| `layout.js` | recebe estado, devolve nós/arestas/etiquetas com x,y | nada |
| `graph.js` | reflete o layout no SVG | `layout.js` |
| `ui.js` | lê os controles, valida, chama `repo.js`, pinta os painéis | `repo.js` |
| `storage.js` | serializa/restaura estado, mantém pilha de desfazer | nada |
| `main.js` | liga ação → novo estado → salvar → redesenhar | todos |

Fluxo de dados unidirecional: **ação do usuário → `repo.js` → estado novo →
`storage` salva → `layout` recalcula → `graph` + `ui` redesenham**. Não há mutação
de estado espalhada pelos módulos de tela.

## Modelo de dados

```js
{
  commits: [
    { id: "a1b2c3", mensagem: "header", pais: ["f0e1d2"], autorId: "ana", faixa: 0, ordem: 3 }
  ],
  branches: [
    { nome: "master", pontaId: "a1b2c3", cor: "#..." , donoId: "ana", faixa: 0 }
  ],
  HEAD: { branch: "master" },
  devs: [
    { id: "ana", nome: "Ana", emoji: "👩" }
  ],
  historico: [
    { n: 1, comando: 'git commit -m "header"' }
  ]
}
```

- `id` é um sha falso de 6 caracteres hexadecimais, gerado sequencialmente para ser
  determinístico (importante para os testes).
- `pais` tem 1 elemento no commit normal, 2 no commit de merge, 0 no commit raiz.
- `faixa` é gravada no commit no momento da criação e **nunca muda depois**.
- `HEAD` sempre aponta para uma branch. Detached HEAD está fora de escopo.

### Estado inicial

Repositório vazio: `commits` vazio e `branches` contendo apenas `master` com
`pontaId: null` e faixa 0. A área do grafo mostra a dica
*"Repositório vazio — clique em Novo commit para começar"*.

O `historico` já começa com a linha `1  git init`, para que a primeira coisa que o
aluno veja no painel seja de onde tudo partiu.

`master` já vem com um dono padrão (`Você 🧑‍💻`), editável a qualquer momento
clicando sobre ele no painel EQUIPE. Evita ter que perguntar o nome do professor
antes do primeiro commit.

## Layout da tela

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  meu-projeto        HEAD → master  👩 Ana              [↶ Desfazer] [Reiniciar]│
├──────────────┬─────────────────────────────────────────────┬──────────────────┤
│  EQUIPE      │                                             │  HISTÓRICO       │
│              │                                             │                  │
│  👩 Ana      │  master ●───●───●─────────────────●  ⌐master│  1 git init      │
│     master   │              ╲                   ╱   👩 Ana │  2 git commit -m │
│              │               ╲                 ╱      ▲HEAD│      "header"    │
│  👨 Bruno    │                ╲               ╱           │  3 git branch    │
│     feature/ │  feature ───────●───●───●─────╯            │      feature/login│
│     login    │  /login              ⌐feature/login 👨 Bruno│  4 git checkout  │
│              │                                             │      feature/login│
├──────────────┤                                             │  5 git commit -m │
│  AÇÕES       │                                             │      "form"      │
│              │                                             │  6 git checkout  │
│  [+ Commit ] │                                             │      master      │
│  [+ Branch ] │                                             │  7 git merge     │
│  [ Checkout▾]│                                             │      feature/login│
│  [ Merge   ▾]│                                             │                  │
│  [ Reset   ▾]│                                             │                  │
└──────────────┴─────────────────────────────────────────────┴──────────────────┘
```

Três colunas. O grafo é o protagonista e ocupa todo o espaço restante. Barra
superior mostra permanentemente para onde `HEAD` aponta e quem é o dono da branch
atual.

## Operações

| Ação | Campos | Comando registrado | Efeito visual |
|---|---|---|---|
| **Novo commit** | mensagem | `git commit -m "..."` | Círculo novo à direita, na faixa e cor da branch atual, com o avatar do dono. A etiqueta da branch **desliza** do commit anterior para o novo. `HEAD` acompanha. |
| **Nova branch** | nome, dono (nome + emoji), ☑ "já mudar pra ela" | `git branch x` ou `git checkout -b x` | Curva desce do commit atual para uma faixa nova em outra cor. O dono aparece no painel EQUIPE, posicionado na ponta da linha dele. |
| **Checkout** | dropdown de branches | `git checkout x` | `HEAD` salta para a outra etiqueta com destaque. Faixa ativa acende, as demais esmaecem. Avatar da barra superior troca. |
| **Merge** | dropdown "mesclar X na atual" | `git merge x` | Fast-forward ou commit de merge (ver abaixo). |
| **Reset** | dropdown de commits alcançáveis a partir do `HEAD` | `git reset --hard <sha>` | A etiqueta desliza **para trás**. Commits que ficaram inalcançáveis viram cinza tracejado — permanecem desenhados, para o professor poder falar sobre eles. |

### Os dois merges

O app detecta o caso e desenha diferente.

```
FAST-FORWARD  (a branch de destino não avançou desde a ramificação)
   antes:  master ●──●        depois:  master ●──●──●──●
                    ╲                                ▲
             login    ●──●              login ──────╯  ⌐login ⌐master
   Nenhum commit é criado. A etiqueta apenas anda para frente.

COMMIT DE MERGE  (os dois lados avançaram)
   master ●──●──●───────◆   ◆ = commit de merge, com dois pais
              ╲        ╱
    login      ●──●──●╯
```

**Regra de detecção:** se a ponta da branch atual é ancestral da ponta da branch de
origem, é fast-forward. Se a ponta da branch de origem é ancestral da ponta da atual,
não há nada a trazer (*"Already up to date"*). Caso contrário, cria commit de merge
cujos pais são `[ponta_atual, ponta_origem]`, nascendo na faixa da branch atual.

## Algoritmo de posicionamento

Determinístico, sem biblioteca de grafos.

- **X** = ordem de criação do commit, garantindo leitura cronológica da esquerda
  para a direita.
- **Y** = faixa. `master` é a faixa 0, no topo. Cada branch nova recebe **sempre uma
  faixa nova** abaixo, na ordem de criação. Faixas de branches já mescladas não são
  reaproveitadas: reaproveitar faria linhas antigas se deslocarem na tela.
- O commit **herda a faixa da branch em que nasceu e nunca a troca**. Isso impede
  que o desenho inteiro se reorganize após um merge, o que faria o aluno perder o fio.
- Aresta entre commits na mesma faixa: linha reta. Entre faixas diferentes: curva
  de Bézier.

**Ajuste ao projetor:** o SVG usa `viewBox` e se reescala para caber na área. Ao
atingir um tamanho mínimo legível, para de encolher e passa a rolar na horizontal,
mantendo o commit mais recente à vista.

## Linguagem visual

- **Cor nunca é o único diferenciador.** Cada branch carrega cor + nome escrito +
  avatar do dono. Projetores distorcem matiz e há alunos daltônicos.
- Tipografia grande e alto contraste, calibrada para leitura no fundo da sala.
- Animações curtas (~300ms) e com propósito: a etiqueta deslizando, o commit
  surgindo, o `HEAD` saltando. Nada decorativo.
- A faixa da branch ativa fica em destaque; as demais, esmaecidas.

## Persistência e desfazer

- **Autosave** em `localStorage` (chave `git-branch-aula/v1`) após cada comando.
  Protege contra F5 acidental no meio da aula.
- **Reiniciar**, com confirmação, volta ao estado inicial descrito acima.
- **↶ Desfazer** mantém pilha dos últimos 50 estados. Ele **remove a última linha do
  histórico** em vez de gerar um `git revert`: é borracha de clique errado, não uma
  operação de Git. Misturar as duas coisas confundiria o aluno. O botão fica
  desabilitado quando a pilha está vazia (estado inicial).

## Tratamento de erro

Mensagens inline, em português, junto ao campo. Nenhum `alert()`.

| Situação | Resposta |
|---|---|
| Nome de branch repetido, vazio ou com espaço | Aviso no campo; ação bloqueada |
| Commit sem mensagem | Ação bloqueada |
| Merge da branch nela mesma | Opção ausente do dropdown |
| Merge sem nada a trazer | Mostra *"Already up to date"* e **registra o comando no histórico mesmo assim**, porque é o comportamento real do Git |
| Reset | O dropdown só oferece commits alcançáveis a partir do `HEAD`, excluindo a própria ponta atual (seria um comando sem efeito) |
| Commit ou branch com repositório vazio | Commit cria o commit raiz; criar branch fica desabilitado até existir um commit |

## Testes

`testes.html` abre no navegador e executa asserções sobre `repo.js` e `layout.js`,
exibindo ✅/❌ na página. Sem framework e sem instalação — coerente com a decisão de
não ter build.

Casos cobertos:

- Commit raiz em repositório vazio
- Commit avança a ponta da branch e o `HEAD`
- `branch` não move o `HEAD`; `checkout -b` move
- Detecção de fast-forward
- Commit de merge tem exatamente dois pais e nasce na faixa correta
- *Already up to date* não cria commit
- Merge nos dois sentidos
- Reset move a ponta para trás e marca os commits órfãos
- Ancestralidade e ancestral comum
- Colisão de nome de branch é rejeitada
- Layout: faixa do commit não muda após merge; X segue a ordem de criação

## Entrega

A pasta do projeto, aberta por duplo clique no `index.html`.

Ao final, gerar também uma **versão em arquivo único** (`.html` autocontido, com CSS
e JS embutidos) para o professor distribuir por WhatsApp ou Classroom e o aluno abrir
em casa. A versão em arquivo único é derivada da pasta; a pasta é a fonte da verdade.

## Idioma

Interface e mensagens em português. Comandos Git permanecem em inglês
(`git checkout -b`), porque é o que o aluno vai digitar de verdade.

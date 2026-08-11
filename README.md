# Branches na prática

App de projetor para explicar branches de Git em aula. Sem instalação, sem internet,
sem banco de dados.

O app usa tema escuro, pensado para uma sala com a luz baixa e o projetor ligado.

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
| Apagar | `git branch -d nome` ou `git branch -D nome` |
| Reset | `git reset --hard <sha>` |

Todo comando executado aparece numerado no painel da direita.

Não dá para apagar a branch em que você está. Se a branch tiver commits que
mais ninguém alcança, é preciso marcar `Forçar (-D)` — e aí eles vão para a
faixa de commits abandonados, em cinza, em vez de sumir da tela.

As duas barras laterais são ajustáveis: arraste a linha que separa cada uma do
grafo, ou dê Tab até ela e use as setas. Duplo clique volta à largura original.
O grafo nunca fica menor que as barras.

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

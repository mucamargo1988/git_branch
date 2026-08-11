(function (raiz) {
  "use strict";

  var estado = null;
  var ultimoCommitVisto = null;
  var ultimasDims = null;

  var ESCALA_MINIMA = 0.7; // abaixo disso o texto para de ser legível do fundo da sala

  function commitMaisRecente(e) {
    return e.commits.length > 0 ? e.commits[e.commits.length - 1].id : null;
  }

  // Recebe as dimensões que Graph.desenhar REALMENTE usou, não as do layout:
  // quando há etiquetas acima de y=0, a altura desenhada é maior que layout.altura.
  function ajustarZoom(dims, deveRolar) {
    var area = document.querySelector(".area-grafo");
    var svg = document.getElementById("grafo");
    var disponivel = area.clientWidth - 40;

    var escala = Math.min(1, disponivel / dims.largura);
    if (escala < ESCALA_MINIMA) escala = ESCALA_MINIMA;

    svg.style.transform = "scale(" + escala + ")";
    // O elemento encolhe visualmente mas não no fluxo: reservamos o espaço real
    // para que a rolagem horizontal funcione quando a escala trava no mínimo.
    svg.style.marginBottom = (dims.altura * (escala - 1)) + "px";
    svg.style.marginRight = (dims.largura * (escala - 1)) + "px";

    // Acompanha o commit mais recente — mas só quando ele de fato mudou. Um
    // checkout para uma branch com a ponta lá atrás, um desfazer ou um resize
    // não podem jogar a vista inteira para a direita.
    if (deveRolar) area.scrollLeft = area.scrollWidth;
  }

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

  // Devolve se deu certo. main.js é o único que usa isto para decidir o próximo
  // passo (checkout, commit, etc. ignoram); o editor inline do painel EQUIPE em
  // ui.js usa para saber se pode se destruir ou se precisa continuar aberto
  // depois de um erro (ex.: nome vazio) — sem isto, um editarDev rejeitado
  // travava o editor porque a trava contra reenvio nunca soltava.
  function aplicar(nomeAcao, resultado) {
    if (!resultado.ok) {
      UI.mostrarErro(nomeAcao, resultado.erro);
      return false;
    }
    Storage.empilhar(estado);
    estado = resultado.estado;
    Storage.salvar(estado);
    UI.limparCampos(nomeAcao);
    if (resultado.aviso) UI.mostrarAviso(resultado.aviso);
    redesenhar();
    return true;
  }

  function executar(nomeAcao, p) {
    UI.limparErros();

    if (nomeAcao === "commit") return aplicar(nomeAcao, Repo.commit(estado, p.mensagem));
    if (nomeAcao === "criarBranch") return aplicar(nomeAcao, Repo.criarBranch(estado, p.nome, p.dono, p.jaMudar));
    if (nomeAcao === "checkout") return aplicar(nomeAcao, Repo.checkout(estado, p.nome));
    if (nomeAcao === "merge") return aplicar(nomeAcao, Repo.merge(estado, p.nome));
    if (nomeAcao === "excluirBranch") return aplicar(nomeAcao, Repo.excluirBranch(estado, p.nome, p.forcar));
    if (nomeAcao === "reset") return aplicar(nomeAcao, Repo.reset(estado, p.commitId));
    if (nomeAcao === "editarDev") return aplicar(nomeAcao, Repo.editarDev(estado, p.donoId, p.nome, p.emoji));
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
    UI.montarDivisorias(reajustar);
    document.getElementById("btn-desfazer").addEventListener("click", desfazer);
    document.getElementById("btn-reiniciar").addEventListener("click", reiniciar);
    window.addEventListener("resize", function () { redesenhar(); });
    redesenhar();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

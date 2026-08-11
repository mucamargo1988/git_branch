(function (raiz) {
  "use strict";

  var estado = null;

  var ESCALA_MINIMA = 0.55; // abaixo disso o texto fica ilegível no projetor

  // Recebe as dimensões que Graph.desenhar REALMENTE usou, não as do layout:
  // quando há etiquetas acima de y=0, a altura desenhada é maior que layout.altura.
  function ajustarZoom(dims) {
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

    // Acompanha o commit mais recente.
    area.scrollLeft = area.scrollWidth;
  }

  function redesenhar() {
    UI.atualizar(estado);
    ajustarZoom(Graph.desenhar(Layout.calcular(estado)));
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
    window.addEventListener("resize", function () { redesenhar(); });
    redesenhar();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

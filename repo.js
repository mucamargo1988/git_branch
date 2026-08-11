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

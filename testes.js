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

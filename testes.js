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

// ---------- repo.js: commit ----------

teste("commit em repositório vazio cria o commit raiz", function () {
  var r = Repo.commit(Repo.estadoInicial(), "primeiro");
  verdade(r.ok, "deveria ter dado certo");
  igual(r.estado.commits.length, 1);
  igual(r.estado.commits[0].pais, [], "o commit raiz não tem pai");
  igual(r.estado.commits[0].mensagem, "primeiro");
  igual(r.estado.commits[0].ordem, 0);
  igual(r.estado.commits[0].faixa, 0, "nasce na faixa da branch atual");
});

teste("commit move a ponta da branch e o HEAD acompanha", function () {
  var r1 = Repo.commit(Repo.estadoInicial(), "um");
  var r2 = Repo.commit(r1.estado, "dois");
  var id1 = r1.estado.commits[0].id;
  var id2 = r2.estado.commits[1].id;
  igual(r2.estado.commits[1].pais, [id1], "o segundo commit aponta para o primeiro");
  igual(Repo.acharBranch(r2.estado, "master").pontaId, id2, "a etiqueta andou");
  igual(r2.estado.HEAD.branch, "master", "HEAD continua na master");
});

teste("commit registra o comando no histórico", function () {
  var r = Repo.commit(Repo.estadoInicial(), "header");
  igual(r.comando, 'git commit -m "header"');
  igual(r.estado.historico.length, 2, "git init + o commit");
  igual(r.estado.historico[1], { n: 2, comando: 'git commit -m "header"' });
});

teste("commit sem mensagem é rejeitado", function () {
  var r = Repo.commit(Repo.estadoInicial(), "   ");
  igual(r.ok, false);
  verdade(r.erro.length > 0, "precisa explicar o erro");
});

teste("commit não muta o estado recebido", function () {
  var e = Repo.estadoInicial();
  Repo.commit(e, "x");
  igual(e.commits.length, 0, "o estado original tem que continuar vazio");
});

teste("commit usa o dono da branch atual como autor", function () {
  var r = Repo.commit(Repo.estadoInicial(), "x");
  igual(r.estado.commits[0].autorId, "voce");
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

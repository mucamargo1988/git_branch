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

// ---------- repo.js: branch e checkout ----------

function comUmCommit() {
  return Repo.commit(Repo.estadoInicial(), "inicial").estado;
}

teste("criarBranch aponta para o commit atual e ganha faixa nova", function () {
  var e = comUmCommit();
  var r = Repo.criarBranch(e, "feature/login", { nome: "Ana", emoji: "👩" }, false);
  verdade(r.ok, r.erro);
  var nova = Repo.acharBranch(r.estado, "feature/login");
  igual(nova.pontaId, e.commits[0].id, "nasce no commit onde estávamos");
  igual(nova.faixa, 1, "master é 0, a nova é 1");
  igual(r.estado.proximaFaixa, 2);
  verdade(nova.cor !== Repo.acharBranch(r.estado, "master").cor, "cores devem diferir");
});

teste("git branch sem checkout: não move HEAD, não cria commit, duas etiquetas no mesmo commit", function () {
  var e = comUmCommit();
  var r = Repo.criarBranch(e, "feature/login", { nome: "Ana", emoji: "👩" }, false);
  igual(r.estado.HEAD.branch, "master", "HEAD não pode ter se movido");
  igual(r.estado.commits.length, 1, "criar branch não cria commit");
  igual(r.comando, "git branch feature/login");
  igual(
    Repo.acharBranch(r.estado, "master").pontaId,
    Repo.acharBranch(r.estado, "feature/login").pontaId,
    "as duas branches apontam para o MESMO commit"
  );
});

teste("checkout -b cria e já muda de branch", function () {
  var r = Repo.criarBranch(comUmCommit(), "feature/x", { nome: "Bruno", emoji: "👨" }, true);
  igual(r.estado.HEAD.branch, "feature/x");
  igual(r.comando, "git checkout -b feature/x");
});

teste("criarBranch registra o dono na equipe", function () {
  var r = Repo.criarBranch(comUmCommit(), "feature/x", { nome: "Ana", emoji: "👩" }, false);
  igual(r.estado.devs.length, 2, "o dono padrão mais a Ana");
  igual(Repo.acharBranch(r.estado, "feature/x").donoId, "ana");
  igual(r.estado.devs[1], { id: "ana", nome: "Ana", emoji: "👩" });
});

teste("dono já existente é reaproveitado, não duplicado", function () {
  var r1 = Repo.criarBranch(comUmCommit(), "a", { nome: "Ana", emoji: "👩" }, false);
  var r2 = Repo.criarBranch(r1.estado, "b", { nome: "Ana", emoji: "👩" }, false);
  igual(r2.estado.devs.length, 2, "Ana não pode aparecer duas vezes");
});

teste("nomes acentuados diferentes não viram a mesma pessoa", function () {
  var r1 = Repo.criarBranch(comUmCommit(), "a", { nome: "José", emoji: "👨" }, false);
  var r2 = Repo.criarBranch(r1.estado, "b", { nome: "Josué", emoji: "🧔" }, false);
  igual(r2.estado.devs.length, 3, "o dono padrão, o José e o Josué");
  var idA = Repo.acharBranch(r2.estado, "a").donoId;
  var idB = Repo.acharBranch(r2.estado, "b").donoId;
  verdade(idA !== idB, "José e Josué não podem compartilhar id");

  var nomes = {};
  r2.estado.devs.forEach(function (d) { nomes[d.id] = d.nome; });
  igual(nomes[idA], "José");
  igual(nomes[idB], "Josué", "o projetor mostraria o nome errado do aluno");
});

teste("nome de branch repetido é rejeitado", function () {
  var r1 = Repo.criarBranch(comUmCommit(), "x", { nome: "Ana", emoji: "👩" }, false);
  var r2 = Repo.criarBranch(r1.estado, "x", { nome: "Bruno", emoji: "👨" }, false);
  igual(r2.ok, false);
});

teste("nome de branch vazio ou com espaço é rejeitado", function () {
  igual(Repo.criarBranch(comUmCommit(), "  ", { nome: "Ana", emoji: "👩" }, false).ok, false);
  igual(Repo.criarBranch(comUmCommit(), "meu login", { nome: "Ana", emoji: "👩" }, false).ok, false);
});

teste("não dá para criar branch em repositório sem commits", function () {
  var r = Repo.criarBranch(Repo.estadoInicial(), "x", { nome: "Ana", emoji: "👩" }, false);
  igual(r.ok, false);
});

teste("checkout move o HEAD e registra o comando", function () {
  var r1 = Repo.criarBranch(comUmCommit(), "x", { nome: "Ana", emoji: "👩" }, false);
  var r2 = Repo.checkout(r1.estado, "x");
  verdade(r2.ok, r2.erro);
  igual(r2.estado.HEAD.branch, "x");
  igual(r2.comando, "git checkout x");
});

teste("checkout para branch inexistente ou para a branch atual é rejeitado", function () {
  var e = comUmCommit();
  igual(Repo.checkout(e, "nao-existe").ok, false);
  igual(Repo.checkout(e, "master").ok, false);
});

// ---------- repo.js: ancestralidade e merge ----------

// master: c0 -> c1 ; feature: nasce em c0 e ganha c2
// Devolve { estado, c0, c1, c2 }
function cenarioDivergente() {
  var e = Repo.commit(Repo.estadoInicial(), "c0").estado;
  var c0 = e.commits[0].id;
  e = Repo.criarBranch(e, "feature", { nome: "Ana", emoji: "👩" }, true).estado;
  e = Repo.commit(e, "c2").estado;
  var c2 = e.commits[1].id;
  e = Repo.checkout(e, "master").estado;
  e = Repo.commit(e, "c1").estado;
  var c1 = e.commits[2].id;
  return { estado: e, c0: c0, c1: c1, c2: c2 };
}

teste("ehAncestral reconhece a cadeia de pais", function () {
  var c = cenarioDivergente();
  verdade(Repo.ehAncestral(c.estado, c.c0, c.c1), "c0 é ancestral de c1");
  verdade(Repo.ehAncestral(c.estado, c.c0, c.c2), "c0 é ancestral de c2");
  verdade(!Repo.ehAncestral(c.estado, c.c1, c.c2), "c1 e c2 são irmãos, não ancestrais");
  verdade(Repo.ehAncestral(c.estado, c.c1, c.c1), "um commit é ancestral de si mesmo");
});

teste("merge fast-forward: só anda a etiqueta, sem criar commit", function () {
  var e = Repo.commit(Repo.estadoInicial(), "c0").estado;
  e = Repo.criarBranch(e, "feature", { nome: "Ana", emoji: "👩" }, true).estado;
  e = Repo.commit(e, "c1").estado;
  var pontaFeature = Repo.acharBranch(e, "feature").pontaId;
  e = Repo.checkout(e, "master").estado;

  var r = Repo.merge(e, "feature");
  verdade(r.ok, r.erro);
  igual(r.tipo, "fast-forward");
  igual(r.estado.commits.length, 2, "fast-forward NÃO cria commit");
  igual(Repo.acharBranch(r.estado, "master").pontaId, pontaFeature, "a etiqueta pulou para a ponta da feature");
  igual(r.comando, "git merge feature");
});

teste("merge com os dois lados avançados cria commit de merge com dois pais", function () {
  var c = cenarioDivergente();
  var r = Repo.merge(c.estado, "feature");
  verdade(r.ok, r.erro);
  igual(r.tipo, "commit-de-merge");
  igual(r.estado.commits.length, 4, "os 3 originais mais o de merge");
  var m = r.estado.commits[3];
  igual(m.pais, [c.c1, c.c2], "primeiro pai é a branch atual, segundo é a origem");
  igual(m.faixa, 0, "o commit de merge nasce na faixa da branch de destino");
  igual(Repo.acharBranch(r.estado, "master").pontaId, m.id);
});

teste("merge sem nada a trazer avisa Already up to date e não cria commit", function () {
  var e = Repo.commit(Repo.estadoInicial(), "c0").estado;
  e = Repo.criarBranch(e, "feature", { nome: "Ana", emoji: "👩" }, false).estado;
  e = Repo.commit(e, "c1").estado; // avança só a master

  var r = Repo.merge(e, "feature");
  verdade(r.ok, r.erro);
  igual(r.tipo, "atualizado");
  igual(r.estado.commits.length, 2, "não pode criar commit");
  igual(r.aviso, "Already up to date.");
  igual(r.estado.historico[r.estado.historico.length - 1].comando, "git merge feature",
    "o comando entra no histórico mesmo assim, porque é o que o Git faz");
});

teste("merge funciona no sentido inverso: master dentro da feature", function () {
  var c = cenarioDivergente();
  var e = Repo.checkout(c.estado, "feature").estado;
  var r = Repo.merge(e, "master");
  verdade(r.ok, r.erro);
  igual(r.tipo, "commit-de-merge");
  var m = r.estado.commits[3];
  igual(m.pais, [c.c2, c.c1], "agora a feature é o primeiro pai");
  igual(m.faixa, 1, "nasce na faixa da feature, que é o destino");
  igual(Repo.acharBranch(r.estado, "feature").pontaId, m.id);
});

teste("merge de uma branch nela mesma ou inexistente é rejeitado", function () {
  var c = cenarioDivergente();
  igual(Repo.merge(c.estado, "master").ok, false);
  igual(Repo.merge(c.estado, "nao-existe").ok, false);
});

// ---------- repo.js: reset e órfãos ----------

function tresCommits() {
  var e = Repo.commit(Repo.estadoInicial(), "c1").estado;
  e = Repo.commit(e, "c2").estado;
  e = Repo.commit(e, "c3").estado;
  return e;
}

teste("reset move a ponta para trás e registra o comando", function () {
  var e = tresCommits();
  var c1 = e.commits[0].id;
  var r = Repo.reset(e, c1);
  verdade(r.ok, r.erro);
  igual(Repo.acharBranch(r.estado, "master").pontaId, c1);
  igual(r.estado.commits.length, 3, "os commits continuam existindo, só ficaram órfãos");
  igual(r.comando, "git reset --hard " + c1);
});

teste("reset deixa os commits posteriores órfãos", function () {
  var e = tresCommits();
  igual(Repo.orfaos(e), [], "sem reset não há órfãos");
  var r = Repo.reset(e, e.commits[0].id);
  igual(Repo.orfaos(r.estado), [e.commits[1].id, e.commits[2].id]);
});

teste("commit órfão alcançável por outra branch não conta como órfão", function () {
  var e = tresCommits();
  e = Repo.criarBranch(e, "salva", { nome: "Ana", emoji: "👩" }, false).estado;
  var r = Repo.reset(e, e.commits[0].id);
  igual(Repo.orfaos(r.estado), [], "a branch salva ainda segura c2 e c3");
});

teste("reset para commit fora do histórico da branch atual é rejeitado", function () {
  var c = cenarioDivergente(); // estamos na master; c2 é da feature
  igual(Repo.reset(c.estado, c.c2).ok, false);
  igual(Repo.reset(c.estado, "nao-existe").ok, false);
});

teste("reset para a própria ponta atual é rejeitado", function () {
  var e = tresCommits();
  igual(Repo.reset(e, e.commits[2].id).ok, false);
});

teste("commitsAlcancaveis lista do mais novo ao mais antigo, sem a ponta atual", function () {
  var e = tresCommits();
  igual(Repo.commitsAlcancaveis(e), [
    { id: e.commits[1].id, mensagem: "c2" },
    { id: e.commits[0].id, mensagem: "c1" }
  ]);
});

teste("commitsAlcancaveis em repositório vazio devolve lista vazia", function () {
  igual(Repo.commitsAlcancaveis(Repo.estadoInicial()), []);
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

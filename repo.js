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

  // Muta o estado recebido de propósito: só é chamada de dentro das operações
  // (commit, criarBranch, checkout, merge, reset), que já trabalham sobre um clone.
  function registrar(estado, comando) {
    estado.historico.push({ n: estado.historico.length + 1, comando: comando });
  }

  function commit(estado, mensagem) {
    mensagem = (mensagem || "").trim();
    if (!mensagem) {
      return { ok: false, erro: "Escreva uma mensagem para o commit." };
    }

    var e = clonar(estado);
    var br = branchAtual(e);
    var id = gerarId(e.proximoId);

    e.commits.push({
      id: id,
      mensagem: mensagem,
      pais: br.pontaId ? [br.pontaId] : [],
      autorId: br.donoId,
      faixa: br.faixa,
      ordem: e.proximoId - 1
    });
    e.proximoId = e.proximoId + 1;
    br.pontaId = id;

    var comando = 'git commit -m "' + mensagem + '"';
    registrar(e, comando);
    return { ok: true, estado: e, comando: comando };
  }

  // Muta o estado recebido de propósito: só é chamada de dentro de criarBranch,
  // que já trabalha sobre um clone.
  function registrarDev(estado, dono) {
    var nome = ((dono && dono.nome) || "").trim() || "Dev";
    var emoji = ((dono && dono.emoji) || "").trim() || "🧑‍💻";

    // Tira os acentos ANTES de gerar o id. Sem isto, "José" e "Josué" viram os dois
    // "jos", o segundo aluno é confundido com o primeiro e o projetor mostra o nome
    // errado no meio da aula. `normalize` é método de String — não quebra a pureza
    // do módulo nem depende de DOM.
    var semAcento = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    var base = semAcento.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "dev";

    var id = base;
    var sufixo = 2;
    while (true) {
      var achado = null;
      for (var i = 0; i < estado.devs.length; i++) {
        if (estado.devs[i].id === id) achado = estado.devs[i];
      }
      if (!achado) break;
      // Mesmo id E mesmo nome: é a mesma pessoa, reaproveita.
      if (achado.nome === nome) {
        achado.emoji = emoji;
        return id;
      }
      // Mesmo id, nome diferente: pessoa diferente, precisa de id próprio.
      id = base + "-" + sufixo;
      sufixo = sufixo + 1;
    }

    estado.devs.push({ id: id, nome: nome, emoji: emoji });
    return id;
  }

  function criarBranch(estado, nome, dono, jaMudar) {
    nome = (nome || "").trim();
    if (!nome) {
      return { ok: false, erro: "Dê um nome para a branch." };
    }
    if (/\s/.test(nome)) {
      return { ok: false, erro: "Nome de branch não pode ter espaço. Use traço ou barra: feature/login" };
    }
    if (acharBranch(estado, nome)) {
      return { ok: false, erro: "Já existe uma branch chamada " + nome + "." };
    }
    if (!branchAtual(estado).pontaId) {
      return { ok: false, erro: "Faça pelo menos um commit antes de criar uma branch." };
    }

    var e = clonar(estado);
    var atual = branchAtual(e);
    var donoId = registrarDev(e, dono);

    e.branches.push({
      nome: nome,
      pontaId: atual.pontaId,
      cor: CORES[e.proximaFaixa % CORES.length],
      donoId: donoId,
      faixa: e.proximaFaixa
    });
    e.proximaFaixa = e.proximaFaixa + 1;

    var comando;
    if (jaMudar) {
      e.HEAD.branch = nome;
      comando = "git checkout -b " + nome;
    } else {
      comando = "git branch " + nome;
    }

    registrar(e, comando);
    return { ok: true, estado: e, comando: comando };
  }

  function checkout(estado, nome) {
    if (!acharBranch(estado, nome)) {
      return { ok: false, erro: "A branch " + nome + " não existe." };
    }
    if (estado.HEAD.branch === nome) {
      return { ok: false, erro: "Você já está em " + nome + "." };
    }

    var e = clonar(estado);
    e.HEAD.branch = nome;
    var comando = "git checkout " + nome;
    registrar(e, comando);
    return { ok: true, estado: e, comando: comando };
  }

  // Percorre a cadeia de pais e devolve o conjunto de ids alcançáveis,
  // incluindo o próprio commitId.
  function alcancaveis(estado, commitId) {
    var vistos = {};
    var pilha = commitId ? [commitId] : [];
    while (pilha.length > 0) {
      var id = pilha.pop();
      if (!id || vistos[id]) continue;
      vistos[id] = true;
      var c = acharCommit(estado, id);
      if (c) {
        for (var i = 0; i < c.pais.length; i++) pilha.push(c.pais[i]);
      }
    }
    return vistos;
  }

  function ehAncestral(estado, idA, idB) {
    if (!idA || !idB) return false;
    return alcancaveis(estado, idB)[idA] === true;
  }

  function merge(estado, nomeOrigem) {
    var origem = acharBranch(estado, nomeOrigem);
    if (!origem) {
      return { ok: false, erro: "A branch " + nomeOrigem + " não existe." };
    }
    var atual = branchAtual(estado);
    if (origem.nome === atual.nome) {
      return { ok: false, erro: "Não dá para mesclar uma branch nela mesma." };
    }
    if (!origem.pontaId) {
      return { ok: false, erro: "A branch " + nomeOrigem + " ainda não tem commits." };
    }

    var comando = "git merge " + nomeOrigem;

    // Nada a trazer: a ponta da origem já faz parte da história da branch atual.
    if (atual.pontaId && ehAncestral(estado, origem.pontaId, atual.pontaId)) {
      var eA = clonar(estado);
      registrar(eA, comando);
      return {
        ok: true, estado: eA, comando: comando,
        tipo: "atualizado", aviso: "Already up to date."
      };
    }

    // Fast-forward: a branch atual não andou desde a ramificação.
    if (!atual.pontaId || ehAncestral(estado, atual.pontaId, origem.pontaId)) {
      var eF = clonar(estado);
      acharBranch(eF, atual.nome).pontaId = origem.pontaId;
      registrar(eF, comando);
      return {
        ok: true, estado: eF, comando: comando,
        tipo: "fast-forward", aviso: "Fast-forward: a etiqueta só andou para frente."
      };
    }

    // Os dois lados avançaram: nasce um commit com dois pais.
    var e = clonar(estado);
    var destino = branchAtual(e);
    var id = gerarId(e.proximoId);

    e.commits.push({
      id: id,
      mensagem: "Merge branch '" + nomeOrigem + "' into " + destino.nome,
      pais: [destino.pontaId, origem.pontaId],
      autorId: destino.donoId,
      faixa: destino.faixa,
      ordem: e.proximoId - 1
    });
    e.proximoId = e.proximoId + 1;
    destino.pontaId = id;

    registrar(e, comando);
    return { ok: true, estado: e, comando: comando, tipo: "commit-de-merge" };
  }

  raiz.Repo = {
    CORES: CORES,
    gerarId: gerarId,
    estadoInicial: estadoInicial,
    clonar: clonar,
    acharBranch: acharBranch,
    acharCommit: acharCommit,
    branchAtual: branchAtual,
    commit: commit,
    registrarDev: registrarDev,
    criarBranch: criarBranch,
    checkout: checkout,
    alcancaveis: alcancaveis,
    ehAncestral: ehAncestral,
    merge: merge
  };
})(typeof globalThis !== "undefined" ? globalThis : this);

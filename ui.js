(function (raiz) {
  "use strict";

  function pegar(id) { return document.getElementById(id); }

  function opcao(valor, rotulo) {
    var o = document.createElement("option");
    o.value = valor;
    o.textContent = rotulo;
    return o;
  }

  function preencher(select, itens, vazio) {
    var anterior = select.value;
    select.innerHTML = "";
    if (itens.length === 0) {
      select.appendChild(opcao("", vazio));
      select.disabled = true;
      return;
    }
    select.disabled = false;
    itens.forEach(function (i) { select.appendChild(opcao(i.valor, i.rotulo)); });
    for (var k = 0; k < itens.length; k++) {
      if (itens[k].valor === anterior) { select.value = anterior; return; }
    }
  }

  function montar(aoExecutar) {
    pegar("btn-commit").addEventListener("click", function () {
      aoExecutar("commit", { mensagem: pegar("msg-commit").value });
    });

    pegar("msg-commit").addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") pegar("btn-commit").click();
    });

    pegar("btn-branch").addEventListener("click", function () {
      aoExecutar("criarBranch", {
        nome: pegar("nome-branch").value,
        dono: { nome: pegar("nome-dono").value, emoji: pegar("emoji-dono").value },
        jaMudar: pegar("ja-mudar").checked
      });
    });

    pegar("btn-checkout").addEventListener("click", function () {
      aoExecutar("checkout", { nome: pegar("sel-checkout").value });
    });

    pegar("btn-merge").addEventListener("click", function () {
      aoExecutar("merge", { nome: pegar("sel-merge").value });
    });

    pegar("btn-reset").addEventListener("click", function () {
      aoExecutar("reset", { commitId: pegar("sel-reset").value });
    });
  }

  function limparCampos(nomeAcao) {
    if (nomeAcao === "commit") pegar("msg-commit").value = "";
    if (nomeAcao === "criarBranch") {
      pegar("nome-branch").value = "";
      pegar("nome-dono").value = "";
      pegar("emoji-dono").value = "";
    }
  }

  function limparErros() {
    ["commit", "branch", "checkout", "merge", "reset"].forEach(function (n) {
      pegar("erro-" + n).textContent = "";
    });
    pegar("avisos").innerHTML = "";
  }

  var MAPA_ERRO = {
    commit: "erro-commit",
    criarBranch: "erro-branch",
    checkout: "erro-checkout",
    merge: "erro-merge",
    reset: "erro-reset"
  };

  function mostrarErro(nomeAcao, mensagem) {
    var alvo = pegar(MAPA_ERRO[nomeAcao] || "erro-commit");
    alvo.textContent = mensagem;
  }

  function mostrarAviso(mensagem) {
    var p = document.createElement("p");
    p.className = "aviso";
    p.textContent = mensagem;
    pegar("avisos").appendChild(p);
  }

  function pintarBarra(estado) {
    var br = Repo.branchAtual(estado);
    var dono = null;
    for (var i = 0; i < estado.devs.length; i++) {
      if (estado.devs[i].id === br.donoId) dono = estado.devs[i];
    }
    pegar("barra-head").innerHTML =
      "HEAD → <strong>" + br.nome + "</strong> &nbsp; " +
      (dono ? dono.emoji + " " + dono.nome : "");
  }

  function pintarEquipe(estado) {
    var painel = pegar("painel-equipe");
    painel.innerHTML = "";
    estado.branches.forEach(function (br) {
      var dono = null;
      for (var i = 0; i < estado.devs.length; i++) {
        if (estado.devs[i].id === br.donoId) dono = estado.devs[i];
      }
      var div = document.createElement("div");
      div.className = "dev" + (estado.HEAD.branch === br.nome ? " ativo" : "");
      div.style.borderLeftColor = br.cor;
      div.innerHTML =
        '<span class="dev-emoji">' + (dono ? dono.emoji : "🧑‍💻") + "</span>" +
        '<span><span class="dev-nome">' + (dono ? dono.nome : "Dev") + "</span><br>" +
        '<span class="dev-branch">' + br.nome + "</span></span>";
      painel.appendChild(div);
    });
  }

  function pintarHistorico(estado) {
    var lista = pegar("lista-historico");
    lista.innerHTML = "";
    estado.historico.forEach(function (h, i) {
      var li = document.createElement("li");
      if (i === estado.historico.length - 1) li.className = "recente";
      var code = document.createElement("code");
      code.textContent = h.comando;
      li.appendChild(code);
      lista.appendChild(li);
    });
    lista.scrollTop = lista.scrollHeight;
  }

  function pintarDropdowns(estado) {
    var atual = estado.HEAD.branch;

    preencher(pegar("sel-checkout"), estado.branches
      .filter(function (b) { return b.nome !== atual; })
      .map(function (b) { return { valor: b.nome, rotulo: b.nome }; }),
      "só existe a branch atual");

    preencher(pegar("sel-merge"), estado.branches
      .filter(function (b) { return b.nome !== atual && b.pontaId; })
      .map(function (b) { return { valor: b.nome, rotulo: b.nome + " → " + atual }; }),
      "nada para mesclar");

    preencher(pegar("sel-reset"), Repo.commitsAlcancaveis(estado)
      .map(function (c) { return { valor: c.id, rotulo: c.id + "  " + c.mensagem }; }),
      "sem commit anterior");
  }

  function atualizar(estado) {
    pintarBarra(estado);
    pintarEquipe(estado);
    pintarHistorico(estado);
    pintarDropdowns(estado);

    pegar("btn-branch").disabled = !Repo.branchAtual(estado).pontaId;

    // Botão segue o select: sem opção para escolher, não há o que executar.
    // Sem isto, clicar em Merge no início da aula joga no projetor a mensagem
    // sem sentido "A branch  não existe."
    ["checkout", "merge", "reset"].forEach(function (n) {
      pegar("btn-" + n).disabled = pegar("sel-" + n).disabled;
    });

    pegar("dica-vazio").style.display = estado.commits.length === 0 ? "block" : "none";
  }

  raiz.UI = {
    montar: montar,
    atualizar: atualizar,
    limparCampos: limparCampos,
    limparErros: limparErros,
    mostrarErro: mostrarErro,
    mostrarAviso: mostrarAviso
  };
})(typeof globalThis !== "undefined" ? globalThis : this);

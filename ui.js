(function (raiz) {
  "use strict";

  // Guardado aqui (em vez de mudar a assinatura de atualizar/pintarEquipe) porque
  // montar() já é o único lugar que recebe o callback vindo de main.js.
  var acaoAoExecutar = null;

  // Cada barra lateral se limita SOZINHA a 30% da janela, com um piso de 220px que
  // CEDE quando a janela é muito estreita. Como as duas juntas nunca passam de 60%,
  // o miolo é sempre a maior coluna em qualquer janela acima de ~160px — aritmética,
  // sem precisar comparar uma barra com a outra.
  var LARGURA_MINIMA = 220;   // abaixo disto o campo de nome + emoji do painel Ações quebra
  var FRACAO_MAXIMA = 0.30;

  function clampLargura(desejada, larguraJanela) {
    // Sem uma janela válida não há teto a calcular.
    if (typeof larguraJanela !== "number" || !isFinite(larguraJanela)) return LARGURA_MINIMA;
    var teto = larguraJanela * FRACAO_MAXIMA;
    // O piso CEDE quando a janela é estreita demais para bancá-lo. Travar as duas
    // barras em 220px numa janela de 600px deixaria o miolo com 144px — menor que
    // elas, quebrando a única promessa da feature. Cedendo junto, as duas ficam em
    // 30% e o miolo continua com ~40%.
    var piso = Math.min(LARGURA_MINIMA, teto);
    if (typeof desejada !== "number" || !isFinite(desejada)) return piso;
    return Math.max(piso, Math.min(desejada, teto));
  }

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

  function acharDev(estado, donoId) {
    for (var i = 0; i < estado.devs.length; i++) {
      if (estado.devs[i].id === donoId) return estado.devs[i];
    }
    return null;
  }

  function span(classe, texto) {
    var el = document.createElement("span");
    if (classe) el.className = classe;
    el.textContent = texto;
    return el;
  }

  function montar(aoExecutar) {
    acaoAoExecutar = aoExecutar;

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

  var PADRAO_ESQ = 300;
  var PADRAO_DIR = 320;
  var PASSO_TECLADO = 16;

  function configurarDivisoria(alca, variavel, padrao, ehEsquerda, colunas, aoRedimensionar) {
    var pendente = false;
    var deslocamento = 0;

    // Distância do cursor até a borda externa da janela do lado desta barra.
    function larguraCrua(clientX) {
      var caixa = colunas.getBoundingClientRect();
      return ehEsquerda ? clientX - caixa.left : caixa.right - clientX;
    }

    function larguraAtual() {
      var valor = parseFloat(getComputedStyle(colunas).getPropertyValue(variavel));
      return isFinite(valor) ? valor : padrao;
    }

    function aplicar(desejada) {
      colunas.style.setProperty(variavel, clampLargura(desejada, window.innerWidth) + "px");
      // Um arraste dispara dezenas de pointermove por segundo. Uma vez por
      // quadro basta para o grafo parecer colado na divisória.
      if (pendente) return;
      pendente = true;
      requestAnimationFrame(function () {
        pendente = false;
        aoRedimensionar();
      });
    }

    alca.addEventListener("pointerdown", function (ev) {
      ev.preventDefault();
      // Sem captura, um arraste rápido tira o cursor da faixa de 8px antes do
      // próximo evento e o gesto "escapa" no meio do caminho.
      alca.setPointerCapture(ev.pointerId);
      alca.classList.add("arrastando");
      document.body.classList.add("redimensionando");
      // Guarda onde dentro da faixa o professor pegou, para a borda não pular
      // até o cursor no primeiro pixel de movimento.
      deslocamento = larguraAtual() - larguraCrua(ev.clientX);
    });

    alca.addEventListener("pointermove", function (ev) {
      if (!alca.hasPointerCapture(ev.pointerId)) return;
      aplicar(larguraCrua(ev.clientX) + deslocamento);
    });

    function soltar(ev) {
      if (alca.hasPointerCapture(ev.pointerId)) alca.releasePointerCapture(ev.pointerId);
      alca.classList.remove("arrastando");
      document.body.classList.remove("redimensionando");
    }
    alca.addEventListener("pointerup", soltar);
    alca.addEventListener("pointercancel", soltar);

    alca.addEventListener("dblclick", function () { aplicar(padrao); });

    alca.addEventListener("keydown", function (ev) {
      // Na barra da direita, mover a divisória para a direita ESTREITA a barra.
      // O sinal invertido é o que faz a seta concordar com o que se vê.
      var passo = ehEsquerda ? PASSO_TECLADO : -PASSO_TECLADO;
      if (ev.key === "ArrowRight") aplicar(larguraAtual() + passo);
      else if (ev.key === "ArrowLeft") aplicar(larguraAtual() - passo);
      else if (ev.key === "Home") aplicar(0);                    // clampLargura leva ao mínimo
      else if (ev.key === "End") aplicar(window.innerWidth);     // clampLargura leva ao máximo
      else return;
      ev.preventDefault();
    });

    // Devolve um jeito de reaplicar o limite sobre a largura atual, sem mexer nela
    // de propósito. Quem chama: a abertura da página e o resize da janela.
    return function () { aplicar(larguraAtual()); };
  }

  function montarDivisorias(aoRedimensionar) {
    var colunas = document.querySelector(".colunas");
    var reancorarEsq = configurarDivisoria(pegar("divisoria-esq"), "--col-esq", PADRAO_ESQ, true, colunas, aoRedimensionar);
    var reancorarDir = configurarDivisoria(pegar("divisoria-dir"), "--col-dir", PADRAO_DIR, false, colunas, aoRedimensionar);

    // As larguras padrão não passam pelo clamp sozinhas. Numa janela de 800px,
    // 300 + 320 + 16 deixa o miolo com 164px — menor que as duas barras, logo na
    // abertura e antes de qualquer arraste. O mesmo vale quando o professor
    // estreita a janela depois: o valor em px guardado continua sendo o antigo.
    // Sem estas duas chamadas a promessa da feature só passa a valer depois do
    // primeiro arraste.
    function reancorar() { reancorarEsq(); reancorarDir(); }
    reancorar();
    window.addEventListener("resize", reancorar);
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
    reset: "erro-reset",
    editarDev: "erro-branch"
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
    var dono = acharDev(estado, br.donoId);
    var alvo = pegar("barra-head");

    alvo.textContent = "HEAD → ";
    var forte = document.createElement("strong");
    forte.textContent = br.nome;
    alvo.appendChild(forte);
    if (dono) {
      alvo.appendChild(document.createTextNode("  " + dono.emoji + " " + dono.nome));
    }
  }

  function pintarEquipe(estado) {
    var painel = pegar("painel-equipe");
    painel.textContent = "";
    estado.branches.forEach(function (br) {
      var dono = acharDev(estado, br.donoId);

      var div = document.createElement("div");
      div.className = "dev" + (estado.HEAD.branch === br.nome ? " ativo" : "");
      div.style.borderLeftColor = br.cor;
      div.title = "Clique para renomear";
      div.style.cursor = "pointer";

      function pintarConteudo() {
        div.textContent = "";
        div.appendChild(span("dev-emoji", dono ? dono.emoji : "🧑‍💻"));
        var bloco = document.createElement("span");
        bloco.appendChild(span("dev-nome", dono ? dono.nome : "Dev"));
        bloco.appendChild(document.createElement("br"));
        bloco.appendChild(span("dev-branch", br.nome));
        div.appendChild(bloco);
      }

      function abrirEditor() {
        div.classList.add("editando");
        div.textContent = "";

        var inputNome = document.createElement("input");
        inputNome.type = "text";
        inputNome.className = "dev-editar-nome";
        inputNome.value = dono ? dono.nome : "";

        var inputEmoji = document.createElement("input");
        inputEmoji.type = "text";
        inputEmoji.className = "dev-editar-emoji";
        inputEmoji.maxLength = 4;
        inputEmoji.value = dono ? dono.emoji : "";

        var btnSalvar = document.createElement("button");
        btnSalvar.type = "button";
        btnSalvar.className = "dev-editar-salvar";
        btnSalvar.textContent = "Salvar";

        // Trava contra reentrância: salvar() e cancelar() disparam de vários
        // eventos (Enter, clique no Salvar, Escape, sair do editor) e só o
        // primeiro pode valer.
        var resolvido = false;

        function salvar() {
          if (resolvido) return;
          resolvido = true;
          var ok = acaoAoExecutar("editarDev", { donoId: br.donoId, nome: inputNome.value, emoji: inputEmoji.value });
          // Rejeitado (ex.: nome vazio): não há redesenho para destruir este
          // editor, então solta a trava para o professor poder corrigir e
          // tentar de novo em vez de ficar com a linha travada.
          if (ok === false) resolvido = false;
        }

        function cancelar() {
          if (resolvido) return;
          resolvido = true;
          div.classList.remove("editando");
          pintarConteudo();
        }

        function teclado(ev) {
          if (ev.key === "Enter") salvar();
          else if (ev.key === "Escape") cancelar();
        }
        inputNome.addEventListener("keydown", teclado);
        inputEmoji.addEventListener("keydown", teclado);

        // mousedown, não click: dispara ANTES do campo em foco perder o foco.
        // Com click, o blur fecharia o editor primeiro e o clique no Salvar
        // nunca chegaria a valer.
        btnSalvar.addEventListener("mousedown", function (ev) {
          ev.preventDefault();
          salvar();
        });

        // focusout (não blur) para poder checar PARA ONDE o foco foi: alternar
        // entre nome e emoji com Tab não pode fechar o editor, só sair dele
        // por completo conta como "blur sem mudança" e cancela.
        div.addEventListener("focusout", function (ev) {
          if (resolvido) return;
          if (ev.relatedTarget && div.contains(ev.relatedTarget)) return;
          cancelar();
        });

        div.appendChild(inputNome);
        div.appendChild(inputEmoji);
        div.appendChild(btnSalvar);
        inputNome.focus();
        inputNome.select();
      }

      pintarConteudo();

      div.addEventListener("click", function () {
        // Sem isto, clicar dentro do próprio input (para posicionar o cursor)
        // borbulharia até aqui e reabriria o editor por cima dele mesmo.
        if (div.classList.contains("editando")) return;
        abrirEditor();
      });

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
    mostrarAviso: mostrarAviso,
    clampLargura: clampLargura,
    montarDivisorias: montarDivisorias
  };
})(typeof globalThis !== "undefined" ? globalThis : this);

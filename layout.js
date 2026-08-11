(function (raiz) {
  "use strict";

  var Repo = raiz.Repo;
  if (!Repo && typeof require !== "undefined") {
    require("./repo.js");
    Repo = raiz.Repo;
  }

  var RAIO = 18;
  var ESPACO_X = 96;
  var ESPACO_Y = 96;
  var MARGEM_X = 90;
  var MARGEM_Y = 70;
  var DESLOC_ETIQUETA_X = 34;  // etiqueta fica à direita do commit-ponta
  var ALTURA_ETIQUETA = 30;    // passo do empilhamento
  var LARGURA_HEAD = 62;       // folga para "◀ HEAD" depois da pílula, com margem
  var MEIA_LEGENDA = 55;       // metade da largura máxima de uma legenda de 12 caracteres
  var COR_FANTASMA = "#64748b"; // cinza-ardósia: visível no escuro, claramente apagado

  function calcular(estado) {
    var orfaos = {};
    var listaOrfaos = Repo.orfaos(estado);
    for (var i = 0; i < listaOrfaos.length; i++) orfaos[listaOrfaos[i]] = true;

    // A faixa fantasma fica sempre abaixo de todas as faixas de branch.
    var maiorFaixa = 0;
    for (var b = 0; b < estado.branches.length; b++) {
      if (estado.branches[b].faixa > maiorFaixa) maiorFaixa = estado.branches[b].faixa;
    }
    var faixaFantasma = maiorFaixa + 1;

    var corDaFaixa = {};
    var emojiDoDev = {};
    for (var d = 0; d < estado.devs.length; d++) emojiDoDev[estado.devs[d].id] = estado.devs[d].emoji;
    for (var k = 0; k < estado.branches.length; k++) corDaFaixa[estado.branches[k].faixa] = estado.branches[k].cor;

    // ----- nós -----
    var pos = {};
    var nos = [];
    for (var c = 0; c < estado.commits.length; c++) {
      var commit = estado.commits[c];
      var orfao = orfaos[commit.id] === true;
      var faixa = orfao ? faixaFantasma : commit.faixa;
      var x = MARGEM_X + commit.ordem * ESPACO_X;
      var y = MARGEM_Y + faixa * ESPACO_Y;
      pos[commit.id] = { x: x, y: y, faixa: faixa };
      nos.push({
        id: commit.id,
        x: x,
        y: y,
        cor: orfao ? COR_FANTASMA : (corDaFaixa[commit.faixa] || COR_FANTASMA),
        emoji: emojiDoDev[commit.autorId] || "🧑‍💻",
        mensagem: commit.mensagem,
        orfao: orfao,
        faixa: faixa
      });
    }

    // ----- arestas -----
    var arestas = [];
    for (var n = 0; n < estado.commits.length; n++) {
      var filho = estado.commits[n];
      for (var p = 0; p < filho.pais.length; p++) {
        var pai = filho.pais[p];
        if (!pos[pai] || !pos[filho.id]) continue;
        arestas.push({
          de: pai,
          para: filho.id,
          x1: pos[pai].x,
          y1: pos[pai].y,
          x2: pos[filho.id].x,
          y2: pos[filho.id].y,
          tipo: pos[pai].faixa === pos[filho.id].faixa ? "reta" : "curva",
          cor: pos[filho.id].faixa === faixaFantasma ? COR_FANTASMA : (corDaFaixa[filho.faixa] || COR_FANTASMA)
        });
      }
    }

    // ----- etiquetas -----
    // Ancoradas no commit-ponta. branch.faixa decide onde nascem commits futuros,
    // não onde a etiqueta é desenhada. Etiquetas no mesmo commit empilham.
    var porPonta = {};
    var ordemPonta = [];
    for (var q = 0; q < estado.branches.length; q++) {
      var br = estado.branches[q];
      if (!br.pontaId) continue;
      if (!porPonta[br.pontaId]) { porPonta[br.pontaId] = []; ordemPonta.push(br.pontaId); }
      porPonta[br.pontaId].push(br);
    }

    var etiquetas = [];
    for (var o = 0; o < ordemPonta.length; o++) {
      var pontaId = ordemPonta[o];
      var grupo = porPonta[pontaId];
      var centro = ((grupo.length - 1) * ALTURA_ETIQUETA) / 2;
      for (var g = 0; g < grupo.length; g++) {
        var emoji = emojiDoDev[grupo[g].donoId] || "🧑‍💻";
        var rotulo = emoji + " " + grupo[g].nome;
        etiquetas.push({
          nome: grupo[g].nome,
          cor: grupo[g].cor,
          emoji: emoji,
          commitId: pontaId,
          x: pos[pontaId].x + DESLOC_ETIQUETA_X,
          y: pos[pontaId].y + g * ALTURA_ETIQUETA - centro,
          ehHead: estado.HEAD.branch === grupo[g].nome,
          larguraPilula: 22 + rotulo.length * 9.5
        });
      }
    }

    // ----- faixas -----
    var faixas = [];
    for (var f = 0; f < estado.branches.length; f++) {
      var bf = estado.branches[f];
      if (!bf.pontaId) continue; // branch ainda sem commit não tem faixa para desenhar
      faixas.push({
        indice: bf.faixa,
        y: MARGEM_Y + bf.faixa * ESPACO_Y,
        nome: bf.nome,
        cor: bf.cor,
        ativa: estado.HEAD.branch === bf.nome,
        fantasma: false
      });
    }
    faixas.sort(function (a, z) { return a.indice - z.indice; });
    if (listaOrfaos.length > 0) {
      faixas.push({
        indice: faixaFantasma,
        y: MARGEM_Y + faixaFantasma * ESPACO_Y,
        nome: "commits abandonados",
        cor: COR_FANTASMA,
        ativa: false,
        fantasma: true
      });
    }

    var maiorX = MARGEM_X;
    for (var m = 0; m < nos.length; m++) if (nos[m].x > maiorX) maiorX = nos[m].x;
    var ultimaFaixa = faixas.length > 0 ? faixas[faixas.length - 1].indice : 0;

    // A largura vem do conteúdo, não de uma folga fixa: cada etiqueta reserva
    // espaço para a própria pílula MAIS o marcador "◀ HEAD", ainda que ela não
    // seja o HEAD agora — assim o canvas não pula de largura quando o HEAD muda.
    var largura = maiorX + MEIA_LEGENDA;
    for (var ie = 0; ie < etiquetas.length; ie++) {
      var direita = etiquetas[ie].x + etiquetas[ie].larguraPilula + 10 + LARGURA_HEAD;
      if (direita > largura) largura = direita;
    }

    return {
      nos: nos,
      arestas: arestas,
      etiquetas: etiquetas,
      faixas: faixas,
      largura: largura,
      altura: MARGEM_Y + (ultimaFaixa + 1) * ESPACO_Y,
      vazio: nos.length === 0
    };
  }

  raiz.Layout = {
    calcular: calcular,
    RAIO: RAIO,
    ESPACO_X: ESPACO_X,
    ESPACO_Y: ESPACO_Y,
    MARGEM_X: MARGEM_X,
    MARGEM_Y: MARGEM_Y,
    LARGURA_HEAD: LARGURA_HEAD,
    COR_FANTASMA: COR_FANTASMA
  };
})(typeof globalThis !== "undefined" ? globalThis : this);

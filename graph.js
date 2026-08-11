(function (raiz) {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var svg = null;
  var grupos = {};

  // Elementos reaproveitados entre desenhos, indexados por chave estável:
  // commits por id, etiquetas por nome de branch.
  //
  // Isto NÃO é otimização — é o que faz a animação existir. Transição CSS só
  // dispara quando um elemento JÁ ESTAVA na tela com outro valor. Se recriássemos
  // tudo a cada desenho, a etiqueta teletransportaria em vez de deslizar, e o
  // principal recurso didático do app iria embora.
  var vistos = { nos: {}, etiquetas: {} };

  function criar(tag, atributos) {
    var el = document.createElementNS(NS, tag);
    for (var k in atributos) {
      if (Object.prototype.hasOwnProperty.call(atributos, k)) el.setAttribute(k, atributos[k]);
    }
    return el;
  }

  function limpar(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  // Ordem de criação = ordem de pintura. Faixas ficam por baixo de tudo,
  // etiquetas por cima de tudo.
  function montar(elementoSvg) {
    svg = elementoSvg;
    limpar(svg);
    vistos = { nos: {}, etiquetas: {} };
    ["faixas", "arestas", "nos", "etiquetas"].forEach(function (nome) {
      grupos[nome] = criar("g", { "class": "grupo-" + nome });
      svg.appendChild(grupos[nome]);
    });
  }

  // Descarta os elementos cuja chave sumiu do layout (ex.: reiniciar, desfazer).
  function podar(cache, grupo, presentes) {
    for (var chave in cache) {
      if (!Object.prototype.hasOwnProperty.call(cache, chave)) continue;
      if (!presentes[chave]) {
        grupo.removeChild(cache[chave].g);
        delete cache[chave];
      }
    }
  }

  function desenharFaixas(layout) {
    limpar(grupos.faixas);
    layout.faixas.forEach(function (f) {
      grupos.faixas.appendChild(criar("rect", {
        "class": "faixa-fundo" + (f.ativa ? " ativa" : ""),
        x: 0, y: f.y - 44, width: layout.largura, height: 88
      }));
      var texto = criar("text", { "class": "faixa-nome", x: 10, y: f.y - 26 });
      texto.textContent = f.nome;
      texto.setAttribute("fill", f.cor);
      grupos.faixas.appendChild(texto);
    });
  }

  function desenharArestas(layout) {
    limpar(grupos.arestas);
    layout.arestas.forEach(function (a) {
      var d;
      if (a.tipo === "reta") {
        d = "M " + a.x1 + " " + a.y1 + " L " + a.x2 + " " + a.y2;
      } else {
        // Bézier cúbica: sai na horizontal do pai e chega na horizontal do filho,
        // o que deixa a ramificação com cara de trilho de trem.
        var meio = (a.x1 + a.x2) / 2;
        d = "M " + a.x1 + " " + a.y1 +
            " C " + meio + " " + a.y1 + ", " + meio + " " + a.y2 + ", " + a.x2 + " " + a.y2;
      }
      grupos.arestas.appendChild(criar("path", {
        "class": "aresta" + (a.cor === Layout.COR_FANTASMA ? " fantasma" : ""),
        d: d,
        stroke: a.cor
      }));
    });
  }

  // Reaproveita o <g> de cada commit (chave = id) para que a descida até a faixa
  // fantasma, no reset, seja animada em vez de instantânea.
  function desenharNos(layout) {
    var presentes = {};

    layout.nos.forEach(function (n) {
      presentes[n.id] = true;
      var item = vistos.nos[n.id];

      if (!item) {
        item = {
          g: criar("g", { "class": "no" }),
          circulo: criar("circle", { "class": "no-circulo", r: Layout.RAIO }),
          emoji: criar("text", { "class": "no-emoji", x: 0, y: 1 }),
          msg: criar("text", { "class": "no-msg", x: 0, y: Layout.RAIO + 20 }),
          titulo: criar("title", {})
        };
        item.g.appendChild(item.circulo);
        item.g.appendChild(item.emoji);
        item.g.appendChild(item.msg);
        item.g.appendChild(item.titulo);
        // Posiciona ANTES de entrar no DOM: assim o commit novo aparece no lugar
        // certo, e só os movimentos posteriores é que animam.
        item.g.setAttribute("transform", "translate(" + n.x + "," + n.y + ")");
        grupos.nos.appendChild(item.g);
        vistos.nos[n.id] = item;
      }

      item.g.setAttribute("class", "no" + (n.orfao ? " fantasma" : ""));
      item.g.setAttribute("transform", "translate(" + n.x + "," + n.y + ")");
      item.circulo.setAttribute("fill", n.cor);
      item.emoji.textContent = n.emoji;
      item.msg.textContent = n.mensagem.length > 12 ? n.mensagem.slice(0, 11) + "…" : n.mensagem;
      item.titulo.textContent = n.id + " — " + n.mensagem;
    });

    podar(vistos.nos, grupos.nos, presentes);
  }

  // A chave é o NOME da branch, não o commit. É exatamente por isso que a etiqueta
  // desliza: quando um commit novo entra, o mesmo <g> continua na tela e só muda de
  // transform — que é o momento "a master não copiou nada, ela só andou".
  function desenharEtiquetas(layout) {
    var presentes = {};

    layout.etiquetas.forEach(function (e) {
      presentes[e.nome] = true;
      var item = vistos.etiquetas[e.nome];

      if (!item) {
        item = {
          g: criar("g", { "class": "etiqueta" }),
          linha: criar("line", { "class": "etiqueta-linha", x2: 0, y2: 0 }),
          fundo: criar("rect", { "class": "etiqueta-fundo", y: -13, height: 26 }),
          texto: criar("text", { "class": "etiqueta-texto", x: 11, y: 1 }),
          head: criar("text", { "class": "marca-head", y: 1 })
        };
        item.g.appendChild(item.linha);
        item.g.appendChild(item.fundo);
        item.g.appendChild(item.texto);
        item.g.appendChild(item.head);
        item.g.setAttribute("transform", "translate(" + e.x + "," + e.y + ")");
        grupos.etiquetas.appendChild(item.g);
        vistos.etiquetas[e.nome] = item;
      }

      var rotulo = e.emoji + " " + e.nome;
      var largura = e.larguraPilula;

      item.g.setAttribute("transform", "translate(" + e.x + "," + e.y + ")");

      // Conector até o commit, em coordenadas locais do <g>. Deixa explícito em
      // qual bolinha a etiqueta está grudada.
      item.linha.setAttribute("x1", layoutXdoCommit(layout, e.commitId) - e.x);
      item.linha.setAttribute("y1", layoutYdoCommit(layout, e.commitId) - e.y);
      item.linha.setAttribute("stroke", e.cor);

      item.fundo.setAttribute("x", 0);
      item.fundo.setAttribute("width", largura);
      item.fundo.setAttribute("fill", e.cor);

      item.texto.textContent = rotulo;

      item.head.setAttribute("x", largura + 10);
      item.head.textContent = e.ehHead ? "◀ HEAD" : "";
    });

    podar(vistos.etiquetas, grupos.etiquetas, presentes);
  }

  function layoutXdoCommit(layout, id) {
    for (var i = 0; i < layout.nos.length; i++) if (layout.nos[i].id === id) return layout.nos[i].x;
    return 0;
  }

  function layoutYdoCommit(layout, id) {
    for (var i = 0; i < layout.nos.length; i++) if (layout.nos[i].id === id) return layout.nos[i].y;
    return 0;
  }

  // Devolve as dimensões REAIS desenhadas — que não são as do layout quando há
  // etiquetas acima de y=0. Task 10 usa este retorno, não layout.altura.
  function desenhar(layout) {
    // Uma pilha alta de etiquetas no mesmo commit sobe acima de y=0: com
    // MARGEM_Y=70 e passo de 30, seis branches no mesmo commit já estouram.
    // (Cenário real de aula: "cada aluno cria a sua branch a partir daqui".)
    // Um viewBox fixo em "0 0 …" cortaria as de cima, então o topo acompanha.
    var minY = 0;
    for (var i = 0; i < layout.etiquetas.length; i++) {
      var topo = layout.etiquetas[i].y - 13; // metade da altura da pílula
      if (topo < minY) minY = topo;
    }
    var altura = layout.altura - minY;

    svg.setAttribute("width", layout.largura);
    svg.setAttribute("height", altura);
    svg.setAttribute("viewBox", minY === 0
      ? "0 0 " + layout.largura + " " + altura
      : "0 " + minY + " " + layout.largura + " " + altura);

    desenharFaixas(layout);
    desenharArestas(layout);
    desenharNos(layout);
    desenharEtiquetas(layout);

    return { largura: layout.largura, altura: altura };
  }

  raiz.Graph = { montar: montar, desenhar: desenhar };
})(typeof globalThis !== "undefined" ? globalThis : this);

(function (raiz) {
  "use strict";

  var casos = [];

  function teste(nome, fn) {
    casos.push({ nome: nome, fn: fn });
  }

  function igual(recebido, esperado, msg) {
    var a = JSON.stringify(recebido);
    var b = JSON.stringify(esperado);
    if (a !== b) {
      throw new Error((msg || "valores diferentes") +
        "\n    esperado: " + b +
        "\n    recebido: " + a);
    }
  }

  function verdade(valor, msg) {
    if (!valor) throw new Error(msg || "esperava verdadeiro, veio " + JSON.stringify(valor));
  }

  function rodar(aoTerminar) {
    var linhas = [];
    var falhas = 0;
    for (var i = 0; i < casos.length; i++) {
      try {
        casos[i].fn();
        linhas.push({ ok: true, nome: casos[i].nome });
      } catch (err) {
        falhas++;
        linhas.push({ ok: false, nome: casos[i].nome, erro: err.message });
      }
    }
    aoTerminar(linhas, casos.length, falhas);
  }

  raiz.MiniTeste = { teste: teste, igual: igual, verdade: verdade, rodar: rodar };
})(typeof globalThis !== "undefined" ? globalThis : this);

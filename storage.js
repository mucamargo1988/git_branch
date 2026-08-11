(function (raiz) {
  "use strict";

  var CHAVE = "git-branch-aula/v1";
  var LIMITE_DESFAZER = 50;
  var pilha = [];

  function salvar(estado) {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(estado));
    } catch (err) {
      // Modo anônimo ou armazenamento cheio: o app continua funcionando,
      // só não sobrevive a um F5. Não vale interromper a aula por isso.
    }
  }

  function carregar() {
    try {
      var bruto = localStorage.getItem(CHAVE);
      if (!bruto) return null;
      var estado = JSON.parse(bruto);
      // Guarda contra um localStorage de versão antiga ou corrompido. Confere os
      // quatro campos que a tela lê logo no primeiro desenho — faltando qualquer
      // um deles, o app quebraria em cima da aula em vez de simplesmente começar
      // do zero.
      if (!estado || !estado.branches || !estado.HEAD ||
          !estado.historico || !estado.devs || !estado.commits) return null;
      return estado;
    } catch (err) {
      return null;
    }
  }

  function limpar() {
    try { localStorage.removeItem(CHAVE); } catch (err) { /* ver salvar() */ }
    pilha = [];
  }

  function empilhar(estado) {
    pilha.push(JSON.stringify(estado));
    if (pilha.length > LIMITE_DESFAZER) pilha.shift();
  }

  function desempilhar() {
    if (pilha.length === 0) return null;
    return JSON.parse(pilha.pop());
  }

  function podeDesfazer() {
    return pilha.length > 0;
  }

  raiz.Storage = {
    salvar: salvar,
    carregar: carregar,
    limpar: limpar,
    empilhar: empilhar,
    desempilhar: desempilhar,
    podeDesfazer: podeDesfazer
  };
})(typeof globalThis !== "undefined" ? globalThis : this);

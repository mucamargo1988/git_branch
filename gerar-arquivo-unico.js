// Gera branches-na-pratica.html: um único arquivo com CSS e JS embutidos,
// para o professor mandar por WhatsApp ou Classroom.
// Uso: node gerar-arquivo-unico.js
//
// A pasta é a fonte da verdade. Este arquivo é sempre derivado dela.

var fs = require("fs");

var SCRIPTS = ["repo.js", "layout.js", "graph.js", "storage.js", "ui.js", "main.js"];

var html = fs.readFileSync("index.html", "utf8");
var css = fs.readFileSync("styles.css", "utf8");

// Atenção: as substituições usam FUNÇÃO como segundo argumento, não string.
// String.prototype.replace interpreta $&, $1 e $` dentro de uma string de
// substituição como retrovisor. Nenhum arquivo tem "$" hoje, mas no dia em que
// alguém escrever uma regex ou um preço no CSS, o arquivo único divergiria em
// silêncio da versão em pasta — e o guard lá embaixo não pegaria.
html = html.replace(
  '<link rel="stylesheet" href="styles.css">',
  function () { return "<style>\n" + css + "\n</style>"; }
);

SCRIPTS.forEach(function (arquivo) {
  var js = fs.readFileSync(arquivo, "utf8");
  html = html.replace(
    '<script src="' + arquivo + '"></script>',
    function () { return "<script>\n" + js + "\n</script>"; }
  );
});

if (html.indexOf('<script src="') !== -1 || html.indexOf('<link rel="stylesheet"') !== -1) {
  console.error("ERRO: sobrou referência externa no HTML. O arquivo único não ficaria autocontido.");
  process.exit(1);
}

fs.writeFileSync("branches-na-pratica.html", html);
console.log("branches-na-pratica.html gerado (" + Math.round(html.length / 1024) + " KB)");

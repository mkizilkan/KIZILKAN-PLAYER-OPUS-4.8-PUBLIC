/**
 * KULLANIM-ÖNCE-TANIM DENETLEYİCİSİ (7. araç)
 * "const hoisting yok" hatasını yakalar: bir bileşen gövdesinde, henüz
 * TANIMLANMAMIŞ bir const'un hook çağrısı içinde kullanılması.
 * Bu hata SESSİZDİR (try/catch varsa çökmez, sadece çalışmaz).
 */
const ts = require(require.resolve("typescript", { paths: [process.cwd(), __dirname] }));
const fs = require('fs');
const path = require('path');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

let problems = 0;
for (const file of [...walk('app'), ...walk('src')]) {
  const src = fs.readFileSync(file, 'utf8');
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.ESNext, true, kind);

  // Bileşen/fonksiyon gövdelerini tek tek incele
  function checkBody(body) {
    if (!body || !body.statements) return;
    // Bu gövdedeki const tanımlarının konumu
    const declPos = new Map();
    body.statements.forEach(st => {
      if (ts.isVariableStatement(st) && (st.declarationList.flags & ts.NodeFlags.Const)) {
        st.declarationList.declarations.forEach(d => {
          if (ts.isIdentifier(d.name)) declPos.set(d.name.text, d.getStart());
        });
      }
    });
    if (declPos.size === 0) return;

    // Hook çağrılarını bul (useXxx({...}) biçimi)
    body.statements.forEach(st => {
      if (!ts.isExpressionStatement(st)) return;
      const expr = st.expression;
      if (!ts.isCallExpression(expr)) return;
      if (!ts.isIdentifier(expr.expression) || !/^use[A-Z]/.test(expr.expression.text)) return;
      const callPos = expr.getStart();
      const hookName = expr.expression.text;

      /**
       * ÖNEMLİ AYRIM:
       * useEffect(() => { ... }) gibi hook'lar geri çağırmayı SONRA çalıştırır;
       * o an değişken tanımlı olur -> YANLIŞ ALARM.
       * Riskli olan, hook'a ANINDA okunan değer verilmesidir:
       *   useRemoteKeys({ channelUp: () => zap(1), playPause: togglePlay })
       * Burada `togglePlay` nesne oluşturulurken HEMEN okunur -> undefined.
       * Bu yüzden yalnızca ok fonksiyonu GÖVDESİ DIŞINDA kalan, doğrudan
       * referansları işaretliyoruz.
       */
      const used = new Set();
      function scan(n, insideCallback) {
        // Geri çağırma gövdesine girince artık "sonra çalışacak" sayılır
        if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
          ts.forEachChild(n, (c) => scan(c, true));
          return;
        }
        if (ts.isIdentifier(n) && !insideCallback) used.add(n.text);
        ts.forEachChild(n, (c) => scan(c, insideCallback));
      }
      expr.arguments.forEach(a => scan(a, false));

      for (const name of used) {
        const dp = declPos.get(name);
        if (dp !== undefined && dp > callPos) {
          const pos = sf.getLineAndCharacterOfPosition(callPos);
          const dpos = sf.getLineAndCharacterOfPosition(dp);
          console.log(`  KULLANIM-ÖNCE-TANIM  ${file}:${pos.line + 1}  ->  ${hookName}() içinde '${name}' kullanılıyor ama satır ${dpos.line + 1}'de tanımlanıyor`);
          problems++;
        }
      }
    });
  }

  function visit(node) {
    if ((ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && node.body && ts.isBlock(node.body)) {
      checkBody(node.body);
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}
console.log(problems === 0 ? '\nTEMIZ — kullanim-once-tanim yok' : `\n${problems} SORUN`);

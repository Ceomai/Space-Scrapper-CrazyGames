// Tek dosyalık paket: bütün betikler ve ikon index.html içine gömülür (CrazyGames yükleyicisi klasör kabul etmediğinde).
// Kullanım: node tools/build-single.js  →  dist/index.html
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<script src="(js\/[\w.-]+\.js)"><\/script>/g, (_, f) => `<script>\n${fs.readFileSync(path.join(root, f), 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`);
html = html.replace(/href="icons\/icon-192\.png"/, () => `href="data:image/png;base64,${fs.readFileSync(path.join(root, 'icons/icon-192.png')).toString('base64')}"`);
if (/src="js\//.test(html) || /icons\//.test(html)) throw new Error('gömülmemiş dosya kaldı');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'index.html'), html);
console.log(`dist/index.html yazıldı (${Math.round(html.length / 1024)} KB)`);

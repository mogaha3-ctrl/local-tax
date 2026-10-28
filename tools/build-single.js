// 한 파일로 묶기: node tools/build-single.js
// → dist/golden-time-alarm.html (메일·전시용 단일 파일), dist/artifact.html (Claude 아티팩트 게시용)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="css\/style.css">/, () => `<style>\n${fs.readFileSync(path.join(root, 'css/style.css'), 'utf8')}\n</style>`);
html = html.replace(/<script src="((?:data|js)\/[\w.-]+)"><\/script>/g, (_, f) => `<script>\n${fs.readFileSync(path.join(root, f), 'utf8')}\n</script>`);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/golden-time-alarm.html'), html);
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta charset[^>]*>|<meta name="viewport"[^>]*>/g, '');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
fs.writeFileSync(path.join(root, 'dist/artifact.html'), head.trim() + '\n' + body.trim() + '\n');
console.log('dist/golden-time-alarm.html, dist/artifact.html 생성');

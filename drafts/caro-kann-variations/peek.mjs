import { readFileSync } from 'node:fs';
import { Chess } from '/home/user/chess-academy/vendor/chess.js/chess.js';
const cache = JSON.parse(readFileSync('./explorer-cache.json', 'utf8'));
const t = r => r.white + r.draws + r.black;
for (const s of process.argv.slice(2)) {
  const g = new Chess();
  for (const m of s.split(' ')) g.move(m);
  const r = cache[g.fen()];
  if (!r) { console.log(s, ': not cached'); continue; }
  console.log(s, '=>', t(r), r.opening?.name ?? '', '\n   ' + r.moves.slice(0, 7).map(m => `${m.san} ${(100 * t(m) / t(r)).toFixed(0)}%`).join(', '));
}

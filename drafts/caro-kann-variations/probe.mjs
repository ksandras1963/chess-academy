// Fetches (and caches) explorer data for each position given as a move list, then prints the top moves.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { Chess } from '/home/user/chess-academy/vendor/chess.js/chess.js';
const cache = JSON.parse(readFileSync('./explorer-cache.json', 'utf8'));
const t = r => r.white + r.draws + r.black;
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (const s of process.argv.slice(2)) {
  const g = new Chess();
  for (const m of s.split(' ')) g.move(m);
  const fen = g.fen();
  while (!cache[fen]) {
    const url = 'https://explorer.lichess.org/lichess?variant=standard&speeds=rapid,classical&ratings=1800,2000&topGames=0&recentGames=0&moves=15&fen=' + encodeURIComponent(fen);
    const out = execFileSync('curl', ['-sS', '--max-time', '60', '-w', '\n%{http_code}', url], { encoding: 'utf8' });
    const i = out.lastIndexOf('\n');
    if (out.slice(i + 1) === '200') { cache[fen] = JSON.parse(out.slice(0, i)); writeFileSync('./explorer-cache.json', JSON.stringify(cache)); await sleep(1000); }
    else { console.error('HTTP', out.slice(i + 1)); await sleep(61000); }
  }
  const r = cache[fen];
  console.log(s, '=>', t(r), r.opening?.name ?? '', '\n   ' + r.moves.slice(0, 6).map(m => `${m.san} ${(100 * t(m) / t(r)).toFixed(0)}%`).join(', '));
}

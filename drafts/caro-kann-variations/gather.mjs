// Checks every line with chess.js, then asks the Lichess opening explorer how
// often each move is played (rated rapid and classical, average 1800-2199).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { Chess } from '/home/user/chess-academy/vendor/chess.js/chess.js';
import { variations } from './lines.mjs';

const dir = new URL('.', import.meta.url).pathname;
const cacheFile = dir + 'explorer-cache.json';
const cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {};
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function explore(fen) {
  if (cache[fen]) return cache[fen];
  const url = 'https://explorer.lichess.org/lichess?variant=standard&speeds=rapid,classical&ratings=1800,2000'
    + '&topGames=0&recentGames=0&moves=15&fen=' + encodeURIComponent(fen);
  for (let attempt = 0; attempt < 5; attempt++) {
    const out = execFileSync('curl', ['-sS', '--max-time', '60', '-w', '\n%{http_code}', url], { encoding: 'utf8' });
    const i = out.lastIndexOf('\n');
    const code = out.slice(i + 1), body = out.slice(0, i);
    if (code === '200') {
      cache[fen] = JSON.parse(body);
      writeFileSync(cacheFile, JSON.stringify(cache));
      await sleep(400);
      return cache[fen];
    }
    console.error('HTTP', code, 'waiting');
    await sleep(code === '429' ? 61000 : 3000);
  }
  throw new Error('explorer failed for ' + fen);
}
const total = r => r.white + r.draws + r.black;

const out = [];
for (const v of variations) {
  const lines = [];
  for (const line of v.lines) {
    const tokens = line.san.replace(/\d+\.(\.\.)?/g, ' ').trim().split(/\s+/);
    const game = new Chess();
    const plies = [];
    for (const san of tokens) {
      const before = game.fen();
      const m = game.move(san); // throws on an illegal move
      if (m.san !== san) throw new Error(`${v.id}: wrote ${san}, chess.js says ${m.san}`);
      const r = await explore(before);
      // Lichess writes castling as the king taking its own rook (e1h1).
      const castle = { e1g1: 'e1h1', e1c1: 'e1a1', e8g8: 'e8h8', e8c8: 'e8a8' };
      const uci = m.from + m.to + (m.promotion || '');
      const hit = r.moves.find(x => x.uci === uci || (m.piece === 'k' && x.uci === castle[uci]));
      const rank = r.moves.findIndex(x => x === hit) + 1;
      plies.push({ san, uci: m.from + m.to + (m.promotion || ''), fen: game.fen(),
        from: m.from, to: m.to, games: hit ? total(hit) : 0, of: total(r),
        rank: rank || null, opening: hit?.opening || null });
    }
    lines.push({ label: line.label, san: line.san, plies });
  }
  const keyFen = lines[0].plies[v.key - 1].fen;
  const kr = await explore(keyFen);
  out.push({ ...v, lines, keyGames: total(kr), keyOpening: kr.opening || lines[0].plies[v.key - 1].opening });
}

const root = await explore(new Chess().fen());
const afterC6 = await explore('rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
writeFileSync(dir + 'data.json', JSON.stringify({ caroKannGames: total(afterC6), variations: out }, null, 1));

// Report
console.log('Games after 1.e4 c6:', total(afterC6));
for (const v of out) {
  console.log(`\n## ${v.name}  key games ${v.keyGames} = ${(100 * v.keyGames / total(afterC6)).toFixed(1)}% of Caro-Kann games | ${v.keyOpening?.eco} ${v.keyOpening?.name}`);
  for (const l of v.lines) {
    console.log('  ' + l.label + ': ' + l.plies.map((p, i) =>
      `${p.san}[${p.rank ?? 'x'}:${(100 * p.games / p.of).toFixed(0)}%]`).join(' '));
  }
}

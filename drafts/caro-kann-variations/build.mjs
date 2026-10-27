// Builds the Caro-Kann variations page from data.json (gather.mjs), content.mjs and the piece sprite.
import { readFileSync, writeFileSync } from 'node:fs';
import { Chess } from '/home/user/chess-academy/vendor/chess.js/chess.js';
import { text } from './content.mjs';

const dir = new URL('.', import.meta.url).pathname;
const data = JSON.parse(readFileSync(dir + 'data.json', 'utf8'));
const cache = JSON.parse(readFileSync(dir + 'explorer-cache.json', 'utf8'));
const pieces = readFileSync(dir + 'pieces.svgfrag', 'utf8');
const client = readFileSync(dir + 'client.js', 'utf8');
const CK = data.caroKannGames;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const total = r => r.white + r.draws + r.black;
const fmtPct = x => x >= 9.95 ? x.toFixed(0) : x.toFixed(1);

// Share of games choosing `san` after the moves in `before` (space-separated SAN).
function branch(before, san) {
  const g = new Chess();
  for (const m of before.split(' ').filter(Boolean)) g.move(m);
  const r = cache[g.fen()];
  if (!r) throw new Error('not cached: ' + before);
  const m = g.move(san);
  const uci = m.from + m.to;
  const hit = r.moves.find(x => x.uci === uci);
  if (!hit) throw new Error('no data for ' + san + ' after ' + before);
  return Math.round(100 * total(hit) / total(r));
}
const label = (i, san) => (i % 2 === 0 ? `${i / 2 + 1}.` : `${Math.floor(i / 2) + 1}...`) + san;
const movesText = (plies, upto) => plies.slice(0, upto).map((p, i) => (i % 2 === 0 ? `${i / 2 + 1}.${p.san}` : p.san)).join(' ');

const appUrl = side => `https://ksandras1963.github.io/chess-academy/#/course/caro-kann-${side.toLowerCase()}`;
const VAR = data.variations.map(v => {
  const shareAt = v.shareAt || v.key;
  const sharePly = v.lines[0].plies[shareAt - 1];
  // deepest Lichess name on the way to the defining move
  let opening = null;
  for (const p of v.lines[0].plies.slice(0, v.key)) if (p.opening) opening = p.opening;
  const lines = v.lines.map((l, li) => {
    let start = v.key;
    if (li > 0) { start = l.plies.findIndex((p, i) => v.lines[0].plies[i]?.san !== p.san) + 1; }
    return { label: l.label, start, keyFrom: start, keyTo: start,
      moves: l.plies.map(p => [p.san, p.from, p.to, p.fen.split(' ')[0], Math.round(100 * p.games / p.of)]) };
  });
  const shareRec = cache[sharePly.fen];
  if (!shareRec) throw new Error('share position not cached: ' + v.id);
  const shareGames = total(shareRec);
  return { ...v, t: text[v.id], opening, share: 100 * shareGames / CK,
    shareWhere: label(shareAt - 1, sharePly.san), defMoves: movesText(v.lines[0].plies, v.key), linesOut: lines };
});
const byId = Object.fromEntries(VAR.map(v => [v.id, v]));

const icon = {
  first: '<path d="M5 4h2v12H5zM16 4v12L8 10z"/>',
  prev: '<path d="M14 4v12L6 10z"/>',
  next: '<path d="M6 4v12l8-6z"/>',
  last: '<path d="M13 4h2v12h-2zM4 4v12l8-6z"/>',
  play: '<path d="M6 4v12l9-6z"/>',
};
const svgIcon = k => `<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">${icon[k]}</svg>`;

function card(v) {
  const t = v.t;
  const tabs = v.linesOut.length > 1
    ? `<div class="tabs" role="group" aria-label="Lines">${v.linesOut.map((l, i) => `<button type="button" data-line="${i}" aria-pressed="${i === 0}">${esc(l.label)}</button>`).join('')}</div>` : '';
  const app = t.app.length ? `<div class="row"><dt>In your app</dt><dd>${t.app.map(([side, ch]) => `<a href="${appUrl(side)}" target="_blank" rel="noopener">${side} course</a> › ${esc(ch)}`).join('<br>')}</dd></div>` : '';
  const eco = v.opening ? v.opening.eco : 'B10';
  const lname = v.opening ? v.opening.name : 'no name of its own on Lichess';
  return `
<article class="var" id="${v.id}" aria-labelledby="${v.id}-h">
  <header class="var-head">
    <div class="var-title">
      <h3 id="${v.id}-h">${esc(v.name)}</h3>
      <p class="def-moves">${esc(v.defMoves)}</p>
    </div>
    <p class="share"><span class="share-n">${fmtPct(v.share)}%</span><span class="share-l">of Caro-Kann games reach ${esc(v.shareWhere)}</span></p>
  </header>
  <p class="aka"><span class="eco">${eco}</span> Lichess: ${esc(lname)}${t.aka ? `. ${esc(t.aka)}` : ''}.</p>
  <div class="var-body">
    <div class="board-col">
      ${tabs}
      <div class="board-wrap" tabindex="0" aria-label="Board. Use the left and right arrow keys to step through the moves.">
        <svg class="board" viewBox="0 0 320 320" role="img"></svg>
      </div>
      <div class="controls" role="group" aria-label="Move controls">
        <button type="button" data-act="first" aria-label="Start">${svgIcon('first')}</button>
        <button type="button" data-act="prev" aria-label="Back one move">${svgIcon('prev')}</button>
        <button type="button" data-act="watch" class="watch" aria-pressed="false">${svgIcon('play')}<span class="lbl">Watch</span></button>
        <button type="button" data-act="next" aria-label="Forward one move">${svgIcon('next')}</button>
        <button type="button" data-act="last" aria-label="End of line">${svgIcon('last')}</button>
      </div>
      <p class="status" aria-live="polite"></p>
      <div class="movelist" aria-label="Moves"></div>
    </div>
    <dl class="notes">
      <div class="row"><dt>The game</dt><dd>${esc(t.kind)}</dd></div>
      <div class="row"><dt>White</dt><dd>${esc(t.white)}</dd></div>
      <div class="row"><dt>Black</dt><dd>${esc(t.black)}</dd></div>
      ${t.warn ? `<div class="row warn"><dt>Watch out</dt><dd>${esc(t.warn)}</dd></div>` : ''}
      ${app}
    </dl>
  </div>
</article>`;
}

// The map: how the variations branch, with the share of games for each move.
const P = (before, san) => `<span class="pct">${branch(before, san)}%</span>`;
const L = id => `<a href="#${id}">${esc(byId[id].name)}</a>`;
const b0 = 'e4 c6', bd = 'e4 c6 d4 d5', bx = 'e4 c6 d4 d5 exd5 cxd5', bn = 'e4 c6 d4 d5 Nc3 dxe4 Nxe4';
const map = `
<ul class="tree">
  <li><span class="mv">1.e4 c6</span> <span class="games">${(CK / 1e6).toFixed(1)} million games</span>
    <ul>
      <li><span class="mv">2.d4</span> ${P(b0, 'd4')} <span class="mv">d5</span>
        <ul>
          <li><span class="mv">3.e5</span> ${P(bd, 'e5')} ${L('advance')}</li>
          <li><span class="mv">3.exd5</span> ${P(bd, 'exd5')} <span class="mv">cxd5</span>
            <ul>
              <li><span class="mv">4.Nf3</span> ${P(bx, 'Nf3')}, <span class="mv">4.Bd3</span> ${P(bx, 'Bd3')} ${L('exchange')}</li>
              <li><span class="mv">4.c4</span> ${P(bx, 'c4')} ${L('panov')}</li>
            </ul></li>
          <li><span class="mv">3.Nc3</span> ${P(bd, 'Nc3')} or <span class="mv">3.Nd2</span> ${P(bd, 'Nd2')} <span class="mv">dxe4 4.Nxe4</span>
            <ul>
              <li><span class="mv">4...Bf5</span> ${P(bn, 'Bf5')} ${L('classical')}</li>
              <li><span class="mv">4...Nf6</span> ${P(bn, 'Nf6')} <span class="mv">5.Nxf6+</span> ${P(bn + ' Nf6', 'Nxf6+')}
                <ul>
                  <li><span class="mv">5...exf6</span> ${P(bn + ' Nf6 Nxf6+', 'exf6')} ${L('tartakower')}</li>
                  <li><span class="mv">5...gxf6</span> ${P(bn + ' Nf6 Nxf6+', 'gxf6')} ${L('bronstein-larsen')}</li>
                </ul></li>
              <li><span class="mv">4...Nd7</span> ${P(bn, 'Nd7')} ${L('karpov')}</li>
            </ul></li>
          <li><span class="mv">3.f3</span> ${P(bd, 'f3')} ${L('fantasy')}</li>
        </ul></li>
      <li><span class="mv">2.Nf3</span> ${P(b0, 'Nf3')} ${L('nf3')}: usually transposes</li>
      <li><span class="mv">2.Nc3</span> ${P(b0, 'Nc3')} <span class="mv">d5 3.Nf3</span> ${P('e4 c6 Nc3 d5', 'Nf3')} ${L('two-knights')}</li>
      <li><span class="mv">2.Bc4</span> ${P(b0, 'Bc4')} ${L('hillbilly')}</li>
      <li><span class="mv">2.f4</span> ${P(b0, 'f4')} <span class="note">no card on this page</span></li>
      <li><span class="mv">2.c4</span> ${P(b0, 'c4')} ${L('c4')}</li>
      <li><span class="mv">2.d3</span> ${P(b0, 'd3')} ${L('d3')}</li>
    </ul></li>
</ul>`;

const groups = [
  ['main', 'Main variations', 'White’s main ways to meet 1...c6 and 2...d5, and Black’s two main fourth moves in the Classical lines.'],
  ['nf6', 'Black’s other fourth move: 4...Nf6', 'After 3.Nc3 dxe4 4.Nxe4 Nf6 White usually trades knights with 5.Nxf6+, and Black chooses which pawn takes back.'],
  ['side', 'White’s other second moves', 'White can skip 2.d4. 2.Nf3 is very common at club level, but it usually transposes to a main line.'],
];
const sections = groups.map(([g, h, p]) => `
<section class="group" aria-labelledby="g-${g}">
  <div class="group-head"><h2 id="g-${g}">${h}</h2><p>${p}</p></div>
  ${VAR.filter(v => v.group === g).map(card).join('\n')}
</section>`).join('\n');

const clientData = VAR.map(v => ({ id: v.id, name: v.name, lines: v.linesOut }));

const css = readFileSync(dir + 'style.css', 'utf8');
const html = `<title>Caro-Kann Variations</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,600&family=Public+Sans:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
${css}
</style>
<svg class="sprite" aria-hidden="true" focusable="false" width="0" height="0"><defs>${pieces}</defs></svg>
<div class="page">
  <header class="hero">
    <p class="eyebrow">Opening field guide · ECO B10–B19</p>
    <h1>Caro-Kann Variations</h1>
    <p class="lede"><span class="mv">1.e4 c6</span> prepares ...d5 without shutting in the c8 bishop. After <span class="mv">2.d4 d5</span> White must decide what to do with the attacked e4 pawn: push it (the Advance), trade it (the Exchange and the Panov), or defend it (3.Nc3 or 3.Nd2, which lead to the Classical and Karpov lines, and 3.f3, the Fantasy). White can also skip 2.d4.</p>
    <div class="howto">
      <p>Each board opens on the position that defines the variation. Press <b>Watch</b> to play the line from move 1, or step with the arrows. Under each board you can see how often club players chose that move on Lichess.</p>
      <div class="flip" role="group" aria-label="Board orientation">
        <span>View from</span>
        <button type="button" data-flip="white" aria-pressed="true">White</button>
        <button type="button" data-flip="black" aria-pressed="false">Black</button>
      </div>
    </div>
  </header>

  <section class="map" aria-labelledby="map-h">
    <h2 id="map-h">Map of the variations</h2>
    <p class="map-note">Each percentage is the share of games that continue with that move from the position before it.</p>
    <div class="tree-wrap">${map}</div>
  </section>
${sections}
  <footer class="sources">
    <h2>Sources and notes</h2>
    <p><b>How often:</b> Lichess opening explorer, rated rapid and classical games between players averaging 1800 to 2199, retrieved 27 October 2026. Card figures are the share of the ${(CK / 1e6).toFixed(1)} million games after 1.e4 c6 that reach the named position by any move order. Because move orders transpose, some games count on more than one card: 2.Nf3 d5 3.Nc3 is also the Two Knights, 2.Nf3 d5 3.exd5 cxd5 4.d4 is also the Exchange with 4.Nf3, and 2.c4 d5 3.exd5 cxd5 4.d4 is also the Panov. The figures agree within 3% with the snapshot your app saved on 18 to 25 October 2026.</p>
    <p><b>Names:</b> ECO codes and names as Lichess gives them (lichess-org/chess-openings). Where Lichess uses a different name from the usual one, the card says so, for example the Fantasy, which Lichess calls the Maróczy Variation.</p>
    <p><b>Lines:</b> most lines follow your Opening Trainer’s Caro-Kann courses. The Tartakower, Bronstein-Larsen and Two Knights (3...Bg4) lines follow named Lichess lines and the moves club players choose most. Every line was checked for legal moves with chess.js, and each trap in a Watch out box was checked move by move. The plans are general guidance, not engine evaluations.</p>
    <p><b>Pieces:</b> Colin M. L. Burnett, via Wikimedia Commons and cm-chessboard, CC BY-SA 3.0.</p>
  </footer>
</div>
<script>window.CK_DATA = ${JSON.stringify(clientData)};</script>
<script>
${client}
</script>
`;
writeFileSync(dir + 'caro-kann-variations.html', html);
console.log('wrote', html.length, 'bytes');
for (const v of VAR) console.log(v.id.padEnd(17), fmtPct(v.share).padStart(5) + '%', 'at', v.shareWhere.padEnd(9), (v.opening?.eco ?? 'B10'), v.opening?.name ?? '-', '| starts', v.linesOut.map(l => l.start).join(','));

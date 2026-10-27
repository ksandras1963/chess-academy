import { Chess } from '/home/user/chess-academy/vendor/chess.js/chess.js';
const play = s => { const g = new Chess(); for (const m of s.split(' ')) g.move(m); return g; };
let g = play('e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nd7 Qe2 Ngf6 Nd6');
console.log('Karpov 5.Qe2 Ngf6?? 6.Nd6 mate:', g.isCheckmate());
g = play('e4 c6 Nc3 d5 Nf3 dxe4 Nxe4 Nf6 Qe2 Nbd7 Nd6');
console.log('Two Knights 5...Nbd7?? 6.Nd6 mate:', g.isCheckmate());
g = play('e4 c6 d4 d5 f3 dxe4 fxe4 e5 dxe5 Qh4+');
console.log('Fantasy 5.dxe5? Qh4+ is check:', g.inCheck());
for (const r of g.moves()) { const h = new Chess(g.fen()); h.move(r); const ok = h.moves().includes('Qxe4') || h.moves().includes('Qxe4+'); console.log('   after 6.' + r + ': ...Qxe4 possible:', ok); }
// Advance: is the bishop trapped after 4.h4 e6?? 5.g4 ?
for (const s of ['e4 c6 d4 d5 e5 Bf5 h4 e6 g4 Bg6 h5 Be4 f3', 'e4 c6 d4 d5 e5 Bf5 h4 e6 g4 Be4 f3 Bg6 h5']) {
  g = play(s);
  const bm = g.moves({ verbose: true }).filter(m => m.piece === 'b' && m.from !== 'f8');
  const safe = bm.filter(m => { const h = new Chess(g.fen()); h.move(m.san); return !h.moves({ verbose: true }).some(x => x.to === m.to); });
  console.log('Advance trap', s.split(' ').slice(-4).join(' '), ': bishop moves', bm.map(m => m.san).join(','), '| safe:', safe.map(m => m.san).join(',') || 'none');
}
g = play('e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 e6 h5 Bf5 Nxf5 exf5');
console.log('Classical 6...e6? 7.h5 Bf5 8.Nxf5 exf5: legal, doubled f-pawns:', g.get('f7')?.type === 'p' && g.get('f5')?.type === 'p');

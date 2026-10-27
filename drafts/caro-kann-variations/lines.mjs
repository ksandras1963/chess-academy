// Caro-Kann variations for the explainer page. Move orders come from the
// app's Caro-Kann courses where they exist; `key` is the move that defines
// the variation (1-based ply index into the line).
export const variations = [
  { id: 'classical', name: 'Classical Variation', group: 'main', key: 8,
    lines: [{ label: 'Main line', san: '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 6. h4 h6 7. Nf3 Nd7 8. h5 Bh7 9. Bd3 Bxd3 10. Qxd3 e6' }] },
  { id: 'karpov', name: 'Karpov Variation', group: 'main', key: 8,
    lines: [{ label: 'Main line', san: '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Nd7 5. Nf3 Ngf6 6. Nxf6+ Nxf6 7. Bc4 Bf5 8. O-O e6 9. c3 Bd6' }] },
  { id: 'advance', name: 'Advance Variation', group: 'main', key: 5,
    lines: [
      { label: '3...Bf5', san: '1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 e6 5. Be2 c5 6. Be3 Qb6 7. Nc3 Nc6' },
      { label: '3...c5', san: '1. e4 c6 2. d4 d5 3. e5 c5 4. c3 Nc6 5. Nf3 cxd4 6. cxd4 Bg4 7. Be2 e6 8. O-O Nge7' }] },
  { id: 'exchange', name: 'Exchange Variation', group: 'main', key: 7, shareAt: 6,
    lines: [
      { label: '4.Bd3', san: '1. e4 c6 2. d4 d5 3. exd5 cxd5 4. Bd3 Nc6 5. c3 Nf6 6. Bf4 Bg4 7. Qb3 Qd7 8. Nd2 e6 9. Ngf3' },
      { label: '4.Nf3', san: '1. e4 c6 2. d4 d5 3. exd5 cxd5 4. Nf3 Nc6 5. Bb5 Bg4 6. O-O e6' }] },
  { id: 'panov', name: 'Panov-Botvinnik Attack', group: 'main', key: 7,
    lines: [{ label: 'Main line', san: '1. e4 c6 2. d4 d5 3. exd5 cxd5 4. c4 Nf6 5. Nc3 e6 6. Nf3 Be7 7. cxd5 Nxd5 8. Bd3 Nc6 9. O-O O-O' }] },
  { id: 'two-knights', name: 'Two Knights Attack', group: 'main', key: 5,
    lines: [
      { label: '3...Bg4', san: '1. e4 c6 2. Nc3 d5 3. Nf3 Bg4 4. h3 Bxf3 5. Qxf3 e6 6. d4 Nf6 7. e5 Nfd7' },
      { label: '3...dxe4', san: '1. e4 c6 2. Nc3 d5 3. Nf3 dxe4 4. Nxe4 Nf6 5. Qe2 Nxe4 6. Qxe4 Nd7 7. Bc4 Nf6 8. Qe2 Bf5' }] },
  { id: 'fantasy', name: 'Fantasy Variation', group: 'main', key: 5,
    lines: [
      { label: '3...e6', san: '1. e4 c6 2. d4 d5 3. f3 e6 4. Nc3 Bb4 5. Bd2' },
      { label: '3...dxe4', san: '1. e4 c6 2. d4 d5 3. f3 dxe4 4. fxe4 e5 5. Nf3 Bg4 6. Bc4 Nd7 7. O-O Ngf6 8. c3 Bd6' }] },
  { id: 'tartakower', name: 'Tartakower Variation', group: 'nf6', key: 10,
    lines: [{ label: 'Main line', san: '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Nf6 5. Nxf6+ exf6 6. c3 Bd6 7. Bd3 O-O 8. Qc2' }] },
  { id: 'bronstein-larsen', name: 'Bronstein-Larsen Variation', group: 'nf6', key: 10,
    lines: [{ label: 'Main line', san: '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Nf6 5. Nxf6+ gxf6 6. Nf3 Bg4 7. Be2' }] },
  { id: 'nf3', name: '2.Nf3', group: 'side', key: 3,
    lines: [
      { label: '3.exd5', san: '1. e4 c6 2. Nf3 d5 3. exd5 cxd5 4. d4 Nc6 5. Bb5 Bg4 6. O-O e6' },
      { label: '3.e5', san: '1. e4 c6 2. Nf3 d5 3. e5 Bg4 4. d4 e6 5. Be2 c5 6. O-O Nc6' }] },
  { id: 'hillbilly', name: '2.Bc4', group: 'side', key: 3,
    lines: [
      { label: '3.exd5', san: '1. e4 c6 2. Bc4 d5 3. exd5 cxd5 4. Bb5+ Bd7' },
      { label: '3.Bb3', san: '1. e4 c6 2. Bc4 d5 3. Bb3 dxe4 4. Qh5 g6' }] },
  { id: 'c4', name: '2.c4', group: 'side', key: 3,
    lines: [{ label: 'Main line', san: '1. e4 c6 2. c4 d5 3. exd5 cxd5 4. cxd5 Nf6 5. Nc3 Nxd5 6. Nf3 Nc6' }] },
  { id: 'd3', name: '2.d3', group: 'side', key: 3,
    lines: [{ label: 'Main line', san: '1. e4 c6 2. d3 d5 3. Nd2 e5 4. Ngf3 Bd6 5. g3 Nf6 6. Bg2 O-O 7. O-O Re8' }] },
];

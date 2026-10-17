// Prints Stockfish's top lines after a move sequence (an authoring aid).
//   node tools/pv.mjs "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4" [--depth 20] [--lines 3] [--plies 12]
// Several sequences can be given; each is analysed in turn.

import { Chess } from "../vendor/chess.js/chess.js"
import { Engine, engineAvailable } from "./engine.mjs"

const args = process.argv.slice(2)
const opt = (name, fallback) => {
    const i = args.indexOf(name)
    if (i < 0) return fallback
    const v = args[i + 1]
    args.splice(i, 2)
    return v
}
const depth = Number(opt("--depth", 20))
const multipv = Number(opt("--lines", 3))
const plies = Number(opt("--plies", 14))

if (!(await engineAvailable())) {
    console.error("Stockfish not found.")
    process.exit(1)
}
const engine = await new Engine().init()

for (const seq of args) {
    const game = new Chess()
    game.loadPgn(seq)
    const fen = game.fen()
    const white = game.turn() === "w"
    console.log(`\n${seq}`)
    for (const line of await engine.analyse(fen, depth, multipv)) {
        const c = new Chess(fen)
        const sans = []
        for (const uci of line.pv.slice(0, plies)) {
            const moveNo = c.moveNumber()
            const turn = c.turn()
            const san = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san
            sans.push(turn === "w" ? `${moveNo}. ${san}` : (sans.length ? san : `${moveNo}... ${san}`))
        }
        const s = white ? line.score : -line.score
        const shown = Math.abs(s) >= 9000 ? `mate ${s > 0 ? "White" : "Black"}` : (s / 100).toFixed(2)
        console.log(`  ${shown.padStart(7)}  (d${line.depth})  ${sans.join(" ")}`)
    }
}
engine.quit()

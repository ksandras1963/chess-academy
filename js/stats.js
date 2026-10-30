// How often positions come up in practice, from Lichess opening-explorer counts
// (content/opening-stats.json, loaded by content.js). A share is a number from 0 to 1, or null when
// the file has no data for a position on the way.

const key = fen => fen.split(" ").slice(0, 4).join(" ")

// Lichess sometimes writes castling as the king taking its own rook (e8h8); the course moves say e8g8.
const CASTLING = { e1g1: "e1h1", e1c1: "e1a1", e8g8: "e8h8", e8c8: "e8a8" }

/** The piece letter on a square of a FEN board ("K", "p"), or "" when it is empty. */
function pieceOn(fen, square) {
    const rank = fen.split(" ")[0].split("/")[8 - Number(square[1])]
    let file = 0
    for (const ch of rank) {
        if (/\d/.test(ch)) file += Number(ch)
        else if (file++ === square.charCodeAt(0) - 97) return ch
    }
    return ""
}

/** Share of the games in a position in which `uci` was played (0 when it isn't among the listed moves). */
export function moveShare(stats, fen, uci) {
    const p = stats && stats.positions[key(fen)]
    if (!p) return null
    const listed = Object.values(p.moves).reduce((a, b) => a + b, 0)
    const castle = CASTLING[uci] && /^[Kk]$/.test(pieceOn(fen, uci.slice(0, 2))) ? p.moves[CASTLING[uci]] || 0 : 0
    return ((p.moves[uci] || 0) + castle) / Math.max(p.games, listed)
}

/**
 * Share of the learner's games in an opening that reach `node` when the learner plays the course's
 * moves: the product of the opponent's choices between the opening's position and the node.
 */
export function shareFrom(stats, openingFen, node, learner) {
    let share = 1
    for (let n = node; n; n = n.parent) {
        if (key(n.fen) === key(openingFen)) return share
        if (!n.parent) return null // the node doesn't come after the opening's position
        if (n.color !== learner) {
            const s = moveShare(stats, n.fenBefore, n.uci)
            if (s == null) return null
            share *= s
        }
    }
    return null
}

/**
 * How often a chapter comes up. A trap: the share of games that reach its key position. A line
 * chapter: the share that reach its key move or the other opponent moves it covers at that point
 * ("Other third moves" covers 3...Be7 and 3...h6).
 */
export function chapterShare(stats, openingFen, chapter, learner) {
    const node = chapter.diagram && chapter.diagram.node
    if (!node) return null
    const group = chapter.type === "line" && node.color !== learner ? node.parent.children : [node]
    let total = 0
    for (const n of group) {
        const s = shareFrom(stats, openingFen, n, learner)
        if (s == null) return null
        total += s
    }
    return total
}

/** "40%", "4%", "0.4%" or "under 0.1%". */
export function pct(share) {
    const p = share * 100
    if (p >= 0.95) return `${Math.round(p)}%`
    if (p >= 0.1) return `${p.toFixed(1)}%`
    return "under 0.1%"
}

/** "Italian" from "Italian Game", "Sicilian" from "Sicilian Defense", or the opening's `games` name. */
export function shortName(opening) {
    return opening.games || opening.name.replace(/\s+(Game|Defense|Defence)$/, "")
}

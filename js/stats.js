// How often positions come up in practice, from Lichess opening-explorer counts
// (content/opening-stats.json, loaded by content.js). A share is a number from 0 to 1, or null when
// the file has no data for a position on the way.

const key = fen => fen.split(" ").slice(0, 4).join(" ")

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"

/** Share of the games in a position in which `uci` was played (0 when it isn't among the listed moves). */
export function moveShare(stats, fen, uci) {
    const p = stats && stats.positions[key(fen)]
    if (!p) return null
    const listed = Object.values(p.moves).reduce((a, b) => a + b, 0)
    return (p.moves[uci] || 0) / Math.max(p.games, listed)
}

/** Share of all games that reach a position, by any move order. */
export function positionShare(stats, fen) {
    const p = stats && stats.positions[key(fen)]
    const all = stats && stats.positions[START]
    return p && all ? p.games / all.games : null
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

/** "Italian" from "Italian Game", "Sicilian" from "Sicilian Defense". */
export function shortName(opening) {
    return opening.name.replace(/\s+(Game|Defense|Defence)$/, "")
}

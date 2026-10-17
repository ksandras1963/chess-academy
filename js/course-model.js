// Turns a course PGN into chapters (move trees checked with chess.js) and drillable lines.
// Shared by the app and tools/validate.mjs.

import { Chess, DEFAULT_POSITION } from "../vendor/chess.js/chess.js"
import { parsePgn, parseComment } from "./pgn.js"

export const CHAPTER_TYPES = ["line", "trap", "ideas"]

export class ContentError extends Error {}

// FNV-1a, enough to give each line a short stable id.
function hash(str) {
    let h = 0x811c9dc5
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i)
        h = Math.imul(h, 0x01000193)
    }
    return (h >>> 0).toString(36)
}

function joinComments(raws) {
    const parts = raws.map(parseComment)
    return {
        text: parts.map(p => p.text).filter(Boolean).join(" "),
        arrows: parts.flatMap(p => p.arrows),
        squares: parts.flatMap(p => p.squares)
    }
}

export function moveLabel(node) {
    return node.color === "w" ? `${node.moveNumber}.${node.san}` : `${node.moveNumber}...${node.san}`
}

export function nagSymbol(nags) {
    const map = { 1: "!", 2: "?", 3: "!!", 4: "??", 5: "!?", 6: "?!" }
    return nags.map(n => map[n] || "").join("")
}

function replay(node, chess, where) {
    for (const child of node.children) {
        chess.load(node.fen)
        let move
        try {
            move = chess.move(child.san)
        } catch {
            throw new ContentError(`${where}: illegal move "${child.san}" after ${node.san ? moveLabel(node) : "the start"}` + (child.line ? ` (PGN line ${child.line})` : ""))
        }
        child.san = move.san
        child.from = move.from
        child.to = move.to
        child.uci = move.lan + (move.promotion && !move.lan.endsWith(move.promotion) ? move.promotion : "")
        child.color = move.color
        child.fenBefore = node.fen
        child.fen = move.after
        child.ply = node.ply + 1
        child.moveNumber = Number(node.fen.split(" ")[5])
        child.note = joinComments(child.comments)
        child.pre = joinComments(child.preComments)
        child.isMistake = child.nags.some(n => n === 2 || n === 4 || n === 6)
        child.symbol = nagSymbol(child.nags)
        replay(child, chess, where)
    }
}

function buildChapter(game, index, course) {
    const h = game.headers
    const title = h.Chapter || h.Event || `Chapter ${index + 1}`
    const type = (h.Type || "line").toLowerCase()
    if (!CHAPTER_TYPES.includes(type)) {
        throw new ContentError(`${course.id} / ${title}: unknown Type "${h.Type}" (use line, trap or ideas)`)
    }
    const root = game.root
    root.fen = h.FEN || DEFAULT_POSITION
    root.ply = 0
    root.color = root.fen.split(" ")[1] === "w" ? "b" : "w" // the side that "just moved"
    root.moveNumber = Number(root.fen.split(" ")[5])
    root.note = joinComments(root.comments)
    const chess = new Chess()
    try {
        chess.load(root.fen)
    } catch {
        throw new ContentError(`${course.id} / ${title}: bad FEN header`)
    }
    replay(root, chess, `${course.id} / ${title}`)
    return {
        index,
        title,
        type,
        opening: h.Opening || "",
        eco: h.ECO || "",
        headers: h,
        root
    }
}

/** Main-line path of a chapter (first child at every node). */
export function mainPath(root) {
    const path = []
    let node = root
    while (node.children.length) {
        node = node.children[0]
        path.push(node)
    }
    return path
}

function extractLines(chapter, course) {
    const learner = course.side === "white" ? "w" : "b"
    const lines = []
    const walk = (node, path) => {
        const kids = node.children
        if (!kids.length) {
            if (path.some(n => n.color === learner)) lines.push(path)
            return
        }
        const toMove = node.color === "w" ? "b" : "w"
        if (toMove === learner) {
            walk(kids[0], [...path, kids[0]])
        } else {
            for (const k of kids) walk(k, [...path, k])
        }
    }
    walk(chapter.root, [])
    return lines.map(nodes => {
        const deviations = nodes.filter(n => n.parent.children[0] !== n).map(moveLabel)
        const suffix = deviations.length === 0 ? "Main line"
            : deviations.length === 1 ? deviations[0]
                : `${deviations[0]} … ${deviations[deviations.length - 1]}`
        return {
            id: hash(course.id + "|" + chapter.root.fen + "|" + nodes.map(n => n.san).join(" ")),
            courseId: course.id,
            chapter,
            type: chapter.type,
            variation: suffix,
            title: `${chapter.title} (${suffix})`,
            nodes,
            learnerMoves: nodes.filter(n => n.color === learner).length
        }
    })
}

/**
 * Builds a course from its metadata (courses.json entry) and PGN text.
 * Throws ContentError with a readable message on any bad move or header.
 */
export function buildCourse(meta, pgnText) {
    let games
    try {
        games = parsePgn(pgnText)
    } catch (e) {
        throw new ContentError(`${meta.id}: ${e.message}`)
    }
    const chapters = games.map((g, i) => buildChapter(g, i, meta))
    const seen = new Set()
    const lines = []
    for (const ch of chapters) {
        if (ch.type === "ideas") continue
        for (const line of extractLines(ch, meta)) {
            if (seen.has(line.id)) continue
            seen.add(line.id)
            lines.push(line)
        }
    }
    return { ...meta, chapters, lines }
}

/** Learner-side alternatives at a node (side notes that are not drilled). */
export function sideNotes(node, learner) {
    if (!node.parent || node.color !== learner) return []
    return node.parent.children.filter(c => c !== node)
}

/** For an opponent move in a line, the other opponent moves that lead to their own lines. */
export function siblingBranches(node, learner) {
    if (!node.parent || node.color === learner) return []
    return node.parent.children.filter(c => c !== node)
}

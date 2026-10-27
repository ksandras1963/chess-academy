// Turns a course PGN into chapters (move trees checked with chess.js) and drillable lines.
// Shared by the app and tools/validate.mjs.

import { Chess, DEFAULT_POSITION } from "../vendor/chess.js/chess.js"
import { parsePgn, parseComment } from "./pgn.js"

export const CHAPTER_TYPES = ["line", "trap", "ideas", "puzzle", "map"] // "map": an overview's flowchart
export const LEVELS = ["basic", "advanced"]
export const SIDES = ["white", "black"]

/**
 * The sections of a course page, in order. A line chapter is basic unless its header says
 * [Level "advanced"]; trap chapters form their own section. Unstarted advanced lines stay out of
 * the daily drill (srs.js).
 */
export const SECTIONS = [
    { id: "basic", title: "Basic and common variations", short: "Basic variations" },
    { id: "traps", title: "Traps and tricks", short: "Traps and tricks" },
    { id: "advanced", title: "Advanced and uncommon variations", short: "Advanced variations" }
]

function sectionOf(type, level) {
    if (type === "trap") return "traps"
    if (type === "line") return level === "advanced" ? "advanced" : "basic"
    return type // ideas, puzzle
}

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
        squares: parts.flatMap(p => p.squares),
        hint: parts.map(p => p.hint).filter(Boolean).join(" ")
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
        child.isGood = child.nags.some(n => n === 1 || n === 3 || n === 5)
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
    const level = (h.Level || "basic").toLowerCase()
    if (!LEVELS.includes(level)) {
        throw new ContentError(`${course.id} / ${title}: unknown Level "${h.Level}" (use basic or advanced)`)
    }
    // The side the learner plays: the course's, or in a course for both sides ("both") the chapter's [Side].
    const side = (h.Side || (SIDES.includes(course.side) ? course.side : "")).toLowerCase()
    if (course.side && !["map", "puzzle"].includes(type) && !SIDES.includes(side)) {
        throw new ContentError(`${course.id} / ${title}: ${h.Side ? `unknown Side "${h.Side}"` : "no [Side] header"} (use white or black)`)
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
    const chapter = {
        index,
        title,
        type,
        level,
        side,
        learner: side === "black" ? "b" : "w",
        section: sectionOf(type, level),
        opening: h.Opening || "",
        eco: h.ECO || "",
        headers: h,
        root
    }
    chapter.diagram = type === "ideas" || type === "puzzle" || type === "map" ? null : chapterDiagram(chapter)
    return chapter
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

const MOVE_LABEL = "(\\d+)(\\.\\.\\.|…|\\.)\\s?([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|O-O-O|O-O)"

/**
 * The position a chapter is about, shown beside it on the course page: the move in its
 * [Diagram "3...Nd4"] header, or else the last move named in its title ("Main line: 3...Bc5").
 * Returns { node } or { error }, or null when the chapter names no move.
 */
export function chapterDiagram(chapter) {
    const wanted = chapter.headers.Diagram || [...chapter.title.matchAll(new RegExp(MOVE_LABEL, "g"))].map(m => m[0]).pop()
    if (!wanted) return null
    return findMainMove(chapter.root, wanted, "diagram move")
}

/** The main-line node for a label like "6...Bb4+". Returns { node } or { error }. */
function findMainMove(root, wanted, what) {
    const m = new RegExp(`^${MOVE_LABEL}$`).exec(wanted.trim().replace(/[?!+#]+$/, ""))
    if (!m) return { error: `can't read the ${what} "${wanted}"` }
    const color = m[2] === "." ? "w" : "b"
    const node = mainPath(root).find(n =>
        n.moveNumber === Number(m[1]) && n.color === color && n.san.replace(/[+#]$/, "") === m[3])
    return node ? { node } : { error: `${what} "${wanted}" is not on the main line` }
}

/**
 * Builds a puzzle set from its PGN. Each game is one puzzle: the moves from the start, with
 * [Solve "6...Bb4+"] marking the first move the solver must find. From there the main line is
 * the solution (the solver's moves and the opponent's best replies), up to the move in the
 * optional [End "8.Qb5+"] header. Moves after it are a follow-up the solver can step through
 * once the puzzle is solved. At a solver's move, a variation marked ! or !? is also accepted;
 * one marked ?, ?? or ?! is a known wrong try whose comment explains the refutation.
 */
export function buildPuzzleSet(meta, pgnText) {
    let games
    try {
        games = parsePgn(pgnText)
    } catch (e) {
        throw new ContentError(`${meta.id} puzzles: ${e.message}`)
    }
    return games.map((g, i) => {
        const ch = buildChapter(g, i, { id: `${meta.id} puzzles` })
        const title = g.headers.Puzzle || ch.title
        if (!g.headers.Solve) throw new ContentError(`${meta.id} puzzles / ${title}: missing [Solve "..."] header`)
        const found = findMainMove(ch.root, g.headers.Solve, "Solve move")
        if (found.error) throw new ContentError(`${meta.id} puzzles / ${title}: ${found.error}`)
        const path = mainPath(ch.root)
        const start = path.indexOf(found.node)
        const endFound = g.headers.End ? findMainMove(ch.root, g.headers.End, "End move") : { node: path[path.length - 1] }
        if (endFound.error) throw new ContentError(`${meta.id} puzzles / ${title}: ${endFound.error}`)
        const end = path.indexOf(endFound.node)
        if (end < start) throw new ContentError(`${meta.id} puzzles / ${title}: the End move comes before the Solve move`)
        return {
            id: hash(`${meta.id}|puzzle|${path.slice(0, start + 1).map(n => n.san).join(" ")}`),
            index: i,
            number: i + 1,
            title,
            theme: g.headers.Theme || "",
            hint: g.headers.Hint || "",
            opening: ch.opening,
            eco: ch.eco,
            chapter: ch,
            learner: found.node.color,
            setup: path.slice(0, start),
            solution: path.slice(start, end + 1),
            followUp: path.slice(end + 1),
            first: found.node,
            // In any line (main or an accepted branch), moves past this ply are follow-up.
            endPly: endFound.node.ply
        }
    })
}

const SCORE_RE = /Stockfish:\s*([−+-]?\d+\.\d)\s*,\s*((?:only\s+)?(?:slightly|clearly)\s+better for (?:White|Black)|winning for (?:White|Black)|equal)/

/**
 * How a puzzle line ends: "Checkmate. White wins." after a mating move, or the score from the
 * last move's note ("Stockfish: +5.4, winning for White." reads "Stockfish +5.4, winning for White.").
 * Null when the note has no score.
 */
export function finalScore(node) {
    if (node.san.endsWith("#")) return `Checkmate. ${node.color === "w" ? "White" : "Black"} wins.`
    const m = SCORE_RE.exec(node.note.text)
    return m ? `Stockfish ${m[1]}, ${m[2]}.` : null
}

function extractLines(chapter, course) {
    const learner = chapter.learner
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
            side: chapter.side,
            learner,
            type: chapter.type,
            section: chapter.section,
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
        if (ch.type === "ideas" || ch.type === "map") continue
        for (const line of extractLines(ch, meta)) {
            if (seen.has(line.id)) continue
            seen.add(line.id)
            lines.push(line)
        }
    }
    return { ...meta, chapters, lines }
}

/**
 * Builds an opening overview (courses.json "surveys"): one chapter per opening, never drilled.
 * Each chapter's [Group] header names the family it is listed under, and its [Diagram] move is
 * the position its board shows. An optional [Type "map"] chapter is the page's flowchart, kept
 * apart as `flow`; the openings are numbered without it, since links use those numbers.
 */
export function buildSurvey(meta, pgnText) {
    let games
    try {
        games = parsePgn(pgnText)
    } catch (e) {
        throw new ContentError(`${meta.id}: ${e.message}`)
    }
    const all = games.map((g, i) => buildChapter(g, i, meta))
    const chapters = all.filter(ch => ch.type !== "map")
    chapters.forEach((ch, i) => {
        ch.index = i
        ch.group = ch.headers.Group || ""
    })
    return { ...meta, chapters, flow: all.find(ch => ch.type === "map") || null }
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

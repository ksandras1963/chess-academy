// PGN reader: headers, comments, variations (RAV) and NAGs.
// It knows nothing about chess rules; course-model.js replays the moves with chess.js.
// Runs unchanged in the browser and in Node (tools/validate.mjs).

const RESULTS = new Set(["1-0", "0-1", "1/2-1/2", "*"])
const SUFFIX_NAGS = { "!": 1, "?": 2, "!!": 3, "??": 4, "!?": 5, "?!": 6 }

export class PgnError extends Error {
    constructor(message, line) {
        super(line ? `${message} (line ${line})` : message)
        this.line = line
    }
}

function newNode(san, parent) {
    return { san, parent, children: [], comments: [], preComments: [], nags: [] }
}

function tokenize(text) {
    const tokens = []
    let i = 0
    let line = 1
    const n = text.length
    while (i < n) {
        const c = text[i]
        if (c === "\n") { line++; i++; continue }
        if (c === " " || c === "\t" || c === "\r" || c === "﻿") { i++; continue }
        if (c === "%" && (i === 0 || text[i - 1] === "\n")) { // escape line
            while (i < n && text[i] !== "\n") i++
            continue
        }
        if (c === "[") {
            const m = /^\[\s*([A-Za-z0-9_]+)\s+"((?:[^"\\]|\\.)*)"\s*\]/.exec(text.slice(i, i + 2000))
            if (!m) throw new PgnError("Malformed header", line)
            tokens.push({ type: "header", name: m[1], value: m[2].replace(/\\(.)/g, "$1"), line })
            i += m[0].length
            continue
        }
        if (c === "{") {
            const end = text.indexOf("}", i + 1)
            if (end < 0) throw new PgnError("Unclosed comment", line)
            const body = text.slice(i + 1, end)
            tokens.push({ type: "comment", value: body, line })
            line += (body.match(/\n/g) || []).length
            i = end + 1
            continue
        }
        if (c === ";") {
            let end = text.indexOf("\n", i)
            if (end < 0) end = n
            tokens.push({ type: "comment", value: text.slice(i + 1, end), line })
            i = end
            continue
        }
        if (c === "(" || c === ")") { tokens.push({ type: c, line }); i++; continue }
        if (c === "$") {
            const m = /^\$(\d+)/.exec(text.slice(i, i + 6))
            if (!m) throw new PgnError("Malformed NAG", line)
            tokens.push({ type: "nag", value: Number(m[1]), line })
            i += m[0].length
            continue
        }
        // a word: move number, move, or result
        let j = i
        while (j < n && !/[\s{}();\[$]/.test(text[j])) j++
        let word = text.slice(i, j)
        i = j
        if (RESULTS.has(word)) { tokens.push({ type: "result", value: word, line }); continue }
        const num = /^\d+\.*/.exec(word)
        if (num) {
            word = word.slice(num[0].length) // "12.e4" or "12..." or "12"
            if (!word) continue
            if (/^\.+$/.test(word)) continue
        }
        word = word.replace(/^\.+/, "")
        if (!word) continue
        const ann = /([!?]{1,2})$/.exec(word)
        let nag = null
        if (ann) {
            nag = SUFFIX_NAGS[ann[1]] || null
            word = word.slice(0, -ann[1].length)
        }
        word = word.replace(/^0-0-0/, "O-O-O").replace(/^0-0/, "O-O")
        tokens.push({ type: "move", value: word, line })
        if (nag) tokens.push({ type: "nag", value: nag, line })
    }
    return tokens
}

/** Parses a PGN file into games: [{headers, root}], each root a tree of move nodes. */
export function parsePgn(text) {
    const tokens = tokenize(text)
    const games = []
    let game = null
    let cur = null
    let stack = []
    let pendingPre = []
    let atVariationStart = false

    const startGame = () => {
        game = { headers: {}, root: newNode(null, null) }
        cur = game.root
        stack = []
        pendingPre = []
        atVariationStart = false
        games.push(game)
    }
    const endGame = (t) => {
        if (stack.length) throw new PgnError("Unclosed variation", t && t.line)
        game = null
    }

    for (const t of tokens) {
        if (t.type === "header") {
            if (!game || game.root.children.length || stack.length) {
                if (game) endGame(t)
                startGame()
            }
            game.headers[t.name] = t.value
            continue
        }
        if (!game) startGame()
        switch (t.type) {
            case "comment":
                if (atVariationStart) {
                    pendingPre.push(t.value)
                } else if (cur === game.root) {
                    game.root.comments.push(t.value)
                } else {
                    cur.comments.push(t.value)
                }
                break
            case "move": {
                const node = newNode(t.value, cur)
                node.preComments = pendingPre
                node.line = t.line
                pendingPre = []
                atVariationStart = false
                cur.children.push(node)
                cur = node
                break
            }
            case "nag":
                if (cur === game.root) throw new PgnError("NAG before the first move", t.line)
                cur.nags.push(t.value)
                break
            case "(":
                if (cur === game.root) throw new PgnError("Variation before the first move", t.line)
                stack.push(cur)
                cur = cur.parent
                atVariationStart = true
                break
            case ")":
                if (!stack.length) throw new PgnError("Unmatched ')'", t.line)
                if (atVariationStart) throw new PgnError("Empty variation", t.line)
                cur = stack.pop()
                atVariationStart = false
                pendingPre = []
                break
            case "result":
                game.headers.Result = game.headers.Result || t.value
                endGame(t)
                break
        }
    }
    if (game) endGame()
    return games.filter(g => g.root.children.length || g.root.comments.length || Object.keys(g.headers).length)
}

const ARROW_COLORS = { G: "green", R: "red", Y: "yellow", B: "blue" }

/** Splits a raw comment into display text plus [%cal]/[%csl] annotations. */
export function parseComment(raw) {
    const arrows = []
    const squares = []
    const text = raw.replace(/\[%(\w+)\s+([^\]]*)\]/g, (_, cmd, args) => {
        const items = args.split(",").map(s => s.trim()).filter(Boolean)
        if (cmd === "cal") {
            for (const it of items) {
                const m = /^([GRYB])([a-h][1-8])([a-h][1-8])$/.exec(it)
                if (m) arrows.push({ color: ARROW_COLORS[m[1]], from: m[2], to: m[3] })
            }
        } else if (cmd === "csl") {
            for (const it of items) {
                const m = /^([GRYB])([a-h][1-8])$/.exec(it)
                if (m) squares.push({ color: ARROW_COLORS[m[1]], square: m[2] })
            }
        }
        return ""
    })
        .replace(/[ \t]*\r?\n[ \t]*(\r?\n\s*)+/g, " ¶ ") // a blank line starts a new paragraph
        .replace(/\s+/g, " ")
        .replace(/ ?¶ ?/g, "\n\n")
        .trim()
    return { text, arrows, squares }
}

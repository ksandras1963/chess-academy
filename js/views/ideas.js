// A Key ideas page made of concepts: one board per idea, with the few moves that show it. A board
// starts from the opening position and plays up to the idea's position ([Diagram]), so the learner
// sees how it is reached.

import { h, paras, label, sideName, spellOut, backTrail, ideasTitle } from "../ui.js"
import { mainPath } from "../course-model.js"
import { Board } from "../board.js"
import { stepBar, mergedNote, furtherStudy } from "./layout.js"

export function ideasPage(root, ctx, c, page, { trail, prev, next }) {
    const concepts = page.concepts.map((cp, i) => conceptSection(cp, i))
    ctx.onLeave(() => concepts.forEach(k => k.destroy()))
    root.append(h("section", { class: "ideas-page" },
        h("header", { class: "ideas-head" },
            backTrail(trail), stepBar(prev, next),
            h("h1", {}, spellOut(ideasTitle(page))),
            ...paras(page.root.note.text, { class: "lede" })),
        ...concepts.map(k => k.el),
        furtherStudy(c.opening.furtherStudy)))
    // The boards are made once their frames are on the page, so they can size themselves.
    for (const k of concepts) k.start()
}

function conceptSection(cp, i) {
    const nodes = mainPath(cp.root)
    // The position the idea is about: the [Diagram] move, or else, on a board that starts from the
    // initial position, the first move with a note ("The idea starts from this position.").
    const fromStart = !cp.headers.FEN
    const noted = fromStart ? nodes.findIndex(n => n.note.text || n.note.arrows.length || n.note.squares.length) + 1 : 0
    const target = cp.diagram?.node ? nodes.indexOf(cp.diagram.node) + 1 : noted
    const boardEl = h("div", { class: "board-frame" })
    const move = h("h3", { class: "cm-move" })
    const note = h("div", { class: "concept-note", "aria-live": "polite" })
    const btn = (text, aria, onclick) => h("button", { class: "btn btn-icon", type: "button", "aria-label": aria, title: aria, onclick }, text)
    const first = btn("«", "First move", () => step(() => go(0, false)))
    const prev = btn("‹", "Previous move", () => step(() => go(idx - 1)))
    const play = btn("▶︎", "Play the moves to the position", togglePlay)
    const next = btn("›", "Next move", () => step(() => go(idx + 1)))
    const last = btn("»", "Last move", () => step(() => go(nodes.length, false)))
    // All the moves on one line below the buttons, the current one highlighted; any move can be picked.
    const moveButtons = nodes.map((n, k) => h("button", {
        class: `cmv${k + 1 === target ? " is-target" : ""}`, type: "button", onclick: () => step(() => go(k + 1, false))
    }, (n.color === "w" || k === 0 ? (n.color === "w" ? `${n.moveNumber}.` : `${n.moveNumber}…`) : "") + label(n).replace(/^\d+(\.|…)/, "")))
    const movesLine = h("p", { class: "concept-moves" }, ...moveButtons.flatMap((b, k) => k ? [" ", b] : [b]))
    let idx = 0
    let board = null
    let playing = null

    // Only the move's one-line heading sits above the buttons; the moves, its note and the explanation
    // go below them, so the buttons stay put from move to move.
    const explain = h("div", { class: "concept-explain" }, ...paras(cp.root.note.text))
    const text = nodes.length
        ? [move, h("div", { class: "nav-buttons" }, first, prev, ...(target ? [play] : []), next, last), movesLine, note, explain]
        : [explain]
    const el = h("section", { class: "concept", "aria-label": cp.title },
        h("h2", { class: "concept-title" }, h("span", { class: "concept-num" }, String(i + 1)), spellOut(cp.title)),
        h("div", { class: "concept-body" },
            h("div", { class: "concept-board" }, boardEl),
            h("div", { class: "concept-text" }, ...text)))

    function step(fn) {
        stopPlay()
        fn()
    }

    // ▶ plays the moves up to the idea's position (or on to the end once there).
    function togglePlay() {
        if (playing) return stopPlay()
        const stopAt = idx < target ? target : nodes.length
        if (idx >= stopAt) return
        const tick = () => {
            go(idx + 1)
            playing = idx < stopAt ? setTimeout(tick, 700) : null
            updatePlay()
        }
        playing = setTimeout(tick, 150)
        updatePlay()
    }
    function stopPlay() {
        clearTimeout(playing)
        playing = null
        updatePlay()
    }
    function updatePlay() {
        play.textContent = playing ? "❚❚" : "▶︎"
        play.disabled = !playing && idx >= nodes.length
    }

    function go(k, animate = true) {
        idx = Math.max(0, Math.min(k, nodes.length))
        const node = idx ? nodes[idx - 1] : null
        const n = node ? mergedNote(node) : (target ? { text: "", arrows: [], squares: [] } : cp.root.note)
        board.show(node ? node.fen : cp.root.fen, {
            animate,
            lastMove: node ? { from: node.from, to: node.to } : null,
            arrows: n.arrows, squares: n.squares
        })
        if (!nodes.length) return
        move.replaceChildren(...(node
            ? [label(node) + (node.symbol || ""), h("span", { class: "cm-who" }, sideName(node.color))]
            : ["Starting position"]))
        const atTarget = target && idx === target
        note.replaceChildren(...(atTarget && !n.text ? paras("The idea starts from this position.") : paras(n.text)))
        moveButtons.forEach((b, k) => b.classList.toggle("is-current", k + 1 === idx))
        first.disabled = prev.disabled = idx === 0
        next.disabled = last.disabled = idx >= nodes.length
        updatePlay()
    }

    return {
        el,
        start() {
            board = new Board(boardEl, { fen: cp.root.fen, orientation: cp.learner })
            go(0, false)
        },
        destroy() {
            clearTimeout(playing)
            board?.destroy()
        }
    }
}

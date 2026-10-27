// A Key ideas page made of concepts: one board per idea, set up for it, with the few moves that show it.

import { h, paras, label, sideName, spellOut, backTrail } from "../ui.js"
import { mainPath } from "../course-model.js"
import { Board } from "../board.js"
import { stepBar, mergedNote, furtherStudy } from "./layout.js"

export function ideasPage(root, ctx, c, page, { trail, prev, next }) {
    const concepts = page.concepts.map((cp, i) => conceptSection(cp, i))
    ctx.onLeave(() => concepts.forEach(k => k.destroy()))
    root.append(h("section", { class: "ideas-page" },
        h("header", { class: "ideas-head" },
            backTrail(trail), stepBar(prev, next),
            h("h1", {}, spellOut(page.title)),
            ...paras(page.root.note.text, { class: "lede" })),
        ...concepts.map(k => k.el),
        furtherStudy(c.opening.furtherStudy)))
    // The boards are made once their frames are on the page, so they can size themselves.
    for (const k of concepts) k.start()
}

function conceptSection(cp, i) {
    const nodes = mainPath(cp.root)
    const boardEl = h("div", { class: "board-frame" })
    const move = h("h3", { class: "cm-move" })
    const note = h("div", { class: "concept-note", "aria-live": "polite" })
    const btn = (text, aria, onclick) => h("button", { class: "btn btn-icon", type: "button", "aria-label": aria, title: aria, onclick }, text)
    const first = btn("«", "First move", () => go(0, false))
    const prev = btn("‹", "Previous move", () => go(idx - 1))
    const next = btn("›", "Next move", () => go(idx + 1))
    const last = btn("»", "Last move", () => go(nodes.length, false))
    let idx = 0
    let board = null

    // The move's heading, then the buttons, then its note, so the buttons stay put from move to move.
    const steps = nodes.length
        ? [move, h("div", { class: "nav-buttons" }, first, prev, next, last), note]
        : []
    const el = h("section", { class: "concept", "aria-label": cp.title },
        h("h2", { class: "concept-title" }, h("span", { class: "concept-num" }, String(i + 1)), spellOut(cp.title)),
        h("div", { class: "concept-body" },
            h("div", { class: "concept-board" }, boardEl),
            h("div", { class: "concept-text" }, ...paras(cp.root.note.text), ...steps)))

    function go(k, animate = true) {
        idx = Math.max(0, Math.min(k, nodes.length))
        const node = idx ? nodes[idx - 1] : null
        const n = node ? mergedNote(node) : cp.root.note
        board.show(node ? node.fen : cp.root.fen, {
            animate,
            lastMove: node ? { from: node.from, to: node.to } : null,
            arrows: n.arrows, squares: n.squares
        })
        if (!nodes.length) return
        move.replaceChildren(...(node
            ? [label(node) + (node.symbol || ""), h("span", { class: "cm-who" }, sideName(node.color))]
            : ["Starting position"]))
        note.replaceChildren(...(node ? paras(n.text) : []))
        first.disabled = prev.disabled = idx === 0
        next.disabled = last.disabled = idx >= nodes.length
    }

    return {
        el,
        start() {
            board = new Board(boardEl, { fen: cp.root.fen, orientation: cp.learner })
            go(0, false)
        },
        destroy() { board?.destroy() }
    }
}

// Shared trainer layout (board + panel) and the scoresheet.

import { h, fig } from "../ui.js"

export function trainerLayout(root, { backHref, backText }) {
    const boardEl = h("div", { class: "board-frame" })
    const crumb = h("a", { class: "crumb", href: backHref }, backText)
    const title = h("h1", { class: "tp-title" })
    const sub = h("p", { class: "tp-sub" })
    const sheet = h("div", { class: "scoresheet" })
    const commentary = h("div", { class: "commentary", "aria-live": "polite" })
    const extra = h("div", { class: "extra" })
    const controls = h("div", { class: "controls" })
    root.append(h("section", { class: "trainer" },
        h("div", { class: "trainer-board" }, boardEl),
        h("aside", { class: "trainer-panel" },
            h("header", { class: "tp-head" }, crumb, title, sub),
            sheet, commentary, extra, controls)))
    return {
        boardEl, sheet, commentary, extra, controls,
        setTitle(t, s = "") {
            title.textContent = t
            sub.textContent = s
            sub.hidden = !s
        }
    }
}

/**
 * Scoresheet: one row per move number, White then Black, like a tournament score sheet.
 * nodes: the moves; upto: how many are shown; current: index of the highlighted move.
 */
export function renderSheet(el, nodes, { upto = nodes.length, current = -1, onPick = null, mistakes = new Set() } = {}) {
    const rows = []
    let row = null
    nodes.slice(0, upto).forEach((n, i) => {
        if (!row || n.color === "w") {
            row = { num: n.moveNumber, w: null, b: null }
            rows.push(row)
        }
        row[n.color] = { n, i }
    })
    const cell = (c) => {
        if (!c) return h("span", { class: "sheet-move is-empty" }, "")
        const text = fig(c.n.san) + (c.n.symbol || "")
        const cls = "sheet-move" + (c.i === current ? " is-current" : "") + (mistakes.has(c.i) ? " is-missed" : "")
        return onPick
            ? h("button", { class: cls, type: "button", onclick: () => onPick(c.i + 1), "aria-current": c.i === current ? "true" : null }, text)
            : h("span", { class: cls }, text)
    }
    el.replaceChildren(...(rows.length ? rows.map(r => h("div", { class: "sheet-row" },
        h("span", { class: "sheet-num" }, r.num + "."), cell(r.w), cell(r.b))) : [h("p", { class: "sheet-empty" }, "No moves yet.")]))
    // Scroll inside the sheet only, never the page.
    const cur = el.querySelector(".is-current")
    if (cur) {
        const r = cur.getBoundingClientRect()
        const box = el.getBoundingClientRect()
        if (r.top < box.top) el.scrollTop -= box.top - r.top + 4
        else if (r.bottom > box.bottom) el.scrollTop += r.bottom - box.bottom + 4
    } else {
        el.scrollTop = el.scrollHeight
    }
}

export function mergedNote(node) {
    return {
        text: [node.pre?.text, node.note?.text].filter(Boolean).join(" "),
        arrows: [...(node.pre?.arrows || []), ...(node.note?.arrows || [])],
        squares: [...(node.pre?.squares || []), ...(node.note?.squares || [])]
    }
}

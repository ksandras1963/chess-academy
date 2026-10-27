// Shared trainer layout (board + panel) and the scoresheet.

import { h, fig, backBar, backTrail } from "../ui.js"

/**
 * prev / next: optional { href, text } links shown under the back buttons (next idea, next puzzle).
 * trail: optional back links, nearest first, shown before Main menu in place of backHref (lesson pages).
 */
export function trainerLayout(root, { backHref, backText, trail = null, prev = null, next = null }) {
    const boardEl = h("div", { class: "board-frame" })
    const back = trail ? backTrail(trail)
        : backBar(backHref && backHref !== "#/" ? { href: backHref, text: backText } : null)
    const steps = prev || next ? h("nav", { class: "stepbar", "aria-label": "Previous and next" },
        prev ? h("a", { class: "btn btn-small btn-step", href: prev.href, "aria-label": `Previous: ${prev.text}` },
            h("span", { "aria-hidden": "true" }, "‹"), h("span", { class: "step-text" }, prev.text)) : h("span"),
        next ? h("a", { class: "btn btn-small btn-step", href: next.href, "aria-label": `Next: ${next.text}` },
            h("span", { class: "step-text" }, next.text), h("span", { "aria-hidden": "true" }, "›")) : null) : null
    const title = h("h1", { class: "tp-title" })
    const sub = h("p", { class: "tp-sub" })
    const sheet = h("div", { class: "scoresheet" })
    // The line's introduction, kept on screen below the current move while the moves are played
    // (line lessons, overview lines).
    const intro = h("section", { class: "lesson-intro", "aria-label": "About this line" })
    intro.hidden = true
    // The current move's heading, above the buttons in lessons, so the buttons keep their height
    // whatever the length of the note below them.
    const move = h("div", { class: "move-head" })
    move.hidden = true
    const commentary = h("div", { class: "commentary", "aria-live": "polite" })
    const extra = h("div", { class: "extra" })
    const controls = h("div", { class: "controls" })
    const trainer = h("section", { class: "trainer" },
        h("div", { class: "trainer-board" }, boardEl),
        h("aside", { class: "trainer-panel" },
            h("header", { class: "tp-head" }, back, steps, title, sub),
            intro, move, commentary, controls, sheet, extra))
    root.append(trainer)
    return {
        boardEl, sheet, commentary, extra, controls,
        /** Shows the introduction (an array of nodes) above the move notes, or hides it when empty. */
        setIntro(nodes) {
            intro.replaceChildren(...(nodes.length ? [h("h2", { class: "intro-label" }, "About this line"), ...nodes] : []))
            intro.hidden = !nodes.length
            trainer.classList.toggle("has-intro", nodes.length > 0) // reorders the panel (css/app.css)
        },
        /** Shows the current move's heading (or hides it when null) above the buttons, with the note below them. */
        setMove(heading) {
            move.replaceChildren(...(heading ? [heading] : []))
            move.hidden = !heading
            trainer.classList.add("has-move") // reorders the panel (css/app.css)
        },
        setTitle(t, s = "") {
            title.textContent = t
            sub.textContent = s
            sub.hidden = !s
        }
    }
}

/**
 * Scoresheet: one row per move number, White then Black, like a tournament score sheet.
 * nodes: the moves; upto: how many are shown; current: index of the highlighted move;
 * followFrom: index of the first follow-up move after a puzzle (shown dimmer), or -1.
 */
export function renderSheet(el, nodes, { upto = nodes.length, current = -1, onPick = null, mistakes = new Set(), symbols = true, followFrom = -1 } = {}) {
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
        const text = fig(c.n.san) + (symbols ? c.n.symbol || "" : "")
        const cls = "sheet-move" + (c.i === current ? " is-current" : "") + (mistakes.has(c.i) ? " is-missed" : "")
            + (followFrom >= 0 && c.i >= followFrom ? " is-after" : "")
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

/** "Further study" links from courses.json (opening.furtherStudy). Opens in a new tab. */
export function furtherStudy(items, heading = "Further study") {
    if (!items || !items.length) return null
    return h("section", { class: "further" },
        h("h3", {}, heading),
        h("p", { class: "muted" }, "These notes draw on the resources below and on Stockfish analysis. The wording is our own."),
        h("ul", {}, items.map(it => h("li", {},
            h("a", { href: it.url, target: "_blank", rel: "noopener noreferrer" }, it.title),
            h("span", { class: "further-by" }, `${it.kind}, ${it.by}`)))))
}

export function mergedNote(node) {
    return {
        text: [node.pre?.text, node.note?.text].filter(Boolean).join(" "),
        arrows: [...(node.pre?.arrows || []), ...(node.note?.arrows || [])],
        squares: [...(node.pre?.squares || []), ...(node.note?.squares || [])]
    }
}

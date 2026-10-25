// Opening overviews (courses.json "surveys"): the replies to 1.e4, to 1.d4, and other first moves.
// The overview page shows each opening after its first moves, with White's and Black's plans and a
// link to its course; the line page plays the moves on the board, step by step or by itself.
// Nothing here is drilled.

import { h, paras, label, sideName, figText, figMoves } from "../ui.js"
import { catalog, survey as loadSurvey } from "../content.js"
import { mainPath } from "../course-model.js"
import { Board } from "../board.js"
import { trainerLayout, renderSheet } from "./layout.js"

/** Every line in a chapter, main line first: [{ nodes, name }]. Names come from the [Lines] header. */
export function chapterPaths(ch) {
    const paths = []
    const walk = (node, path) => {
        if (!node.children.length) return paths.push(path)
        for (const k of node.children) walk(k, [...path, k])
    }
    walk(ch.root, [])
    const names = (ch.headers.Lines || "").split("|").map(s => s.trim()).filter(Boolean)
    return paths.map((nodes, i) => ({ nodes, name: names[i] || (i ? "" : ch.title) }))
}

/** The chapter's opening note: a paragraph starting "White:" and one starting "Black:". */
function plans(ch) {
    const out = { w: "", b: "", other: [] }
    for (const p of ch.root.note.text.split(/\n\n+/).filter(Boolean)) {
        const m = /^(White|Black):\s*/.exec(p)
        if (m) out[m[1] === "White" ? "w" : "b"] = p.slice(m[0].length)
        else out.other.push(p)
    }
    return out
}

function planBlocks(ch) {
    const p = plans(ch)
    const block = (color, text) => text ? h("div", { class: "plan" },
        h("h3", { class: "plan-side" }, h("span", { class: `side-chip ${color === "w" ? "white" : "black"}`, "aria-hidden": "true" }), sideName(color)),
        h("p", {}, figText(text))) : null
    return [
        ...p.other.map(t => h("p", { class: "chapter-intro" }, figText(t))),
        h("div", { class: "plans" }, block("w", p.w), block("b", p.b))
    ]
}

/** "1.d4 ♘f6 2.c4 g6": the moves of a line. */
function moveText(nodes) {
    return figMoves(nodes.map(n => (n.color === "w" ? `${n.moveNumber}. ${n.san}` : n.san)).join(" "))
}

/**
 * The chapter's [Course "italian"] header as links to that opening's courses: one per built
 * course, "Course coming soon" when the catalog lists it but nothing is written yet, and
 * "Course coming later" without the header. [Course "none"] shows nothing: no course is planned.
 */
function courseLinks(cat, ch) {
    if (ch.headers.Course === "none") return null
    const op = cat.openings.find(o => o.id === ch.headers.Course)
    const built = op ? op.courses.filter(m => m.available) : []
    if (!built.length) {
        return h("span", { class: "course-link is-soon" }, op ? `${op.name} course coming soon` : "Course coming later")
    }
    return built.map(m => h("a", { class: "course-link", href: `#/course/${m.id}`, title: m.repertoire },
        h("span", { class: `side-chip ${m.side}`, "aria-hidden": "true" }),
        `${op.name} as ${m.side === "white" ? "White" : "Black"}`))
}

const lineHref = (s, ch, i) => `#/survey/${s.id}/${ch.index}${i ? `/${i}` : ""}`

/** "King's Indian Defense (1...Nf6)" as "King's Indian": a chapter's short name for the map. */
const mapName = ch => ch.title.replace(/\s*\([^)]*\)$/, "").replace(/ (Defense|Opening)\b/g, "")

/**
 * The map at the top of an overview: the page's first move, the replies to it (on "Other first
 * moves", the first moves themselves), and the page's openings, as boxes joined by lines. A reply
 * that leads to one opening shares its box; one that leads to several (1...d5) branches into them.
 * Each opening jumps to its card. A star marks a course in this app, hollow while it is being written.
 */
function openingMap(s, cat, jump) {
    const groups = [...new Set(s.chapters.map(ch => ch.group))]
    const tone = ch => `tone-${groups.indexOf(ch.group) % 4}`
    const plies = s.moves ? s.moves.replace(/\d+\.(\.\.)?/g, " ").trim().split(/\s+/).length : 0
    // The chapters by the first move after the page's own, in page order: 1...c5 → [Sicilian].
    const branches = new Map()
    for (const ch of s.chapters) {
        const node = mainPath(ch.root)[plies]
        if (!node) continue
        if (!branches.has(node.san)) branches.set(node.san, { node, chapters: [] })
        branches.get(node.san).chapters.push(ch)
    }
    const stars = new Set()
    const star = ch => {
        const op = cat.openings.find(o => o.id === ch.headers.Course)
        if (!op) return null
        const ready = op.courses.some(m => m.available)
        stars.add(ready ? "ready" : "soon")
        return h("span", { class: "om-star", title: ready ? "A course in this app" : "Course coming soon" }, ready ? "★" : "☆")
    }
    const opening = (ch, move) => h("button", { class: `om-box ${tone(ch)}`, type: "button", onclick: () => jump(ch) },
        move ? h("span", { class: "om-move" }, label(move)) : null,
        h("span", { class: "om-name" }, figText(mapName(ch))), star(ch))
    const item = (box, kids) => h("li", { class: "om-item" }, box, kids ? h("ul", { class: "om-kids" }, kids) : null)
    const replies = [...branches.values()].map(({ node, chapters }) => chapters.length === 1
        ? item(opening(chapters[0], node))
        : item(h("span", { class: "om-box" }, h("span", { class: "om-move" }, label(node))), chapters.map(ch => item(opening(ch)))))
    const first = h("span", { class: "om-box om-root" }, h("span", { class: "om-move" }, s.moves ? figMoves(s.moves) : s.name))

    return h("section", { class: "opening-map", "aria-labelledby": "opening-map-title" },
        h("h2", { id: "opening-map-title" }, "Map of the openings"),
        h("p", { class: "muted" }, "Tap an opening to go to it."),
        h("ul", { class: "om-tree" }, item(first, replies)),
        h("ul", { class: "om-legend", "aria-label": "Key" },
            groups.length > 1 ? groups.map((g, i) => h("li", {}, h("span", { class: `om-dot tone-${i % 4}`, "aria-hidden": "true" }), figText(g))) : null,
            stars.has("ready") ? h("li", {}, h("span", { class: "om-star", "aria-hidden": "true" }, "★"), "A course in this app") : null,
            stars.has("soon") ? h("li", {}, h("span", { class: "om-star", "aria-hidden": "true" }, "☆"), "Course coming soon") : null))
}

export async function surveyView(root, ctx, id) {
    const s = await loadSurvey(id)
    const cat = await catalog()
    if (!ctx.alive()) return
    const diagrams = []
    const cards = new Map()
    const jump = ch => {
        const el = cards.get(ch)
        el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" })
        el.classList.remove("is-flash")
        void el.offsetWidth // restart the highlight
        el.classList.add("is-flash")
    }
    const groups = []
    for (const ch of s.chapters) {
        const last = groups[groups.length - 1]
        if (last && last.name === ch.group) last.chapters.push(ch)
        else groups.push({ name: ch.group, chapters: [ch] })
    }

    root.append(h("section", { class: "course survey" },
        h("nav", { class: "backbar", "aria-label": "Back" },
            h("a", { class: "btn btn-small btn-back", href: "#/" }, h("span", { "aria-hidden": "true" }, "‹"), "Main menu")),
        h("header", { class: "course-head" },
            h("h1", {}, s.name),
            h("p", { class: "course-side" }, s.subtitle || ""),
            ...paras(s.summary, { class: "course-summary" })),
        openingMap(s, cat, jump),
        groups.map(g => [
            g.name ? h("h2", { class: "section-title" }, figText(g.name)) : null,
            g.chapters.map(ch => {
                // The board shows the [Diagram] move: the end of the line's first moves.
                const node = (ch.diagram && ch.diagram.node) || mainPath(ch.root).pop() || null
                const el = h("div", { class: "board-frame" })
                diagrams.push({ el, node, fen: ch.root.fen })
                const paths = chapterPaths(ch)
                const card = h("section", { class: "chapter survey-chapter" },
                    h("a", { class: "chapter-board", href: lineHref(s, ch, 0), title: "Watch the moves" }, el,
                        node ? h("span", { class: "chapter-board-caption" }, `After ${label(node)}`) : null),
                    h("div", { class: "chapter-head" },
                        h("h2", {}, figText(ch.title), ch.eco ? h("span", { class: "eco", title: "ECO code" }, ch.eco) : null),
                        paths.map(p => h("p", { class: "op-moves" },
                            paths.length > 1 ? h("span", { class: "line-label" }, `${p.name}: `) : null, moveText(p.nodes))),
                        ...planBlocks(ch)),
                    h("div", { class: "survey-actions" },
                        paths.map((p, i) => h("a", { class: `btn btn-small${i ? "" : " btn-primary"}`, href: lineHref(s, ch, i) },
                            h("span", { "aria-hidden": "true" }, "▶︎"), paths.length > 1 ? `Watch: ${p.name}` : "Watch the moves")),
                        courseLinks(cat, ch)))
                cards.set(ch, card)
                return card
            })
        ])))

    // Boards are drawn once their frames are in the page, so they can measure their size.
    const boards = diagrams.map(d => {
        const board = new Board(d.el, { fen: d.node ? d.node.fen : d.fen })
        if (d.node) board.annotate({ lastMove: { from: d.node.from, to: d.node.to } })
        return board
    })
    ctx.onLeave(() => boards.forEach(b => b.destroy()))
}

export async function surveyLineView(root, ctx, id, chapterIndex, pathIndex) {
    const s = await loadSurvey(id)
    const cat = await catalog()
    if (!ctx.alive()) return
    const ch = s.chapters[Number(chapterIndex)]
    if (!ch) throw new Error("This opening is no longer in the overview. Go back to the list.")
    const paths = chapterPaths(ch)
    const path = paths[Number(pathIndex) || 0]
    if (!path) throw new Error("This line is no longer in the overview. Go back to the list.")

    // Previous and next run through every line of every chapter, in the overview's order.
    const all = s.chapters.flatMap(c => {
        const ps = chapterPaths(c)
        return ps.map((p, i) => ({ href: lineHref(s, c, i), text: figText(ps.length > 1 ? p.name : c.title), ch: c, i }))
    })
    const at = all.findIndex(x => x.ch === ch && x.i === (Number(pathIndex) || 0))
    const L = trainerLayout(root, { backHref: `#/survey/${s.id}`, backText: s.name, prev: all[at - 1] || null, next: all[at + 1] || null })
    // The ECO code belongs to the chapter's main line (the Benoni's A56 is not the Benko's).
    L.setTitle(figText(ch.title), [paths.length > 1 ? path.name : "", path === paths[0] ? ch.eco : ""].filter(Boolean).join(" · "))

    const nodes = path.nodes
    const state = { idx: 0 }
    const board = new Board(L.boardEl, { fen: ch.root.fen })
    ctx.onLeave(() => board.destroy())
    const fenAt = i => (i === 0 ? ch.root.fen : nodes[i - 1].fen)

    function go(i, animate = true) {
        state.idx = Math.max(0, Math.min(i, nodes.length))
        render(animate)
    }

    function render(animate) {
        const node = state.idx ? nodes[state.idx - 1] : null
        board.show(fenAt(state.idx), {
            animate,
            lastMove: node ? { from: node.from, to: node.to } : null,
            arrows: node ? node.note.arrows : [], squares: node ? node.note.squares : []
        })
        renderSheet(L.sheet, nodes, { current: state.idx - 1, onPick: i => { stopPlay(); go(i, false) } })
        L.commentary.replaceChildren(...(node
            ? [h("h2", { class: "cm-move" }, label(node), h("span", { class: "cm-who" }, sideName(node.color))), ...paras(node.note.text)]
            : [h("h2", { class: "cm-move" }, "Starting position"), h("p", {}, "Press ▶︎ to watch the moves, or step through them with the arrows.")]))
        updateControls()
    }

    // ▶ plays the line on the board by itself, staying longer on moves with a note.
    let playing = null
    const readTime = node => 1100 + Math.min(3600, (node?.note?.text?.length || 0) * 30)
    function startPlay() {
        clearTimeout(playing)
        if (state.idx >= nodes.length) go(0, false)
        const tick = () => {
            go(state.idx + 1)
            playing = state.idx < nodes.length ? setTimeout(tick, readTime(nodes[state.idx - 1])) : null
            updateControls()
        }
        playing = setTimeout(tick, 400)
        updateControls()
    }
    function stopPlay() {
        clearTimeout(playing)
        playing = null
        updateControls()
    }
    const togglePlay = () => (playing ? stopPlay() : startPlay())
    ctx.onLeave(() => clearTimeout(playing))

    const btn = (text, aria, onclick) => h("button", { class: "btn btn-icon", type: "button", "aria-label": aria, title: aria, onclick }, text)
    const step = to => () => { stopPlay(); to() }
    const first = btn("«", "First move", step(() => go(0, false)))
    const prev = btn("‹", "Previous move", step(() => go(state.idx - 1)))
    const play = btn("▶︎", "Play the moves", togglePlay)
    const next = btn("›", "Next move", step(() => go(state.idx + 1)))
    const last = btn("»", "Last move", step(() => go(nodes.length, false)))
    const flip = h("button", { class: "btn btn-small", type: "button", onclick: () => board.flip() }, "Flip board")
    L.controls.append(h("div", { class: "nav-buttons" }, first, prev, play, next, last), h("div", { class: "more-buttons" }, flip))

    // The chapter's other lines (the Benko Gambit beside the Benoni), the plans, and the course.
    const others = paths.map((p, i) => ({ p, i })).filter(x => x.p !== path)
    L.extra.append(...[
        others.length ? h("div", { class: "alts" },
            h("h3", {}, "Also in this chapter"),
            h("ul", {}, others.map(({ p, i }) => {
                const split = p.nodes.find((n, k) => n !== nodes[k])
                return h("li", {},
                    h("a", { class: "alt-move", href: lineHref(s, ch, i) }, split ? label(split) : p.name),
                    h("span", { class: "alt-note" }, p.name))
            }))) : null,
        h("div", { class: "survey-plans" }, planBlocks(ch)),
        ch.headers.Course !== "none" ? h("div", { class: "survey-actions" }, courseLinks(cat, ch)) : null
    ].filter(Boolean)) // append() would write a null as the text "null"

    function updateControls() {
        first.disabled = prev.disabled = state.idx === 0
        next.disabled = last.disabled = state.idx >= nodes.length
        play.textContent = playing ? "❚❚" : "▶︎"
        const aria = playing ? "Pause" : state.idx >= nodes.length ? "Play the moves again" : "Play the moves"
        play.setAttribute("aria-label", aria)
        play.title = aria
    }

    // Arrows step, Home and End jump, and the space bar plays or pauses (unless a button has focus).
    const onKey = e => {
        if (e.target.closest("input, textarea, select")) return
        if (e.key === "ArrowRight") { stopPlay(); go(state.idx + 1); e.preventDefault() }
        else if (e.key === "ArrowLeft") { stopPlay(); go(state.idx - 1); e.preventDefault() }
        else if (e.key === "Home") { stopPlay(); go(0, false); e.preventDefault() }
        else if (e.key === "End") { stopPlay(); go(nodes.length, false); e.preventDefault() }
        else if (e.key === " " && !e.target.closest("button, a")) { togglePlay(); e.preventDefault() }
    }
    document.addEventListener("keydown", onKey)
    ctx.onLeave(() => document.removeEventListener("keydown", onKey))

    render(false)
}

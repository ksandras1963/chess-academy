// Opening overviews (courses.json "surveys"): the replies to 1.e4, to 1.d4, and other first moves.
// The overview page shows each opening after its first moves, with White's and Black's plans and a
// link to its course; the line page plays the moves on the board, step by step or by itself.
// Nothing here is drilled.

import { h, paras, label, sideName, fig, figText, figMoves } from "../ui.js"
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

/** Every line on the page merged into one tree of moves, each line's name at the node where it ends. */
function moveTree(s) {
    const root = { kids: new Map(), ends: [] }
    for (const ch of s.chapters) {
        const paths = chapterPaths(ch)
        // [Leads "Reversed Dragon | | Queen's Gambit Declined"]: where each line transposes to, in [Lines] order.
        const leads = (ch.headers.Leads || "").split("|").map(t => t.trim())
        paths.forEach((p, i) => {
            let node = root
            for (const n of p.nodes) {
                if (!node.kids.has(n.san)) node.kids.set(n.san, { move: n, kids: new Map(), ends: [] })
                node = node.kids.get(n.san)
            }
            // A line named only by its move ("1...c5", no Lichess name) shows the opening's name
            // instead, so its tag doesn't repeat the move above it.
            let name = paths.length > 1 ? p.name : ch.title
            if (/^\d+\.(\.\.|…)?\s?[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8]\S*$/.test(name)) name = ch.title.replace(/\s*\([^)]*\)$/, "")
            // A branch (the Benko beside the Benoni) has no ECO code of its own here.
            node.ends.push({ ch, name, eco: i ? "" : ch.eco, lead: leads[i] || "" })
        })
    }
    return root
}

/**
 * The map at the top of an overview: the page's lines as a branching tree. Each row is a run of
 * moves with no choice in it; names are colored by their group and jump to the opening's card.
 */
function moveMap(s, jump) {
    const groups = [...new Set(s.chapters.map(ch => ch.group))]
    const tone = ch => `tone-${groups.indexOf(ch.group) % 4}`
    const rows = node => [...node.kids.values()].map(kid => {
        const run = [kid]
        for (let n = kid; n.kids.size === 1 && !n.ends.length;) run.push(n = [...n.kids.values()][0])
        const last = run[run.length - 1]
        return h("li", {},
            h("div", { class: "mt-row" },
                h("span", { class: "mt-moves" }, run.map((r, i) => (i === 0 || r.move.color === "w" ? label(r.move) : fig(r.move.san))).join(" ")),
                last.ends.map(e => [h("button", { class: `mt-name ${tone(e.ch)}`, type: "button", onclick: () => jump(e.ch) },
                    figText(e.name), e.eco ? h("span", { class: "eco" }, e.eco) : null),
                e.lead ? h("span", { class: "mt-lead" }, `→ ${figText(e.lead)}`) : null])),
            last.kids.size ? h("ul", {}, rows(last)) : null)
    })
    return h("section", { class: "move-map", "aria-labelledby": "move-map-title" },
        h("h2", { id: "move-map-title" }, "Map of the openings"),
        h("p", { class: "muted" }, "Read down from the first move: each fork is a choice of move. Tap a name to jump to its board."),
        h("ul", { class: "mt" }, rows(moveTree(s))),
        groups.length > 1 ? h("ul", { class: "mt-legend", "aria-label": "Colors" }, groups.map((g, i) =>
            h("li", {}, h("span", { class: `mt-dot tone-${i % 4}`, "aria-hidden": "true" }), figText(g)))) : null)
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
        moveMap(s, jump),
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

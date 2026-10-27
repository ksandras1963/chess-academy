// Opening overviews (courses.json "surveys"): the replies to 1.e4, to 1.d4, and other first moves.
// The overview page shows each opening after its first moves, with White's and Black's plans and a
// link to its course; the line page plays the moves on the board, step by step or by itself.
// Nothing here is drilled.

import { h, paras, label, sideName, fig, figText, figMoves, spellOut } from "../ui.js"
import { catalog, survey as loadSurvey, course as loadCourse } from "../content.js"
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

/** The note's other paragraphs, then the plans; on a compact or "foldPlans" page the plans fold away under a button. */
function planBlocks(ch, fold = false, withIntro = true) {
    const p = plans(ch)
    const block = (color, text) => text ? h("div", { class: "plan" },
        h("h3", { class: "plan-side" }, h("span", { class: `side-chip ${color === "w" ? "white" : "black"}`, "aria-hidden": "true" }), sideName(color)),
        h("p", {}, figText(text))) : null
    const both = p.w || p.b ? h("div", { class: "plans" }, block("w", p.w), block("b", p.b)) : null
    return [
        ...(withIntro ? p.other.map(t => h("p", { class: "chapter-intro" }, figText(t))) : []),
        fold && both ? h("details", { class: "plans-more" }, h("summary", {}, "Plans for White and Black"), both) : both
    ]
}

/** A page's table from courses.json ("table": { columns, rows, note }), under its title: the replies to 1.e4 at a glance. */
function introTable(t) {
    return h("figure", { class: "survey-table" },
        h("table", {},
            h("thead", {}, h("tr", {}, t.columns.map(c => h("th", { scope: "col" }, c)))),
            h("tbody", {}, t.rows.map(r => h("tr", {},
                r.map((cell, i) => i ? h("td", {}, figText(cell)) : h("th", { scope: "row" }, figText(cell))))))),
        t.note ? h("figcaption", { class: "muted" }, t.note) : null)
}

/** "1.d4 ♘f6 2.c4 g6": the moves of a line. */
function moveText(nodes) {
    return figMoves(nodes.map(n => (n.color === "w" ? `${n.moveNumber}. ${n.san}` : n.san)).join(" "))
}

/**
 * [WhiteLesson "Slav: 4...Bf5"] and [BlackLesson]: the chapter of the [Course] opening's course that
 * teaches this opening, found by its title; [WhiteCourse] or [BlackCourse] names another opening
 * for that side. Returns { white, black } Learn links, or null.
 */
async function lessonLinks(cat, ch) {
    const out = {}
    for (const side of ["white", "black"]) {
        const Side = side === "white" ? "White" : "Black"
        const title = ch.headers[`${Side}Lesson`]
        // [BlackCourse "slav"]: the lesson is in another opening's course (the Slav Course for Black).
        const op = cat.openings.find(o => o.id === (ch.headers[`${Side}Course`] || ch.headers.Course))
        const meta = title && op && op.courses.find(m => m.side === side && m.available)
        if (!meta) continue
        const c = await loadCourse(meta.id).catch(() => null)
        const target = c && c.chapters.find(x => x.title === title)
        // A line chapter opens on its main line, the first line it gives.
        const key = !target ? null : target.type === "ideas" ? `ideas-${target.index}` : c.lines.find(l => l.chapter === target)?.id
        if (key) out[side] = { title, href: `#/learn/${c.id}/${key}` }
    }
    return Object.keys(out).length ? out : null
}

/** "Slav" for the card "Slav Defense", "Declined" for "Queen's Gambit Declined": a variation's short name. */
function variationName(op, ch) {
    const title = op && ch.title.startsWith(`${op.name} `) ? ch.title.slice(op.name.length + 1) : ch.title
    return title.replace(/ (Defense|Defence|Countergambit|Gambit|Variation)$/, "")
}

/**
 * The chapter's [Course "italian"] header as links to that opening's courses: one per built
 * course, "Course coming soon" when the catalog lists it but nothing is written yet, and
 * "Course coming later" without the header. [Course "none"] shows nothing: no course is planned.
 * With lessons (from lessonLinks), each link opens that lesson, and only those sides are shown;
 * `spelled` is the page's set of abbreviations already spelled out (see spellOut).
 */
function courseLinks(cat, ch, lessons, spelled = new Set()) {
    if (ch.headers.Course === "none") return null
    const op = cat.openings.find(o => o.id === ch.headers.Course)
    if (lessons) {
        // "Queen's Gambit Slav variation as Black" over the lesson's title.
        const variation = variationName(op, ch)
        return ["white", "black"].filter(side => lessons[side]).map(side => h("a", { class: "course-link is-lesson", href: lessons[side].href, title: "Open this lesson in Learn mode" },
            h("span", { class: `side-chip ${side}`, "aria-hidden": "true" }),
            h("span", { class: "lesson-label" },
                h("span", { class: "course-meta" }, `${op ? `${op.name} ` : ""}${variation} variation as ${side === "white" ? "White" : "Black"}`),
                figText(spellOut(lessons[side].title, spelled)))))
    }
    const built = op ? op.courses.filter(m => m.available) : []
    if (!built.length) {
        return h("span", { class: "course-link is-soon" }, op ? `${op.name} course coming soon` : "Course coming later")
    }
    return built.map(m => h("a", { class: "course-link", href: `#/course/${m.id}`, title: m.repertoire },
        h("span", { class: `side-chip ${m.side}`, "aria-hidden": "true" }),
        `${op.name} as ${m.side === "white" ? "White" : "Black"}`))
}

/**
 * The full courses this page links (its own "course", then each chapter's [Course], [WhiteCourse]
 * and [BlackCourse]), in a yellow box above the map, one row per opening: "These links open the full Queen's Gambit Course for White and ...".
 * With lesson links on the page, a second sentence tells the two kinds of link apart.
 */
function courseBox(cat, s, hasLessons) {
    const ids = new Set([s.course, ...s.chapters.flatMap(ch => [ch.headers.Course, ch.headers.WhiteCourse, ch.headers.BlackCourse])].filter(Boolean))
    const ops = [...ids].map(id => cat.openings.find(o => o.id === id)).filter(op => op && op.courses.some(m => m.available))
    if (!ops.length) return null
    const built = op => op.courses.filter(m => m.available)
    const title = (op, m) => `${op.name} Course for ${m.side === "white" ? "White" : "Black"}`
    const one = ops.length === 1 ? ops[0] : null
    const plural = !one || built(one).length > 1
    return h("section", { class: "course-box" },
        h("h2", {}, one ? `The full ${one.name} course${plural ? "s" : ""}` : "The full courses"),
        h("p", {}, [
            one ? `${plural ? "These links open" : "This link opens"} the full ${built(one).map(m => title(one, m)).join(" and the ")}.`
                : "These links open the full courses for the openings on this page.",
            hasLessons ? " The links under each variation below open only the lesson on that variation." : ""].join("")),
        ops.map(op => h("div", { class: "course-box-links" }, built(op).map(m => h("a", { class: "btn course-box-link", href: `#/course/${m.id}`, title: m.repertoire },
            h("span", { class: `side-chip ${m.side}`, "aria-hidden": "true" }), title(op, m), h("span", { "aria-hidden": "true" }, "›"))))))
}

const lineHref = (s, ch, i) => `#/survey/${s.id}/${ch.index}${i ? `/${i}` : ""}`

/** "1.d4 d5 2.c4" or "3.♘c3 ♘f6 4.♗g5": a run of moves, numbered like a score sheet. */
function moveRun(nodes) {
    return nodes.map((n, i) => (i === 0 || n.color === "w" ? label(n) : fig(n.san))).join(" ")
}

/**
 * The flowchart at the top of a page that has a [Type "map"] chapter (the Queen's Gambit, the
 * Indian Defenses): boxes from left to right, each showing the moves since the box before it and
 * the name in its note. A box sits at every move with a note (an empty note {} makes a box with
 * moves only), and the moves in between run together. A box named like an opening on the page
 * jumps to its card, and [%course white] or [%course black] in a note stars a line a course teaches.
 */
function flowchart(s, jump) {
    const byName = new Map()
    for (const ch of s.chapters) {
        byName.set(ch.title, ch)
        for (const p of chapterPaths(ch)) byName.set(p.name, ch)
    }
    let starred = false
    const boxesBelow = node => {
        const out = []
        const walk = n => n.children.forEach(k => (k.comments.length ? out.push(k) : walk(k)))
        walk(node)
        return out
    }
    const item = (node, from) => {
        const run = []
        for (let n = node; n !== from; n = n.parent) run.unshift(n)
        const name = node.note.text
        const ch = byName.get(name)
        const course = /\[%course (white|black)\]/.exec(node.comments.join(" "))
        if (course) starred = true
        const content = [
            h("span", { class: "fc-move" }, moveRun(run)),
            name ? h("span", { class: "fc-name" }, figText(name),
                course ? h("span", { class: "om-star", title: `In the ${course[1] === "white" ? "White" : "Black"} course` }, " ★") : null) : null]
        // Laid out like the "Map of the openings" (the om- classes), with two-line boxes.
        const box = ch
            ? h("button", { class: "om-box fc-box tone-0", type: "button", title: "Go to its board", onclick: () => jump(ch) }, content)
            : h("span", { class: "om-box fc-box" }, content)
        const kids = boxesBelow(node)
        return h("li", { class: "om-item" }, box, kids.length ? h("ul", { class: "om-kids" }, kids.map(k => item(k, node))) : null)
    }
    return h("section", { class: "opening-map flowchart", "aria-labelledby": "flowchart-title" },
        h("h2", { id: "flowchart-title" }, "Map of the variations"),
        h("p", { class: "muted" }, "Tap a name with a gold edge to see its board."),
        h("div", { class: "fc-scroll" }, h("ul", { class: "om-tree" }, boxesBelow(s.flow.root).map(k => item(k, s.flow.root)))),
        starred ? h("p", { class: "fc-key" }, h("span", { class: "om-star", "aria-hidden": "true" }, "★"), " A line taught in the full courses above the map") : null)
}

/**
 * "King's Indian Defense (1...Nf6)" as "King's Indian": a chapter's short name for the map, unless
 * its [Map "Queen's Gambit"] header names it. [Map "none"] leaves the chapter out of the map.
 */
const mapName = ch => ch.headers.Map || ch.title.replace(/\s*\([^)]*\)$/, "").replace(/ (Defense|Opening)\b/g, "")

/**
 * The map at the top of an overview: the page's first move, the replies to it (on "Other first
 * moves", the first moves themselves), and the page's openings, as boxes joined by lines. A reply
 * that leads to one opening shares its box; one that leads to several (1...d5) branches into them.
 * Each opening jumps to its card. A star marks a course in this app, hollow while it is being written.
 */
function openingMap(s, cat, jump) {
    const shown = s.chapters.filter(ch => ch.headers.Map !== "none")
    const groups = [...new Set(shown.map(ch => ch.group))]
    const tone = ch => `tone-${groups.indexOf(ch.group) % 4}`
    const plies = s.moves ? s.moves.replace(/\d+\.(\.\.)?/g, " ").trim().split(/\s+/).length : 0
    // The chapters by the first move after the page's own, in page order: 1...c5 → [Sicilian].
    const branches = new Map()
    for (const ch of shown) {
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
    // A reply can carry a family name from its chapters' [MapReply] header: 1...Nf6 "Indian Defenses".
    const replyName = chapters => chapters.map(ch => ch.headers.MapReply).find(Boolean)
    const replies = [...branches.values()].map(({ node, chapters }) => chapters.length === 1
        ? item(opening(chapters[0], node))
        : item(h("span", { class: "om-box" }, h("span", { class: "om-move" }, label(node)),
            replyName(chapters) ? h("span", { class: "om-name" }, figText(replyName(chapters))) : null),
        chapters.map(ch => item(opening(ch)))))
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
    const lessons = new Map(await Promise.all(s.chapters.map(async ch => [ch, await lessonLinks(cat, ch)])))
    if (!ctx.alive()) return
    const spelled = new Set()
    const diagrams = []
    const cards = new Map()
    // A [Page "qg"] chapter stands for a page of its own (the Queen's Gambit), so its map box goes there.
    const pageOf = ch => (cat.surveys || []).find(x => x.id === ch.headers.Page) || null
    const parent = (cat.surveys || []).find(x => x.id === s.parent) || null
    const jump = ch => {
        if (pageOf(ch)) { location.hash = `#/survey/${pageOf(ch).id}`; return }
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

    const fullCourses = courseBox(cat, s, [...lessons.values()].some(Boolean))

    root.append(h("section", { class: "course survey" },
        h("nav", { class: "backbar", "aria-label": "Back" },
            h("a", { class: "btn btn-small btn-back", href: "#/" }, h("span", { "aria-hidden": "true" }, "‹"), "Main menu"),
            parent ? h("a", { class: "btn btn-small btn-back", href: `#/survey/${parent.id}` }, h("span", { "aria-hidden": "true" }, "‹"), parent.name) : null),
        h("header", { class: "course-head" },
            // "heading" replaces the name in the title only; buttons and back links keep the short name.
            h("h1", {}, s.heading || s.name),
            h("p", { class: "course-side" }, figText(s.subtitle || "")),
            s.table && s.table.after !== "map" ? introTable(s.table) : null,
            ...paras(s.summary, { class: "course-summary" })),
        fullCourses,
        s.flow ? flowchart(s, jump) : openingMap(s, cat, jump),
        // "after": "map" puts the table below the map instead of under the title (the 1.d4 page).
        s.table && s.table.after === "map" ? introTable(s.table) : null,
        groups.map(g => [
            g.name ? h("h2", { class: "section-title" }, figText(g.name)) : null,
            g.chapters.map(ch => {
                // The board shows the [Diagram] move: the end of the line's first moves.
                const node = (ch.diagram && ch.diagram.node) || mainPath(ch.root).pop() || null
                const el = h("div", { class: "board-frame" })
                diagrams.push({ el, node, fen: ch.root.fen })
                const paths = chapterPaths(ch)
                const page = pageOf(ch)
                // A compact page lists only built courses; "coming later" on every card would be noise.
                const courses = s.compact && !(cat.openings.find(o => o.id === ch.headers.Course)?.courses.some(m => m.available))
                    ? null : courseLinks(cat, ch, lessons.get(ch), spelled)
                const card = h("section", { class: `chapter survey-chapter${s.compact ? " is-compact" : ""}` },
                    h("a", { class: "chapter-board", href: page ? `#/survey/${page.id}` : lineHref(s, ch, 0), title: page ? page.name : "Watch the moves" }, el,
                        node ? h("span", { class: "chapter-board-caption" }, `After ${label(node)}`) : null),
                    h("div", { class: "chapter-head" },
                        h("h2", {}, figText(ch.title), ch.eco ? h("span", { class: "eco", title: "ECO code" }, ch.eco) : null),
                        paths.map(p => h("p", { class: "op-moves" },
                            paths.length > 1 ? h("span", { class: "line-label" }, `${p.name}: `) : null, moveText(p.nodes))),
                        ...planBlocks(ch, s.compact || s.foldPlans)),
                    h("div", { class: "survey-actions" }, page
                        // "Queen's Gambit: 6 variations", "Uncommon replies to 1.d4: 2 openings": the page and what it holds.
                        ? h("a", { class: "btn btn-small btn-primary", href: `#/survey/${page.id}` }, page.count ? `${page.name}: ${page.count}` : page.name, h("span", { "aria-hidden": "true" }, "›"))
                        : [paths.map((p, i) => h("a", { class: `btn btn-small${i ? "" : " btn-primary"}`, href: lineHref(s, ch, i) },
                            h("span", { "aria-hidden": "true" }, "▶︎"), paths.length > 1 ? `Watch: ${p.name}` : "Watch the moves")),
                        courses]))
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
    const ch = s.chapters[Number(chapterIndex)]
    if (!ch) throw new Error("This opening is no longer in the overview. Go back to the list.")
    const lessons = await lessonLinks(cat, ch)
    if (!ctx.alive()) return
    const paths = chapterPaths(ch)
    const path = paths[Number(pathIndex) || 0]
    if (!path) throw new Error("This line is no longer in the overview. Go back to the list.")

    // Previous and next run through every line of every chapter, in the overview's order.
    const all = s.chapters.filter(c => !c.headers.Page).flatMap(c => {
        const ps = chapterPaths(c)
        return ps.map((p, i) => ({ href: lineHref(s, c, i), text: figText(ps.length > 1 ? p.name : c.title), ch: c, i }))
    })
    const at = all.findIndex(x => x.ch === ch && x.i === (Number(pathIndex) || 0))
    const L = trainerLayout(root, { backHref: `#/survey/${s.id}`, backText: s.name, prev: all[at - 1] || null, next: all[at + 1] || null })
    // The ECO code belongs to the chapter's main line (the Benoni's A56 is not the Benko's).
    L.setTitle(figText(ch.title), [paths.length > 1 ? path.name : "", path === paths[0] ? ch.eco : ""].filter(Boolean).join(" · "))
    // The card's description stays in view while the moves play; the plans stay below.
    L.setIntro(plans(ch).other.map(t => h("p", {}, figText(t))))

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
        h("div", { class: "survey-plans" }, planBlocks(ch, false, false)),
        ch.headers.Course !== "none" ? h("div", { class: "survey-actions" }, courseLinks(cat, ch, lessons)) : null
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

// Course pages. The hub: what you need to know about the opening, today's drill, and links to the
// sections. A section page (basic variations, traps, advanced variations) lists its lines by chapter.

import { h, figText, paras, plural, backBar, label, spellOut } from "../ui.js"
import { course as loadCourse, openingStats, puzzles as loadPuzzles, overviewBack } from "../content.js"
import { SECTIONS } from "../course-model.js"
import { status, progress, buildQueue, practiceQueue, newRemainingToday, daysUntil } from "../srs.js"
import { chapterShare, pct, shortName } from "../stats.js"
import { Board } from "../board.js"
import { furtherStudy } from "./layout.js"
import { puzzleStats } from "./puzzles.js"
import { variationMap, introTable, lessonTarget } from "./survey.js"

const TYPE_LABEL = { line: "", trap: "Trap", ideas: "Key ideas" }

const SECTION_TEXT = {
    basic: "The lines you will meet most often. Learn these first.",
    traps: "Traps to set and traps to avoid, each with its refutation.",
    advanced: "Rarer and more theoretical lines. A line here joins your daily drill only after you drill it once."
}

export function sideLabel(c) {
    return c.side === "both" ? courseTitle(c) : `${c.opening.name}, as ${c.side === "white" ? "White" : "Black"}`
}

/** "Slav Defense Course" for a course that teaches both sides, else "Italian Game Course for White". */
export function courseTitle(c) {
    return c.side === "both" ? `${c.opening.name} Course` : `${c.opening.name} Course for ${c.side === "white" ? "White" : "Black"}`
}

/** In a course for both sides, the tag that says which side a chapter is played from. */
function sideTag(c, ch) {
    if (c.side !== "both") return null
    const text = ch.side === "both" ? "Both sides" : `You play ${ch.side === "white" ? "White" : "Black"}`
    return h("span", { class: `tag side-tag is-${ch.side}` }, text)
}

/** Where a line lives, for back buttons: its section page. */
export function sectionLink(c, line) {
    const s = SECTIONS.find(x => x.id === line.section)
    return s ? { href: `#/course/${c.id}/${s.id}`, text: s.short } : { href: `#/course/${c.id}`, text: sideLabel(c) }
}

/** Lines that count toward the course's progress: everything except unstarted advanced lines. */
export function coreLines(c) {
    return c.lines.filter(l => l.section !== "advanced" || status(l.id).rec)
}

function statusText(s) {
    if (s.kind === "new") return "New"
    if (s.due) return `${s.label}, due`
    const d = daysUntil(s.rec)
    return `${s.label}, next in ${plural(d, "day")}`
}

export async function courseView(root, ctx, id, sectionId) {
    const c = await loadCourse(id)
    const stats = await openingStats()
    const set = await loadPuzzles(c.opening.id).catch(() => null)
    const back = await overviewBack(c.opening)
    if (!ctx.alive()) return
    if (sectionId) return sectionPage(root, ctx, c, stats, SECTIONS.find(s => s.id === sectionId))
    hubPage(root, c, set, back)
}

function drillAction(c) {
    // A course for both sides has a drill for each side: the board stays the same way up all session.
    if (c.side === "both") {
        return h("div", { class: "drill-pair" }, ["white", "black"].map(side =>
            drillButton(c.lines.filter(l => l.side === side), `#/drill/${c.id}/as-${side}`, `Drill as ${side === "white" ? "White" : "Black"}`)))
    }
    return drillButton(c.lines, `#/drill/${c.id}`, "Start today's drill")
}

function drillButton(lines, href, title) {
    const queue = buildQueue(lines)
    const dueCount = queue.filter(l => status(l.id).rec).length
    const newCount = queue.length - dueCount
    if (queue.length) {
        const parts = []
        if (dueCount) parts.push(`${dueCount} to review`)
        if (newCount) parts.push(`${newCount} new`)
        return h("a", { class: "btn btn-primary btn-big", href }, title, h("span", { class: "btn-detail" }, parts.join(", ")))
    }
    if (practiceQueue(lines).length) {
        return h("a", { class: "btn btn-primary btn-big", href }, title, h("span", { class: "btn-detail" }, "Nothing due. Drill your weakest lines."))
    }
    return h("p", { class: "muted" }, "Start with the basic variations below.")
}

function hubPage(root, c, set, back) {
    const ideas = c.chapters.filter(ch => ch.type === "ideas")
    const card = (href, title, meta, lines) => {
        const p = lines ? progress(lines) : null
        return h("a", { class: "hub-card", href },
            h("span", { class: "hub-title" }, title),
            h("span", { class: "hub-meta" }, meta),
            p ? h("span", { class: "meter meter-wide", "aria-hidden": "true" }, h("span", { style: { width: p.pct + "%" } })) : null)
    }
    const sectionCards = SECTIONS.map(s => {
        const lines = c.lines.filter(l => l.section === s.id)
        if (!lines.length) return null
        const p = progress(lines)
        const started = lines.length - p.fresh
        const meta = s.id === "advanced"
            ? `${plural(lines.length, "line")}, ${started} started${p.due ? `, ${p.due} due` : ""}`
            : `${plural(lines.length, "line")}${p.due ? `, ${p.due} due` : ""}`
        return card(`#/course/${c.id}/${s.id}`, s.title, meta, lines)
    })
    const st = set && puzzleStats(set)
    const puzzleCard = set
        ? card(`#/puzzles/${c.opening.id}`, "Puzzles", `${st.solved} of ${st.total} solved`, null)
        : h("span", { class: "hub-card is-soon" }, h("span", { class: "hub-title" }, "Puzzles"), h("span", { class: "hub-meta" }, "Coming soon"))
    const core = progress(coreLines(c))
    const map = c.chapters.find(ch => ch.type === "map")
    const ideasList = ideas.length ? [
        h("p", { class: "muted" }, "Read these first: the reasons behind the moves you will drill."),
        h("ol", {}, ideas.map(ch => h("li", {},
            h("a", { href: `#/learn/${c.id}/ideas-${ch.index}` }, ch.title.replace(/^Key ideas:\s*/i, "")), c.side === "both" ? " " : null, sideTag(c, ch))))
    ] : null

    // A course page with "why" (the Queen's Gambit courses), in the user's order: the text (a short
    // description and why the opening is played), the map of its variations, the table of them, the Key
    // ideas, the sections, and last the drills, which come after the lines have been seen.
    if (c.why) {
        root.append(h("section", { class: "course" },
            backBar(back),
            h("header", { class: "course-head" },
                h("h1", {}, courseTitle(c)),
                h("p", { class: "course-side" }, c.repertoire),
                h("p", { class: "course-summary" }, figText(c.summary || ""))),
            h("section", { class: "course-why" }, h("h2", {}, c.why.title || "Why play it"), ...paras(c.why.text)),
            map ? variationMap(map.root, {
                target: node => lessonTarget([c], node),
                hint: "Tap a box to see its position in a lesson.",
                star: side => (side === "both" ? "A Basic line, for both sides" : `A Basic line: you play ${side === "white" ? "White" : "Black"}`),
                key: " A Basic line: learn these first",
            }) : null,
            c.table ? h("section", { class: "course-table" }, h("h2", {}, c.table.title || "The variations"), introTable(c.table)) : null,
            ideasList ? h("section", { class: "ideas-list" }, h("h2", {}, "Key ideas"), ideasList) : null,
            h("section", { class: "course-sections" }, h("h2", {}, "The lines"),
                h("nav", { class: "hub-links", "aria-label": "Course sections" }, sectionCards, puzzleCard)),
            h("section", { class: "course-drills" }, h("h2", {}, "Drills"),
                h("p", { class: "muted" }, "Once you have looked through the lines, drill them from each side."),
                h("div", { class: "course-actions" }, drillAction(c)),
                h("div", { class: "course-stats" },
                    h("p", {}, `${plural(core.total, "line")} in your schedule: ${core.fresh} new, ${core.learning} learning, ${core.review + core.known} reviewing or known.` +
                        (newRemainingToday() < 1 && core.fresh ? " Today's new lines are used up; any line can still be drilled from its section." : "")))),
            furtherStudy(c.opening.furtherStudy)))
        return
    }

    root.append(h("section", { class: "course" },
        backBar(back),
        h("header", { class: "course-head" },
            h("h1", {}, courseTitle(c)),
            h("p", { class: "course-side" }, c.repertoire),
            h("p", { class: "course-summary" }, figText(c.summary || ""))),
        h("div", { class: "course-actions" }, drillAction(c)),
        h("section", { class: "ideas-list essentials" },
            h("h2", {}, "What you need to know about this opening"),
            c.overview && c.overview.length ? h("ul", { class: "essentials-points" }, c.overview.map(pt => h("li", {}, figText(pt)))) : null,
            ideasList),
        h("nav", { class: "hub-links", "aria-label": "Course sections" }, sectionCards, puzzleCard),
        h("div", { class: "course-stats" },
            h("p", {}, `${plural(core.total, "line")} in your schedule: ${core.fresh} new, ${core.learning} learning, ${core.review + core.known} reviewing or known.` +
                (newRemainingToday() < 1 && core.fresh ? " Today's new lines are used up; any line can still be drilled from its section." : ""))),
        furtherStudy(c.opening.furtherStudy)))
}

function sectionPage(root, ctx, c, stats, section) {
    if (!section) throw new Error("There is no such section. Go back to the course.")
    // "of your Slav games" for each chapter, from the side the chapter is played from.
    const labels = { w: gamesLabel(c, "w"), b: gamesLabel(c, "b") }
    const chapters = c.chapters.filter(ch => ch.section === section.id)
    const sectionLines = c.lines.filter(l => l.section === section.id)
    const p = progress(sectionLines)
    const diagrams = []
    const spelled = new Set() // QGD and QGA are spelled out in the first title that uses them

    root.append(h("section", { class: "course" },
        backBar({ href: `#/course/${c.id}`, text: sideLabel(c) }),
        h("header", { class: "course-head" },
            h("h1", {}, section.title),
            h("p", { class: "course-side" }, sideLabel(c)),
            h("p", { class: "course-summary" }, SECTION_TEXT[section.id])),
        sectionLines.length ? h("div", { class: "course-stats" },
            h("div", { class: "meter meter-wide", role: "progressbar", "aria-valuenow": p.pct, "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": "Section progress" },
                h("span", { style: { width: p.pct + "%" } })),
            h("p", {}, `${plural(p.total, "line")}: ${p.fresh} new, ${p.learning} learning, ${p.review + p.known} reviewing or known.`))
            : h("p", { class: "muted" }, "Nothing in this section yet."),
        chapters.map(ch => {
            const lines = c.lines.filter(l => l.chapter === ch)
            return h("section", { class: `chapter chapter-${ch.type}` },
                chapterBoard(c, ch, lines, diagrams),
                h("div", { class: "chapter-head" },
                    h("h2", {}, spellOut(ch.title, spelled), TYPE_LABEL[ch.type] ? h("span", { class: "tag" }, TYPE_LABEL[ch.type]) : null, sideTag(c, ch)),
                    chapterShareLine(c, stats, ch, labels),
                    ...paras(ch.root.note.text, { class: "chapter-intro" })),
                h("ul", { class: "lines" }, lines.map(l => {
                    const s = status(l.id)
                    return h("li", { class: `line-row is-${s.kind}${s.due ? " is-due" : ""}` },
                        h("div", { class: "line-name" },
                            h("span", {}, figText(l.variation)),
                            h("span", { class: "line-meta" }, `${plural(l.learnerMoves, "move")} to learn. ${statusText(s)}`)),
                        h("div", { class: "line-actions" },
                            h("a", { class: "btn btn-small", href: `#/learn/${c.id}/${l.id}` }, "Learn"),
                            h("a", { class: "btn btn-small", href: `#/drill/${c.id}/${l.id}` }, "Drill")))
                })))
        }),
        stats && chapters.length ? h("p", { class: "stats-note" },
            `How often: the bar under each chapter is the share of your ${shortName(c.opening)} games that reach its position, ` +
            `if you play the moves in this course. Source: ${stats.label}.`) : null))

    // Boards are drawn once their frames are in the page, so they can measure their size.
    const boards = diagrams.map(d => {
        const board = new Board(d.el, { fen: d.node ? d.node.fen : d.fen, orientation: d.learner })
        if (d.node) board.annotate({ lastMove: { from: d.node.from, to: d.node.to } })
        return board
    })
    ctx.onLeave(() => boards.forEach(b => b.destroy()))
}

/**
 * "of your Italian games" for each chapter. When the course gives the learner a choice of moves
 * (2.d4 or 2.Nc3, 3.e5 or 3.f3), the share counts only the games where the learner makes the
 * chapter's choice, so it names the last one: "of your Caro-Kann games with 3.f3".
 */
function gamesLabel(c, learner) {
    const key = fen => fen.split(" ").slice(0, 4).join(" ")
    const choices = new Map()
    for (const l of c.lines) for (const n of l.nodes) {
        if (l.learner !== learner || n.color !== learner) continue
        const k = key(n.fenBefore)
        if (!choices.has(k)) choices.set(k, new Set())
        choices.get(k).add(n.san)
    }
    const base = `of your ${shortName(c.opening)} games`
    return ch => {
        const start = key(c.opening.fen)
        for (let n = ch.diagram && ch.diagram.node; n && key(n.fen) !== start; n = n.parent) {
            if (n.color === learner && choices.get(key(n.fenBefore))?.size > 1) return `${base} with ${label(n)}`
        }
        return base
    }
}

/**
 * The "how often" line of a chapter, from the side it is played from. A chapter drilled from both
 * sides gives both shares: "Comes up in 30% of your Caro-Kann games as White, 12% as Black".
 */
function chapterShareLine(c, stats, ch, labels) {
    if (ch.side !== "both") return shareLine(chapterShare(stats, c.opening.fen, ch, ch.learner), labels[ch.learner](ch))
    const w = chapterShare(stats, c.opening.fen, ch, "w"), b = chapterShare(stats, c.opening.fen, ch, "b")
    if (w == null && b == null) return null
    const most = Math.max(w ?? 0, b ?? 0)
    return h("p", { class: "chapter-share" },
        h("span", { class: "share-bar", "aria-hidden": "true" }, h("span", { style: { width: `${Math.max(most * 100, 1)}%` } })),
        `Comes up in ${w == null ? "?" : pct(w)} of your ${shortName(c.opening)} games as White, ${b == null ? "?" : pct(b)} as Black`)
}

/** "Comes up in 40% of your Italian games", with a bar to compare chapters at a glance. */
function shareLine(share, yourGames) {
    if (share == null) return null
    return h("p", { class: "chapter-share" },
        h("span", { class: "share-bar", "aria-hidden": "true" }, h("span", { style: { width: `${Math.max(share * 100, 1)}%` } })),
        `Comes up in ${pct(share)} ${yourGames}`)
}

/** The board beside a chapter: the position after the move its title (or [Diagram] header) names. */
function chapterBoard(c, ch, lines, diagrams) {
    const node = ch.diagram && ch.diagram.node
    const el = h("div", { class: "board-frame" })
    diagrams.push({ el, node, fen: ch.root.fen, learner: ch.learner })
    if (!node) return h("div", { class: "chapter-board" }, el)
    const first = lines.find(l => l.nodes[node.ply - 1] === node)
    const caption = h("span", { class: "chapter-board-caption" }, `After ${label(node)}${node.symbol || ""}`)
    return first
        ? h("a", { class: "chapter-board", href: `#/learn/${c.id}/${first.id}/${node.ply}`, title: "Open this position in Learn mode" }, el, caption)
        : h("div", { class: "chapter-board" }, el, caption)
}

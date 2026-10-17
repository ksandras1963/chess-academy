// Course page: progress, today's drill, key ideas, and the list of lines by chapter.

import { h, figText, paras, plural } from "../ui.js"
import { course as loadCourse } from "../content.js"
import { status, progress, buildQueue, practiceQueue, newRemainingToday, daysUntil } from "../srs.js"
import { furtherStudy } from "./layout.js"

const TYPE_LABEL = { line: "", trap: "Trap", ideas: "Key ideas" }

export function sideLabel(c) {
    return `${c.opening.name}, as ${c.side === "white" ? "White" : "Black"}`
}

function statusText(s) {
    if (s.kind === "new") return "New"
    if (s.due) return `${s.label}, due`
    const d = daysUntil(s.rec)
    return `${s.label}, next in ${plural(d, "day")}`
}

export async function courseView(root, ctx, id) {
    const c = await loadCourse(id)
    if (!ctx.alive()) return
    const p = progress(c.lines)
    const queue = buildQueue(c.lines)
    const dueCount = queue.filter(l => status(l.id).rec).length
    const newCount = queue.length - dueCount

    let action
    if (queue.length) {
        const parts = []
        if (dueCount) parts.push(`${dueCount} to review`)
        if (newCount) parts.push(`${newCount} new`)
        action = h("a", { class: "btn btn-primary btn-big", href: `#/drill/${c.id}` },
            "Start today's drill", h("span", { class: "btn-detail" }, parts.join(", ")))
    } else if (practiceQueue(c.lines).length) {
        action = h("a", { class: "btn btn-primary btn-big", href: `#/drill/${c.id}` },
            "Practice", h("span", { class: "btn-detail" }, "Nothing due. Drill your weakest lines."))
    } else {
        action = h("p", { class: "muted" }, "Start with any line below.")
    }

    const ideas = c.chapters.filter(ch => ch.type === "ideas")
    const chapters = c.chapters.filter(ch => ch.type !== "ideas")

    root.append(h("section", { class: "course" },
        h("nav", { class: "crumbs" }, h("a", { href: "#/" }, "All openings")),
        h("header", { class: "course-head" },
            h("h1", {}, c.opening.name),
            h("p", { class: "course-side" }, `As ${c.side === "white" ? "White" : "Black"}: ${c.repertoire}`),
            h("p", { class: "course-summary" }, figText(c.summary || ""))),
        h("div", { class: "course-actions" }, action),
        ideas.length ? h("section", { class: "ideas-list" },
            h("h2", {}, "Key ideas"),
            h("p", { class: "muted" }, "Read these first: the reasons behind the moves you will drill."),
            h("ol", {}, ideas.map(ch => h("li", {},
                h("a", { href: `#/learn/${c.id}/ideas-${ch.index}` }, ch.title.replace(/^Key ideas:\s*/i, "")))))) : null,
        h("div", { class: "course-stats" },
            h("div", { class: "meter meter-wide", role: "progressbar", "aria-valuenow": p.pct, "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": "Course progress" },
                h("span", { style: { width: p.pct + "%" } })),
            h("p", {}, `${plural(p.total, "line")}: ${p.fresh} new, ${p.learning} learning, ${p.review + p.known} reviewing or known.` +
                (newRemainingToday() < 1 && p.fresh ? " Today's new lines are used up; any line can still be drilled from the list." : ""))),
        chapters.map(ch => {
            const lines = c.lines.filter(l => l.chapter === ch)
            return h("section", { class: `chapter chapter-${ch.type}` },
                h("h2", {}, ch.title, TYPE_LABEL[ch.type] ? h("span", { class: "tag" }, TYPE_LABEL[ch.type]) : null),
                ...paras(ch.root.note.text, { class: "chapter-intro" }),
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
        furtherStudy(c.opening.furtherStudy)))
}

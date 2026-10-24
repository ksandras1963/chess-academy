// Home: the openings index beside a preview board.

import { h, figMoves, plural } from "../ui.js"
import { catalog, availableCourses, puzzles as loadPuzzles } from "../content.js"
import { progress, buildQueue } from "../srs.js"
import { Board } from "../board.js"
import { puzzleStats } from "./puzzles.js"
import { coreLines } from "./course.js"

export async function homeView(root, ctx) {
    const cat = await catalog()
    const built = await availableCourses()
    const puzzleSets = new Map(await Promise.all(cat.openings.map(async op => [op.id, await loadPuzzles(op.id)])))
    if (!ctx.alive()) return
    const byId = new Map(built.map(c => [c.id, c]))
    const due = built.reduce((n, c) => n + buildQueue(c.lines, { includeNew: false }).length, 0)

    const boardEl = h("div", { class: "board-frame" })
    const caption = h("p", { class: "board-caption" })

    const list = h("ul", { class: "index" }, cat.openings.map(op => {
        const courses = op.courses.map(meta => {
            const c = byId.get(meta.id)
            const side = meta.side === "white" ? "White" : "Black"
            if (!c) {
                return h("span", { class: "course-link is-soon", title: meta.repertoire },
                    h("span", { class: `side-chip ${meta.side}` }), `As ${side}`,
                    h("span", { class: "course-meta" }, "Coming soon"))
            }
            const p = progress(coreLines(c))
            const advanced = c.lines.filter(l => l.section === "advanced").length
            const lineCount = plural(c.lines.length - advanced, "line") + (advanced ? ` + ${advanced} advanced` : "")
            return h("a", { class: "course-link", href: `#/course/${meta.id}`, title: meta.repertoire },
                h("span", { class: `side-chip ${meta.side}` }), `As ${side}`,
                h("span", { class: "meter", "aria-hidden": "true" }, h("span", { style: { width: p.pct + "%" } })),
                h("span", { class: "course-meta" }, p.due ? `${p.due} due` : lineCount))
        })
        const set = puzzleSets.get(op.id)
        const st = set && puzzleStats(set)
        const puzzleLink = set
            ? h("a", { class: "course-link puzzles-link", href: `#/puzzles/${op.id}` },
                h("span", { class: "puzzle-chip", "aria-hidden": "true" }, "?"), "Puzzles",
                h("span", { class: "course-meta" }, `${st.solved} of ${st.total} solved`))
            : h("span", { class: "course-link puzzles-link is-soon" },
                h("span", { class: "puzzle-chip", "aria-hidden": "true" }, "?"), "Puzzles",
                h("span", { class: "course-meta" }, "Coming soon"))
        const li = h("li", { class: "opening", tabindex: "-1" },
            h("div", { class: "op-head" }, h("h2", {}, op.name), h("span", { class: "eco", title: "ECO code" }, op.eco)),
            h("p", { class: "op-moves" }, figMoves(op.moves)),
            h("p", { class: "op-summary" }, op.summary),
            h("div", { class: "op-courses" }, courses, puzzleLink))
        const preview = () => {
            list.querySelectorAll(".opening.is-shown").forEach(e => e.classList.remove("is-shown"))
            li.classList.add("is-shown")
            board.show(op.fen, { animate: true })
            caption.textContent = `${op.name}: ${figMoves(op.moves)}`
        }
        li.addEventListener("pointerenter", preview)
        li.addEventListener("focusin", preview)
        return li
    }))

    const intro = h("div", { class: "home-intro" },
        h("p", { class: "home-brand" },
            h("span", { class: "home-app" }, "Opening Trainer"),
            h("span", { class: "academy" }, "Sandrasegaran Chess Academy")),
        h("h1", {}, "Five openings, from both sides of the board"),
        h("p", { class: "lede" }, "Short explanations, then drills that make the moves stick. Written for club players rated about 1500 to 2000."),
        due ? h("p", { class: "review-strip" },
            h("span", {}, `${plural(due, "line")} ready for review.`),
            h("a", { class: "btn btn-primary", href: "#/review" }, "Review now")) : null)

    root.append(h("section", { class: "home" },
        intro,
        h("div", { class: "home-board" }, boardEl, caption),
        h("div", { class: "home-index" }, list)))

    const first = cat.openings[0]
    const board = new Board(boardEl, { fen: first.fen })
    caption.textContent = `${first.name}: ${figMoves(first.moves)}`
    list.firstElementChild?.classList.add("is-shown")
    ctx.onLeave(() => board.destroy())
}

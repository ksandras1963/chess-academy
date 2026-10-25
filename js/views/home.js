// Home: the core opening principles, then the first moves (1.e4, 1.d4, others) beside a preview board.
// Each first move opens its overview page, which links on to the courses.

import { h, figMoves, figText, plural } from "../ui.js"
import { catalog, availableCourses, survey as loadSurvey } from "../content.js"
import { buildQueue } from "../srs.js"
import { Board } from "../board.js"

/** "Italian Game (1...e5)" becomes "Italian": the short names for a first move's card. */
const shortName = title => title.replace(/\s*\(.*\)\s*$/, "").replace(/ (Defense|Game|Opening)$/, "")

export async function homeView(root, ctx) {
    const cat = await catalog()
    const built = await availableCourses()
    // A missing overview file shouldn't take the home page down: its card then shows the subtitle only.
    const overviews = await Promise.all((cat.surveys || []).map(s => loadSurvey(s.id).catch(() => null)))
    if (!ctx.alive()) return
    const due = built.reduce((n, c) => n + buildQueue(c.lines, { includeNew: false }).length, 0)

    const boardEl = h("div", { class: "board-frame" })
    const caption = h("p", { class: "board-caption" })
    const openingIds = new Set(cat.openings.map(op => op.id))

    const firstMoves = (cat.surveys || []).map((s, i) => {
        const chapters = overviews[i] ? overviews[i].chapters : []
        // "Other first moves" starts from the initial position, so its board shows the most common one (1.c4).
        const lead = !s.moves && chapters[0] && chapters[0].root.children[0]
        const fen = lead ? lead.fen : s.fen
        const shown = s.moves ? `After ${figMoves(s.moves)}` : lead ? figText(chapters[0].title) : s.name
        // The openings on the page, the ones with a course in full ink: "Italian · Sicilian · French …"
        const names = chapters.map((ch, k) => [k ? " · " : "",
            h("span", { class: openingIds.has(ch.headers.Course) ? "fm-taught" : null }, shortName(ch.title))])
        const li = h("li", { class: "opening first-move", tabindex: "-1" },
            h("div", { class: "op-head" }, h("h2", {}, s.name), h("span", { class: "eco", title: "ECO codes" }, s.eco)),
            names.length ? h("p", { class: "fm-names" }, names) : h("p", { class: "op-summary" }, s.subtitle),
            h("div", { class: "op-courses" },
                h("a", { class: "course-link", href: `#/survey/${s.id}` }, "See the openings",
                    h("span", { class: "course-meta" }, s.count))))
        const preview = () => {
            list.querySelectorAll(".opening.is-shown").forEach(e => e.classList.remove("is-shown"))
            li.classList.add("is-shown")
            board.show(fen, { animate: true })
            caption.textContent = shown
        }
        li.addEventListener("pointerenter", preview)
        li.addEventListener("focusin", preview)
        return { li, preview }
    })
    const list = h("ul", { class: "index" }, firstMoves.map(f => f.li))

    const intro = h("div", { class: "home-intro" },
        h("p", { class: "home-brand" },
            h("span", { class: "home-app" }, "Opening Trainer"),
            h("span", { class: "academy" }, "Sandrasegaran Chess Academy")),
        h("h1", {}, "Five openings, from both sides of the board"),
        h("p", { class: "lede" }, "Short explanations, then drills that make the moves stick. Written for club players rated about 1500 to 2000."),
        h("p", { class: "lede" }, "The most common openings are 1.e4, then 1.d4, and then others. We will look at each of these on the pages that follow."),
        h("h2", { class: "principles-title" }, "The core opening principles"),
        h("ol", { class: "principles" }, [
            ["Control the center", "Occupy or target the central squares (e4, d4, e5, d5)."],
            ["Develop minor pieces", "Move knights and bishops out to active squares quickly; avoid moving the same piece twice."],
            ["Castle early", "Get the king to safety and activate the rooks."],
            ["Don't bring the queen out too soon", "Early queen moves invite opponent pieces to gain time (tempi) by attacking it."]
        ].map(([term, text]) => h("li", {}, h("strong", {}, `${term}: `), text))),
        due ? h("p", { class: "review-strip" },
            h("span", {}, `${plural(due, "line")} ready for review.`),
            h("a", { class: "btn btn-primary", href: "#/review" }, "Review now")) : null)

    root.append(h("section", { class: "home" },
        intro,
        h("div", { class: "home-board" }, boardEl, caption),
        h("div", { class: "home-index" }, list,
            h("p", { class: "stats-note" }, "Openings in bold have a course in this app."))))

    const board = new Board(boardEl, { fen: cat.surveys && cat.surveys[0] ? cat.surveys[0].fen : cat.openings[0].fen })
    ctx.onLeave(() => board.destroy())
    if (firstMoves[0]) firstMoves[0].preview()
}

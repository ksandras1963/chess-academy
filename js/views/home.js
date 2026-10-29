// Home: the core opening principles, then the first moves (1.e4, 1.d4, others) beside a board that plays
// each course's opening and the learner's progress in each course. Each first move opens its overview
// page, which links on to the courses.

import { h, fig } from "../ui.js"
import { catalog, course as loadCourse, puzzles as loadPuzzles, survey as loadSurvey } from "../content.js"
import { lineRecord, lessonRead } from "../storage.js"
import { Board } from "../board.js"
import { puzzleStats } from "./puzzles.js"

/** "Italian Game (1...e5)" becomes "Italian": the short names for a first move's card. */
const shortName = title => title.replace(/\s*\(.*\)\s*$/, "").replace(/ (Defense|Game|Opening)$/, "")

/**
 * How much of a course is done, from 0 to 100: the average of its parts, each counting the same however
 * many items it has. The parts are the Basic lessons read to their last move, the Basic lines drilled
 * without a mistake (a line missed since then counts again once it is drilled cleanly), the traps read
 * and drilled (half each), and the puzzles solved. Advanced lines and Key ideas pages are not counted.
 */
function completion(c, set) {
    const drilled = l => (lineRecord(l.id)?.box || 0) >= 1
    const read = l => lessonRead(l.id)
    const share = (items, score) => items.reduce((n, x) => n + Number(score(x)), 0) / items.length
    const basic = c.lines.filter(l => l.section === "basic")
    const traps = c.lines.filter(l => l.section === "traps")
    const parts = []
    if (basic.length) parts.push(share(basic, read), share(basic, drilled))
    if (traps.length) parts.push(share(traps, l => (read(l) + drilled(l)) / 2))
    if (set && set.items.length) parts.push(puzzleStats(set).solved / set.items.length)
    // Rounded down, so 100% means everything is done.
    return parts.length ? Math.floor(100 * parts.reduce((a, b) => a + b, 0) / parts.length + 1e-9) : 0
}

/** "1.e4 e5 2.Nf3": a line's moves so far, in the chosen notation. */
const moveText = nodes => nodes.map((n, i) => n.color === "w" ? `${n.moveNumber}.${fig(n.san)}`
    : i === 0 ? `${n.moveNumber}…${fig(n.san)}` : fig(n.san)).join(" ")

function shuffled(items) {
    const out = [...items]
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]]
    }
    return out
}

/**
 * The board above the progress list. It plays each course's first Basic line (its most common
 * variation) for 5 moves a side, one half-move a second, holds the position for 2 seconds, then
 * starts the next course: 12 seconds a course. The courses come in a random order, each once a round
 * and never twice in a row. The course playing is named under the board with its moves, and its row
 * in the progress list is lit. Clicking the board or the name opens the course. Resting the pointer on
 * the board pauses it; it waits while the page is hidden and stops when the learner leaves the page.
 * entries: [{ meta, name, row, load }], load being the course's promise.
 */
function showcase(ctx, entries) {
    const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    const boardEl = h("div", { class: "board-frame" })
    const name = h("strong", { class: "showcase-name" })
    const moves = h("span", { class: "showcase-moves" })
    const caption = h("a", { class: "showcase-caption", href: "#/" }, name, moves)
    let current = null
    let paused = false
    boardEl.addEventListener("click", () => { if (current) location.hash = `#/course/${current.meta.id}` })
    boardEl.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") paused = true })
    boardEl.addEventListener("pointerleave", () => { paused = false })
    const board = new Board(boardEl, { fen: START })
    ctx.onLeave(() => board.destroy())
    const animate = !matchMedia("(prefers-reduced-motion: reduce)").matches

    // Waits ms of time with the page shown and not paused; false once the learner has left the page.
    const wait = async ms => {
        for (let left = ms; left > 0;) {
            await new Promise(r => setTimeout(r, 100))
            if (!ctx.alive()) return false
            if (!paused && !document.hidden) left -= 100
        }
        return true
    }

    const play = async () => {
        let round = []
        let last = null
        const failed = new Set()
        while (failed.size < entries.length) {
            if (!round.length) {
                round = shuffled(entries)
                if (round.length > 1 && round[0] === last) round.push(round.shift())
            }
            const e = round.shift()
            last = e
            const line = await e.load.then(c => c.lines.find(l => l.section === "basic"), () => null)
            if (!ctx.alive()) return
            if (!line) { failed.add(e); continue }
            const nodes = line.nodes.slice(0, 10)
            current = e
            entries.forEach(x => x.row.classList.toggle("is-playing", x === e))
            name.textContent = e.name
            moves.textContent = ""
            caption.href = `#/course/${e.meta.id}`
            caption.setAttribute("aria-label", `Open the ${e.name} course`)
            board.show(line.chapter.root.fen, { animate: false })
            for (let i = 0; i < nodes.length; i++) {
                if (!await wait(1000)) return
                const n = nodes[i]
                board.show(n.fen, { animate, lastMove: { from: n.from, to: n.to } })
                moves.textContent = moveText(nodes.slice(0, i + 1))
            }
            if (!await wait(2000)) return
        }
    }
    play()
    return h("figure", { class: "showcase" }, boardEl, h("figcaption", {}, caption))
}

export async function homeView(root, ctx) {
    const cat = await catalog()
    // The first-move overviews only: the Queen's Gambit and Indian Defenses pages ("parent": "d4")
    // are reached from the 1.d4 page.
    const firsts = (cat.surveys || []).filter(s => !s.parent)
    // A missing overview file shouldn't take the home page down: its card then shows the subtitle only.
    const overviews = await Promise.all(firsts.map(s => loadSurvey(s.id).catch(() => null)))
    if (!ctx.alive()) return

    const openingIds = new Set(cat.openings.map(op => op.id))
    // A chapter's courses: its [Course], and for a [Page] chapter also its page's "course" list
    // (the Indian Defenses page lists the King's Indian, Nimzo-Indian and Grünfeld courses).
    const courseIds = ch => {
        const page = ch.headers.Page && (cat.surveys || []).find(x => x.id === ch.headers.Page)
        return `${ch.headers.Course || ""} ${(page && page.course) || ""}`.split(/\s+/).filter(Boolean)
    }

    const list = h("ul", { class: "index" }, firsts.map((s, i) => {
        const chapters = overviews[i] ? overviews[i].chapters : []
        // The openings on the page, the ones with a course in full ink: "Italian · Sicilian · French …".
        // A [Page] chapter stands for the chapters whose courses its page lists: the Indian Defenses for the King's Indian.
        const inPage = new Set(chapters.filter(ch => ch.headers.Page).flatMap(courseIds))
        const listed = chapters.filter(ch => ch.headers.Page || !courseIds(ch).length || !courseIds(ch).every(id => inPage.has(id)))
        const names = listed.map((ch, k) => [k ? " · " : "",
            h("span", { class: courseIds(ch).some(id => openingIds.has(id)) ? "fm-taught" : null }, shortName(ch.title))])
        return h("li", { class: "opening first-move" },
            h("div", { class: "op-head" }, h("h2", {}, s.name), h("span", { class: "eco", title: "ECO codes" }, s.eco)),
            names.length ? h("p", { class: "fm-names" }, names) : h("p", { class: "op-summary" }, s.subtitle),
            h("div", { class: "op-courses" },
                h("a", { class: "course-link", href: `#/survey/${s.id}` }, "See the openings",
                    h("span", { class: "course-meta" }, s.count))))
    }))

    // The progress box: every course with content, under its first move, in the order of the cards.
    const groups = firsts.map((s, i) => {
        const ids = [...new Set((overviews[i] ? overviews[i].chapters : []).flatMap(courseIds))]
        const metas = ids.flatMap(id => (cat.openings.find(op => op.id === id)?.courses || []).filter(m => m.available))
        return { name: s.name, metas }
    })
    const shown = new Set(groups.flatMap(g => g.metas))
    const rest = [...cat.courseById.values()].filter(m => m.available && !shown.has(m))
    if (rest.length) groups.push({ name: "Other courses", metas: rest })
    const entries = []
    const progress = h("aside", { class: "home-progress", "aria-labelledby": "progress-title" },
        h("h2", { id: "progress-title" }, "Your progress"),
        h("p", { class: "progress-note" }, "Basic lessons, drills, traps and puzzles in each course. Advanced variations are not counted. Progress is saved on this device."),
        groups.filter(g => g.metas.length).map(g => [
            h("h3", {}, g.name),
            h("ul", { class: "progress-list" }, g.metas.map(meta => {
                const name = shortName(meta.opening.name) + (meta.side === "both" ? "" : ` as ${meta.side === "white" ? "White" : "Black"}`)
                const bar = h("span")
                const pctText = h("span", { class: "progress-pct" })
                const row = h("a", { class: "progress-row", href: `#/course/${meta.id}` },
                    h("span", { class: "progress-name" }, name),
                    h("span", { class: "meter", "aria-hidden": "true" }, bar), pctText)
                // Each course's file loads in the background, so the page doesn't wait for all of them.
                const load = loadCourse(meta.id)
                entries.push({ meta, name, row, load })
                Promise.all([load, loadPuzzles(meta.opening.id).catch(() => null)]).then(([c, set]) => {
                    if (!ctx.alive()) return
                    const p = completion(c, set)
                    bar.style.width = `${p}%`
                    pctText.textContent = `${p}%`
                    row.setAttribute("aria-label", `${name}: ${p}% done`)
                }).catch(() => { pctText.textContent = "–" })
                return h("li", {}, row)
            }))
        ]))

    const intro = h("div", { class: "home-intro" },
        h("p", { class: "home-brand" },
            h("span", { class: "academy" }, "Sandrasegaran Chess Academy")),
        h("h1", {}, "Openings from both sides of the board"),
        h("p", { class: "lede" }, "Short explanations, then drills that make the moves stick. Written for club players rated about 1500 to 2000."),
        h("p", { class: "lede" }, "The most common openings are 1.e4, then 1.d4, and then others. We will look at each of these on the pages that follow."),
        h("h2", { class: "principles-title" }, "The core opening principles"),
        h("ol", { class: "principles" }, [
            ["Control the center", "Occupy or target the central squares (e4, d4, e5, d5)."],
            ["Develop minor pieces", "Move knights and bishops out to active squares quickly; avoid moving the same piece twice."],
            ["Castle early", "Get the king to safety and activate the rooks."],
            ["Don't bring the queen out too soon", "Early queen moves invite opponent pieces to gain time (tempi) by attacking it."]
        ].map(([term, text]) => h("li", {}, h("strong", {}, `${term}: `), text))),
        h("h2", { class: "principles-title" }, "Basic and Advanced variations"),
        h("p", { class: "home-levels" }, "Each course has Basic and Advanced variations. Learn the Basic variations first: they are the lines you will meet most often. The Advanced variations are worth learning for the openings you play all the time, or when you want to go beyond a 2000 rating."))

    root.append(h("section", { class: "home" },
        intro,
        h("div", { class: "home-side" }, showcase(ctx, entries), progress),
        h("div", { class: "home-index" }, list,
            h("p", { class: "stats-note" }, "Openings in bold have a course in this app."))))
}

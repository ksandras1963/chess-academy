// Drill mode: the learner plays their side, the app plays the other. Results feed the review schedule.

import { Chess } from "../../vendor/chess.js/chess.js"
import { h, figText, paras, label, sideName, plural, sleep, backBar, spellOut } from "../ui.js"
import { course as loadCourse, availableCourses } from "../content.js"
import { sideNotes } from "../course-model.js"
import { status, buildQueue, practiceQueue, recordResult, daysUntil } from "../srs.js"
import { Board } from "../board.js"
import { trainerLayout, renderSheet } from "./layout.js"
import { sideLabel, sectionLink } from "./course.js"

const ABORT = Symbol("abort")
const JUMP = Symbol("jump") // Previous drill or Next drill was pressed during a session

export async function drillView(root, ctx, courseId, lineId) {
    const c = await loadCourse(courseId)
    if (!ctx.alive()) return
    // "as-white" or "as-black": today's drill for one side of a course that teaches both.
    const side = /^as-(white|black)$/.exec(lineId || "")?.[1]
    let lines
    let pool = null // the lines today's drill draws from; a single line or a practice session has none
    let neighbours = null // a single line: the lines before and after it, in its section page's order
    if (lineId && !side) {
        const line = c.lines.find(l => l.id === lineId)
        if (!line) throw new Error("This line no longer exists; it may have been edited. Go back to the course to see the current lines.")
        lines = [line]
        const order = c.chapters.filter(ch => ch.section === line.section).flatMap(ch => c.lines.filter(l => l.chapter === ch))
        const i = order.indexOf(line)
        neighbours = { prev: order[i - 1] || null, next: order[i + 1] || null }
    } else {
        pool = side ? c.lines.filter(l => l.side === side) : c.lines
        lines = buildQueue(pool)
        if (!lines.length) {
            lines = practiceQueue(pool)
            pool = null
        }
    }
    // A single line returns to its section; a session returns to the course hub.
    const back = lineId && !side ? sectionLink(c, lines[0]) : { href: `#/course/${c.id}`, text: sideLabel(c) }
    await runSession(root, ctx, lines.map(line => ({ course: c, line })), {
        backHref: back.href, backText: back.text, pool, neighbours
    })
}

export async function reviewView(root, ctx) {
    const courses = await availableCourses()
    if (!ctx.alive()) return
    const items = courses.flatMap(c => buildQueue(c.lines, { includeNew: false }).map(line => ({ course: c, line })))
        .sort((a, b) => status(a.line.id).rec.due - status(b.line.id).rec.due)
    if (!items.length) {
        root.append(h("section", { class: "empty" },
            backBar(),
            h("h1", {}, "Nothing to review"),
            h("p", {}, "Lines you have drilled come back here when they are due. To learn new lines, open a course."),
            h("a", { class: "btn btn-primary", href: "#/" }, "Choose a course")))
        return
    }
    await runSession(root, ctx, items, { backHref: "#/", backText: "All openings" })
}

async function runSession(root, ctx, items, { backHref, backText, pool = null, neighbours = null }) {
    if (!items.length) {
        root.append(h("section", { class: "empty" },
            backBar(backHref !== "#/" ? { href: backHref, text: backText } : null),
            h("h1", {}, "No lines to drill"),
            h("p", {}, "This course has no lines yet."),
            h("a", { class: "btn btn-primary", href: backHref }, "Back")))
        return
    }
    // No Main menu on a drill page (Kumar's rule): the way back, then Previous drill and Next drill. For a
    // single line they open the lines before and after it on its section page; in a session, Next drill
    // skips the current line (it stays due) and Previous drill goes back to drill the one before again.
    let jump = 0 // a pending press in a session: -1 or +1
    let wake = null // ends whatever the session is waiting for, so a press takes effect at once
    const go = d => {
        jump = d
        const w = wake
        wake = null
        if (w) w()
    }
    const stepEl = (text, dir, target) => {
        const kids = dir < 0
            ? [h("span", { "aria-hidden": "true" }, "‹"), h("span", { class: "step-text" }, text)]
            : [h("span", { class: "step-text" }, text), h("span", { "aria-hidden": "true" }, "›")]
        if (neighbours) {
            return target
                ? h("a", { class: "btn btn-small btn-step", href: `#/drill/${items[0].course.id}/${target.id}` }, ...kids)
                : h("button", { class: "btn btn-small btn-step", type: "button", disabled: true }, ...kids)
        }
        return h("button", { class: "btn btn-small btn-step", type: "button", onclick: () => go(dir) }, ...kids)
    }
    const prevEl = stepEl("Previous drill", -1, neighbours && neighbours.prev)
    const nextEl = stepEl("Next drill", 1, neighbours && neighbours.next)
    const setNav = k => {
        if (neighbours) return
        prevEl.disabled = k <= 0
        nextEl.disabled = k < 0 || k >= items.length - 1
    }
    const nav = h("nav", { class: "backbar", "aria-label": "Drill navigation" },
        h("a", { class: "btn btn-small btn-back", href: backHref }, h("span", { "aria-hidden": "true" }, "‹"), backHref === "#/" ? "Main menu" : backText),
        prevEl, nextEl)
    const L = trainerLayout(root, { backHref, backText, nav })
    const board = new Board(L.boardEl, { orientation: items[0].line.learner })
    ctx.onLeave(() => board.destroy())
    const check = () => {
        if (!ctx.alive()) throw ABORT
        if (jump) throw JUMP
    }
    const results = []
    // Today's drill takes the Basic lines and traps first. Before the first Advanced line it stops to say
    // that they come next and are optional, and the learner can stop there.
    let advancedFrom = pool ? items.findIndex(it => it.line.section === "advanced") : -1

    try {
        for (let k = 0; k < items.length; k++) {
            try {
                setNav(k)
                if (k === advancedFrom) {
                    // With no Basic line due, the pause also offers the weakest Basic lines instead.
                    const weakest = k === 0 ? practiceQueue(pool.filter(l => l.section !== "advanced")) : []
                    let choice = await advancedNext(k, weakest.length > 0)
                    if (choice === "jump" && jump > 0) {
                        jump = 0 // Next drill on the pause goes on to the first Advanced line
                        choice = "go"
                    }
                    if (choice === "jump") throw JUMP
                    if (choice === "stop") break
                    advancedFrom = -1 // the pause comes once, even if Previous drill goes back past it
                    if (choice === "practice") {
                        items = weakest.map(line => ({ course: items[0].course, line }))
                        k = -1
                        continue
                    }
                }
                let action
                do {
                    const result = await drillLine(items[k], k, items.length)
                    results[k] = result
                    action = await showResult(items[k], result, k, items.length)
                } while (action === "retry")
                if (action === "jump") throw JUMP
                if (action === "stop") break
            } catch (e) {
                if (e !== JUMP) throw e
                const d = jump
                jump = 0
                k = Math.min(Math.max(k + d, 0), items.length - 1) - 1 // the loop's k++ lands on the target
            }
        }
        check()
        setNav(-1)
        const drilled = results.filter(Boolean)
        const clean = drilled.filter(r => r === "clean").length
        L.setTitle("Session complete", "")
        L.extra.replaceChildren()
        L.commentary.replaceChildren(
            h("h2", { class: "cm-move" }, `${plural(drilled.length, "line")} drilled`),
            h("p", {}, clean === drilled.length ? "Every line without a mistake. Well played."
                : `${clean} without a mistake. The others come back in your next drill.`))
        L.controls.replaceChildren(h("a", { class: "btn btn-primary", href: backHref }, "Done"))
    } catch (e) {
        if (e !== ABORT) throw e
    }

    async function drillLine({ line }, k, total) {
        const learner = line.learner // a course for both sides turns the board from line to line
        const nodes = line.nodes
        const missed = new Set()
        let hints = 0
        L.setTitle(spellOut(line.chapter.title), `${figText(line.variation)}${total > 1 ? `. Line ${k + 1} of ${total}` : ""}`)
        if (board.orientation !== learner) await board.setOrientation(learner)
        await board.show(line.chapter.root.fen, { animate: false })
        check()
        const feed = []
        const say = (entry) => {
            feed.push(entry)
            L.commentary.replaceChildren(...feed.slice(-2).map(e => h("div", { class: `cm-entry is-${e.kind}` },
                h("h2", { class: "cm-move" }, e.title, e.who ? h("span", { class: "cm-who" }, e.who) : null),
                ...paras(e.text))))
        }
        const sheet = (upto) => renderSheet(L.sheet, nodes, { upto, mistakes: missed })
        sheet(0)
        L.extra.replaceChildren()
        if (line.type === "trap") L.extra.append(h("p", { class: "banner" }, "Trap line. Find the moves that punish the mistake."))

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i]
            if (node.color !== learner) {
                L.controls.replaceChildren(h("p", { class: "muted" }, `${sideName(node.color)} is moving…`))
                await sleep(i === 0 ? 500 : 300)
                check()
                await board.show(node.fen, { lastMove: { from: node.from, to: node.to } })
                check()
                say({ kind: "them", title: label(node) + (node.symbol || ""), who: sideName(node.color), text: node.note.text })
                sheet(i + 1)
                continue
            }
            const r = await playMove(node, learner, i, missed, say)
            hints += r.hints
            sheet(i + 1)
            await sleep(120)
            check()
        }
        board.disableInput()
        return missed.size ? "failed" : hints ? "hinted" : "clean"
    }

    function playMove(node, learner, i, missed, say) {
        return new Promise((resolve, reject) => {
            let hints = 0
            let answered = false
            const prompt = h("p", { class: "prompt" }, `Your move as ${sideName(learner)}.`)
            const hintBtn = h("button", { class: "btn btn-small", type: "button" }, "Hint")
            const showBtn = h("button", { class: "btn btn-small", type: "button" }, "Show move")
            const reveal = () => {
                board.unarrow("answer")
                board.arrow("answer", node.from, node.to)
            }
            hintBtn.onclick = () => {
                hints++
                board.unmark("hint")
                board.mark("hint", node.from)
                hintBtn.disabled = true
            }
            showBtn.onclick = () => {
                missed.add(i)
                reveal()
                showBtn.disabled = hintBtn.disabled = true
                say({ kind: "wrong", title: `The move is ${label(node)}`, text: node.note.text })
            }
            L.controls.replaceChildren(prompt, h("div", { class: "more-buttons" }, hintBtn, showBtn))
            const timer = setInterval(() => {
                if (ctx.alive()) return
                clearInterval(timer)
                reject(ABORT)
            }, 500)
            wake = () => {
                clearInterval(timer)
                board.disableInput()
                reject(JUMP)
            }

            board.enableInput(learner, (from, to) => {
                if (answered) return false
                const chess = new Chess(node.fenBefore)
                let mv
                try {
                    mv = chess.move({ from, to, promotion: "q" })
                } catch {
                    return false // not a legal move: the piece just goes back
                }
                if (mv.san === node.san) {
                    answered = true
                    wake = null
                    clearInterval(timer)
                    board.disableInput()
                    setTimeout(async () => {
                        await board.show(node.fen, { animate: true, lastMove: { from: node.from, to: node.to }, arrows: node.note.arrows, squares: node.note.squares })
                        say({ kind: missed.has(i) ? "fixed" : "you", title: label(node) + (node.symbol || ""), who: missed.has(i) ? "Now you have it" : "Correct", text: node.note.text })
                        resolve({ hints })
                    }, 0)
                    return true
                }
                const alt = sideNotes(node, learner).find(n => n.san === mv.san)
                if (alt) {
                    say({ kind: "alt", title: `${label(alt)} is not this repertoire`, text: (alt.note.text ? alt.note.text + " " : "") + "Try the move this course plays." })
                    return false
                }
                missed.add(i)
                board.shake()
                board.unmark("wrong")
                board.mark("wrong", to)
                setTimeout(() => board.unmark("wrong"), 900)
                reveal()
                hintBtn.disabled = showBtn.disabled = true
                say({ kind: "wrong", title: `Not ${mv.san}. Play ${label(node)}`, text: node.note.text })
                return false
            })
        })
    }

    // The pause before the Advanced lines. Resolves to "go", "stop" or "practice".
    async function advancedNext(k, canPractice) {
        const count = items.length - k
        L.setTitle("Advanced variations next", plural(count, "line"))
        // A clean board and scoresheet: the next line's start, without the last line's moves and arrows.
        await board.show(items[k].line.chapter.root.fen, { animate: false })
        check()
        renderSheet(L.sheet, [], { upto: 0, mistakes: new Set() })
        L.commentary.replaceChildren(
            h("h2", { class: "cm-move" }, k ? "Basic lines done" : "Basic lines up to date"),
            h("p", {}, k ? `${plural(k, "line")} drilled.` : "No Basic line or trap is due."))
        L.extra.replaceChildren(h("p", { class: "banner" },
            `Next come the Advanced variations: ${plural(count, "line")}. They are optional: many players stop at the Basic lines.`))
        return new Promise(resolve => {
            L.controls.replaceChildren(h("div", { class: "more-buttons" },
                h("button", { class: "btn btn-primary", type: "button", onclick: () => resolve("go") }, "Go on to the Advanced lines"),
                canPractice ? h("button", { class: "btn", type: "button", onclick: () => resolve("practice") }, "Drill my weakest Basic lines") : null,
                // Stopping after some lines shows the session's results; stopping before any goes back.
                k ? h("button", { class: "btn", type: "button", onclick: () => resolve("stop") }, "Stop here")
                    : h("a", { class: "btn", href: backHref }, "Stop here")))
            const timer = setInterval(() => { if (!ctx.alive()) { clearInterval(timer); resolve("stop") } }, 500)
            wake = () => { clearInterval(timer); resolve("jump") }
        })
    }

    function showResult({ course, line }, result, k, total) {
        check()
        const s0 = status(line.id)
        const wasDue = !s0.rec || s0.due
        const updated = recordResult(line.id, result)
        let msg
        if (result === "failed") msg = "Done, with a mistake. This line comes back in your next drill."
        else if (result === "hinted") msg = "Done, with a hint. This line comes back in your next drill."
        else if (!wasDue) msg = "No mistakes. This line wasn't due yet, so its schedule stays the same."
        else msg = `No mistakes. Next review in ${plural(daysUntil(updated), "day")}.`
        L.extra.replaceChildren(h("div", { class: `result is-${result}` }, h("h2", {}, "Line complete"), h("p", {}, msg)))
        return new Promise(resolve => {
            const more = k < total - 1
            L.controls.replaceChildren(h("div", { class: "more-buttons" },
                h("button", { class: "btn btn-primary", type: "button", onclick: () => resolve("next") },
                    more ? `Next line (${total - k - 1} left)` : "Finish"),
                h("button", { class: "btn", type: "button", onclick: () => resolve("retry") }, "Try again"),
                h("a", { class: "btn", href: `#/learn/${course.id}/${line.id}` }, "Learn this line")))
            const timer = setInterval(() => { if (!ctx.alive()) { clearInterval(timer); resolve("stop") } }, 500)
            wake = () => { clearInterval(timer); resolve("jump") }
        })
    }
}

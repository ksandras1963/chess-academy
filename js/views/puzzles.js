// Puzzles: the list for an opening, and the solving screen.

import { Chess } from "../../vendor/chess.js/chess.js"
import { h, fig, label, paras, sideName, plural, sleep, backBar } from "../ui.js"
import { puzzles as loadPuzzles } from "../content.js"
import { mainPath } from "../course-model.js"
import { puzzleRecord, setPuzzleRecord } from "../storage.js"
import { Board } from "../board.js"
import { trainerLayout, renderSheet, mergedNote } from "./layout.js"

const STATUS_TEXT = { solved: "Solved", missed: "To retry" }
const ABORT = Symbol("abort")

export function puzzleStats(set) {
    const out = { total: set.items.length, solved: 0, missed: 0, fresh: 0 }
    for (const pz of set.items) {
        const r = puzzleRecord(pz.id)
        if (!r) out.fresh++
        else out[r.status]++
    }
    return out
}

const isMissed = pz => puzzleRecord(pz.id)?.status === "missed"
const lastSetup = pz => pz.setup[pz.setup.length - 1] || null

/** The move that led to a position as a green arrow, plus the note's own arrows and rings. */
function boardMarks(node, note) {
    const arrows = note ? [...note.arrows] : []
    const squares = note ? note.squares : []
    if (!node) return { lastMove: null, arrows, squares }
    if (!arrows.some(a => a.from === node.from && a.to === node.to)) arrows.unshift({ color: "green", from: node.from, to: node.to })
    return { lastMove: { from: node.from, to: node.to }, arrows, squares }
}

async function needSet(openingId) {
    const set = await loadPuzzles(openingId)
    if (!set) throw new Error("Puzzles for this opening are coming soon.")
    return set
}

export async function puzzlesView(root, ctx, openingId) {
    const set = await needSet(openingId)
    if (!ctx.alive()) return
    const op = set.opening
    const st = puzzleStats(set)
    const missed = set.items.filter(isMissed)
    const next = set.items.find(pz => puzzleRecord(pz.id)?.status !== "solved") || set.items[0]
    const frames = []

    root.append(h("section", { class: "puzzles" },
        backBar(),
        h("header", { class: "course-head" },
            h("h1", {}, `${op.name} puzzles`),
            h("p", { class: "course-summary" },
                `${set.items.length} positions from the ${op.name} courses. Find the best move: some punish a trap, some escape one, and a few finish the game.`),
            h("p", { class: "muted" },
                "Stockfish scores read + for White and − for Black. They measure winning chances, not material: about ±1 is a clear edge, and ±2 or more usually wins.")),
        h("div", { class: "course-actions" },
            h("a", { class: "btn btn-primary btn-big", href: `#/puzzle/${op.id}/${next.number}` },
                st.solved || st.missed ? "Continue" : "Start", h("span", { class: "btn-detail" }, `${st.solved} of ${st.total} solved`)),
            missed.length ? h("a", { class: "btn btn-big", href: `#/puzzle/${op.id}/${missed[0].number}/retry` },
                "Retry missed", h("span", { class: "btn-detail" }, plural(missed.length, "puzzle"))) : null),
        h("ol", { class: "puzzle-grid" }, set.items.map(pz => {
            const r = puzzleRecord(pz.id)
            const el = h("div", { class: "board-frame" })
            frames.push({ el, pz })
            return h("li", {},
                h("a", { class: `puzzle-card is-${r ? r.status : "new"}`, href: `#/puzzle/${op.id}/${pz.number}` },
                    el,
                    h("span", { class: "puzzle-num" }, `Puzzle ${pz.number}`),
                    h("span", { class: "puzzle-meta" }, `${sideName(pz.learner)} to move. ${pz.theme}.`),
                    h("span", { class: "puzzle-status" }, r ? STATUS_TEXT[r.status] : "New")))
        }))))

    const boards = frames.map(({ el, pz }) => {
        const b = new Board(el, { fen: pz.first.fenBefore, orientation: pz.learner })
        const m = lastSetup(pz)
        if (m) b.annotate(boardMarks(m, null))
        return b
    })
    ctx.onLeave(() => boards.forEach(b => b.destroy()))
}

export async function puzzleView(root, ctx, openingId, number, mode) {
    const set = await needSet(openingId)
    if (!ctx.alive()) return
    const op = set.opening
    const pz = set.items[Number(number) - 1]
    if (!pz) throw new Error("That puzzle doesn't exist. Go back to the puzzle list.")
    const retryMode = mode === "retry"
    const learner = pz.learner
    const check = () => { if (!ctx.alive()) throw ABORT }

    const L = trainerLayout(root, { backHref: `#/puzzles/${op.id}`, backText: `${op.name} puzzles` })
    L.setTitle(`Puzzle ${pz.number} of ${set.items.length}`, `${sideName(learner)} to move. ${pz.theme}.`)
    const last = lastSetup(pz)
    const board = new Board(L.boardEl, { fen: last ? last.fenBefore : pz.first.fenBefore, orientation: learner })
    ctx.onLeave(() => board.destroy())

    // `played` is the game so far: the setup, then each move as it is made (the last setup move
    // is played on screen). `view` is what the board and score sheet show. While solving it is
    // `played`, and the learner can step back through it. After the puzzle it is the whole line
    // with the follow-up, and the other lines (wrong tries, other answers) can be opened.
    // `view.explore` is set while a side line is shown: after the puzzle, or while solving when
    // a known wrong try plays out its refutation (then `explore.why` is that wrong move).
    const played = pz.setup.slice(0, -1)
    const view = { nodes: played, idx: played.length, explore: null }
    const missedPlies = new Set()
    const feed = []
    let done = false
    let turn = null // the learner's move being waited for: { onMove, answer }
    let waiters = []
    let resultBox = null
    let misses = 0
    let revealed = false

    const atLatest = () => !view.explore && view.idx === played.length
    const showFeed = () => L.commentary.replaceChildren(...feed.slice(-2).map(e => h("div", { class: `cm-entry is-${e.kind}` },
        h("h2", { class: "cm-move" }, e.title, e.who ? h("span", { class: "cm-who" }, e.who) : null),
        ...paras(e.text))))
    const say = entry => {
        feed.push(entry)
        if (atLatest()) showFeed()
    }

    // ---------- Board, score sheet and panel ----------

    function render(animate = false) {
        const node = view.idx ? view.nodes[view.idx - 1] : null
        // Notes (and their arrows) on the setup moves stay hidden until the puzzle is over.
        const note = node && (done || view.idx > pz.setup.length) ? mergedNote(node) : null
        const marks = boardMarks(node, note)
        if (turn?.answer && atLatest()) marks.arrows.push({ color: "answer", ...turn.answer })
        const shown = board.show(node ? node.fen : pz.chapter.root.fen, { animate, ...marks })

        renderSheet(L.sheet, view.nodes, {
            current: view.idx - 1,
            onPick: i => { stopPlay(); go(i, false) },
            mistakes: view.explore ? new Set() : missedPlies,
            symbols: done,
            followFrom: done && !view.explore ? played.length : -1
        })

        if (atLatest()) showFeed()
        else if (!node) L.commentary.replaceChildren(h("h2", { class: "cm-move" }, "Starting position"))
        else {
            L.commentary.replaceChildren(
                h("h2", { class: "cm-move" }, label(node) + (done ? node.symbol || "" : ""),
                    h("span", { class: "cm-who" }, node.color === learner ? `${sideName(node.color)}, your side` : sideName(node.color))),
                ...paras(note ? note.text : ""))
        }

        L.extra.replaceChildren()
        if (resultBox) L.extra.append(resultBox)
        if (!done && !view.explore && view.idx < played.length) {
            L.extra.append(h("div", { class: "banner" },
                h("p", {}, "You are looking at an earlier move."),
                h("button", { class: "btn btn-small", type: "button", onclick: () => goLatest() }, "Back to the puzzle")))
        }
        if (view.explore) {
            const why = view.explore.why
            L.extra.append(h("div", { class: "banner" },
                h("p", {}, why ? `Why not ${label(why)}${why.symbol || ""}` : "Side line."),
                h("button", { class: "btn btn-small", type: "button", onclick: leaveExplore }, why ? "Back to the puzzle" : "Back to the puzzle line")))
        }
        if (done) L.extra.append(otherLines() || "")

        first.disabled = prev.disabled = view.idx === 0
        next.disabled = end.disabled = view.idx >= view.nodes.length
        updatePlay()
        return shown
    }

    /** Wrong tries, other answers and the opponent's other replies along a line. */
    const altsOf = nodes => nodes.slice(pz.setup.length).flatMap(n => n.parent.children.filter(c => c !== n))

    function otherLines() {
        const alts = altsOf(view.nodes)
        if (!alts.length) return null
        return h("div", { class: "alts" },
            h("h3", {}, "Other lines"),
            h("div", { class: "alt-row" }, alts.map(a => h("button", { class: "alt-move", type: "button", onclick: () => explore(a) }, label(a) + (a.symbol || "")))))
    }

    function go(i, animate = true) {
        view.idx = Math.max(0, Math.min(i, view.nodes.length))
        if (!done && !view.explore) {
            if (view.idx >= played.length) return goLatest()
            board.disableInput()
        }
        render(animate)
    }

    /** Back to the position the puzzle is waiting on. */
    function goLatest() {
        view.idx = played.length
        render(false)
        if (turn) board.enableInput(learner, turn.onMove)
        const w = waiters
        waiters = []
        w.forEach(f => f())
    }
    const whenLatest = () => (view.idx < played.length ? new Promise(r => waiters.push(r)) : Promise.resolve())

    function explore(alt) {
        stopPlay()
        // From a side line, the puzzle's own move just takes you back to the puzzle line.
        const home = view.explore?.nodes
        if (home && home.includes(alt)) {
            leaveExplore()
            return go(home.indexOf(alt) + 1, false)
        }
        if (!view.explore) view.explore = { nodes: view.nodes, idx: view.idx }
        const prefix = view.nodes.slice(0, view.nodes.indexOf(alt.parent) + 1)
        view.nodes = [...prefix, alt, ...mainPath(alt)]
        view.idx = prefix.length + 1
        render(false)
    }

    function leaveExplore() {
        stopPlay()
        Object.assign(view, { nodes: view.explore.nodes, idx: view.explore.idx, explore: null })
        if (done) return render(false)
        goLatest()
        turn?.afterRefutation?.()
    }

    /** While solving: a known wrong try plays out on the board, then the learner tries again. */
    function showRefutation(alt) {
        view.explore = { nodes: view.nodes, idx: view.idx, why: alt }
        view.nodes = [...played, alt, ...mainPath(alt)]
        view.idx = played.length + 1
        render(false)
        startPlay(readTime(alt))
    }

    // ▶ plays the moves ahead on the board by itself, staying longer on moves with a note.
    let playing = null
    const readTime = node => 900 + Math.min(3600, (node?.note?.text?.length || 0) * 30)
    function startPlay(delay = 250) {
        clearTimeout(playing)
        const tick = () => {
            go(view.idx + 1)
            playing = view.idx < view.nodes.length ? setTimeout(tick, readTime(view.nodes[view.idx - 1])) : null
            updatePlay()
        }
        playing = setTimeout(tick, delay)
        updatePlay()
    }
    const togglePlay = () => (playing ? stopPlay() : startPlay())
    function stopPlay() {
        clearTimeout(playing)
        playing = null
        updatePlay()
    }
    function updatePlay() {
        play.hidden = !done && !view.explore
        play.disabled = !playing && view.idx >= view.nodes.length
        play.textContent = playing ? "❚❚" : "▶︎"
        const aria = playing ? "Pause" : "Play the moves"
        play.setAttribute("aria-label", aria)
        play.title = aria
    }
    ctx.onLeave(() => clearTimeout(playing))

    const btn = (text, aria, onclick) => h("button", { class: "btn btn-icon", type: "button", "aria-label": aria, title: aria, onclick }, text)
    const step = to => () => { stopPlay(); to() }
    const first = btn("«", "First move", step(() => go(0, false)))
    const prev = btn("‹", "Previous move", step(() => go(view.idx - 1)))
    const play = btn("▶︎", "Play the moves", togglePlay)
    const next = btn("›", "Next move", step(() => go(view.idx + 1)))
    const end = btn("»", "Last move", step(() => go(view.nodes.length, false)))
    const action = h("div", { class: "puzzle-action" })
    const setAction = (...kids) => action.replaceChildren(...kids)
    L.controls.append(h("div", { class: "nav-buttons" }, first, prev, play, next, end), action)

    const onKey = e => {
        if (e.target.closest("input, textarea, select")) return
        if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return
        stopPlay()
        if (e.key === "ArrowRight") go(view.idx + 1)
        else if (e.key === "ArrowLeft") go(view.idx - 1)
        else if (e.key === "Home") go(0, false)
        else go(view.nodes.length, false)
        e.preventDefault()
    }
    document.addEventListener("keydown", onKey)
    ctx.onLeave(() => document.removeEventListener("keydown", onKey))

    // ---------- Solving ----------

    try {
        say({ kind: "intro", title: "Find the best move",
            text: last ? `${sideName(last.color)} has just played ${label(last)}. ${sideName(learner)} to move.` : `${sideName(learner)} to move.` })
        render(false)
        if (last) {
            await sleep(400)
            check()
            await whenLatest()
            check()
            played.push(last)
            view.idx = played.length
            await render(true)
            check()
        }

        let cur = last || pz.chapter.root
        while (cur.children.length && cur.ply < pz.endPly) {
            const main = cur.children[0]
            if (main.color !== learner) {
                setAction(h("p", { class: "muted" }, `${sideName(main.color)} is moving…`))
                await sleep(450)
                check()
                await whenLatest()
                check()
                played.push(main)
                feed.push({ kind: "them", title: label(main), who: sideName(main.color), text: main.note.text })
                view.idx = played.length
                await render(true)
                check()
                cur = main
                continue
            }
            cur = await learnerTurn(cur)
            await sleep(150)
            check()
        }
        finish()
    } catch (e) {
        if (e !== ABORT) throw e
    }

    function learnerTurn(at) {
        return new Promise((resolve, reject) => {
            const main = at.children[0]
            const accepted = at.children.filter((c, i) => i === 0 || c.isGood)
            // The [Hint] header is for the first move; later moves can carry their own [%hint ...].
            const hint = main.note.hint || (main === pz.first ? pz.hint : "")
            let tries = 0
            let shown = false
            const reveal = () => {
                if (shown) return
                revealed = shown = true
                if (view.explore) leaveExplore()
                else if (view.idx < played.length) goLatest()
                turn.answer = { from: main.from, to: main.to }
                board.unarrow("answer")
                board.arrow("answer", main.from, main.to)
                giveUp.disabled = true
                say({ kind: "wrong", title: `The move is ${label(main)}`, text: "Play it on the board to see why." })
            }
            const giveUp = h("button", { class: "btn btn-small", type: "button", onclick: reveal }, "Show answer")
            setAction(h("p", { class: "prompt" }, `Your move as ${sideName(learner)}.`), h("div", { class: "more-buttons" }, giveUp))
            const timer = setInterval(() => {
                if (ctx.alive()) return
                clearInterval(timer)
                reject(ABORT)
            }, 500)

            const onMove = (from, to) => {
                let mv
                try {
                    mv = new Chess(at.fen).move({ from, to, promotion: "q" })
                } catch {
                    return false // not a legal move: the piece just goes back
                }
                const match = at.children.find(c => c.san === mv.san)
                if (match && accepted.includes(match)) {
                    clearInterval(timer)
                    board.disableInput()
                    turn = null
                    setTimeout(async () => {
                        played.push(match)
                        const who = shown ? "Now you have it" : match === main ? "Correct" : match.symbol === "!?" ? "Playable" : "Also good"
                        feed.push({ kind: "you", title: label(match) + (match.symbol || ""), who, text: match.note.text })
                        view.idx = played.length
                        await render(true)
                        resolve(match)
                    }, 0)
                    return true
                }
                misses++
                tries++
                missedPlies.add(played.length)
                say({
                    kind: "wrong",
                    title: match ? `${label(match)}${match.symbol || ""} is a mistake` : `${fig(mv.san)} isn't the best move`,
                    text: (match && match.note.text) || (tries === 1 ? "Try again." : "")
                })
                if (tries === 1 && hint && !shown) say({ kind: "hint", title: "Hint", text: hint })
                // A wrong try written with its refutation plays out on the board first.
                if (match && match.children.length) {
                    board.disableInput()
                    setTimeout(() => showRefutation(match), 0)
                    return true
                }
                board.shake()
                board.unmark("wrong")
                board.mark("wrong", to)
                setTimeout(() => board.unmark("wrong"), 900)
                if (tries >= 2) reveal()
                return false
            }
            // After a refutation, back at the puzzle: a second miss shows the answer.
            turn = { onMove, answer: null, afterRefutation: () => { if (tries >= 2) reveal() } }
            if (view.idx === played.length) board.enableInput(learner, onMove)
        })
    }

    function finish() {
        done = true
        turn = null
        board.disableInput()
        const clean = misses === 0 && !revealed
        const before = puzzleRecord(pz.id)
        setPuzzleRecord(pz.id, { status: clean ? "solved" : "missed", tries: (before?.tries || 0) + 1, last: Date.now() })

        const after = set.items.slice(pz.index + 1).concat(set.items.slice(0, pz.index))
        const nextPz = retryMode ? after.find(isMissed) : set.items[pz.index + 1]
        const nextHref = nextPz ? `#/puzzle/${op.id}/${nextPz.number}${retryMode ? "/retry" : ""}` : `#/puzzles/${op.id}`

        // The follow-up: how the line goes on after the last move the learner had to find.
        const followUp = mainPath(played[played.length - 1])
        resultBox = h("div", { class: `result is-${clean ? "clean" : "failed"}` },
            h("h2", {}, clean ? "Solved" : "Solved with help"),
            h("p", {}, pz.title + "."),
            clean ? null : h("p", { class: "muted" }, "Marked to retry. It appears under Retry missed until you solve it cleanly."),
            h("p", { class: "muted" }, [
                followUp.length ? "The game goes on by itself on the board: ❚❚ pauses it, and you can tap any move to see that position."
                    : "Tap any move to see that position.",
                altsOf([...played, ...followUp]).length ? "Open a line under Other lines, then tap ▶︎ to watch it." : ""
            ].filter(Boolean).join(" ")))
        view.nodes = [...played, ...followUp]
        view.idx = played.length
        setAction(h("div", { class: "more-buttons" },
            h("a", { class: "btn btn-primary", href: nextHref }, nextPz ? "Next puzzle" : "All puzzles"),
            h("button", { class: "btn", type: "button", onclick: () => window.dispatchEvent(new HashChangeEvent("hashchange")) }, "Try again"),
            nextPz ? h("a", { class: "btn", href: `#/puzzles/${op.id}` }, "All puzzles") : null))
        render(false)
        // Play the follow-up, after time to read the last move's note.
        if (followUp.length) startPlay(readTime(played[played.length - 1]) + 400)
    }
}

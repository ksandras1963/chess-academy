// Puzzles: the list for an opening, and the solving screen.

import { Chess } from "../../vendor/chess.js/chess.js"
import { h, fig, paras, sideName, plural, sleep, backBar } from "../ui.js"
import { puzzles as loadPuzzles } from "../content.js"
import { puzzleRecord, setPuzzleRecord } from "../storage.js"
import { Board } from "../board.js"
import { trainerLayout, renderSheet } from "./layout.js"

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
/** Setup moves are shown without ! and ? marks, which would give the game away. */
const plainLabel = node => (node.color === "w" ? `${node.moveNumber}.${fig(node.san)}` : `${node.moveNumber}…${fig(node.san)}`)

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
                `${set.items.length} positions from the ${op.name} courses. Find the best move: some punish a trap, some escape one, and a few finish the game.`)),
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
        if (m) b.annotate({ lastMove: { from: m.from, to: m.to } })
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

    const played = [...pz.setup]
    const missedPlies = new Set()
    const sheet = () => renderSheet(L.sheet, played, { mistakes: missedPlies, symbols: false })
    const feed = []
    const say = entry => {
        feed.push(entry)
        L.commentary.replaceChildren(...feed.slice(-2).map(e => h("div", { class: `cm-entry is-${e.kind}` },
            h("h2", { class: "cm-move" }, e.title, e.who ? h("span", { class: "cm-who" }, e.who) : null),
            ...paras(e.text))))
    }

    let misses = 0
    let revealed = false

    try {
        sheet()
        L.commentary.replaceChildren(h("h2", { class: "cm-move" }, "Find the best move"),
            h("p", {}, last ? `${sideName(last.color)} has just played ${plainLabel(last)}. ${sideName(learner)} to move.` : `${sideName(learner)} to move.`))
        if (last) {
            await sleep(400)
            check()
            await board.show(last.fen, { lastMove: { from: last.from, to: last.to } })
            check()
        }

        let cur = last || pz.chapter.root
        while (cur.children.length) {
            const main = cur.children[0]
            if (main.color !== learner) {
                L.controls.replaceChildren(h("p", { class: "muted" }, `${sideName(main.color)} is moving…`))
                await sleep(450)
                check()
                await board.show(main.fen, { lastMove: { from: main.from, to: main.to } })
                check()
                played.push(main)
                sheet()
                say({ kind: "them", title: plainLabel(main), who: sideName(main.color), text: main.note.text })
                cur = main
                continue
            }
            cur = await learnerTurn(cur)
            played.push(cur)
            sheet()
            await sleep(150)
            check()
        }
        board.disableInput()
        finish()
    } catch (e) {
        if (e !== ABORT) throw e
    }

    function learnerTurn(at) {
        return new Promise((resolve, reject) => {
            const main = at.children[0]
            const accepted = at.children.filter((c, i) => i === 0 || c.isGood)
            const reveal = () => {
                revealed = true
                board.unarrow("answer")
                board.arrow("answer", main.from, main.to)
                giveUp.disabled = true
                say({ kind: "wrong", title: `The move is ${plainLabel(main)}`, text: "Play it on the board to see why." })
            }
            const giveUp = h("button", { class: "btn btn-small", type: "button", onclick: reveal }, "Show answer")
            L.controls.replaceChildren(h("p", { class: "prompt" }, `Your move as ${sideName(learner)}.`), h("div", { class: "more-buttons" }, giveUp))
            const timer = setInterval(() => {
                if (ctx.alive()) return
                clearInterval(timer)
                reject(ABORT)
            }, 500)

            board.enableInput(learner, (from, to) => {
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
                    setTimeout(async () => {
                        await board.show(match.fen, { lastMove: { from: match.from, to: match.to }, arrows: match.note.arrows, squares: match.note.squares })
                        say({ kind: "you", title: plainLabel(match) + (match.symbol || ""), who: revealed ? "Now you have it" : "Correct", text: match.note.text })
                        resolve(match)
                    }, 0)
                    return true
                }
                misses++
                missedPlies.add(played.length)
                board.shake()
                board.unmark("wrong")
                board.mark("wrong", to)
                setTimeout(() => board.unmark("wrong"), 900)
                say({
                    kind: "wrong",
                    title: match ? `${plainLabel(match)}${match.symbol || ""} is a mistake` : `${fig(mv.san)} isn't the best move`,
                    text: (match && match.note.text) || (misses === 1 ? "Try again." : "")
                })
                if (misses === 1 && pz.hint && !revealed) say({ kind: "hint", title: "Hint", text: pz.hint })
                if (misses >= 2 && !revealed) reveal()
                return false
            })
        })
    }

    function finish() {
        const clean = misses === 0 && !revealed
        const before = puzzleRecord(pz.id)
        setPuzzleRecord(pz.id, { status: clean ? "solved" : "missed", tries: (before?.tries || 0) + 1, last: Date.now() })

        const after = set.items.slice(pz.index + 1).concat(set.items.slice(0, pz.index))
        const nextPz = retryMode ? after.find(isMissed) : set.items[pz.index + 1]
        const nextHref = nextPz ? `#/puzzle/${op.id}/${nextPz.number}${retryMode ? "/retry" : ""}` : `#/puzzles/${op.id}`

        L.extra.replaceChildren(h("div", { class: `result is-${clean ? "clean" : "failed"}` },
            h("h2", {}, clean ? "Solved" : "Solved with help"),
            h("p", {}, pz.title + "."),
            clean ? null : h("p", { class: "muted" }, "Marked to retry. It appears under Retry missed until you solve it cleanly.")))
        L.controls.replaceChildren(h("div", { class: "more-buttons" },
            h("a", { class: "btn btn-primary", href: nextHref }, nextPz ? "Next puzzle" : "All puzzles"),
            h("button", { class: "btn", type: "button", onclick: () => window.dispatchEvent(new HashChangeEvent("hashchange")) }, "Try again"),
            nextPz ? h("a", { class: "btn", href: `#/puzzles/${op.id}` }, "All puzzles") : null))
    }
}

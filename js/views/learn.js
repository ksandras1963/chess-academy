// Learn mode: step through a line (or a key-ideas chapter) with the explanation for each move.

import { h, figText, paras, label, sideName, spellOut } from "../ui.js"
import { course as loadCourse } from "../content.js"
import { mainPath, sideNotes, siblingBranches } from "../course-model.js"
import { Board } from "../board.js"
import { trainerLayout, renderSheet, mergedNote, furtherStudy } from "./layout.js"
import { sideLabel, sectionLink } from "./course.js"
import { ideasPage } from "./ideas.js"

export async function learnView(root, ctx, courseId, lineKey, startAt) {
    const c = await loadCourse(courseId)
    if (!ctx.alive()) return
    let base
    if (lineKey.startsWith("ideas-")) {
        const ch = c.chapters[Number(lineKey.slice(6))]
        if (!ch || ch.type !== "ideas") throw new Error("This key-ideas page no longer exists. Go back to the course.")
        base = { nodes: mainPath(ch.root), start: ch.root, title: ch.title, sub: "", line: null }
    } else {
        const line = c.lines.find(l => l.id === lineKey)
        if (!line) throw new Error("This line no longer exists; it may have been edited. Go back to the course to see the current lines.")
        base = { nodes: line.nodes, start: line.chapter.root, title: line.chapter.title, sub: figText(line.variation), line }
    }
    // The side the learner plays here: the chapter's (a course for both sides mixes them).
    const learner = base.line ? base.line.learner : c.chapters[Number(lineKey.slice(6))].learner

    // Key ideas pages link to the previous and next idea, so they can be read in order.
    const steps = {}
    if (!base.line) {
        const ideas = c.chapters.filter(ch => ch.type === "ideas")
        const at = ideas.findIndex(ch => ch.index === Number(lineKey.slice(6)))
        const link = ch => (ch ? { href: `#/learn/${c.id}/ideas-${ch.index}`, text: ch.title.replace(/^Key ideas:\s*/i, "") } : null)
        steps.prev = link(ideas[at - 1])
        steps.next = link(ideas[at + 1])
    }
    // Back to the line's section, then the course page (whose map opens lessons directly), then Main menu.
    const coursePage = { href: `#/course/${c.id}`, text: sideLabel(c) }
    const section = base.line ? sectionLink(c, base.line) : coursePage
    const trail = section.href === coursePage.href ? [coursePage] : [section, coursePage]
    // A Key ideas page made of concepts shows one board per concept instead of the single trainer board.
    const page = base.line ? null : c.chapters[Number(lineKey.slice(6))]
    if (page && page.concepts.length) return ideasPage(root, ctx, c, page, { trail, ...steps })
    const L = trainerLayout(root, { trail, ...steps })
    L.setTitle(spellOut(base.title), base.sub)
    // A line's introduction stays in view while the moves are played; a Key ideas page shows its text
    // as the starting position's note instead.
    if (base.line) L.setIntro(paras(base.start.note.text || ""))
    const state = { nodes: base.nodes, idx: Math.min(Number(startAt) || 0, base.nodes.length), explore: null }
    const board = new Board(L.boardEl, { fen: base.start.fen, orientation: learner })
    ctx.onLeave(() => board.destroy())

    const fenAt = i => (i === 0 ? base.start.fen : state.nodes[i - 1].fen)

    function go(i, animate = true) {
        state.idx = Math.max(0, Math.min(i, state.nodes.length))
        render(animate)
    }

    function explore(node) {
        if (!state.explore) state.explore = { nodes: state.nodes, idx: state.idx }
        const prefix = state.nodes.slice(0, state.idx - 1)
        state.nodes = [...prefix, node, ...mainPath(node)]
        render(false)
    }

    function leaveExplore() {
        Object.assign(state, { nodes: state.explore.nodes, idx: state.explore.idx, explore: null })
        render(false)
    }

    function render(animate) {
        const node = state.idx ? state.nodes[state.idx - 1] : null
        const note = node ? mergedNote(node) : base.start.note
        board.show(fenAt(state.idx), {
            animate,
            lastMove: node ? { from: node.from, to: node.to } : null,
            arrows: note.arrows, squares: note.squares
        })
        renderSheet(L.sheet, state.nodes, { current: state.idx - 1, onPick: i => go(i, false) })

        if (!node) {
            L.setMove(state.nodes.length ? h("h2", { class: "cm-move" }, "Starting position") : null)
            L.commentary.replaceChildren(...paras((!base.line && note.text) || (state.nodes.length
                ? "Step through the line with the arrows, or tap any move on the score sheet." : "")))
        } else {
            const who = node.color === learner ? `${sideName(node.color)}, your side` : sideName(node.color)
            L.setMove(h("h2", { class: "cm-move" }, label(node) + (node.symbol || ""), h("span", { class: "cm-who" }, who)))
            L.commentary.replaceChildren(...paras(note.text))
        }

        L.extra.replaceChildren()
        if (!base.line) L.extra.append(furtherStudy(c.opening.furtherStudy) || "")
        if (state.explore) {
            L.extra.append(h("div", { class: "banner" },
                h("p", {}, "Side line. It isn't part of this repertoire and isn't drilled."),
                h("button", { class: "btn btn-small", type: "button", onclick: leaveExplore }, "Back to the line")))
        }
        if (node) {
            const notes = sideNotes(node, learner)
            const branches = siblingBranches(node, learner)
            if (notes.length) {
                L.extra.append(h("div", { class: "alts" },
                    h("h3", {}, "Other moves here, not in this repertoire"),
                    h("ul", {}, notes.map(n => h("li", {},
                        h("button", { class: "alt-move", type: "button", onclick: () => explore(n) }, label(n) + (n.symbol || "")),
                        n.note.text ? h("span", { class: "alt-note" }, figText(n.note.text.replace(/\n\n/g, " "))) : null)))))
            }
            if (branches.length) {
                L.extra.append(h("div", { class: "alts" },
                    h("h3", {}, `${sideName(node.color)} can also play`),
                    h("ul", {}, branches.map(b => {
                        const target = c.lines.find(l => l.nodes[state.idx - 1] === b)
                        const go = target
                            ? () => { location.hash = `#/learn/${c.id}/${target.id}/${state.idx}` }
                            : () => explore(b)
                        return h("li", {}, h("button", { class: "alt-move", type: "button", onclick: go }, label(b) + (b.symbol || "")),
                            b.note.text ? h("span", { class: "alt-note" }, figText(b.note.text.replace(/\n\n/g, " "))) : null)
                    }))))
            }
        }
        updateControls()
    }

    const btn = (text, aria, onclick) => h("button", { class: "btn btn-icon", type: "button", "aria-label": aria, title: aria, onclick }, text)
    const first = btn("«", "First move", () => go(0, false))
    const prev = btn("‹", "Previous move", () => go(state.idx - 1))
    const next = btn("›", "Next move", () => go(state.idx + 1))
    const last = btn("»", "Last move", () => go(state.nodes.length, false))
    const flip = h("button", { class: "btn btn-small", type: "button", onclick: () => board.flip() }, "Flip board")
    L.controls.append(h("div", { class: "nav-buttons" }, first, prev, next, last),
        h("div", { class: "more-buttons" }, flip,
            base.line ? h("a", { class: "btn btn-primary btn-small", href: `#/drill/${c.id}/${base.line.id}` }, "Drill this line") : null))

    function updateControls() {
        first.disabled = prev.disabled = state.idx === 0
        next.disabled = last.disabled = state.idx >= state.nodes.length
        // A key-ideas page made of a single position has nothing to step through.
        const still = state.nodes.length === 0
        L.sheet.hidden = still
        first.parentElement.hidden = still
    }

    const onKey = e => {
        if (e.target.closest("input, textarea, select")) return
        if (e.key === "ArrowRight") { go(state.idx + 1); e.preventDefault() }
        else if (e.key === "ArrowLeft") { go(state.idx - 1); e.preventDefault() }
        else if (e.key === "Home") { go(0, false); e.preventDefault() }
        else if (e.key === "End") { go(state.nodes.length, false); e.preventDefault() }
    }
    document.addEventListener("keydown", onKey)
    ctx.onLeave(() => document.removeEventListener("keydown", onKey))

    render(false)
}

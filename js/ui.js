// Small DOM helpers. Text always goes in as text nodes, never as HTML.

import { settings } from "./storage.js"

export function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag)
    for (const [k, v] of Object.entries(attrs || {})) {
        if (v == null || v === false) continue
        if (k === "class") el.className = v
        else if (k === "style" && typeof v === "object") Object.assign(el.style, v)
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v)
        else el.setAttribute(k, v === true ? "" : v)
    }
    for (const c of children.flat(Infinity)) {
        if (c == null || c === false) continue
        el.append(c instanceof Node ? c : String(c))
    }
    return el
}

const FIG = { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘" }
const VS15 = "︎" // text presentation, so no emoji pieces

/** SAN with figurines (♘f3) unless the learner chose letters. */
export function fig(san) {
    if (settings().notation === "letters") return san
    return san.replace(/^[KQRBN]/, m => FIG[m] + VS15).replace(/=([QRBN])/, (_, p) => "=" + FIG[p] + VS15)
}

/** Figurines inside free text: "3.Bc4" becomes "3.♗c4". */
export function figText(text) {
    if (settings().notation === "letters") return text
    return text.replace(/(^|[\s(.…])([KQRBN])(?=[a-h]?[1-8]?x?[a-h][1-8]\b)/g, (_, pre, p) => pre + FIG[p] + VS15)
}

/** Abbreviations in chapter titles, spelled out the first time a page uses them. */
const ABBREVIATIONS = { QGD: "Queen's Gambit Declined", QGA: "Queen's Gambit Accepted" }

/**
 * "QGD – Exchange: 5...Be7" becomes "Queen's Gambit Declined (QGD) – Exchange: 5...Be7" the first time a
 * page shows QGD. `seen` holds the abbreviations a page has already spelled out; a page with a
 * single title leaves it out.
 */
export function spellOut(text, seen = new Set()) {
    return text.replace(/\b(QGD|QGA)\b/g, abbr => {
        if (seen.has(abbr)) return abbr
        seen.add(abbr)
        return `${ABBREVIATIONS[abbr]} (${abbr})`
    })
}

/**
 * The back buttons at the top of every page except the main menu.
 * `parent` adds a second button, e.g. back to the course from a lesson: { href, text }.
 */
export function backBar(parent = null) {
    return h("nav", { class: "backbar", "aria-label": "Back" },
        h("a", { class: "btn btn-small btn-back", href: "#/" }, h("span", { "aria-hidden": "true" }, "‹"), "Main menu"),
        parent ? h("a", { class: "btn btn-small btn-back", href: parent.href }, h("span", { "aria-hidden": "true" }, "‹"), parent.text) : null)
}

/** Back buttons from the nearest page to the farthest, with Main menu last (lesson pages). */
export function backTrail(links) {
    return h("nav", { class: "backbar", "aria-label": "Back" },
        [...links, { href: "#/", text: "Main menu" }].map(l =>
            h("a", { class: "btn btn-small btn-back", href: l.href }, h("span", { "aria-hidden": "true" }, "‹"), l.text)))
}

/** A note as paragraphs (a blank line in the PGN comment starts a new one), with figurines. */
export function paras(text, attrs = {}) {
    return String(text || "").split(/\n\n+/).filter(Boolean).map(p => h("p", attrs, figText(p)))
}

export function label(node) {
    return node.color === "w" ? `${node.moveNumber}.${fig(node.san)}` : `${node.moveNumber}…${fig(node.san)}`
}

/** "1.e4 e5 2.Nf3" from a SAN movetext string, with figurines. */
export function figMoves(movetext) {
    return movetext.replace(/(\d+)\.\s+/g, "$1.").split(/\s+/).map(tok => {
        const m = /^(\d+\.)(.*)$/.exec(tok)
        return m ? m[1] + fig(m[2]) : fig(tok)
    }).join(" ")
}

export function sideName(color) { return color === "w" ? "White" : "Black" }

/**
 * A Key ideas page's title says which side it is for: "Playing as White: The setup and the move order".
 * The side isn't named twice ("Plans for White" becomes "Plans", "White's plan" becomes "The plan").
 * A page about both sides keeps its own title.
 */
export function ideasTitle(ch) {
    const side = { white: "White", black: "Black" }[ch.side]
    if (!side) return ch.title
    const rest = ch.title.replace(/^Key ideas:\s*/i, "")
        .replace(new RegExp(`\\s+(for|as) ${side}$`), "")
        .replace(new RegExp(`^${side}'s\\s+`), "The ")
    return `Playing as ${side}: ${rest}`
}

export function plural(n, word, many = word + "s") { return `${n} ${n === 1 ? word : many}` }

export const sleep = ms => new Promise(r => setTimeout(r, ms))

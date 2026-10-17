// Thin wrapper around cm-chessboard: positions, last-move and annotation markers, arrows, move input.

import { Chessboard, INPUT_EVENT_TYPE, BORDER_TYPE } from "../vendor/cm-chessboard/src/Chessboard.js"
import { Markers } from "../vendor/cm-chessboard/src/extensions/markers/Markers.js"
import { Arrows } from "../vendor/cm-chessboard/src/extensions/arrows/Arrows.js"
import { settings } from "./storage.js"

export const MARK = {
    last: { class: "mk-last", slice: "markerSquare" },
    input: { class: "mk-input", slice: "markerFrame" },
    hint: { class: "mk-hint", slice: "markerCircle" },
    wrong: { class: "mk-wrong", slice: "markerSquare" },
    // PGN [%csl] squares are drawn as rings so they never look like the last-move highlight.
    green: { class: "mk-green", slice: "markerCircle" },
    red: { class: "mk-red", slice: "markerCircle" },
    yellow: { class: "mk-yellow", slice: "markerCircle" },
    blue: { class: "mk-blue", slice: "markerCircle" }
}
export const ARROW = {
    green: { class: "ar-green" },
    red: { class: "ar-red" },
    yellow: { class: "ar-yellow" },
    blue: { class: "ar-blue" },
    answer: { class: "ar-answer" }
}

export class Board {
    constructor(el, { fen, orientation = "w" } = {}) {
        const s = settings()
        this.el = el
        this.cb = new Chessboard(el, {
            position: fen,
            orientation,
            assetsUrl: "vendor/cm-chessboard/assets/",
            style: {
                cssClass: "ot",
                showCoordinates: s.coordinates,
                borderType: BORDER_TYPE.none,
                pieces: { file: "pieces/standard.svg" },
                animationDuration: s.animation === "off" ? 0 : s.animation === "fast" ? 120 : 260
            },
            extensions: [{ class: Markers, props: { autoMarkers: MARK.input } }, { class: Arrows }]
        })
    }

    /** Shows a position with an optional last move, PGN arrows and squares. */
    async show(fen, { animate = true, lastMove = null, arrows = [], squares = [] } = {}) {
        this.clear()
        const p = this.cb.setPosition(fen, animate)
        this.annotate({ lastMove, arrows, squares })
        await p
    }

    annotate({ lastMove = null, arrows = [], squares = [] } = {}) {
        if (lastMove) {
            this.cb.addMarker(MARK.last, lastMove.from)
            this.cb.addMarker(MARK.last, lastMove.to)
        }
        for (const s of squares) this.cb.addMarker(MARK[s.color] || MARK.yellow, s.square)
        for (const a of arrows) this.cb.addArrow(ARROW[a.color] || ARROW.green, a.from, a.to)
    }

    clear() {
        this.cb.removeMarkers()
        this.cb.removeArrows()
    }

    mark(type, square) { this.cb.addMarker(MARK[type], square) }
    unmark(type) { this.cb.removeMarkers(MARK[type]) }
    arrow(type, from, to) { this.cb.addArrow(ARROW[type], from, to) }
    unarrow(type) { this.cb.removeArrows(type ? ARROW[type] : undefined) }

    get orientation() { return this.cb.getOrientation() }
    setOrientation(color) { return this.cb.setOrientation(color, false) }
    flip() { return this.setOrientation(this.orientation === "w" ? "b" : "w") }

    /** onMove(from, to) must return true to accept the move on the board. */
    enableInput(color, onMove) {
        this.disableInput()
        this.cb.enableMoveInput(event => {
            if (event.type === INPUT_EVENT_TYPE.validateMoveInput) return onMove(event.squareFrom, event.squareTo)
            return true
        }, color)
    }

    disableInput() {
        if (this.cb.isMoveInputEnabled()) this.cb.disableMoveInput()
    }

    shake() {
        clearTimeout(this.shakeTimer)
        this.el.classList.remove("shake")
        void this.el.offsetWidth
        this.el.classList.add("shake")
        this.shakeTimer = setTimeout(() => this.el.classList.remove("shake"), 700)
    }

    destroy() {
        try { this.cb.destroy() } catch { /* already gone */ }
    }
}

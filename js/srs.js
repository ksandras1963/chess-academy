// Spaced repetition per line (Leitner boxes). Box 0 = new or just missed; a clean run moves a due line up
// one box. There is no daily limit: the learner decides how many lines to drill.

import { lineRecord, setLineRecord } from "./storage.js"

export const INTERVALS = [0, 1, 3, 7, 14, 30, 60] // days for boxes 0..6
const DAY = 86400000

// ?days=N shifts the clock N days forward (for testing the schedule).
let offsetDays = 0
try {
    offsetDays = Number(new URLSearchParams(location.search).get("days")) || 0
} catch { /* not in a browser */ }

export function now() { return Date.now() + offsetDays * DAY }

function startOfDay(t) {
    const d = new Date(t)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
}

export function status(lineId) {
    const rec = lineRecord(lineId)
    if (!rec) return { kind: "new", label: "New", due: false, box: 0 }
    const kind = rec.box <= 2 ? "learning" : rec.box <= 4 ? "review" : "known"
    const label = { learning: "Learning", review: "Reviewing", known: "Known" }[kind]
    return { kind, label, due: rec.due <= now(), box: rec.box, rec }
}

/**
 * Records a drill result: "clean" (no help), "hinted" (used a hint) or "failed" (a wrong move or shown answer).
 * A missed or hinted line is due again at once, so it comes back in the next drill. Returns the updated record.
 */
export function recordResult(lineId, result) {
    const t = now()
    let rec = lineRecord(lineId)
    if (!rec) rec = { box: 0, due: 0, reps: 0, lapses: 0, first: t }
    const wasDue = rec.box === 0 || rec.due <= t
    if (result === "failed") {
        rec.box = 0
        rec.lapses++
        rec.due = t
    } else if (result === "hinted") {
        rec.box = Math.min(rec.box, 1)
        rec.due = t
    } else if (wasDue) {
        rec.box = Math.min(rec.box + 1, INTERVALS.length - 1)
        rec.due = startOfDay(t) + INTERVALS[rec.box] * DAY
    } // a clean run of a line that is not yet due changes nothing
    rec.reps++
    rec.last = t
    setLineRecord(lineId, { ...rec })
    return rec
}

export function daysUntil(rec) {
    return Math.max(0, Math.round((startOfDay(rec.due) - startOfDay(now())) / DAY))
}

/**
 * Due lines (most overdue first), then every new line. New lines come only from the basic and trap
 * sections: an advanced line joins the schedule once the learner drills it.
 */
export function buildQueue(lines, { includeNew = true } = {}) {
    const due = lines.map(l => ({ l, s: status(l.id) }))
        .filter(x => x.s.rec && x.s.due)
        .sort((a, b) => a.s.rec.due - b.s.rec.due)
        .map(x => x.l)
    const fresh = includeNew ? lines.filter(l => !lineRecord(l.id) && l.section !== "advanced") : []
    return [...due, ...fresh]
}

/** True once every Basic and Traps line among `lines` has been started, so the drill has no new lines left. */
export function basicStarted(lines) {
    const core = lines.filter(l => l.section !== "advanced")
    return core.length > 0 && core.every(l => lineRecord(l.id))
}

/** Lines to practice when nothing is due: weakest and least recently seen first. */
export function practiceQueue(lines, n = 5) {
    return lines.map(l => ({ l, r: lineRecord(l.id) }))
        .filter(x => x.r)
        .sort((a, b) => a.r.box - b.r.box || a.r.last - b.r.last)
        .slice(0, n)
        .map(x => x.l)
}

export function progress(lines) {
    const out = { total: lines.length, fresh: 0, learning: 0, review: 0, known: 0, due: 0, pct: 0 }
    let sum = 0
    for (const l of lines) {
        const s = status(l.id)
        if (s.kind === "new") out.fresh++
        else out[s.kind]++
        if (s.due) out.due++
        sum += Math.min(s.box, 5) / 5
    }
    out.pct = lines.length ? Math.round((sum / lines.length) * 100) : 0
    return out
}

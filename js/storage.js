// Progress and settings, kept in localStorage on this device.
// Everything goes through load()/save() so a private window or blocked storage still works (in memory).

const KEY = "openingTrainer.v1"
const DEFAULTS = {
    v: 1,
    lines: {},            // lineId -> { box, due, last, reps, lapses }
    puzzles: {},          // puzzleId -> { status: "solved" | "missed", tries, last }
    daily: { day: "", newCount: 0 },
    settings: { theme: "dark", newPerDay: 3, animation: "normal", coordinates: true, notation: "figurines", sides: {} }
}

let state = null

function clone(o) { return JSON.parse(JSON.stringify(o)) }

function normalize(data) {
    const s = clone(DEFAULTS)
    if (data && typeof data === "object") {
        if (data.lines && typeof data.lines === "object") s.lines = data.lines
        if (data.puzzles && typeof data.puzzles === "object") s.puzzles = data.puzzles
        if (data.daily) s.daily = { ...s.daily, ...data.daily }
        if (data.settings) s.settings = { ...s.settings, ...data.settings }
    }
    return s
}

export function load() {
    if (state) return state
    try {
        state = normalize(JSON.parse(localStorage.getItem(KEY) || "null"))
    } catch {
        state = normalize(null)
    }
    return state
}

export function save() {
    try {
        localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
        // storage blocked or full: keep working in memory
    }
}

export function settings() { return load().settings }

export function updateSettings(patch) {
    Object.assign(load().settings, patch)
    save()
}

/** The side last chosen in a course that covers both sides ("white" or "black"), or null. */
export function preferredSide(openingId) { return (load().settings.sides || {})[openingId] || null }

export function setPreferredSide(openingId, side) {
    const s = load().settings
    s.sides = { ...(s.sides || {}), [openingId]: side }
    save()
}

export function lineRecord(id) { return load().lines[id] || null }

export function setLineRecord(id, rec) {
    load().lines[id] = rec
    save()
}

export function puzzleRecord(id) { return load().puzzles[id] || null }

export function setPuzzleRecord(id, rec) {
    load().puzzles[id] = rec
    save()
}

export function resetProgress() {
    const s = load()
    s.lines = {}
    s.puzzles = {}
    s.daily = { day: "", newCount: 0 }
    save()
}

// ---- backup ----

const PREFIX = "OT1:"

export function exportCode() {
    const json = JSON.stringify(load())
    const bytes = new TextEncoder().encode(json)
    let bin = ""
    for (const b of bytes) bin += String.fromCharCode(b)
    return PREFIX + btoa(bin)
}

export function exportJson() { return JSON.stringify(load(), null, 1) }

/** Replaces progress with a backup (code or JSON text). Returns the number of lines restored. */
export function importBackup(text) {
    text = text.trim()
    let data
    if (text.startsWith(PREFIX)) {
        const bin = atob(text.slice(PREFIX.length).replace(/\s+/g, ""))
        const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
        data = JSON.parse(new TextDecoder().decode(bytes))
    } else {
        data = JSON.parse(text)
    }
    if (!data || data.v !== 1 || typeof data.lines !== "object") throw new Error("This is not an Opening Trainer backup.")
    state = normalize(data)
    save()
    return Object.keys(state.lines).length
}

// Loads the course catalog and course PGNs (cached for the session).

import { Chess } from "../vendor/chess.js/chess.js"
import { buildCourse, buildPuzzleSet, buildSurvey } from "./course-model.js"

let catalogPromise = null
const courses = new Map()
const puzzleSets = new Map()
const surveys = new Map()

// The single-file build ("Opening Trainer.html") embeds the content files here, so it needs no server.
const embedded = globalThis.__OT_CONTENT__ || null

async function readText(path, failMessage) {
    if (embedded && path in embedded) return embedded[path]
    const r = await fetch(path, { cache: "no-cache" }).catch(() => null) // check for a newer version every time
    if (!r || !r.ok) throw new Error(failMessage)
    return r.text()
}

export function catalog() {
    if (!catalogPromise) {
        catalogPromise = readText("content/courses.json", "The course list could not be loaded. Check your connection and reload.")
            .then(text => JSON.parse(text))
            .then(cat => {
                cat.courseById = new Map()
                for (const op of cat.openings) {
                    const c = new Chess()
                    c.loadPgn(op.moves)
                    op.fen = c.fen()
                    for (const meta of op.courses) {
                        meta.opening = op
                        meta.available = Boolean(meta.file)
                        cat.courseById.set(meta.id, meta)
                    }
                }
                for (const s of cat.surveys || []) {
                    const c = new Chess()
                    c.loadPgn(s.moves)
                    s.fen = c.fen()
                }
                return cat
            })
        catalogPromise.catch(() => { catalogPromise = null })
    }
    return catalogPromise
}

export async function course(id) {
    if (courses.has(id)) return courses.get(id)
    const cat = await catalog()
    const meta = cat.courseById.get(id)
    if (!meta) throw new Error("There is no course with that name. Go back to the openings list.")
    if (!meta.available) throw new Error(`${meta.opening.name}${meta.side === "both" ? "" : ` as ${meta.side === "white" ? "White" : "Black"}`} is coming soon.`)
    const built = buildCourse(meta, await readText(meta.file, `The file ${meta.file} could not be loaded.`))
    courses.set(id, built)
    return built
}

/** An opening's puzzle set (opening.puzzles in courses.json), or null when it has none yet. */
export async function puzzles(openingId) {
    if (puzzleSets.has(openingId)) return puzzleSets.get(openingId)
    const cat = await catalog()
    const op = cat.openings.find(o => o.id === openingId)
    if (!op) throw new Error("There is no opening with that name. Go back to the main menu.")
    if (!op.puzzles) return null
    const set = { opening: op, items: buildPuzzleSet({ id: op.id }, await readText(op.puzzles, `The file ${op.puzzles} could not be loaded.`)) }
    puzzleSets.set(openingId, set)
    return set
}

/** An opening overview (courses.json "surveys"), such as the replies to 1.d4. */
export async function survey(id) {
    if (surveys.has(id)) return surveys.get(id)
    const cat = await catalog()
    const meta = (cat.surveys || []).find(s => s.id === id)
    if (!meta) throw new Error("There is no overview with that name. Go back to the main menu.")
    const built = buildSurvey(meta, await readText(meta.file, `The file ${meta.file} could not be loaded.`))
    surveys.set(id, built)
    return built
}

/** The overview an opening sits under (the replies to 1.e4 for the Italian), as a back button: { href, text }. */
export async function overviewBack(opening) {
    const all = (await catalog()).surveys || []
    // The closest one: the Queen's Gambit page (1.d4 d5 2.c4) before Replies to 1.d4. An opening's own
    // Introduction page (the Caro-Kann's, 1.e4 c6) is skipped: its course page repeats its map and table.
    const s = all.filter(s => s.moves && opening.moves.startsWith(s.moves) && s.moves !== opening.moves)
        .sort((a, b) => b.moves.length - a.moves.length)[0] ||
        all.find(s => !s.moves)
    return s ? { href: `#/survey/${s.id}`, text: s.name } : null
}

let statsPromise = null

/** Lichess move counts for the positions in the courses (opening-stats.json), or null if unreadable. */
export function openingStats() {
    if (!statsPromise) {
        statsPromise = readText("content/opening-stats.json", "The opening statistics could not be loaded.")
            .then(text => JSON.parse(text))
            .catch(() => null)
    }
    return statsPromise
}

/** Every course that has content, built. */
export async function availableCourses() {
    const cat = await catalog()
    const metas = [...cat.courseById.values()].filter(m => m.available)
    return Promise.all(metas.map(m => course(m.id)))
}

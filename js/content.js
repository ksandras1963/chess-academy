// Loads the course catalog and course PGNs (cached for the session).

import { Chess } from "../vendor/chess.js/chess.js"
import { buildCourse } from "./course-model.js"

let catalogPromise = null
const courses = new Map()

export function catalog() {
    if (!catalogPromise) {
        catalogPromise = fetch("content/courses.json")
            .then(r => {
                if (!r.ok) throw new Error("The course list could not be loaded. Check your connection and reload.")
                return r.json()
            })
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
    if (!meta.available) throw new Error(`${meta.opening.name} as ${meta.side === "white" ? "White" : "Black"} is coming soon.`)
    const r = await fetch(meta.file)
    if (!r.ok) throw new Error(`The file ${meta.file} could not be loaded.`)
    const built = buildCourse(meta, await r.text())
    courses.set(id, built)
    return built
}

/** Every course that has content, built. */
export async function availableCourses() {
    const cat = await catalog()
    const metas = [...cat.courseById.values()].filter(m => m.available)
    return Promise.all(metas.map(m => course(m.id)))
}

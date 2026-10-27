// Checks every course: legal moves, opening names/ECO against the Lichess dataset (CC0),
// and Stockfish evaluations. Writes tools/report.md.
//
//   node tools/validate.mjs                 all courses, engine depth 18
//   node tools/validate.mjs --course italian-white --depth 20
//   node tools/validate.mjs --no-engine
//
// Stockfish path: STOCKFISH_PATH, or %LOCALAPPDATA%\OpeningTrainer\stockfish\stockfish\stockfish-windows-x86-64-universal.exe

import { readFile, writeFile, readdir, access } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Chess } from "../vendor/chess.js/chess.js"
import { buildCourse, buildPuzzleSet, buildSurvey, mainPath, moveLabel, finalScore, expandCourses } from "../js/course-model.js"
const diagramLabel = ch => (ch.diagram && ch.diagram.node ? moveLabel(ch.diagram.node) : "—")
import { Engine, DEFAULT_EXE, engineAvailable } from "./engine.mjs"
import { buildStandalone } from "./build-standalone.mjs"
import { buildServiceWorker } from "./build-sw.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const args = process.argv.slice(2)
const opt = (name, fallback) => {
    const i = args.indexOf(name)
    return i >= 0 ? args[i + 1] : fallback
}
const useEngine = !args.includes("--no-engine")
const depth = Number(opt("--depth", 18))
const onlyCourse = opt("--course", null)

// Thresholds, in centipawns from the mover's point of view.
const LEARNER_LOSS = 60 // learner move this much worse than best -> flag
const OPPONENT_LOSS = 150 // opponent move this much worse than best and not marked ?/??/?! -> note
const LINE_END_BAD = -100 // line ends with the learner this far behind -> flag
const PUZZLE_MARGIN = 70 // a puzzle move must beat every non-accepted move by this much
const PUZZLE_DEFENSE = 50 // the opponent's reply in a puzzle may be at most this much worse than best

const epd = fen => fen.split(" ").slice(0, 4).join(" ")
const pawns = cp => (cp / 100).toFixed(2)

// ---------- Lichess opening names ----------
async function loadOpenings() {
    const dir = path.join(root, "tools", "data")
    const byName = new Map()
    const byEpd = new Map()
    for (const f of (await readdir(dir)).filter(f => f.endsWith(".tsv")).sort()) {
        const rows = (await readFile(path.join(dir, f), "utf8")).split(/\r?\n/).slice(1)
        for (const row of rows) {
            if (!row.trim()) continue
            const [eco, name, pgn] = row.split("\t")
            const chess = new Chess()
            chess.loadPgn(pgn)
            const entry = { eco, name, pgn, epd: epd(chess.fen()), plies: chess.history().length }
            if (!byName.has(name)) byName.set(name, [])
            byName.get(name).push(entry)
            if (!byEpd.has(entry.epd)) byEpd.set(entry.epd, entry)
        }
    }
    return { byName, byEpd }
}

function uciToSan(fen, uci) {
    try {
        const c = new Chess(fen)
        return c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san
    } catch {
        return uci
    }
}

async function exists(p) {
    try { await access(p); return true } catch { return false }
}

// ---------- main ----------
const catalog = JSON.parse(await readFile(path.join(root, "content", "courses.json"), "utf8"))
for (const o of catalog.openings) o.courses = expandCourses(o) // one "course" for both sides becomes two
const courses = catalog.openings.flatMap(o => o.courses.map(c => ({ ...c, opening: o })))
    .filter(c => c.file && (!onlyCourse || c.id === onlyCourse))

const errors = []
const report = []
const openings = await loadOpenings()

// Each opening's own name, ECO and moves in courses.json
for (const op of catalog.openings) {
    const c = new Chess()
    c.loadPgn(op.moves)
    const entry = openings.byEpd.get(epd(c.fen()))
    if (!entry) errors.push(`courses.json / ${op.id}: "${op.moves}" is not a named position in the Lichess dataset`)
    else if (entry.eco !== op.eco) errors.push(`courses.json / ${op.id}: ECO ${op.eco}, but the dataset says ${entry.eco} (${entry.name})`)
}

let engine = null
if (useEngine) {
    if (await engineAvailable()) {
        engine = await new Engine().init()
    } else {
        console.warn(`Stockfish not found at ${DEFAULT_EXE}; skipping engine checks.`)
    }
}

const cachePath = path.join(root, "tools", ".eval-cache.json")
const cache = (await exists(cachePath)) ? JSON.parse(await readFile(cachePath, "utf8")) : {}
async function evalCached(fen, move) {
    const key = `${depth}|${fen}|${move || ""}`
    if (!cache[key]) cache[key] = await engine.evaluate(fen, depth, move)
    return cache[key]
}
/** Centipawns lost by playing `uci` in `fen` (mover's view), plus engine's best move. */
async function moveLoss(fen, uci) {
    const best = await evalCached(fen)
    if (best.best === uci) return { loss: 0, best: best.best, bestScore: best.score, score: best.score }
    const played = await evalCached(fen, uci)
    return { loss: best.score - played.score, best: best.best, bestScore: best.score, score: played.score }
}

for (const meta of courses) {
    const learner = meta.side === "white" ? "w" : "b"
    const section = [`## ${meta.opening.name} — as ${meta.side === "white" ? "White" : "Black"} (\`${meta.id}\`)`, ""]
    let course
    try {
        course = buildCourse(meta, await readFile(path.join(root, meta.file), "utf8"))
    } catch (e) {
        errors.push(e.message)
        section.push(`**ERROR:** ${e.message}`, "")
        report.push(section.join("\n"))
        continue
    }
    const chapters = course.chapters
    const bySection = id => course.lines.filter(l => l.section === id).length
    section.push(`${chapters.length} chapters, ${course.lines.length} drillable lines ` +
        `(basic ${bySection("basic")}, traps ${bySection("traps")}, advanced ${bySection("advanced")}), ` +
        `${course.lines.reduce((s, l) => s + l.learnerMoves, 0)} learner moves.`, "")

    // Course-page diagrams: every lesson chapter must point at a position on its main line
    for (const ch of chapters.filter(c => c.type !== "ideas")) {
        if (!ch.diagram) errors.push(`${meta.id} / ${ch.title}: no diagram. Name a move in the title (e.g. "3...Bc5") or add a [Diagram "3...Nd4"] header`)
        else if (ch.diagram.error) errors.push(`${meta.id} / ${ch.title}: ${ch.diagram.error}`)
    }

    // Opening names and ECO codes
    const nameRows = []
    for (const ch of chapters) {
        if (!ch.opening) {
            if (ch.type !== "ideas") nameRows.push(`| ${ch.title} | ${diagramLabel(ch)} | — | — | no Opening header |`)
            continue
        }
        const entries = openings.byName.get(ch.opening)
        if (!entries) {
            errors.push(`${meta.id} / ${ch.title}: "${ch.opening}" is not a Lichess opening name`)
            nameRows.push(`| ${ch.title} | ${diagramLabel(ch)} | ${ch.opening} | ${ch.eco} | **not in dataset** |`)
            continue
        }
        if (ch.eco && !entries.some(e => e.eco === ch.eco)) {
            errors.push(`${meta.id} / ${ch.title}: ECO ${ch.eco} does not match "${ch.opening}" (${entries.map(e => e.eco).join("/")})`)
        }
        const reached = new Set([epd(ch.root.fen), ...mainPath(ch.root).map(n => epd(n.fen))])
        const ok = entries.some(e => reached.has(e.epd))
        if (!ok) errors.push(`${meta.id} / ${ch.title}: main line never reaches the "${ch.opening}" position`)
        nameRows.push(`| ${ch.title} | ${diagramLabel(ch)} | ${ch.opening} | ${ch.eco || "—"} | ${ok ? "ok" : "**position not reached**"} |`)
    }
    section.push("### Opening names and course-page diagrams", "", "| Chapter | Diagram | Opening header | ECO | Check |", "|---|---|---|---|---|", ...nameRows, "")

    // Engine checks
    if (engine) {
        const flags = []
        const accepted = []
        const notes = []
        const ends = []
        const done = new Set()
        const checkMove = async (node, title) => {
            const key = node.fenBefore + node.uci
            if (done.has(key)) return
            done.add(key)
            const r = await moveLoss(node.fenBefore, node.uci)
            const row = `| ${title} | ${moveLabel(node)} | ${uciToSan(node.fenBefore, r.best)} | ${pawns(r.loss)} |`
            if (node.color === learner && r.loss > LEARNER_LOSS && !node.isMistake) {
                if (node.comments.some(c => /\[%engine ok\]/.test(c))) accepted.push(row)
                else flags.push(row)
            } else if (node.color !== learner && r.loss > OPPONENT_LOSS && !node.isMistake) {
                notes.push(row)
            }
            process.stdout.write(".")
        }
        // Moves shown on Key ideas pages are checked too, though they are never drilled.
        for (const ch of chapters.filter(c => c.type === "ideas")) {
            for (const node of mainPath(ch.root)) await checkMove(node, ch.title)
        }
        for (const line of course.lines) {
            for (const node of line.nodes) await checkMove(node, line.title)
            const last = line.nodes[line.nodes.length - 1]
            const e = await evalCached(last.fen)
            const learnerView = (last.color === learner ? -1 : 1) * e.score
            const named = [...line.nodes].reverse().map(n => openings.byEpd.get(epd(n.fen))).find(Boolean)
            ends.push(`| ${line.title} | ${pawns(learnerView)}${learnerView < LINE_END_BAD ? " **flag**" : ""} | ${named ? `${named.eco} ${named.name}` : "—"} |`)
            if (learnerView < LINE_END_BAD) flags.push(`| ${line.title} | (line end) | — | ends at ${pawns(learnerView)} |`)
        }
        section.push(`### Learner moves flagged (> ${pawns(LEARNER_LOSS)} pawns worse than engine best, depth ${depth})`, "")
        section.push(flags.length ? ["| Line | Move | Engine prefers | Loss |", "|---|---|---|---|", ...flags].join("\n") : "None.", "")
        if (accepted.length) {
            section.push("### Learner moves flagged but accepted with `[%engine ok]`", "",
                "| Line | Move | Engine prefers | Loss |", "|---|---|---|---|", ...accepted, "")
        }
        section.push(`### Opponent moves that lose > ${pawns(OPPONENT_LOSS)} pawns but are not marked ?, ?? or ?!`, "")
        section.push(notes.length ? ["| Line | Move | Engine prefers | Loss |", "|---|---|---|---|", ...notes].join("\n") : "None.", "")
        section.push("### Line ends (evaluation from the learner's side; Lichess name of the deepest named position)", "",
            "| Line | Eval | Deepest named position |", "|---|---|---|", ...ends, "")
        await writeFile(cachePath, JSON.stringify(cache))
    }
    report.push(section.join("\n"))
}

// ---------- Overviews (courses.json "surveys") ----------
const lessonCourses = new Map() // courses named by [WhiteLesson] and [BlackLesson], built once
for (const meta of (catalog.surveys || []).filter(() => !onlyCourse)) {
    const section = [`## Overview: ${meta.name} (\`${meta.file}\`)`, ""]
    let survey
    try {
        survey = buildSurvey(meta, await readFile(path.join(root, meta.file), "utf8"))
    } catch (e) {
        errors.push(e.message)
        report.push([...section, `**ERROR:** ${e.message}`, ""].join("\n"))
        continue
    }
    const rows = []
    const surveyIds = new Set((catalog.surveys || []).map(s => s.id))
    if (meta.parent && !surveyIds.has(meta.parent)) errors.push(`courses.json / ${meta.id}: "parent" ${meta.parent} is not an overview id`)
    // Both sides' moves are checked: an overview shows the usual moves, not mistakes.
    const checkMoves = async (root, problems) => {
        if (!engine) return
        const seen = new Set()
        const all = []
        const collect = n => { for (const k of n.children) { all.push(k); collect(k) } }
        collect(root)
        for (const node of all) {
            if (seen.has(node.fenBefore + node.uci)) continue
            seen.add(node.fenBefore + node.uci)
            const r = await moveLoss(node.fenBefore, node.uci)
            if (r.loss > LEARNER_LOSS && !node.comments.some(c => /\[%engine ok\]/.test(c))) {
                problems.push(`${moveLabel(node)} is ${pawns(r.loss)} worse than ${uciToSan(node.fenBefore, r.best)}`)
            }
            process.stdout.write(".")
        }
    }
    if (survey.flow) {
        const problems = []
        await checkMoves(survey.flow.root, problems)
        // [%lesson Chapter title] in a box must name a chapter of the page's own course ("course").
        const titles = []
        const collect = n => n.children.forEach(k => {
            for (const c of k.comments) for (const m of c.matchAll(/\[%lesson ([^\]]+)\]/g)) titles.push(m[1].trim())
            collect(k)
        })
        collect(survey.flow.root)
        if (titles.length) {
            const op = catalog.openings.find(o => o.id === meta.course)
            const metas = op ? op.courses.filter(m => m.file) : []
            if (!metas.length) problems.push(`[%lesson] needs "course" in courses.json naming an opening with a written course`)
            else {
                const known = new Set()
                for (const m of metas) buildCourse(m, await readFile(path.join(root, m.file), "utf8")).chapters.forEach(ch => known.add(ch.title))
                for (const t of titles) if (!known.has(t)) problems.push(`[%lesson ${t}] is not a chapter title in the ${op.name} course`)
            }
        }
        for (const p of problems) errors.push(`${meta.id} / ${survey.flow.title}: ${p}`)
        rows.push(`| ${survey.flow.title} (flowchart) | — | — | — | — | ${problems.length ? `**${problems.join("; ")}**` : "ok"} |`)
    }
    for (const ch of survey.chapters) {
        const where = `${meta.id} / ${ch.title}`
        const problems = []
        if (!ch.diagram) problems.push("no [Diagram] header naming the move whose position the overview's board shows")
        else if (ch.diagram.error) problems.push(ch.diagram.error)
        if (ch.headers.Page && !surveyIds.has(ch.headers.Page)) problems.push(`[Page "${ch.headers.Page}"] is not an overview id in courses.json`)
        if (ch.headers.Course && ch.headers.Course !== "none" && !catalog.openings.some(o => o.id === ch.headers.Course)) {
            problems.push(`[Course "${ch.headers.Course}"] is not an opening id in courses.json (or "none")`)
        }
        // [WhiteLesson] and [BlackLesson] name a chapter of that opening's course, which the page links to.
        for (const side of ["white", "black"]) {
            const tag = side === "white" ? "WhiteLesson" : "BlackLesson"
            const title = ch.headers[tag]
            if (!title) continue
            const lessonMeta = catalog.openings.find(o => o.id === ch.headers.Course)?.courses.find(m => m.side === side && m.file)
            if (!lessonMeta) { problems.push(`[${tag}] needs a [Course] header naming an opening with a written ${side} course`); continue }
            if (!lessonCourses.has(lessonMeta.id)) lessonCourses.set(lessonMeta.id, buildCourse(lessonMeta, await readFile(path.join(root, lessonMeta.file), "utf8")))
            if (!lessonCourses.get(lessonMeta.id).chapters.some(x => x.title === title)) problems.push(`[${tag} "${title}"] is not a chapter title in ${lessonMeta.file}`)
        }
        const entries = openings.byName.get(ch.opening)
        if (!entries) problems.push(`"${ch.opening}" is not a Lichess opening name`)
        else {
            if (ch.eco && !entries.some(e => e.eco === ch.eco)) problems.push(`ECO ${ch.eco} does not match "${ch.opening}" (${entries.map(e => e.eco).join("/")})`)
            const reached = new Set(mainPath(ch.root).map(n => epd(n.fen)))
            if (!entries.some(e => reached.has(e.epd))) problems.push(`main line never reaches the "${ch.opening}" position`)
        }
        // A chapter with branches names each line in its [Lines] header, main line first.
        const leaves = []
        const walk = n => (n.children.length ? n.children.forEach(walk) : leaves.push(n))
        walk(ch.root)
        const names = (ch.headers.Lines || "").split("|").map(s => s.trim()).filter(Boolean)
        if (leaves.length > 1 && names.length !== leaves.length) problems.push(`${leaves.length} lines but ${names.length} names in the [Lines] header`)
        const leads = ch.headers.Leads ? ch.headers.Leads.split("|").length : 0
        if (leads > leaves.length) problems.push(`${leads} entries in the [Leads] header but only ${leaves.length} lines`)
        await checkMoves(ch.root, problems)
        for (const p of problems) errors.push(`${where}: ${p}`)
        const ends = []
        for (const n of leaves) { // one at a time: the engine answers one question at a time
            const e = engine ? await evalCached(n.fen) : null
            ends.push(e ? `${moveLabel(n)} ${pawns((n.color === "w" ? -1 : 1) * e.score)}` : moveLabel(n))
        }
        rows.push(`| ${ch.title} | ${diagramLabel(ch)} | ${ch.opening} | ${ch.eco || "—"} | ${ends.join("; ")} | ${problems.length ? `**${problems.join("; ")}**` : "ok"} |`)
    }
    section.push(`${survey.chapters.length} chapters. Every move of both sides must be within ${pawns(LEARNER_LOSS)} pawns of Stockfish's choice (depth ${depth}), unless its note says \`[%engine ok]\`. Line ends are scored for White.`, "",
        "| Chapter | Board after | Opening header | ECO | Line ends | Check |", "|---|---|---|---|---|---|", ...rows, "")
    report.push(section.join("\n"))
}

// ---------- Puzzles ----------
/** Stockfish's top lines; at least 3, and always one more than the number of accepted moves. */
async function topLines(fen, n = 3) {
    const lines = Math.max(3, n)
    const key = lines === 3 ? `${depth}|multipv3|${fen}` : `${depth}|multipv${lines}|${fen}`
    if (!cache[key]) cache[key] = await engine.analyse(fen, depth, lines)
    return cache[key]
}

for (const op of catalog.openings.filter(o => o.puzzles && !onlyCourse)) {
    const section = [`## Puzzles: ${op.name} (\`${op.puzzles}\`)`, ""]
    let set
    try {
        set = buildPuzzleSet({ id: op.id }, await readFile(path.join(root, op.puzzles), "utf8"))
    } catch (e) {
        errors.push(e.message)
        report.push([...section, `**ERROR:** ${e.message}`, ""].join("\n"))
        continue
    }
    const rows = []
    for (const pz of set) {
        const problems = []
        if (engine) {
            for (const node of pz.solution) {
                const label = moveLabel(node)
                if (node.color === pz.learner) {
                    const accepted = new Set([node.uci, ...node.parent.children.filter(c => c !== node && c.isGood).map(c => c.uci)])
                    const lines = await topLines(node.fenBefore, accepted.size + 1)
                    const best = lines[0]
                    const solution = lines.find(l => l.pv[0] === node.uci) || { score: (await evalCached(node.fenBefore, node.uci)).score }
                    if (!accepted.has(best.pv[0])) {
                        problems.push(`${label}: Stockfish prefers ${uciToSan(node.fenBefore, best.pv[0])} by ${pawns(best.score - solution.score)}`)
                    }
                    const rival = lines.find(l => !accepted.has(l.pv[0]))
                    if (rival && solution.score - rival.score < PUZZLE_MARGIN) {
                        problems.push(`${label}: not unique, ${uciToSan(node.fenBefore, rival.pv[0])} is only ${pawns(solution.score - rival.score)} worse`)
                    }
                } else {
                    const r = await moveLoss(node.fenBefore, node.uci)
                    if (r.loss > PUZZLE_DEFENSE) {
                        problems.push(`${label} is not the best defense (Stockfish prefers ${uciToSan(node.fenBefore, r.best)})`)
                    }
                }
                process.stdout.write(".")
            }
        }
        // Every line end (the follow-up's and each side line's) gives the final position's score or mates.
        const ends = []
        const walk = n => (n.children.length ? n.children.forEach(walk) : ends.push(n))
        walk(pz.chapter.root)
        for (const end of ends.filter(n => !finalScore(n))) {
            problems.push(`the line ending ${moveLabel(end)} has no score: end its note with "Stockfish: +1.2, clearly better for White."`)
        }
        for (const p of problems) errors.push(`${op.id} puzzle ${pz.number} (${pz.title}): ${p}`)
        const moves = pz.solution.filter(n => n.color === pz.learner).length
        const follow = pz.followUp.length ? `${moveLabel(pz.followUp[0])} (${pz.followUp.length} ${pz.followUp.length === 1 ? "half-move" : "half-moves"})` : "none"
        rows.push(`| ${pz.number} | ${pz.title} | ${pz.learner === "w" ? "White" : "Black"} | ${moveLabel(pz.first)} | ${moves} | ${follow} | ${engine ? (problems.length ? `**${problems.join("; ")}**` : "ok") : "not checked"} |`)
    }
    section.push(`${set.length} puzzles. Each solver move must be Stockfish's choice and beat every move that isn't accepted by at least ${pawns(PUZZLE_MARGIN)} pawns (depth ${depth}).`, "",
        "Follow-up moves (after the `End` move) are shown for stepping through and are not checked here.", "",
        "| # | Puzzle | To move | First move | Solver moves | Follow-up | Check |", "|---|---|---|---|---|---|---|", ...rows, "")
    report.push(section.join("\n"))
}
if (engine) await writeFile(cachePath, JSON.stringify(cache))
engine?.quit()

const header = [
    "# Content validation report", "",
    `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} · engine ${engine ? `Stockfish, depth ${depth}` : "skipped"}`, "",
    errors.length ? `**${errors.length} error(s):**\n\n${errors.map(e => `- ${e}`).join("\n")}` : "**No errors.**", ""
]
await writeFile(path.join(root, "tools", "report.md"), header.concat(report).join("\n"))
console.log(`\n${errors.length ? errors.join("\n") : "No errors."}\nReport: tools/report.md`)
if (!errors.length && !onlyCourse) {
    const b = await buildStandalone()
    console.log(`Rebuilt ${b.file} (${(b.bytes / 1024).toFixed(0)} KB).`)
    const sw = await buildServiceWorker()
    console.log(`Rebuilt ${sw.file} (offline copy of ${sw.files} files, version ${sw.version}).`)
}
process.exit(errors.length ? 1 : 0)

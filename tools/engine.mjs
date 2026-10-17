// Minimal UCI client for the local Stockfish (used only by the checking tools).

import { spawn } from "node:child_process"
import { createInterface } from "node:readline"
import { access } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

export const DEFAULT_EXE = process.env.STOCKFISH_PATH ||
    path.join(process.env.LOCALAPPDATA || "", "OpeningTrainer", "stockfish", "stockfish", "stockfish-windows-x86-64-universal.exe")

export async function engineAvailable(exe = DEFAULT_EXE) {
    try { await access(exe); return true } catch { return false }
}

const toScore = (kind, v) => kind === "cp" ? v : (v > 0 ? 10000 - v : -10000 - v)

export class Engine {
    constructor(exe = DEFAULT_EXE) {
        this.proc = spawn(exe, [], { stdio: ["pipe", "pipe", "inherit"] })
        this.waiters = []
        this.lines = []
        createInterface({ input: this.proc.stdout }).on("line", l => {
            this.lines.push(l)
            for (const w of [...this.waiters]) {
                if (w.re.test(l)) {
                    this.waiters.splice(this.waiters.indexOf(w), 1)
                    w.resolve(this.lines.splice(0))
                }
            }
        })
    }

    send(cmd) { this.proc.stdin.write(cmd + "\n") }

    waitFor(re) { return new Promise(resolve => this.waiters.push({ re, resolve })) }

    async init({ threads = Math.max(1, os.cpus().length - 1), hash = 256 } = {}) {
        this.send("uci")
        await this.waitFor(/^uciok/)
        this.send(`setoption name Threads value ${threads}`)
        this.send(`setoption name Hash value ${hash}`)
        this.send("isready")
        await this.waitFor(/^readyok/)
        return this
    }

    /** Score (side to move, centipawns; mates as ±10000) and best move at a fixed depth. */
    async evaluate(fen, depth, searchmove) {
        this.lines.length = 0
        this.send(`position fen ${fen}`)
        this.send(`go depth ${depth}` + (searchmove ? ` searchmoves ${searchmove}` : ""))
        const out = await this.waitFor(/^bestmove/)
        let score = null
        for (const l of out) {
            const m = / score (cp|mate) (-?\d+)/.exec(l)
            if (m && !/bound/.test(l)) score = toScore(m[1], Number(m[2]))
        }
        return { score, best: /^bestmove (\S+)/.exec(out[out.length - 1])[1] }
    }

    /** Top `multipv` lines: [{score, pv: [uci...]}] from the side to move's view. */
    async analyse(fen, depth, multipv = 3) {
        this.send(`setoption name MultiPV value ${multipv}`)
        this.lines.length = 0
        this.send(`position fen ${fen}`)
        this.send(`go depth ${depth}`)
        const out = await this.waitFor(/^bestmove/)
        this.send("setoption name MultiPV value 1")
        const best = new Map()
        for (const l of out) {
            const m = / depth (\d+) .*multipv (\d+) score (cp|mate) (-?\d+).* pv (.+)$/.exec(l)
            if (!m || /bound/.test(l)) continue
            best.set(Number(m[2]), { depth: Number(m[1]), score: toScore(m[3], Number(m[4])), pv: m[5].trim().split(/\s+/) })
        }
        return [...best.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1])
    }

    quit() { this.send("quit") }
}

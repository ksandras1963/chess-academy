// Settings, backup and restore, and credits.

import { h, backBar } from "../ui.js"
import { settings, updateSettings, exportCode, exportJson, importBackup, resetProgress } from "../storage.js"
import { applyTheme } from "../theme.js"

function choice(name, labelText, options, value, onChange) {
    return h("fieldset", { class: "field" },
        h("legend", {}, labelText),
        h("div", { class: "segmented" }, options.map(([v, text]) =>
            h("label", {},
                h("input", { type: "radio", name, value: v, checked: v === value, onchange: () => onChange(v) }),
                h("span", {}, text)))))
}

export function settingsView(root) {
    const s = settings()
    const status = h("p", { class: "form-status", role: "status" })
    const say = (text) => { status.textContent = text }

    const codeOut = h("textarea", { class: "code", rows: 3, readonly: true, "aria-label": "Backup code" })
    const codeIn = h("textarea", { class: "code", rows: 3, placeholder: "Paste a backup code here", "aria-label": "Backup code to restore" })
    const fileIn = h("input", { type: "file", accept: ".json,application/json", class: "visually-hidden", id: "restore-file" })
    fileIn.addEventListener("change", async () => {
        const f = fileIn.files[0]
        if (!f) return
        try {
            const n = importBackup(await f.text())
            say(`Restored ${n} lines from ${f.name}.`)
        } catch (e) {
            say(`Couldn't restore: ${e.message}`)
        }
        fileIn.value = ""
    })

    root.append(h("section", { class: "settings" },
        backBar(),
        h("h1", {}, "Settings"),
        h("section", { class: "settings-group" },
            h("h2", {}, "Display"),
            choice("theme", "Theme", [["dark", "Dark"], ["light", "Light"], ["system", "Match device"]], s.theme, v => {
                updateSettings({ theme: v })
                applyTheme()
            }),
            choice("notation", "Move notation", [["figurines", "Figurines (♘f3)"], ["letters", "Letters (Nf3)"]], s.notation, v => updateSettings({ notation: v })),
            choice("animation", "Piece animation", [["normal", "Normal"], ["fast", "Fast"], ["off", "Off"]], s.animation, v => updateSettings({ animation: v })),
            choice("coordinates", "Board coordinates", [["on", "Show"], ["off", "Hide"]], s.coordinates ? "on" : "off", v => updateSettings({ coordinates: v === "on" }))),
        h("section", { class: "settings-group" },
            h("h2", {}, "Learning"),
            h("label", { class: "field" }, "New lines per day, across all courses",
                h("select", { onchange: e => updateSettings({ newPerDay: Number(e.target.value) }) },
                    [1, 2, 3, 5, 8, 12].map(n => h("option", { value: n, selected: n === s.newPerDay }, String(n))))),
            h("p", { class: "muted" }, "This limits only the daily drill. You can always open and drill any line from a course page.")),
        h("section", { class: "settings-group" },
            h("h2", {}, "Back up your progress"),
            h("p", {}, "Progress is saved in this browser on this device. To move it to another device, copy the backup code and paste it there, or save a backup file."),
            h("div", { class: "row" },
                h("button", { class: "btn", type: "button", onclick: async () => {
                    codeOut.value = exportCode()
                    codeOut.select()
                    try {
                        await navigator.clipboard.writeText(codeOut.value)
                        say("Backup code copied.")
                    } catch {
                        say("Backup code shown below. Copy it by hand.")
                    }
                } }, "Copy backup code"),
                h("button", { class: "btn", type: "button", onclick: () => {
                    const blob = new Blob([exportJson()], { type: "application/json" })
                    const a = h("a", { href: URL.createObjectURL(blob), download: `opening-trainer-backup-${new Date().toISOString().slice(0, 10)}.json` })
                    a.click()
                    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
                    say("Backup file saved.")
                } }, "Save backup file")),
            codeOut,
            h("h3", {}, "Restore"),
            h("p", { class: "muted" }, "Restoring replaces the progress on this device."),
            codeIn,
            h("div", { class: "row" },
                h("button", { class: "btn", type: "button", onclick: () => {
                    try {
                        const n = importBackup(codeIn.value)
                        say(`Restored ${n} lines.`)
                        codeIn.value = ""
                    } catch (e) {
                        say(`Couldn't restore: ${e.message}`)
                    }
                } }, "Restore from code"),
                h("label", { class: "btn", for: "restore-file" }, "Restore from file"), fileIn),
            status),
        h("section", { class: "settings-group" },
            h("h2", {}, "Start over"),
            h("button", { class: "btn btn-danger", type: "button", onclick: () => {
                if (confirm("Erase all progress on this device? This can't be undone unless you have a backup.")) {
                    resetProgress()
                    say("Progress erased.")
                }
            } }, "Erase progress")),
        h("section", { class: "settings-group about" },
            h("h2", {}, "About"),
            h("p", {}, "Lessons written by Kumar Sandrasegaran, M.D., FRCR, FSAR, FESGAR. Every line is checked for legal moves, against the Lichess opening-name database, and with the Stockfish engine."),
            h("ul", { class: "credits" },
                h("li", {}, "Move rules: chess.js, BSD 2-Clause license."),
                h("li", {}, "Board: cm-chessboard by Stefan Haack, MIT license."),
                h("li", {}, "Pieces: Colin M. L. Burnett, via Wikimedia Commons, CC BY-SA 3.0."),
                h("li", {}, "Opening names: lichess-org/chess-openings, CC0."),
                h("li", {}, "Script font: Dancing Script by the Dancing Script Project Authors, SIL Open Font License 1.1."),
                h("li", {}, "Engine checks: Stockfish, GPL-3.0 (used offline when writing lessons, not part of the app).")))))
}

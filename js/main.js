// App entry: hash router, the review badge, and error display.

import { h, backBar } from "./ui.js"
import { applyTheme } from "./theme.js"
import { availableCourses } from "./content.js"
import { buildQueue } from "./srs.js"
import { homeView } from "./views/home.js"
import { courseView } from "./views/course.js"
import { learnView } from "./views/learn.js"
import { drillView, reviewView } from "./views/drill.js"
import { settingsView } from "./views/settings.js"
import { puzzlesView, puzzleView } from "./views/puzzles.js"

const routes = [
    [/^#?\/?$/, (root, ctx) => homeView(root, ctx)],
    [/^#\/course\/([\w-]+)(?:\/(basic|traps|advanced))?$/, (root, ctx, m) => courseView(root, ctx, m[1], m[2])],
    [/^#\/learn\/([\w-]+)\/([\w-]+)(?:\/(\d+))?$/, (root, ctx, m) => learnView(root, ctx, m[1], m[2], m[3])],
    [/^#\/drill\/([\w-]+)(?:\/([\w-]+))?$/, (root, ctx, m) => drillView(root, ctx, m[1], m[2])],
    [/^#\/review$/, (root, ctx) => reviewView(root, ctx)],
    [/^#\/puzzles\/([\w-]+)$/, (root, ctx, m) => puzzlesView(root, ctx, m[1])],
    [/^#\/puzzle\/([\w-]+)\/(\d+)(?:\/(retry))?$/, (root, ctx, m) => puzzleView(root, ctx, m[1], m[2], m[3])],
    [/^#\/settings$/, (root) => settingsView(root)]
]

const app = document.getElementById("app")
let token = 0
let leaveHandlers = []

async function route() {
    const my = ++token
    for (const fn of leaveHandlers) {
        try { fn() } catch { /* view already gone */ }
    }
    leaveHandlers = []
    const view = h("div", { class: "view" })
    app.replaceChildren(view)
    window.scrollTo(0, 0)
    const ctx = {
        alive: () => my === token,
        onLeave: fn => { if (my === token) leaveHandlers.push(fn); else fn() }
    }
    const hash = location.hash || "#/"
    const match = routes.map(([re, fn]) => [hash.match(re), fn]).find(([m]) => m)
    try {
        if (!match) throw new Error("That page doesn't exist.")
        await match[1](view, ctx, match[0])
    } catch (e) {
        if (!ctx.alive()) return
        console.error(e)
        view.replaceChildren(h("section", { class: "empty" },
            backBar(),
            h("h1", {}, "Something went wrong"),
            h("p", {}, e.message || String(e)),
            h("a", { class: "btn btn-primary", href: "#/" }, "Back to all openings")))
    }
    if (ctx.alive()) updateBadge()
}

async function updateBadge() {
    const badge = document.getElementById("due-count")
    try {
        const courses = await availableCourses()
        const n = courses.reduce((s, c) => s + buildQueue(c.lines, { includeNew: false }).length, 0)
        badge.textContent = n
        badge.hidden = n === 0
        badge.setAttribute("aria-label", `${n} due`)
    } catch {
        badge.hidden = true
    }
}

applyTheme()
window.addEventListener("hashchange", route)
route()

// Offline support on the website (sw.js). Not for the double-click file, which needs no network.
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("sw.js").catch(() => { /* the app still works online */ })
}

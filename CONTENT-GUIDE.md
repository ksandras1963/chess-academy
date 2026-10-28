# Editing the lessons

Each course is one PGN file in `content/`. For example, `italian.pgn` is the Italian Game, played as White and as Black. You can edit these files in any text editor. You can also paste a whole file into a Lichess Study to see it on a board.

A course can also teach both sides, like the Queen's Gambit courses (`queens-gambit-declined.pgn`, `queens-gambit-accepted.pgn`, `slav.pgn`, `tarrasch.pgn`). Its entry in `courses.json` has `"side": "both"`, and every chapter says which side the learner plays with a `[Side "white"]` or `[Side "black"]` header. The course page lists both sides together, most common first, with a "You play White" or "You play Black" tag on each chapter; the board and the "how often" bar follow the chapter's side. A chapter worth learning from both sides has `[Side "both"]` and a "Both sides" tag; each of its lines is taught twice, once for each side. Its main line takes the variation's name from the title, the part before the colon and after the last comma there: "Mar del Plata, Bayonet Attack: 9.b4" gives "Bayonet Attack, as White" and "Bayonet Attack, as Black". If that part is "Main line", the name before it is used ("Mar del Plata, Main line: 9.Ne1" gives "Mar del Plata"); if it starts with a small letter, the move after the colon is used ("Sidelines, fourth moves: 4.Bg5" gives "4.Bg5"). The page has a drill for each side ("Drill as White", "Drill as Black"). The title has no color: "Slav Defense Course". The King's Indian Defense (`kings-indian.pgn`) and the French Defense (`french.pgn`) are built the same way.

The Queen's Gambit and King's Indian course pages are short, in this order: a sentence on the opening, "Why play it", a map of the variations, a table of them, the Key ideas, the sections ("The lines": Basic, Traps, Advanced, Puzzles), and last the drills for each side, which come after the lines have been seen. In `courses.json` the course has `"why": { "text": "..." }` (paragraphs separated by a blank line) and `"table": { "columns": [...], "rows": [[...]], "note": "..." }`, like the overview tables; the course file ends with a `[Type "map"]` chapter, written like a family page's map. Each map box opens the first lesson that reaches its position, and `[%course white]`, `[%course black]` or `[%course both]` stars a Basic line. `[%order 2]` in a note sets a box's place among the boxes that branch from the same box, so the map can follow the course's order even when lines branch at different moves (the King's Indian Fianchetto leaves at move 4, the Sämisch at move 5); boxes without a number follow, in PGN order. On an Introduction page whose `"course"` names a single opening (a Caro-Kann page with no cards), a map box that names no card opens that course's lessons the same way. A course with `"why"` shows no "What you need to know" list. A lesson page's back buttons are, in this order: its section (Basic variations, Traps or Advanced variations), the course page, and Main menu, since a lesson can be opened straight from the course page's map; a Key ideas page has the course page and Main menu. The table (Variation, How often, What to do) says what happens in each Basic line and how often it is played, with a note that says how that is measured. A line taught for both sides gives both figures, "20% as White" above "3% as Black" (a line break in the cell), and its What to do starts "As White:" and then "As Black:".

## General rules for every course

Kumar's rules for every opening. The King's Indian follows them.

1. **The page order.** An opening's Introduction page shows, in this order: a short text of two or three sentences, the course links (the yellow box), the map of the variations, then a table of the variations that says what happens in each and how often it is played (a "How often" column, with a note on how it is measured). A course page keeps the same order for its text, map and table (see above).
2. **Name first, then the move.** Whenever a line is meant, give its name and then the move: "Mar del Plata, Bayonet Attack: 9.b4", "Classical, Open Center: 7...exd4". Chapter titles, notes and table rows use the same pattern.
3. **Less text.** A note can run up to five sentences when needed; keep it shorter when it can be. In Kumar's words: "Can be longer sentences - up to 5, if needed." Use the table and the map instead of long paragraphs.
4. **Names.** The Lichess name is the official one (the `Opening` header). Use a descriptive name ("Open Center") where Lichess has none.
5. **Order by club frequency.** Frequencies come from Lichess club games (rated rapid and classical, players averaging 1800 to 2199). Lines with the same name stay together, and within a group the most-played line comes first; the map follows the same order. Count each game by the position it reaches, not by its first moves: a move order that transposes counts with the variation it becomes.
6. **Traps** stay together in the Traps section, whatever the level of the line they come from.

**Course page order (Kumar's rule for every course):**

1. "Why play it": a short text.
2. The map of the variations.
3. The table of the variations.
4. Key ideas.
5. The section links (Basic, Traps, Advanced, Puzzles).
6. The drills, "Drill as White" and "Drill as Black".
7. Further study: 4 entries for most courses, never more than 5.

Further study lists only sources with a named author or presenter. It has no Wikipedia articles and no entries credited only to a channel.

Keep "Why play it", the table and the Key ideas pages free of significant overlap:

- "Why play it" says why to choose the opening.
- The table says what to do in each line, in one or two sentences.
- The Key ideas pages explain the plans, structures and tactics in depth, without repeating the table line by line.

## What a file looks like

A file is a series of chapters. Each chapter starts with a few header lines in square brackets, followed by the moves.

```
[Chapter "Main line: 3...Bc5"]
[Type "line"]
[Opening "Italian Game: Classical Variation, Giuoco Pianissimo"]
[ECO "C54"]

{Text shown before the first move.}
1. e4 {The explanation for 1.e4.} e5 2. Nf3 Nc6 3. Bc4 Bc5
4. c3 Nf6 5. d3 d6
(5... O-O 6. O-O d5 {A branch: Black plays 5...O-O instead.})
6. O-O *
```

### Headers

| Header | Meaning |
|---|---|
| `Chapter` | The title shown in the app. In a course for one family, leave the family name out: the course's name says it (`Exchange: 5...Be7` in the Queen's Gambit Declined Course). Where a title needs one, write the Queen's Gambit families short, as `QGD` or `QGA`: each page spells out the first QGD or QGA it shows ("Queen's Gambit Declined (QGD)") and keeps the abbreviation after that (`spellOut` in `js/ui.js`). |
| `Type` | `line` (normal lines), `trap`, `ideas` (a Key ideas page, which is never drilled), or `concept` (one board on the Key ideas page before it). Puzzle files use `puzzle` (see Puzzles below). |
| `Side` | Only in a course for both sides (`"side": "both"`): `white` or `black`, the side the learner plays in this chapter, or `both` for a chapter drilled from each side (every line then exists once as White and once as Black, with its own progress, and the chapter's tag reads "Both sides"). The checker reports a chapter without it. |
| `Opening`, `ECO` | The Lichess opening name and code. The checker verifies both. |
| `FEN` | Optional. Starts the chapter from a set position (used for Key ideas). |
| `Diagram` | The move whose position is shown beside the chapter on the course page, e.g. `[Diagram "3...Nd4"]`. Without it, the last move named in the title is used (`Main line: 3...Bc5`). The checker reports an error if neither is found on the main line. |
| `Level` | Optional, for `line` chapters: `basic` (the default) or `advanced`. See "Course sections" below. |

### Course sections

Each course has a hub page and three section pages:

- **What you need to know about this opening**, on the hub itself: the `overview` points from `content/courses.json` (a list of short sentences in the course's entry), followed by links to the Key ideas pages.
- **Basic and common variations:** `line` chapters without a `Level` header. Keep only the lines that come up in about 10% or more of the learner's games in this opening (9.5% and up): about 4 to 6 lines, the very core (trap lines are counted separately). Kumar makes exceptions himself: the King's Indian has 7 Basic lines. Measure a line as "How often" does (see "How often each chapter comes up" below): the share of the learner's games that reach it from the side they play, so the alternatives answered only in its notes, or in Advanced sidelines, count toward it. Minor defenses can go to Advanced even when common. Opponent branches from move 6 on go to an Advanced "sidelines" chapter (for example "Pianissimo: White's sixth moves"), so they don't make a long main line look rare. When the opponent's choices are spread thin (Black often faces many White systems), fewer lines reach 10%; then take the 4 to 6 most common.
- **Traps and tricks:** all `trap` chapters.
- **Advanced and uncommon variations:** `line` chapters with `[Level "advanced"]`: lines played in under about 10% of games, or more theoretical ones, grouped by variation name, most common first.

A drill ("Drill as White", "Drill as Black", or "Start today's drill") takes the Basic and Traps lines first, due ones then new ones, and the Advanced lines after them. Before the first Advanced line it stops: the Advanced variations come next and are optional, since many learners stop at the Basic lines, so the learner can go on or stop there (and, when no Basic line is due, drill the weakest Basic lines instead). There is no daily limit, and a line drilled with a mistake or a hint comes back in the next drill. The checker's report lists the number of lines in each section.

### Moves, branches and explanations

- **Explanations** go in `{curly braces}` right after the move they explain. Say what the move is for, and why it beats the obvious alternative. There is no length limit. Leave a blank line inside the braces to start a new paragraph.
- **Branches** go in `(round brackets)` right after the move they replace. `5. d3 d6 (5... O-O ...)` means "instead of 5...d6, Black can play 5...O-O".
- **Opponent branches become extra drill lines.** In a White course, a Black alternative in brackets becomes its own line that learners drill.
- **Your-side branches are side notes.** In a White course, an alternative White move in brackets is shown in Learn mode as "not in this repertoire" and is never drilled. Use this for tempting moves to avoid, such as `(4. Nxe5? Qg5! ...)`.
- **Marks:** `?`, `??`, `?!`, `!` and `!!` after a move are shown in the app.
- End each chapter with `*`.

### Arrows and highlighted squares

These go inside an explanation, in the same format Lichess uses:

- `[%cal Gc4f7]` draws a green arrow from c4 to f7. Colors: `G` green, `R` red, `Y` yellow, `B` blue. List several with commas: `[%cal Gd3d4,Gf1g3]`.
- `[%csl Yg4]` puts a ring on g4.

### Key ideas pages and further study

- **Key ideas pages:** chapters with `[Type "ideas"]`. They appear in order under "What you need to know about this opening" on the course hub, and their moves are never drilled. A page can be a single position (`[FEN "..."]` with no moves) or a short move sequence. A page for one side is titled "Playing as White: ..." or "Playing as Black: ..." in the app (Kumar's rule, in CLAUDE.md): the app takes the side from `[Side]` and drops "Key ideas:" from the `[Chapter]` title, and a side named again ("Plans for White", "White's plan") becomes "Plans" or "The plan". A page with `[Side "both"]` keeps its title.
- **Key ideas with one board per concept** (Kumar's rule, in CLAUDE.md): put the page's short introduction in a `[Type "ideas"]` chapter with no moves, then one `[Type "concept"]` chapter per idea right after it. Each concept has its own `[Chapter]` title, a comment of two to five sentences that explains it, and its moves from the initial position (no `[FEN]`, Kumar's rule): first the course moves that lead to the idea, without notes, the last of them noted "The idea starts from this position." and carrying the board's arrows and highlights; then only the few moves that show how the idea works, each with a short note. `content/french.pgn` has 21 examples. The position the idea is about can also be named with a `[Diagram "10...Nf8"]` header, as in the Queen's Gambit files; without one, the app takes the first move that has a note. On the page the board starts from the initial position: ▶ plays the moves up to the idea's position and stops there, and a line of all the moves under the buttons shows where you are, with that position underlined. Any move in the line can be clicked. The page then shows the concepts one under another, numbered, each with its own board and move buttons. A concept takes its page's `[Side]` unless it has its own. Every concept also says whose idea it shows, with `[Idea "white"]`, `[Idea "black"]` or `[Idea "both"]` (Kumar's rule): the page shows "White's idea", "Black's idea" or "Both sides" beside the board's title. Set it from what the board teaches, not from the page's side (a White page can show Black's answer). The checker lists boards without one. The concepts are not listed on the course page and are never drilled; the checker checks their moves like any Key ideas moves. `content/queens-gambit-declined.pgn`, "Key ideas: Plans in the Exchange Variation", is the worked example.
- **Further study:** in `content/courses.json`, each opening can have a `furtherStudy` list (title, by, kind, url). It is shown on the course page and on every Key ideas page. Credit every source you draw on there, and always write the notes in your own words.

## Puzzles

Each opening can have one puzzle file, named in `content/courses.json` as `"puzzles": "content/italian-puzzles.pgn"`. The Puzzles link on the main menu shows "Coming soon" until an opening has one. Each puzzle is one chapter:

```
[Puzzle "Don't take the queen"]
[Type "puzzle"]
[Theme "Escape the trap"]
[Solve "6...Nxe5"]
[End "6...Nxe5"]
[Hint "Taking the queen looks free. Count White's checks first."]

1. e4 e5 2. Nf3 Nc6 3. Bc4 d6 4. Nc3 Bg4 5. h3 Bh5? 6. Nxe5! Nxe5! {Why it works.}
(6... Bxd1?? {Why this try fails.} 7. Bxf7+ Ke7 8. Nd5#)
7. Qxh5 Nxc4 8. Qb5+ c6 9. Qxc4 {How the game goes on.}
*
```

| Header | Meaning |
|---|---|
| `Puzzle` | The title, shown after the puzzle is solved (it can give the answer away). |
| `Theme` | A short label shown before solving, such as `Escape the trap` or `Checkmate in 2`. |
| `Solve` | The first move the learner must find. Moves before it are the setup and play out automatically. The side that plays it is the side the learner plays. |
| `End` | Optional. The last move of the answer. Moves after it are the **follow-up**: the learner doesn't have to find them, and steps through them after solving. Without `End`, the answer runs to the end of the main line. |
| `Hint` | Shown after the first wrong try at the `Solve` move. |

- **Longer answers:** the main line from the `Solve` move to the `End` move is the answer. The opponent's replies play automatically, and the learner must find each of their own moves.
- **Follow-up and side lines:** after solving, the learner can tap any move on the score sheet, or use ‹ and ›, to see that position, from move 1 to the end of the follow-up. The follow-up plays on the board by itself right after solving, and ▶ plays any line the same way, staying longer on moves that have an explanation. Every branch you write (wrong tries, other answers, other replies) is listed under "Other lines" and can be played through the same way. So give a wrong try a few moves of refutation in the branch itself, as in `(6... Bxd1?? {...} 7. Bxf7+ Ke7 8. Nd5#)`, not only in its explanation. The move just played always has a green arrow.
- **Hints for later moves:** put `[%hint ...]` inside that move's explanation, e.g. `9. d4! {[%hint Look at f2. What is Black threatening?] Stops ...Qxf2 mate.}`. The hint shows after the first wrong try at that move and is never shown as part of the explanation. After two wrong tries at any move, the answer is shown.
- **Wrong tries:** a branch marked `?`, `??` or `?!` shows its explanation when the learner plays it. If the branch has moves after the wrong try, they play out on the board, and then the learner tries again. Any other wrong move gets "isn't the best move".
- **Other good answers:** a branch marked `!` or `!!` is accepted as correct too ("Also good"), and one marked `!?` is accepted as "Playable". The answer ends at the same move number as on the main line, so in a branch the moves after that point are its follow-up.
- **Stockfish scores in notes:** write them as `Stockfish: −3.9, winning for Black.` (+ for White, − for Black, one decimal). Use these verdicts: under 0.3 equal; 0.3 to 0.9 slightly better; 1.0 to 1.9 clearly better; 2.0 or more winning. Stockfish's score measures winning chances, not material, so an extra piece often shows as 3 to 5. Take the number from `tools/pv.mjs` at depth 20 or more.
- **Every line must end with a score.** The last move of the follow-up, and of every branch, needs a `Stockfish:` note, unless the move is checkmate. The app shows the follow-up's score as "Final position" when the puzzle is solved, and the checker stops with an error if a line end has none.
- **Marks are hidden** on the setup moves, so a `?` on the opponent's last move doesn't give the answer away.
- **The checker is strict about puzzles.** For each move the learner must find, Stockfish's first choice has to be that move or an accepted `!` branch, and the move has to be at least 0.7 pawns better than every move that isn't accepted. Each opponent reply up to the `End` move must be within 0.5 pawns of Stockfish's choice. The follow-up and the branches are not checked, so check those lines yourself with `tools/pv.mjs` (see below). If a puzzle fails, start it a move earlier or later, or pick another position.
- A learner who solves a puzzle with no wrong tries and without "Show answer" gets **Solved**. Otherwise it is marked **To retry**, and the puzzle list offers "Retry missed". Puzzle progress is separate from Review.

## Opening overviews

The overview pages (Replies to 1.e4, Replies to 1.d4, Other first moves) show each opening after its first four moves, with White's and Black's plans and a link to its course. They sit at the top of the main menu and are never drilled. At the top of each page, "Map of the openings" is a tree diagram built from the PGN automatically: the page's first move, then each reply to it (taken from each chapter's main line), then the openings by name, colored by `Group` and starred when they have a course. A reply with several openings (1...d5 on the 1.d4 page) branches into them. Tapping a name jumps to that opening. Each is one PGN file, listed in `content/courses.json` under `"surveys"` (id, name, eco, moves, file, count, subtitle, summary). The menu shows them in that order. Each chapter is one opening:

```
[Chapter "Benoni Defense and Benko Gambit"]
[Group "1...Nf6: the Indian defenses"]
[Opening "Benoni Defense"]
[ECO "A56"]
[Diagram "4...exd5"]
[Lines "Modern Benoni | Benko Gambit"]
[Course "kings-indian"]

{White: White's plan, in two or three short sentences.

Black: Black's plan, the same way.}
1. d4 Nf6 2. c4 c5 3. d5 e6 {This is the Modern Benoni.}
(3... b5 {This is the Benko Gambit.} 4. cxb5 a6)
4. Nc3 exd5 *
```

| Header | Meaning |
|---|---|
| `Group` | The heading the opening is listed under. |
| `Diagram` | The position the overview's board shows, usually Black's fourth move. |
| `Lines` | Only for a chapter with branches: a name for each line, main line first, then the branches in the order they appear. Each line gets its own Watch button. |
| `Leads` | Optional: where each line transposes to, in `[Lines]` order, e.g. `[Leads "Reversed Dragon | | Queen's Gambit Declined"]`. Not shown at present: the map lists openings by name only. Kept so a later version can show the transpositions again. |
| `Course` | Optional: an opening id from `courses.json`. Its built courses are linked; until one is built the page says "course coming soon", and without the header it says "Course coming later". `[Course "none"]` shows no course line, for an opening with no course planned (the Albin Countergambit card, for now). It can list several ids, separated by spaces: the 1.d4 page's Queen's Gambit card has `[Course "queens-gambit-declined queens-gambit-accepted slav tarrasch"]`. A survey's `"course"` field in `courses.json` works the same way. On a `[Page]` chapter, such a list shows as one link, "Queen's Gambit Course", to that page, which lists the courses. |
| `WhiteLesson`, `BlackLesson` | Optional, with `Course`: the exact title of the chapter in that side's course that teaches this opening, such as `[WhiteLesson "Slav: 4...Bf5"]` or `[BlackLesson "Key ideas: Why the Queen's Gambit Declined"]`. The page then links straight to that lesson in Learn mode, and only for the sides that have one. Each link is labelled with the opening and the card's short name, for example "Queen's Gambit Slav variation as White". The checker reports a title that is not in the course. |
| `WhiteCourse`, `BlackCourse` | Optional: an opening id whose course holds that side's lesson, when it isn't the `Course` opening. In a course for both sides, both lessons are in the same course, so the Queen's Gambit cards need only `[Course]`. These courses also join the page's full-course box. |
| `Map` | Optional: the opening's name in the map at the top of the page, e.g. `[Map "Queen's Gambit"]`. `[Map "none"]` leaves it out of the map; its card stays on the page. Keeps the map to the main openings. |
| `MapReply` | Optional: a family name for the reply box the opening sits under, e.g. `[MapReply "Indian Defenses"]` puts "1…♘f6 Indian Defenses" above the King's Indian, Nimzo-Indian and the rest. |
| `Page` | Optional: the chapter stands for a page of its own, e.g. `[Page "qg"]` on the 1.d4 page's Queen's Gambit chapter. Its card and its map box open that page instead of playing moves. |

### Family pages and flowcharts

A family with many variations gets its own page, reached from a `[Page]` chapter: the Queen's Gambit (`content/qg-overview.pgn`) and the Indian Defenses (`content/indian-overview.pgn`), both under Replies to 1.d4. In `courses.json` such a page has `"parent": "d4"`, which keeps it off the main menu and gives it a back button to its parent. Two more optional fields: `"compact": true` keeps each card short (its White and Black plans fold away under a button, and only built courses are linked), and `"course": "queens-gambit"` adds that opening to the page's full-course box. The box sits in yellow above the map of every overview page that links a written course: it lists the page's `course` and each chapter's `[Course]`, one row per opening, with a button for each side. `"heading"` gives the page a longer title ("Queen's Gambit Introduction") while buttons and back links keep the short `name`. `"foldPlans": true` folds the plans the same way but keeps every course line (Replies to 1.e4). `"table": { "columns": [...], "rows": [[...], ...], "note": "..." }` shows a small table under the page title in place of a long introduction, such as Black's replies to 1.e4 with their Lichess shares; the first cell of each row is its heading.

A family page starts with a flowchart instead of the map: a chapter with `[Type "map"]`, written as one game with branches. Every move with a note becomes a box showing the moves since the box before it and the note as its name; an empty note `{}` makes a box with moves only. A box named exactly like an opening card on the page (its title or a `[Lines]` name) opens that card, and `[%course white]` or `[%course black]` in a note stars a line the course teaches:

```
[Chapter "Map of the variations"]
[Type "map"]

1. d4 d5 2. c4 {Queen's Gambit} e6 {Queen's Gambit Declined}
(2... c6 {Slav Defense} 3. Nf3 (3. cxd5 cxd5 {Exchange Variation}) Nf6 4. Nc3 dxc4 {Main line})
3. Nc3 Nf6 (3... c5 {Tarrasch Defense}) 4. Bg5 {[%course black] Main line} *
```

A branch goes right after the move it replaces, so `(3. cxd5 ...)` follows `3. Nf3`, not the end of that line. The checker reports a misplaced branch as an illegal move.

The checker holds every move of both sides to within 0.6 pawns of Stockfish's choice, since an overview shows the usual moves, not mistakes. A gambit that costs a little more can be kept with `[%engine ok]` in that move's note.

## After editing: run the checker

```bash
node tools/validate.mjs
```

This checks every line for legal moves and checks opening names and ECO codes against the Lichess database. It also asks Stockfish whether each of your side's moves is sound, then writes the results to `tools/report.md`.

- **Errors** (for example, an illegal move): fix them before sharing, or the course won't load.
- **No errors:** the checker also rebuilds `Opening Trainer.html`, the double-click version of the app, so it always has your latest lessons.
- **Flagged moves:** your-side moves that Stockfish rates more than 0.6 pawns worse than its choice. Change the move, or keep it on purpose by adding `[%engine ok]` inside that move's explanation. It moves to an "accepted" list and isn't shown in the app.
- **Opponent moves that lose material** without a `?` mark are listed, so you can mark real mistakes in trap lines.

To see Stockfish's top three lines after any position while you write:

```bash
node tools/pv.mjs "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4"
```

## How often each chapter comes up

`content/opening-stats.json` holds move counts from the Lichess opening explorer: rated rapid and classical games between players averaging 1800 to 2199, read in October 2026. The course page shows, under each chapter, the share of your games in that opening that reach the chapter's position, if you play the course's moves. A table's "How often" counts all of a line's move orders: the chance that its position comes up when you steer toward it and your opponents move as club players do, so it can be higher than the chapter's bar, which follows the course's own move order. Only the opponent's choices count, so "Main line: 3...Bc5" comes up in 40% of Italian games for White. When a course gives the learner a choice of systems (the Caro-Kann for White plays 3.e5, 3.f3 or 2.Nc3), the share counts the games with that choice, and the page names it: "of your Caro-Kann games with 3.f3". Openings and individual lines show no percentages.

The file covers the chapters in the current courses. After adding a chapter, ask Claude to read its positions from the Lichess explorer (it needs a signed-in Lichess account) and add them; until then that chapter shows no bar.

## Progress when lines change

Each line's progress is tied to its moves. Editing explanations keeps learners' progress. Changing a line's moves makes it a new line, so learners start that line again.

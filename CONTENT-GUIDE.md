# Editing the lessons

Each course is one PGN file in `content/`. For example, `italian-white.pgn` is the Italian Game played as White. You can edit these files in any text editor. You can also paste a whole file into a Lichess Study to see it on a board.

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
| `Chapter` | The title shown in the app. |
| `Type` | `line` (normal lines), `trap`, or `ideas` (the Key ideas page, which is never drilled). |
| `Opening`, `ECO` | The Lichess opening name and code. The checker verifies both. |
| `FEN` | Optional. Starts the chapter from a set position (used for Key ideas). |
| `Diagram` | The move whose position is shown beside the chapter on the course page, e.g. `[Diagram "3...Nd4"]`. Without it, the last move named in the title is used (`Main line: 3...Bc5`). The checker reports an error if neither is found on the main line. |

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

- **Key ideas pages:** chapters with `[Type "ideas"]`. They appear in order under "Key ideas" on the course page, and their moves are never drilled. A page can be a single position (`[FEN "..."]` with no moves) or a short move sequence.
- **Further study:** in `content/courses.json`, each opening can have a `furtherStudy` list (title, by, kind, url). It is shown on the course page and on every Key ideas page. Credit every source you draw on there, and always write the notes in your own words.

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

## Progress when lines change

Each line's progress is tied to its moves. Editing explanations keeps learners' progress. Changing a line's moves makes it a new line, so learners start that line again.

# Opening Trainer

A web app for learning chess openings from both sides, written for club players rated about 1500 to 2000. It works on phones, tablets and computers. Nothing to install, no accounts, and progress is saved in the browser.

Version 1 covers the Italian Game, Sicilian, French, Caro-Kann and Queen's Gambit, each as White and as Black. The Italian Game courses are written. The others are coming.

## How it teaches

- **Learn:** step through a line and read why each move is played.
- **Drill:** you play your side and the app plays the other. A wrong move shows the right one with its reason.
- **Review:** spaced repetition. Lines you know come back less often, and lines you miss come back the next day.

## Open it

**Double-click `Opening Trainer.html`.** It is the whole app in one file and needs no server or internet (only the further-study links go online). It is generated, so don't edit it. The content checker rebuilds it after every passing check, or you can rebuild it directly:

```bash
node tools/build-standalone.mjs
```

For development, run the local server and open http://127.0.0.1:8765/:

```bash
node tools/serve.mjs
```

Progress is stored separately by each browser on each computer. The double-click file and the local server count as two different sites, so each keeps its own progress. Use **Settings → Back up your progress** to move it between them.

## Edit or add lessons

See [CONTENT-GUIDE.md](CONTENT-GUIDE.md). After any change, run:

```bash
node tools/validate.mjs
```

The checker needs Node.js. For engine checks it also needs Stockfish at `%LOCALAPPDATA%\OpeningTrainer\stockfish\stockfish\stockfish-windows-x86-64-universal.exe`, or wherever the `STOCKFISH_PATH` environment variable points. Stockfish is not part of the app.

## Folder layout

| Path | What it holds |
|---|---|
| `index.html`, `css/`, `js/` | The app |
| `content/` | `courses.json` (the catalog) and one PGN file per course |
| `vendor/` | chess.js and cm-chessboard, with their licenses |
| `tools/` | Local server, content checker, engine helper, Lichess opening names |

## Credits and licenses

- App code: MIT (see `LICENSE`). The lesson text in `content/` is © Kumar Sandrasegaran; its sharing license is still to be decided.
- [chess.js](https://github.com/jhlywa/chess.js): BSD 2-Clause.
- [cm-chessboard](https://github.com/shaack/cm-chessboard): MIT.
- Chess pieces: Colin M. L. Burnett, via Wikimedia Commons, CC BY-SA 3.0.
- Opening names: [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings), CC0.
- Stockfish (GPL-3.0) is used only to check lessons and is not included in the app.

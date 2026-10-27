# Opening Trainer: rules for every course

These are Kumar's standing rules for every opening. Follow them in every session, for every course. File formats and the checker are in CONTENT-GUIDE.md, and its section "General rules for every course" (name first, then the move; less text; order by club frequency; traps stay in the Traps section; and more) is part of these rules.

When Kumar gives a rule for every course, in any session, add it to this file in that session, in his words where possible. Merge main first, and once he approves the merge, tell the other sessions to merge main so they pick it up.

## One course per opening

- One course teaches both sides. There are no separate White and Black courses, only separate drills: "Drill as White" and "Drill as Black".
- Keep text short and concrete. No list of abstract points ("What you need to know"); what a reader needs about each variation goes in the table.

## Introduction page (an opening's overview page), in this order

1. Short text
2. The yellow box with the course link
3. Map of the variations
4. Table of the variations

## Course page, in this order

1. Short text: "Why play it"
2. Map of the variations
3. Table of the variations
4. Key ideas
5. The sections: Basic, Traps, Advanced and Puzzles
6. Drills for White and for Black
7. References (Further study)

## Basic lines and "How often"

- Basic holds only the lines played in about 10% or more of your games (9.5% and up): about 4 to 6 lines, the very core. Everything else goes to Advanced, grouped by variation name, most common first. Kumar makes exceptions himself (the King's Indian has 7 Basic lines; the Caro-Kann keeps its 9 Basic lines and its own table, by his choice, so leave them as they are).
- "How often", in tables and chapter bars, is the share of your games in the opening that reach the line, from the side you play in it: the product of the opponent's move frequencies from the course start, in Lichess rated rapid and classical games between players averaging 1800 to 2199 (`content/opening-stats.json`). A table counts all of the line's move orders.

## Tables

- A course page's table of the variations has the columns Variation, How often, and What to do. The Caro-Kann is the exception: it keeps its own columns, by Kumar's choice.

## Lesson pages

- A move's note can run up to five sentences when needed. In Kumar's words: "Can be longer sentences - up to 5, if needed."
- The move buttons (« ‹ › ») stay at the same height on every move, directly under the move line; a move's note goes below them. In Kumar's words: "The moves line keeps moving up and down - very annoying. Ensure all move lines are at same level. If additional text if needed, add this below the move line."
- Only one line of text, the move line, sits directly above the move buttons; everything else goes below them. In Kumar's words: "Make sure there is only one line of text above the moves buttons. Anything else goes below the buttons." This holds for lessons, Key ideas boards, overview lines and puzzles.
- The scroll bar is shown on every page, whether it is needed or not, so the move buttons never shift sideways or up and down. In Kumar's words: "Have scroll bar on every page, whether it is needed or not. That way the sideways and up/down motion of the moves buttons is eliminated."
- A lesson's introduction (the text under "Starting position") stays visible while the moves play, and the current move is shown above it, beside the board. In Kumar's words: "Whatever is written after Starting position of each variation should remain visible when the pieces start moving."

## Key ideas pages

- Every course, the Caro-Kann included. Kumar found the Key ideas pages "too long", with "multiple moves which cannot be followed by average player". In his words: "Every concept you want to show have the pieces on the board and show how the moves work (this may need multiple boards on each page - one per concept)."
- So: one board per concept. Each board starts from the initial position and plays the moves that lead to the idea, then only the few moves that show how it works. A page with several concepts has several boards. The format (`[Type "concept"]` chapters after the `[Type "ideas"]` page) is in CONTENT-GUIDE.md.
- Every board starts from the initial position, never from a set-up position. In Kumar's words: "For all key ideas start board from starting position (no moves yet) and advance to where you are discussing the idea. It is difficult for a learner to know how you arrived at the position you are discussing." And: "Key Ideas start with staring position (no moves yet), moves to where the discussion starts, and then the key idea." And: "Yes, do this for all courses."
- Every Key ideas page in every opening course is converted to this format. In Kumar's words: "Convert all Key ideas in every opening course to this format."

## Names

- Spell out an abbreviation the first time a page uses it, then use the short form: "Queen's Gambit Declined (QGD)", then "QGD".
- No colour in course titles: "Caro-Kann Defense Course", not "Caro-Kann Defense Course for White".

## Drills

- No daily limit: every line is in the drill from the start, and the learner decides how many to drill.
- The White and Black drills can both be done on the same day.
- A drill takes the Basic lines (and traps) first. Before the Advanced variations it stops with an alert that they come next, so a learner can stop at the Basic lines.
- A line played incorrectly (a wrong move, or a hint) comes back in the next drill.

## No repetition

"Why play it", the table and the Key ideas pages must not repeat each other in any significant way:

- "Why play it" gives the reasons to choose the opening, for each side.
- The table says what happens in each line.
- The Key ideas pages explain the ideas behind the lines, such as pawn structures and plans.

## References

- Usually 4 per course; 5 at most, only when needed.
- No Wikipedia.
- No source whose author is unknown: a video must name its presenter, not only its channel.

## Back buttons

Every lesson page (a line in Basic, Traps or Advanced) shows its back buttons in this order: the section, then the course page, then Main menu. For example: "< Basic variations < French Defense Course < Main menu". A Key ideas page shows the course page, then Main menu. A Puzzles page shows the course page, then Main menu. A course page shows Main menu, then the overview page the opening sits under, never the opening's own Introduction page, which repeats the course page's map and table (the Caro-Kann course page goes back to Replies to 1.e4).

## Sessions and branches

- One working session per opening. In Kumar's words: "Start new session for every opening - so I don't get confused."
- Major structural changes to the app go on their own GitHub branch, for review.

## Before merging

- Show Kumar screenshots of every change that is not live yet. Pages that are already published need no screenshots: he can see them online.
- Never push to main or merge without Kumar's "Yes, merge it so it goes live".

(function () {
  "use strict";
  var V = window.CK_DATA;
  var SVGNS = "http://www.w3.org/2000/svg";
  var SQ = 40;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var flipped = false;
  try { flipped = localStorage.getItem("ck-flip") === "1"; } catch (e) {}

  function el(name, attrs) {
    var n = document.createElementNS(SVGNS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function parseBoard(fen) {
    var out = {};
    var rows = fen.split(" ")[0].split("/");
    for (var r = 0; r < 8; r++) {
      var f = 0;
      for (var i = 0; i < rows[r].length; i++) {
        var c = rows[r][i];
        if (/\d/.test(c)) { f += +c; continue; }
        var color = c === c.toUpperCase() ? "w" : "b";
        out["abcdefgh"[f] + (8 - r)] = color + c.toLowerCase();
        f++;
      }
    }
    return out;
  }
  function xy(sq) {
    var f = "abcdefgh".indexOf(sq[0]), r = +sq[1];
    return flipped ? [(7 - f) * SQ, (r - 1) * SQ] : [f * SQ, (8 - r) * SQ];
  }
  function moveLabel(i, san) {
    var n = Math.floor(i / 2) + 1;
    return i % 2 === 0 ? n + "." + san : n + "..." + san;
  }
  var START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

  function Board(card, v) {
    var self = this;
    this.v = v;
    this.lineIx = 0;
    this.ply = v.lines[0].start;
    this.timer = null;
    this.svg = card.querySelector("svg.board");
    this.status = card.querySelector(".status");
    this.list = card.querySelector(".movelist");
    this.watchBtn = card.querySelector("[data-act=watch]");
    this.tabs = card.querySelectorAll("[data-line]");

    var sqG = el("g", {}), coordG = el("g", { "class": "coords" });
    this.hlG = el("g", {});
    this.pcG = el("g", {});
    for (var r = 0; r < 8; r++) for (var f = 0; f < 8; f++) {
      sqG.appendChild(el("rect", { x: f * SQ, y: r * SQ, width: SQ, height: SQ,
        "class": (r + f) % 2 ? "sq-d" : "sq-l" }));
    }
    this.coordG = coordG;
    this.svg.appendChild(sqG);
    this.svg.appendChild(this.hlG);
    this.svg.appendChild(coordG);
    this.svg.appendChild(this.pcG);

    card.querySelector(".controls").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-act]");
      if (!b) return;
      var a = b.getAttribute("data-act");
      if (a === "watch") return self.toggleWatch();
      self.stop();
      if (a === "first") self.go(0);
      if (a === "prev") self.go(self.ply - 1);
      if (a === "next") self.go(self.ply + 1, true);
      if (a === "last") self.go(self.line().moves.length);
    });
    this.list.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-ply]");
      if (!b) return;
      self.stop();
      var p = +b.getAttribute("data-ply");
      self.go(p, p === self.ply + 1);
    });
    Array.prototype.forEach.call(this.tabs, function (t) {
      t.addEventListener("click", function () {
        self.stop();
        self.lineIx = +t.getAttribute("data-line");
        self.ply = self.line().start;
        self.drawList();
        self.render(false);
      });
    });
    card.querySelector(".board-wrap").addEventListener("keydown", function (e) {
      var map = { ArrowLeft: -1, ArrowRight: 1 };
      if (e.key in map) { self.stop(); self.go(self.ply + map[e.key], map[e.key] === 1); e.preventDefault(); }
      if (e.key === "Home") { self.stop(); self.go(0); e.preventDefault(); }
      if (e.key === "End") { self.stop(); self.go(self.line().moves.length); e.preventDefault(); }
    });
    this.drawCoords();
    this.drawList();
    this.render(false);
  }
  Board.prototype.line = function () { return this.v.lines[this.lineIx]; };
  Board.prototype.go = function (p, animate) {
    var n = this.line().moves.length;
    p = Math.max(0, Math.min(n, p));
    if (p === this.ply) return;
    this.ply = p;
    this.render(!!animate);
  };
  Board.prototype.stop = function () {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.watchBtn.setAttribute("aria-pressed", "false");
    this.watchBtn.querySelector(".lbl").textContent = "Watch";
  };
  Board.prototype.toggleWatch = function () {
    var self = this;
    if (this.timer) return this.stop();
    this.watchBtn.setAttribute("aria-pressed", "true");
    this.watchBtn.querySelector(".lbl").textContent = "Pause";
    if (this.ply >= this.line().moves.length || this.ply === this.line().start) { this.ply = 0; this.render(false); }
    this.timer = setInterval(function () {
      if (self.ply >= self.line().moves.length) return self.stop();
      self.go(self.ply + 1, true);
    }, 850);
  };
  Board.prototype.drawCoords = function () {
    var g = this.coordG;
    while (g.firstChild) g.removeChild(g.firstChild);
    for (var i = 0; i < 8; i++) {
      var file = flipped ? "hgfedcba"[i] : "abcdefgh"[i];
      var rank = flipped ? i + 1 : 8 - i;
      var t = el("text", { x: i * SQ + SQ - 3, y: 8 * SQ - 3, "text-anchor": "end",
        "class": (7 + i) % 2 ? "on-d" : "on-l" });
      t.textContent = file;
      g.appendChild(t);
      var u = el("text", { x: 3, y: i * SQ + 10, "class": i % 2 ? "on-d" : "on-l" });
      u.textContent = rank;
      g.appendChild(u);
    }
  };
  Board.prototype.render = function (animate) {
    var line = this.line(), p = this.ply;
    var mv = p > 0 ? line.moves[p - 1] : null;
    var board = parseBoard(mv ? mv[3] : START);

    while (this.hlG.firstChild) this.hlG.removeChild(this.hlG.firstChild);
    if (mv) [mv[1], mv[2]].forEach(function (s) {
      var c = xy(s);
      this.hlG.appendChild(el("rect", { x: c[0], y: c[1], width: SQ, height: SQ, "class": "hl" }));
    }, this);

    while (this.pcG.firstChild) this.pcG.removeChild(this.pcG.firstChild);
    var moving = null;
    for (var s in board) {
      var c = xy(s);
      var u = el("use", { href: "#p-" + board[s], "class": "pc" });
      u.style.transform = "translate(" + c[0] + "px," + c[1] + "px)";
      if (animate && mv && s === mv[2]) moving = { node: u, to: c };
      this.pcG.appendChild(u);
    }
    if (moving && !reduceMotion) {
      var f = xy(mv[1]);
      moving.node.style.transform = "translate(" + f[0] + "px," + f[1] + "px)";
      this.pcG.appendChild(moving.node);
      moving.node.getBoundingClientRect();
      requestAnimationFrame(function () {
        moving.node.classList.add("moving");
        moving.node.style.transform = "translate(" + moving.to[0] + "px," + moving.to[1] + "px)";
      });
    }

    var label = mv ? moveLabel(p - 1, mv[0]) : null;
    this.svg.setAttribute("aria-label", this.v.name + ": " + (label ? "position after " + label : "starting position"));
    if (!mv) {
      this.status.innerHTML = "Starting position. Press <b>Watch</b> to play the line from move 1.";
    } else {
      this.status.innerHTML = "<b>" + label + "</b> · chosen in <b>" + mv[4] + "%</b> of club games from the position before it";
    }
    Array.prototype.forEach.call(this.list.querySelectorAll("button[data-ply]"), function (b) {
      var on = +b.getAttribute("data-ply") === p;
      b.classList.toggle("now", on);
      if (on) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
    var self = this;
    Array.prototype.forEach.call(this.tabs, function (t) {
      t.setAttribute("aria-pressed", String(+t.getAttribute("data-line") === self.lineIx));
    });
  };
  Board.prototype.drawList = function () {
    var line = this.line(), html = "";
    for (var i = 0; i < line.moves.length; i++) {
      if (i % 2 === 0) html += '<span class="num">' + (i / 2 + 1) + ".</span>";
      var cls = i + 1 >= line.keyFrom && i + 1 <= line.keyTo ? ' class="def"' : "";
      html += '<button type="button" data-ply="' + (i + 1) + '"' + cls + ">" + line.moves[i][0] + "</button>";
    }
    this.list.innerHTML = html;
  };

  var boards = [];
  V.forEach(function (v) {
    var card = document.getElementById(v.id);
    if (card) boards.push(new Board(card, v));
  });

  var flipBtns = document.querySelectorAll("[data-flip]");
  function setFlip(val) {
    flipped = val;
    try { localStorage.setItem("ck-flip", val ? "1" : "0"); } catch (e) {}
    Array.prototype.forEach.call(flipBtns, function (b) {
      b.setAttribute("aria-pressed", String((b.getAttribute("data-flip") === "black") === val));
    });
    boards.forEach(function (b) { b.drawCoords(); b.render(false); });
  }
  Array.prototype.forEach.call(flipBtns, function (b) {
    b.addEventListener("click", function () { setFlip(b.getAttribute("data-flip") === "black"); });
  });
  setFlip(flipped);
})();

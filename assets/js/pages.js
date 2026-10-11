// The live "shows" in the heroes of the inner pages (built by website/shows.py). Each runs only while it is on screen;
// with reduced motion it shows its finished state. Text is always set with textContent.
(function () {
  "use strict";
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var wait = function (ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); };

  // run fn(el, alive) while the element is visible; alive() turns false when it scrolls away, and fn restarts later
  function whenVisible(el, fn) {
    var on = false, gen = 0;
    var io = new IntersectionObserver(function (es) {
      var vis = es[0].isIntersecting;
      if (vis && !on) { on = true; var g = ++gen; fn(el, function () { return on && g === gen; }); }
      if (!vis) on = false;
    }, { threshold: 0.2 });
    io.observe(el);
  }
  function data(el) { var s = el.querySelector(".show__data"); return s ? JSON.parse(s.textContent) : null; }

  // append coloured pieces to a <pre>: parts = [[cls, text], ...]; typed when speed > 0
  async function type(pre, parts, speed, alive) {
    for (var i = 0; i < parts.length; i++) {
      var span = document.createElement("span");
      if (parts[i][0]) span.className = parts[i][0];
      pre.appendChild(span);
      var t = parts[i][1];
      if (!speed || still) { span.textContent = t; continue; }
      for (var j = 0; j < t.length; j += 2) {
        if (!alive()) return false;
        span.textContent = t.slice(0, j + 2);
        await wait(speed);
      }
    }
    return true;
  }

  // ── terminal: a request, then the answer streaming in
  var LETTER = "Heimatverein Lindenbrück e.V. · Am Marktplatz 3 · 37581 Lindenbrück\\n\\nFrau\\nDr. Johanna Weiß\\nKreisarchiv Nordheide\\nSchlossstraße 12\\n37574 Nordheim\\n\\nLindenbrück, den 3. September 2026\\n\\n**Digitalisierung der Kirchenbücher 1754–1899**\\n\\nSehr geehrte Frau Dr. Weiß,\\n\\nwir bedanken uns herzlich für Ihre Unterstützung …";
  var CMD = [["p", "$ "], ["", "curl https://api.runemic.com/v1/ocr \\\n    -H "], ["s", "\"Authorization: Bearer $RUNEMIC_API_KEY\""], ["", " \\\n    -F "],
    ["s", "\"file=@letter.png\""], ["", " -F "], ["s", "\"model=preview-gemma-4\""], ["", "\n\n"]];
  async function terminal(term, alive) {
    var cmd = term.querySelector(".term__cmd"), out = term.querySelector(".term__out");
    while (alive()) {
      cmd.textContent = ""; out.textContent = ""; term.classList.add("caret");
      if (!await type(cmd, CMD, 28, alive)) return;
      await wait(500);
      if (!await type(out, [["", "{ "], ["k", "\"object\""], ["", ": "], ["s", "\"ocr.result\""], ["", ",\n  "], ["k", "\"text\""], ["", ": "]], 0, alive)) return;
      if (!await type(out, [["s", "\"" + LETTER + "\""]], 14, alive)) return;
      await type(out, [["", ",\n  "], ["k", "\"usage\""], ["", ": { "], ["k", "\"pages\""], ["", ": 1, "], ["k", "\"credits_used\""], ["", ": 2 },\n  "], ["k", "\"credits_left\""], ["", ": 2498 }"]], 0, alive);
      term.classList.remove("caret");
      if (still) return;
      await wait(5000);
    }
  }

  // ── models: layout, reading order, recognition, structure
  async function pipeline(el, alive) {
    var d = data(el), steps = el.querySelectorAll(".pipe__steps li"), text = el.querySelector(".pipe__text"),
      meta = el.querySelector(".pipe__meta"), file = el.querySelector(".pipe__file"), bars = el.querySelectorAll(".pipe__line");
    function phase(n) {
      el.classList.remove("is-p1", "is-p2", "is-p3", "is-p4");
      if (n) el.classList.add("is-p" + n);
      steps.forEach(function (s, i) { s.classList.toggle("is-on", i === n - 1); });
    }
    function md(i) { return d.lines[i]; }
    async function structure(speed) {
      file.textContent = "page.json"; meta.textContent = d.blocks.length + " blocks, in reading order"; text.textContent = "";
      var parts = [["", "{ "], ["k", "\"blocks\""], ["", ": [\n"]];
      d.blocks.forEach(function (b, n) {
        var first = d.lines[b[1][0]].replace(/\*\*/g, ""), short = first.length > 30 ? first.slice(0, 30) + "…" : first;
        parts.push(["", "  { "], ["k", "\"order\""], ["", ": " + (n + 1) + ", "], ["k", "\"type\""], ["", ": "], ["s", "\"" + b[0] + "\""], ["", ", "],
          ["k", "\"lines\""], ["", ": " + b[1].length + ", "], ["k", "\"text\""], ["", ": "], ["s", "\"" + short + "\""], ["", " }" + (n < d.blocks.length - 1 ? "," : "") + "\n"]);
      });
      parts.push(["", "] }"]);
      return type(text, parts, speed, alive);
    }
    if (still) { phase(4); bars.forEach(function (b) { b.classList.add("is-done"); }); await structure(0); return; }
    while (alive()) {
      phase(0); text.textContent = ""; file.textContent = "page.md"; meta.textContent = "";
      bars.forEach(function (b) { b.classList.remove("is-on", "is-done"); });
      await wait(600);
      phase(1); meta.textContent = "finding text regions…"; await wait(2400); if (!alive()) return;
      phase(2); meta.textContent = "working out the reading order…"; await wait(2600); if (!alive()) return;
      phase(3);
      var count = 0;
      for (var n = 0; n < d.blocks.length; n++) {
        var idx = d.blocks[n][1];
        for (var k = 0; k < idx.length; k++) {
          var i = idx[k];
          bars[i].classList.add("is-on");
          meta.textContent = "line " + (++count) + " of " + d.lines.length;
          if (!await type(text, [["", md(i) + (k < idx.length - 1 ? "\n" : n < d.blocks.length - 1 ? "\n\n" : "")]], 9, alive)) return;
          text.scrollTop = text.scrollHeight;
          bars[i].classList.remove("is-on"); bars[i].classList.add("is-done");
        }
      }
      meta.textContent = "done"; await wait(1600); if (!alive()) return;
      phase(4);
      if (!await structure(4)) return;
      await wait(4500);
    }
  }

  // ── products: the API terminal, the scanner, the archive search
  async function products(el, alive) {
    var scan = el.querySelector(".tile--scan"), digi = el.querySelector(".tile--digi"), q = el.querySelector(".digi__q");
    terminal(el.querySelector(".tile--api .term"), alive);
    if (still) { scan.classList.add("is-on"); digi.classList.add("is-on"); q.textContent = q.dataset.q; return; }
    while (alive()) {
      scan.classList.remove("is-on"); digi.classList.remove("is-on"); q.textContent = ""; q.classList.add("caret");
      await wait(2200); if (!alive()) return;
      scan.classList.add("is-on");
      for (var i = 1; i <= q.dataset.q.length; i++) { if (!alive()) return; q.textContent = q.dataset.q.slice(0, i); await wait(110); }
      q.classList.remove("caret"); await wait(300);
      digi.classList.add("is-on");
      await wait(5200);
    }
  }

  // ── pricing: the 2,500 free credits, spent page by page (2 or 3 credits, by the sample's model)
  async function credit(el, alive) {
    var pages = data(el), img = el.querySelector(".credit__page img"), tag = el.querySelector(".credit__tag"),
      v = el.querySelector(".credit__v"), bar = el.querySelector(".credit__bar i"), nEl = el.querySelector(".credit__n"), c = el.querySelector(".credit__c");
    var start = Number(v.getAttribute("data-start")) || 2500, left = start, n = 0, i = 0;
    function fmt(x) { return x.toLocaleString("en-US"); }
    function show(p) { img.src = p.img; tag.textContent = p.label; c.textContent = p.credits + (p.credits === 1 ? " credit" : " credits"); }
    show(pages[0]);
    if (still) return;
    while (alive()) {
      var p = pages[i % pages.length];
      img.classList.add("is-out"); await wait(300); show(p); img.classList.remove("is-out");
      await wait(500);
      left = Math.max(0, left - p.credits); n++;
      v.textContent = fmt(left); nEl.textContent = n; bar.style.width = (left / start * 100).toFixed(2) + "%";
      i++;
      if (n >= 60) { await wait(1500); left = start; n = 0; v.textContent = fmt(start); nEl.textContent = "0"; bar.style.width = "100%"; }
      await wait(1300);
    }
  }


  var SHOWS = { pipeline: pipeline, products: products, credit: credit,
    terminal: function (el, alive) { return terminal(el.querySelector(".term"), alive); } };
  document.querySelectorAll("[data-show]").forEach(function (el) {
    var fn = SHOWS[el.dataset.show];
    if (fn && "IntersectionObserver" in window) whenVisible(el, fn);
  });
})();

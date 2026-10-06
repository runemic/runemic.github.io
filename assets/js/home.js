// Home page. Sample pages float around the headline and drift with the mouse; clicking one opens the reader, where
// the scan line passes over the page and the text Runemic's preview models really returned for it is written out
// as real, selectable text (data embedded by build.py). Your own page (button, drop or paste) is handed to /try,
// which reads it at once.
(function () {
  var stage = document.getElementById("stage"), dlg = document.getElementById("reader-dlg"), root = document.getElementById("reader");
  var dataEl = document.getElementById("reader-data");
  if (!stage || !dlg || !root || !dataEl) return;
  var S = JSON.parse(dataEl.textContent);
  var credit = document.getElementById("reader-credit"), creditLink = document.getElementById("reader-credit-link"), img = document.getElementById("reader-img"), md = document.getElementById("reader-md"), meta = document.getElementById("reader-meta"), caveat = document.getElementById("reader-caveat");
  var tabs = root.querySelectorAll('.reader__tabs [role="tab"]');
  var floats = stage.querySelectorAll(".float");
  var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var cur = 0, timer = null, raf = null;

  // ── the pages drift with the mouse (each by its own depth)
  var fine = window.matchMedia && window.matchMedia("(pointer: fine) and (min-width: 1200px)").matches;
  if (fine && !calm) {
    var tx = 0, ty = 0, pending = false;
    stage.addEventListener("mousemove", function (e) {
      var r = stage.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5; ty = (e.clientY - r.top) / r.height - 0.5;
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        floats.forEach(function (f) {
          var d = Number(f.getAttribute("data-depth")) || 1;
          f.style.setProperty("--mx", (-tx * 46 * d).toFixed(1) + "px");
          f.style.setProperty("--my", (-ty * 34 * d).toFixed(1) + "px");
        });
      });
    });
    stage.addEventListener("mouseleave", function () { floats.forEach(function (f) { f.style.setProperty("--mx", "0px"); f.style.setProperty("--my", "0px"); }); });
  }

  // ── a small Markdown renderer (headings, bold, paragraphs with line breaks, tables)
  function el(tag, text) { var e = document.createElement(tag); if (text != null) e.textContent = text; return e; }
  function inline(parent, text) {
    text.split(/(\*\*[^*]+\*\*)/).forEach(function (part) {
      if (/^\*\*[^*]+\*\*$/.test(part)) parent.appendChild(el("strong", part.slice(2, -2)));
      else if (part) parent.appendChild(document.createTextNode(part));
    });
  }
  function cells(line) { return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(function (c) { return c.trim(); }); }
  function render(src) {
    var out = document.createDocumentFragment(), lines = src.split("\n"), i = 0;
    while (i < lines.length) {
      var line = lines[i];
      if (!line.trim()) { i++; continue; }
      var h = line.match(/^(#{1,3})\s+(.*)$/);
      if (h) { var hx = el("h" + (h[1].length + 1)); inline(hx, h[2]); hx.dir = "auto"; out.appendChild(hx); i++; continue; }
      if (/^\s*\|/.test(line)) {
        var wrap = el("div"); wrap.className = "md__table";
        var t = el("table"), head = el("thead"), body = el("tbody"), tr = el("tr");
        cells(line).forEach(function (c) { var th = el("th"); inline(th, c); tr.appendChild(th); });
        head.appendChild(tr); t.appendChild(head); i++;
        if (i < lines.length && /^\s*\|?\s*:?-+/.test(lines[i])) i++;
        while (i < lines.length && /^\s*\|/.test(lines[i])) {
          var r = el("tr"); cells(lines[i]).forEach(function (c) { var td = el("td"); inline(td, c); r.appendChild(td); }); body.appendChild(r); i++;
        }
        t.appendChild(body); wrap.appendChild(t); out.appendChild(wrap); continue;
      }
      var p = el("p"); p.dir = "auto";
      while (i < lines.length && lines[i].trim() && !/^#{1,3}\s/.test(lines[i]) && !/^\s*\|/.test(lines[i])) {
        if (p.childNodes.length) p.appendChild(el("br"));
        inline(p, lines[i]); i++;
      }
      out.appendChild(p);
    }
    md.textContent = ""; md.appendChild(out);
  }

  // ── reading one page: the scan line, then the text written out
  function stop() { clearTimeout(timer); cancelAnimationFrame(raf); root.classList.remove("is-scanning"); }
  function show(i) {
    stop();
    cur = (i + S.length) % S.length;
    var s = S[cur];
    tabs.forEach(function (b, k) { b.setAttribute("aria-selected", String(k === cur)); b.tabIndex = k === cur ? 0 : -1; });
    md.dir = s.dir; md.lang = tabs[cur].lang;
    meta.textContent = s.target ? "Rune-1 · in training" : s.model + " · read in " + (s.ms / 1000).toFixed(1) + " s · $" + s.cost.toFixed(3);
    img.src = "/assets/samples/" + (s.img || s.id + ".png"); img.alt = s.name;
    caveat.textContent = s.caveat || ""; caveat.hidden = !s.caveat || !!s.target; // honest about a reading's mistakes
    creditLink.textContent = s.credit || ""; creditLink.href = s.credit_url || "#"; credit.hidden = !s.credit;
    if (s.target) { // a page the preview models can't read yet: say so instead of showing invented text
      md.textContent = ""; md.dir = "ltr"; md.lang = "en";
      var n = el("div"); n.className = "reader__note";
      n.appendChild(el("strong", "Not readable with today's preview models"));
      n.appendChild(el("p", s.note));
      var a = el("a", "About Rune-1"); a.href = "/models"; n.appendChild(a);
      md.appendChild(n);
      return;
    }
    if (calm) { render(s.text); return; }
    md.textContent = "";
    void root.offsetWidth; // restart the scan animation
    root.classList.add("is-scanning");
    timer = setTimeout(function () { type(s.text); }, 900);
  }
  function type(text) {
    var total = Math.max(1600, Math.min(4200, text.length * 9)), t0 = performance.now(), last = -1;
    (function step(now) {
      var n = Math.min(text.length, Math.ceil(text.length * (now - t0) / total));
      if (n !== last) { render(text.slice(0, n)); last = n; md.scrollTop = md.scrollHeight; }
      if (n < text.length) raf = requestAnimationFrame(step);
      else { md.scrollTop = 0; root.classList.remove("is-scanning"); }
    })(t0);
  }

  // ── opening and closing the reader
  var opener = null;
  function open(i, from) {
    opener = from || null;
    if (!dlg.open) dlg.showModal();
    show(i);
    tabs[cur].focus({ preventScroll: true });
  }
  function close() { stop(); dlg.close(); }
  dlg.addEventListener("close", function () { stop(); if (opener) opener.focus({ preventScroll: true }); });
  dlg.addEventListener("click", function (e) { if (e.target === dlg) close(); }); // click on the backdrop
  document.getElementById("reader-close").addEventListener("click", close);
  floats.forEach(function (f) { f.addEventListener("click", function () { open(Number(f.getAttribute("data-i")), f); }); });
  tabs.forEach(function (b, k) {
    b.addEventListener("click", function () { show(k); });
    b.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (d) { e.preventDefault(); show(k + d); tabs[cur].focus(); }
    });
  });

  // ── your own page: hand it to /try (sessionStorage), which reads it at once
  var input = document.getElementById("reader-file"), dropzone = document.getElementById("reader-drop");
  function handoff(f) {
    if (!f || !/^image\//.test(f.type)) return;
    var r = new FileReader();
    r.onload = function () {
      try { sessionStorage.setItem("runemic-handoff", JSON.stringify({ name: f.name, type: f.type, data: r.result })); }
      catch (e) { /* too large for this browser's storage: /try asks for the file again */ }
      location.href = "/try";
    };
    r.readAsDataURL(f);
  }
  input.addEventListener("change", function () { handoff(input.files[0]); });
  document.getElementById("stage-own").addEventListener("click", function () { input.click(); });
  [stage, dlg].forEach(function (zone) {
    ["dragenter", "dragover"].forEach(function (t) { zone.addEventListener(t, function (e) { e.preventDefault(); dropzone.classList.add("is-over"); }); });
    zone.addEventListener("dragleave", function (e) { if (!zone.contains(e.relatedTarget)) dropzone.classList.remove("is-over"); });
    zone.addEventListener("drop", function (e) { e.preventDefault(); dropzone.classList.remove("is-over"); if (e.dataTransfer && e.dataTransfer.files[0]) handoff(e.dataTransfer.files[0]); });
  });
})();

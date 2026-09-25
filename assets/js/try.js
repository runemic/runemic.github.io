// runemic.com/try: free image-to-text. A big drop zone opens a full-screen workspace (image | text, with a
// draggable divider); reading starts as soon as an image is chosen and the text streams in as it is written.
// Talks to api.runemic.com/v1/try, which counts free pages per visitor
// (a signed cookie on api.runemic.com) and per network. All text is set with textContent, never innerHTML.
(function () {
  "use strict";
  var tool = document.getElementById("tool");
  if (!tool) return;
  var API = tool.getAttribute("data-api") + "/v1/try";
  var CONSOLE = "https://console.runemic.com";
  var MAX = 4194304, MAX_IN = 25 * 1048576, TYPES = /^image\/(png|jpeg|webp|gif)$/; // big photos are shrunk before sending
  function $(id) { return document.getElementById(id); }
  var file = null, busy = false, remaining = null, open = true, lastText = "", lastFormat = "markdown";

  // interface text (English, or Persian on /fa/ pages); error codes from the server map to local messages
  var FA = tool.getAttribute("data-lang") === "fa";
  // signed in to the console? rk_signed_in is a non-secret hint ("1", no identity). /v1/try never reads it,
  // and the console session cookie is never sent here, so free-tool use is not linked to any account.
  var SIGNED_IN = /(?:^|;\s*)rk_signed_in=1/.test(document.cookie);
  var faDigits = function (n) { return String(n).replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[d]; }); };
  var T = FA ? {
    left: function (r, l) { return faDigits(r) + " صفحهٔ رایگان از " + faDigits(l) + " صفحهٔ امروز باقی مانده · "; },
    signin: "برای ۵ دلار اعتبار رایگان وارد شوید", none: "صفحهٔ رایگان امروز شما تمام شده است.",
    inLeft: "شما وارد شده‌اید: ", inLink: "در محیط آزمایش تا ۵۰۰ صفحه در روز بخوانید (روز اول ۵۰)",
    leftHere: function (r, l) { return faDigits(r) + " از " + faDigits(l) + " صفحهٔ رایگان این‌جا باقی مانده · "; },
    type: "لطفاً یک تصویر PNG، JPEG، WebP یا GIF انتخاب کنید. پشتیبانی از PDF به‌زودی اضافه می‌شود.",
    size: "حجم این تصویر بیشتر از ۲۵ مگابایت است. یک عکس یا اسکرین‌شات کوچک‌تر امتحان کنید.",
    sample: "نمونه بارگذاری نشد. دوباره تلاش کنید.", reading: "در حال خواندن…", run: "خواندن دوباره",
    notext: "(در این تصویر متنی پیدا نشد.)", network: "اتصال به سرور برقرار نشد. اینترنت خود را بررسی کنید و دوباره تلاش کنید.",
    paused: "ابزار رایگان فعلاً متوقف است. می‌توانید وارد کنسول شوید و از اعتبار رایگان خود استفاده کنید.",
    copied: "کپی شد", copy: "کپی", generic: "مشکلی پیش آمد. دوباره تلاش کنید.",
    codes: { try_limit: "صفحه‌های رایگان امروز شما تمام شده است.", capacity: "ظرفیت رایگان امروز تمام شده است. وارد شوید یا بعد از ساعت ۰۰:۰۰ UTC دوباره بیایید.",
             rate_limited: "درخواست‌ها زیاد است. یک دقیقه صبر کنید.", model_error: "مدل نتوانست این تصویر را بخواند. یک عکس واضح‌تر امتحان کنید.",
             too_large: "حجم این تصویر بیشتر از ۴ مگابایت است.", unsupported_type: "لطفاً یک تصویر PNG، JPEG، WebP یا GIF انتخاب کنید.",
             unavailable: "ابزار رایگان فعلاً متوقف است." }
  } : {
    left: function (r, l) { return r + " of " + l + " free pages left today · "; },
    signin: "Sign in for $5 of free credit", none: "No free pages left today.",
    inLeft: "You're signed in: ", inLink: "the playground gives you up to 500 pages a day (50 on day one)",
    leftHere: function (r, l) { return r + " of " + l + " free pages left here · "; },
    type: "Use a PNG, JPEG, WebP or GIF image. PDFs are coming soon.",
    size: "That image is larger than 25 MB. Try a smaller photo or screenshot.",
    sample: "Couldn't load the sample. Please try again.", reading: "Reading…", run: "Read again",
    notext: "(No text found in this image.)", network: "Couldn't reach the server. Check your connection and try again.",
    paused: "The free tool is paused right now. You can still sign in to the console and use your free credit.",
    copied: "Copied", copy: "Copy", generic: "Something went wrong. Please try again.", codes: {}
  };

  var ws = $("ws"), pane = document.querySelector(".ws__pane--txt"), split = $("ws-split"), out = $("try-out");
  var gateHome = document.querySelector(".tool-section > .note");

  function say(msg, kind) {
    ["try-status", "try-status-start"].forEach(function (id) { var s = $(id); s.textContent = msg || ""; s.setAttribute("data-kind", kind || ""); });
  }
  function refresh() { $("try-run").disabled = !file || busy || !open || remaining === 0; }
  function isOpen() { return !ws.hidden; }

  // ── pages left (shown on the start screen and in the workspace bar)
  function fillLeft(el, rem, limit) {
    el.textContent = "";
    function link(href, text) { var a = document.createElement("a"); a.href = href; a.textContent = text; el.appendChild(a); }
    if (SIGNED_IN) {
      if (rem != null) el.appendChild(document.createTextNode(rem === 0 ? T.none + " " : T.leftHere(rem, limit)));
      el.appendChild(document.createTextNode(T.inLeft));
      link(CONSOLE + "/#playground", T.inLink);
    } else if (rem === 0) {
      el.textContent = T.none;
    } else if (rem != null) {
      el.appendChild(document.createTextNode(T.left(rem, limit)));
      link(CONSOLE + "/?from=try", T.signin);
    }
  }
  function placeGates() {
    [$("try-gate"), $("try-gate-in")].forEach(function (g) {
      if (isOpen()) $("ws-gates").appendChild(g); else gateHome.parentNode.insertBefore(g, gateHome);
    });
  }
  function showLeft(rem, limit) {
    remaining = rem;
    fillLeft($("try-left"), rem, limit);
    fillLeft($("ws-left"), rem, limit);
    if (rem === 0) $(SIGNED_IN ? "try-gate-in" : "try-gate").hidden = false;
    placeGates();
    refresh();
  }

  // ── formatted Markdown: the same rules as the console playground. Builds elements from text only, never HTML.
  function mk(tag, text) { var e = document.createElement(tag); if (text != null) e.textContent = text; return e; }
  function inline(parent, text) {
    var re = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g, last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
      var t = m[0];
      if (t[0] === "`") parent.appendChild(mk("code", t.slice(1, -1)));
      else if (t.slice(0, 2) === "**" || t.slice(0, 2) === "__") inline(parent.appendChild(mk("strong")), t.slice(2, -2));
      else inline(parent.appendChild(mk("em")), t.slice(1, -1));
      last = m.index + t.length;
    }
    if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  }
  function cells(line) { return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(function (c) { return c.trim(); }); }
  function renderMd(root, src) {
    root.textContent = "";
    var lines = src.replace(/\r\n?/g, "\n").split("\n"), i = 0;
    function add(tag) { var e = mk(tag); e.setAttribute("dir", "auto"); root.appendChild(e); return e; }
    while (i < lines.length) {
      var line = lines[i];
      if (!line.trim()) { i++; continue; }
      var h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) { inline(add("h" + Math.min(4, h[1].length)), h[2]); i++; continue; }
      if (/^```/.test(line)) {
        var buf = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
        i++; add("pre").appendChild(mk("code", buf.join("\n"))); continue;
      }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { root.appendChild(mk("hr")); i++; continue; }
      if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        var table = add("table"), tr = mk("tr"), tbody = mk("tbody");
        cells(line).forEach(function (c) { inline(tr.appendChild(mk("th")), c); });
        table.appendChild(mk("thead")).appendChild(tr); table.appendChild(tbody); i += 2;
        while (i < lines.length && /^\s*\|/.test(lines[i])) {
          var r = mk("tr"); cells(lines[i]).forEach(function (c) { inline(r.appendChild(mk("td")), c); }); tbody.appendChild(r); i++;
        }
        continue;
      }
      var li = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
      if (li) {
        var list = add(/\d/.test(li[1]) ? "ol" : "ul");
        while (i < lines.length && (li = lines[i].match(/^\s*([-*+]|\d+[.)])\s+(.*)$/))) { inline(list.appendChild(mk("li")), li[2]); i++; }
        continue;
      }
      if (/^>\s?/.test(line)) {
        var q = add("blockquote"), first = true;
        while (i < lines.length && /^>\s?/.test(lines[i])) { if (!first) q.appendChild(mk("br")); inline(q, lines[i++].replace(/^>\s?/, "")); first = false; }
        continue;
      }
      var p = add("p"), f = true;
      while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|\s*\||\s*([-*+]|\d+[.)])\s+|>)/.test(lines[i])) {
        if (!f) p.appendChild(mk("br"));
        inline(p, lines[i]); f = false; i++;
      }
      if (f) { inline(p, lines[i]); i++; }
    }
  }
  // Formatted / Markdown switch (shown for Markdown results)
  function showView(v) {
    $("try-md").hidden = v !== "md"; out.hidden = v === "md";
    Array.prototype.forEach.call($("try-view").querySelectorAll("button"), function (b) { b.setAttribute("aria-selected", String(b.getAttribute("data-v") === v)); });
  }
  $("try-view").addEventListener("click", function (e) { var b = e.target.closest("button[data-v]"); if (b) showView(b.getAttribute("data-v")); });
  function resetView() { $("try-view").hidden = true; $("try-md").hidden = true; out.hidden = false; }

  // ── the workspace
  var lastFocus = null;
  function openWs(name) {
    $("ws-name").textContent = name || "";
    if (!isOpen()) { lastFocus = document.activeElement; ws.hidden = false; document.body.classList.add("ws-open"); $("ws-close").focus(); }
    placeGates();
  }
  function closeWs() {
    if (!isOpen()) return;
    ws.hidden = true; document.body.classList.remove("ws-open");
    placeGates();
    if (lastFocus && lastFocus.focus) lastFocus.focus(); else $("drop").focus();
  }
  $("ws-close").addEventListener("click", closeWs);
  $("ws-new").addEventListener("click", function () { $("try-file").click(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen()) closeWs();
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") run();
  });
  // phones: one pane at a time
  function view(which) {
    ws.classList.toggle("ws--img", which === "img"); ws.classList.toggle("ws--txt", which !== "img");
    $("ws-tab-img").setAttribute("aria-selected", String(which === "img"));
    $("ws-tab-txt").setAttribute("aria-selected", String(which !== "img"));
  }
  $("ws-tab-img").addEventListener("click", function () { view("img"); });
  $("ws-tab-txt").addEventListener("click", function () { view("txt"); });
  view("txt");
  // click the page to zoom to full size, click again to fit
  $("try-preview").addEventListener("click", function () { this.parentNode.classList.toggle("is-zoomed"); });
  // the divider: drag with mouse, touch or pen; arrow keys move it too
  (function () {
    var d = $("ws-divider"), pct = 50;
    function set(p) { pct = Math.max(20, Math.min(80, p)); split.style.setProperty("--split", pct + "%"); d.setAttribute("aria-valuenow", String(Math.round(pct))); }
    d.addEventListener("pointerdown", function (e) { d.setPointerCapture(e.pointerId); d.classList.add("is-dragging"); e.preventDefault(); });
    d.addEventListener("pointermove", function (e) {
      if (!d.hasPointerCapture(e.pointerId)) return;
      var r = split.getBoundingClientRect(); set((e.clientX - r.left) / r.width * 100);
    });
    ["pointerup", "pointercancel"].forEach(function (t) { d.addEventListener(t, function () { d.classList.remove("is-dragging"); }); });
    d.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { set(pct - 5); e.preventDefault(); }
      if (e.key === "ArrowRight") { set(pct + 5); e.preventDefault(); }
    });
    d.addEventListener("dblclick", function () { set(50); });
  })();

  // ── choosing an image: it is prepared (scaled to 2000 px, compressed) at once and reading starts right away.
  // Nothing is uploaded before that: we don't store images.
  var MAXSIDE = 2000, SMALL = 1500000, prepared = null;
  function prepare(f, dataUrl) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, scale = Math.min(1, MAXSIDE / Math.max(w, h));
        if (scale === 1 && f.size <= SMALL && f.type !== "image/gif") return resolve(f);
        var c = document.createElement("canvas");
        c.width = Math.round(w * scale); c.height = Math.round(h * scale);
        var ctx = c.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) { resolve(b && b.size < f.size ? new File([b], "page.jpg", { type: "image/jpeg" }) : f); }, "image/jpeg", 0.9);
      };
      img.onerror = function () { resolve(f); };
      img.src = dataUrl;
    });
  }
  function setFile(f, name) {
    if (!f) return;
    if (!TYPES.test(f.type)) { say(T.type, "error"); return; }
    if (f.size > MAX_IN) { say(T.size, "error"); return; }
    file = f;
    var img = $("try-preview");
    img.removeAttribute("src"); img.parentNode.classList.remove("is-zoomed");
    out.textContent = ""; out.classList.add("is-empty"); lastText = ""; resetView();
    $("try-copy").disabled = $("try-download").disabled = true;
    say("");
    openWs(name || f.name || "");
    prepared = new Promise(function (resolve) {
      var r = new FileReader();
      r.onload = function () { img.src = r.result; prepare(f, r.result).then(resolve); };
      r.onerror = function () { resolve(f); };
      r.readAsDataURL(f);
    });
    refresh();
    if (remaining === 0) { out.textContent = T.none; return; }
    if (open) run();
  }
  $("try-file").addEventListener("change", function (e) { setFile(e.target.files[0]); e.target.value = ""; });
  var drop = $("drop");
  ["dragenter", "dragover"].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add("is-over"); }); });
  ["dragleave", "drop"].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove("is-over"); }); });
  // drop an image anywhere on the page
  var dropall = $("dropall"), depth = 0;
  function hasFiles(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") >= 0; }
  document.addEventListener("dragenter", function (e) { if (hasFiles(e)) { depth++; dropall.hidden = false; } });
  document.addEventListener("dragleave", function () { if (--depth <= 0) { depth = 0; dropall.hidden = true; } });
  document.addEventListener("dragover", function (e) { if (hasFiles(e)) e.preventDefault(); });
  document.addEventListener("drop", function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault(); depth = 0; dropall.hidden = true;
    if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
  });
  document.addEventListener("paste", function (e) {
    var items = (e.clipboardData && e.clipboardData.files) || [];
    if (items[0]) { e.preventDefault(); setFile(items[0], FA ? "تصویر چسبانده‌شده" : "Pasted image"); }
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-sample]"), function (b) {
    b.addEventListener("click", function () {
      var k = b.getAttribute("data-sample"), label = b.textContent.trim();
      fetch("/assets/samples/" + k + ".png").then(function (r) { return r.blob(); })
        .then(function (blob) { setFile(new File([blob], k + ".png", { type: "image/png" }), label); })
        .catch(function () { say(T.sample, "error"); });
    });
  });

  // reads a server-sent-events response: on(event, data) for each event; resolves when the stream ends
  function readEvents(res, on) {
    var reader = res.body.getReader(), dec = new TextDecoder(), buf = "";
    function pump() {
      return reader.read().then(function (r) {
        if (r.done) return;
        buf += dec.decode(r.value, { stream: true });
        var i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          var block = buf.slice(0, i), ev = "message", data = "";
          buf = buf.slice(i + 2);
          block.split("\n").forEach(function (l) {
            if (l.indexOf("event:") === 0) ev = l.slice(6).trim();
            else if (l.indexOf("data:") === 0) data += l.slice(5).trim();
          });
          if (data) { try { on(ev, JSON.parse(data)); } catch (e) { /* ignore a malformed event */ } }
        }
        return pump();
      });
    }
    return pump();
  }

  // ── reading
  function run() {
    if (!file || busy || !open || remaining === 0) return;
    busy = true; refresh();
    view("txt");
    var fmt = document.querySelector('input[name="try-format"]:checked').value;
    $("try-run").textContent = T.reading;
    $("try-copy").disabled = $("try-download").disabled = true;
    out.textContent = ""; out.classList.add("is-empty", "is-streaming"); resetView();
    say("");
    function fail(d) {
      out.classList.remove("is-streaming");
      var code = d.error && d.error.code;
      if (d.remaining != null) showLeft(d.remaining, d.limit);
      if (code === "try_limit" || code === "capacity") showLeft(0, d.limit);
      say((code && T.codes[code]) || (!FA && d.error && d.error.message) || T.generic, "error");
    }
    function finish(d) {
      lastText = d.text || ""; lastFormat = d.format || fmt;
      out.textContent = lastText || T.notext;
      out.classList.remove("is-empty", "is-streaming");
      $("try-copy").disabled = $("try-download").disabled = !lastText;
      if (lastText && lastFormat === "markdown") { renderMd($("try-md"), lastText); $("try-view").hidden = false; showView("md"); }
      if (d.remaining != null) showLeft(d.remaining, d.limit);
    }
    (prepared || Promise.resolve(file))
      .then(function (f) {
        if (f.size > MAX) throw { tooBig: true };
        var fd = new FormData();
        fd.append("file", f);
        fd.append("format", fmt);
        fd.append("stream", "true");
        return fetch(API, { method: "POST", body: fd, credentials: "include" });
      })
      .then(function (r) {
        if ((r.headers.get("Content-Type") || "").indexOf("text/event-stream") !== 0) {
          // refused before reading (limits, bad file …): a plain JSON answer
          return r.json().catch(function () { return {}; }).then(function (d) { if (r.ok && typeof d.text === "string") finish(d); else fail(d); });
        }
        var ended = false;
        return readEvents(r, function (ev, d) {
          if (ev === "delta") {
            var atEnd = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 60;
            if (out.classList.contains("is-empty")) { out.textContent = ""; out.classList.remove("is-empty"); }
            out.textContent += d.text;
            if (atEnd) pane.scrollTop = pane.scrollHeight;
          } else if (ev === "done") { ended = true; finish(d); }
          else if (ev === "error") { ended = true; fail(d); }
        }).then(function () { if (!ended) fail({}); });
      })
      .catch(function (e) { out.classList.remove("is-streaming"); say(e && e.tooBig ? T.size : T.network, "error"); })
      .then(function () { busy = false; $("try-run").textContent = T.run; refresh(); });
  }
  $("try-run").addEventListener("click", run);

  $("try-copy").addEventListener("click", function () {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(lastText).then(function () {
      var label = $("try-copy").querySelector("span");
      label.textContent = T.copied;
      setTimeout(function () { label.textContent = T.copy; }, 1500);
    });
  });
  $("try-download").addEventListener("click", function () {
    var a = document.createElement("a");
    var md = lastFormat === "markdown";
    a.href = "data:" + (md ? "text/markdown" : "text/plain") + ";charset=utf-8," + encodeURIComponent(lastText);
    a.download = "runemic-ocr." + (md ? "md" : "txt");
    document.body.appendChild(a); a.click(); a.remove();
  });

  // how many free pages are left (and whether the tool is on)
  fetch(API, { credentials: "include" })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      open = d.open !== false;
      if (!open) say(T.paused, "error");
      showLeft(d.remaining, d.limit);
    })
    .catch(function () { /* the POST will report problems */ });
})();

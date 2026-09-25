// runemic.com/try: free image-to-text. Talks to api.runemic.com/v1/try, which counts free pages per visitor
// (a signed cookie on api.runemic.com) and per network. All text is set with textContent, never innerHTML.
(function () {
  "use strict";
  var tool = document.getElementById("tool");
  if (!tool) return;
  var API = tool.getAttribute("data-api") + "/v1/try";
  var CONSOLE = "https://console.runemic.com";
  var MAX = 4194304, TYPES = /^image\/(png|jpeg|webp|gif)$/;
  function $(id) { return document.getElementById(id); }
  var file = null, busy = false, remaining = null, open = true, lastText = "", lastFormat = "markdown";

  function say(msg, kind) { var s = $("try-status"); s.textContent = msg || ""; s.setAttribute("data-kind", kind || ""); }
  function refresh() { $("try-run").disabled = !file || busy || !open || remaining === 0; }

  function showLeft(rem, limit) {
    remaining = rem;
    var el = $("try-left");
    el.textContent = "";
    if (rem === 0) {
      el.textContent = "No free pages left today.";
      $("try-gate").hidden = false;
    } else if (rem != null) {
      el.appendChild(document.createTextNode(rem + " of " + limit + " free pages left today · "));
      var a = document.createElement("a");
      a.href = CONSOLE; a.textContent = "Sign in for $5 of free credit";
      el.appendChild(a);
    }
    refresh();
  }

  function setFile(f) {
    if (!f) return;
    if (!TYPES.test(f.type)) { say("Use a PNG, JPEG, WebP or GIF image. PDFs are coming soon.", "error"); return; }
    if (f.size > MAX) { say("That image is larger than 4 MB. Try a smaller photo or screenshot.", "error"); return; }
    file = f;
    var r = new FileReader();
    r.onload = function () { var img = $("try-preview"); img.src = r.result; img.hidden = false; $("drop-empty").hidden = true; };
    r.readAsDataURL(f);
    say("");
    refresh();
  }

  $("try-file").addEventListener("change", function (e) { setFile(e.target.files[0]); });
  var drop = $("drop");
  ["dragenter", "dragover"].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add("is-over"); }); });
  ["dragleave", "drop"].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove("is-over"); }); });
  drop.addEventListener("drop", function (e) { if (e.dataTransfer && e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); });
  document.addEventListener("paste", function (e) {
    var items = (e.clipboardData && e.clipboardData.files) || [];
    if (items[0]) { e.preventDefault(); setFile(items[0]); }
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-sample]"), function (b) {
    b.addEventListener("click", function () {
      var k = b.getAttribute("data-sample");
      fetch("/assets/samples/" + k + ".png").then(function (r) { return r.blob(); })
        .then(function (blob) { setFile(new File([blob], k + ".png", { type: "image/png" })); })
        .catch(function () { say("Couldn't load the sample. Please try again.", "error"); });
    });
  });

  function run() {
    if ($("try-run").disabled) return;
    busy = true; refresh();
    var fmt = document.querySelector('input[name="try-format"]:checked').value;
    var fd = new FormData();
    fd.append("file", file);
    fd.append("format", fmt);
    $("try-run").textContent = "Reading…";
    say("");
    fetch(API, { method: "POST", body: fd, credentials: "include" })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) {
        var d = x.d || {};
        if (d.remaining != null) showLeft(d.remaining, d.limit);
        if (x.ok && typeof d.text === "string") {
          lastText = d.text; lastFormat = d.format || fmt;
          var out = $("try-out");
          out.textContent = d.text || "(No text found in this image.)";
          out.classList.remove("is-empty");
          $("try-copy").disabled = $("try-download").disabled = !d.text;
          return;
        }
        var code = d.error && d.error.code;
        if (code === "try_limit" || code === "capacity") { $("try-gate").hidden = false; showLeft(0, d.limit); }
        say((d.error && d.error.message) || "Something went wrong. Please try again.", "error");
      })
      .catch(function () { say("Couldn't reach the server. Check your connection and try again.", "error"); })
      .then(function () { busy = false; $("try-run").textContent = "Get text"; refresh(); });
  }
  $("try-run").addEventListener("click", run);
  document.addEventListener("keydown", function (e) { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") run(); });

  $("try-copy").addEventListener("click", function () {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(lastText).then(function () {
      $("try-copy").textContent = "Copied";
      setTimeout(function () { $("try-copy").textContent = "Copy"; }, 1500);
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
      if (!open) say("The free tool is paused right now. You can still sign in to the console and use your free credit.", "error");
      showLeft(d.remaining, d.limit);
    })
    .catch(function () { /* the POST will report problems */ });
})();

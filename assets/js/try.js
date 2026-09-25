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

  // interface text (English, or Persian on /fa/ pages); error codes from the server map to local messages
  var FA = tool.getAttribute("data-lang") === "fa";
  var faDigits = function (n) { return String(n).replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[d]; }); };
  var T = FA ? {
    left: function (r, l) { return faDigits(r) + " صفحهٔ رایگان از " + faDigits(l) + " صفحهٔ امروز باقی مانده · "; },
    signin: "برای ۵ دلار اعتبار رایگان وارد شوید", none: "صفحهٔ رایگان امروز شما تمام شده است.",
    type: "لطفاً یک تصویر PNG، JPEG، WebP یا GIF انتخاب کنید. پشتیبانی از PDF به‌زودی اضافه می‌شود.",
    size: "حجم این تصویر بیشتر از ۴ مگابایت است. یک عکس یا اسکرین‌شات کوچک‌تر امتحان کنید.",
    sample: "نمونه بارگذاری نشد. دوباره تلاش کنید.", reading: "در حال خواندن…", run: "دریافت متن",
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
    type: "Use a PNG, JPEG, WebP or GIF image. PDFs are coming soon.",
    size: "That image is larger than 4 MB. Try a smaller photo or screenshot.",
    sample: "Couldn't load the sample. Please try again.", reading: "Reading…", run: "Get text",
    notext: "(No text found in this image.)", network: "Couldn't reach the server. Check your connection and try again.",
    paused: "The free tool is paused right now. You can still sign in to the console and use your free credit.",
    copied: "Copied", copy: "Copy", generic: "Something went wrong. Please try again.", codes: {}
  };

  function say(msg, kind) { var s = $("try-status"); s.textContent = msg || ""; s.setAttribute("data-kind", kind || ""); }
  function refresh() { $("try-run").disabled = !file || busy || !open || remaining === 0; }

  function showLeft(rem, limit) {
    remaining = rem;
    var el = $("try-left");
    el.textContent = "";
    if (rem === 0) {
      el.textContent = T.none;
      $("try-gate").hidden = false;
    } else if (rem != null) {
      el.appendChild(document.createTextNode(T.left(rem, limit)));
      var a = document.createElement("a");
      a.href = CONSOLE; a.textContent = T.signin;
      el.appendChild(a);
    }
    refresh();
  }

  function setFile(f) {
    if (!f) return;
    if (!TYPES.test(f.type)) { say(T.type, "error"); return; }
    if (f.size > MAX) { say(T.size, "error"); return; }
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
        .catch(function () { say(T.sample, "error"); });
    });
  });

  function run() {
    if ($("try-run").disabled) return;
    busy = true; refresh();
    var fmt = document.querySelector('input[name="try-format"]:checked').value;
    var fd = new FormData();
    fd.append("file", file);
    fd.append("format", fmt);
    $("try-run").textContent = T.reading;
    say("");
    fetch(API, { method: "POST", body: fd, credentials: "include" })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) {
        var d = x.d || {};
        if (d.remaining != null) showLeft(d.remaining, d.limit);
        if (x.ok && typeof d.text === "string") {
          lastText = d.text; lastFormat = d.format || fmt;
          var out = $("try-out");
          out.textContent = d.text || T.notext;
          out.classList.remove("is-empty");
          $("try-copy").disabled = $("try-download").disabled = !d.text;
          return;
        }
        var code = d.error && d.error.code;
        if (code === "try_limit" || code === "capacity") { $("try-gate").hidden = false; showLeft(0, d.limit); }
        say((code && T.codes[code]) || (!FA && d.error && d.error.message) || T.generic, "error");
      })
      .catch(function () { say(T.network, "error"); })
      .then(function () { busy = false; $("try-run").textContent = T.run; refresh(); });
  }
  $("try-run").addEventListener("click", run);
  document.addEventListener("keydown", function (e) { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") run(); });

  $("try-copy").addEventListener("click", function () {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(lastText).then(function () {
      $("try-copy").textContent = T.copied;
      setTimeout(function () { $("try-copy").textContent = T.copy; }, 1500);
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

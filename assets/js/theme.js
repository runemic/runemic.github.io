// Light is the default. The toggle switches to dark and remembers the choice.
// The choice is shared with console.runemic.com through a "theme" cookie on .runemic.com.
(function () {
  var root = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  function apply(theme) {
    if (theme === "dark") root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0a0a0a" : "#ffffff");
    var btn = document.querySelector(".theme-toggle");
    if (btn) btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  }
  function save(theme) {
    try { localStorage.setItem("theme", theme); } catch (err) {}
    var dom = /(^|\.)runemic\.com$/.test(location.hostname) ? "; Domain=runemic.com" : "";
    document.cookie = "theme=" + theme + "; Path=/; Max-Age=31536000; SameSite=Lax" + dom + (location.protocol === "https:" ? "; Secure" : "");
  }
  apply(root.getAttribute("data-theme") === "dark" ? "dark" : "light");
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".theme-toggle");
    if (!btn) return;
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    apply(next);
    save(next);
  });

  // Phones and tablets: the menu opens from the ☰ button as a panel under the header.
  function setNav(open) {
    var header = document.querySelector(".site-header"), btn = document.querySelector(".nav-toggle");
    if (!header || !btn) return;
    header.classList.toggle("is-open", open);
    root.classList.toggle("nav-open", open);
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "Close menu" : "Menu");
  }
  document.addEventListener("click", function (e) {
    var header = document.querySelector(".site-header");
    if (!header) return;
    if (e.target.closest(".nav-toggle")) { setNav(!header.classList.contains("is-open")); return; }
    if (header.classList.contains("is-open") && e.target.closest("#site-nav a")) setNav(false);
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setNav(false); });
  window.addEventListener("resize", function () { if (window.innerWidth > 960) setNav(false); });

  // Signed in to the console? (rk_signed_in is a non-secret hint set by console.runemic.com)
  if (/(?:^|;\s*)rk_signed_in=1/.test(document.cookie)) {
    root.classList.add("is-signed-in");
    var links = document.querySelectorAll("[data-in]");
    for (var i = 0; i < links.length; i++) {
      var a = links[i], label = a.getAttribute("data-in");
      for (var n = a.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3 && n.nodeValue.trim()) { n.nodeValue = label + (a.querySelector(".arrow") ? " " : ""); break; }
      }
    }
  }
})();

// Docs sidebar: marks the section you are reading (aria-current): the last section whose top has passed the
// header. At the very bottom of the page the last section wins.
(function () {
  var links = [].slice.call(document.querySelectorAll('.docs-toc a[href^="#"]'));
  var secs = links.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); });
  if (!links.length) return;
  var ticking = false;
  function update() {
    ticking = false;
    var cur = 0;
    for (var i = 0; i < secs.length; i++) if (secs[i] && secs[i].getBoundingClientRect().top <= 120) cur = i;
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) cur = secs.length - 1;
    links.forEach(function (a, i) { if (i === cur) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
  }
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener("hashchange", function () { setTimeout(update, 50); });
  update();
})();

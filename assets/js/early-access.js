// Early-access form → api.runemic.com/v1/waitlist (Runemic platform Worker: origin check, per-IP rate limit,
// 8 KB body cap, daily cap, honeypot). Falls back to email if the request fails.
(function () {
  var ENDPOINT = "https://api.runemic.com/v1/waitlist";
  var FALLBACK_EMAIL = "hello@runemic.com";

  var form = document.getElementById("early-access");
  if (!form) return;
  var status = form.querySelector(".form__status");
  var button = form.querySelector('button[type="submit"]');

  var want = new URLSearchParams(location.search).get("interest");
  // compare values instead of building a CSS selector from the URL (a crafted ?interest= could break the page)
  for (var i = 0; want && i < form.interest.options.length; i++) if (form.interest.options[i].value === want) form.interest.value = want;

  function say(msg, kind) { status.textContent = msg; status.dataset.kind = kind || ""; }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = form.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { say("Please enter a valid email address.", "error"); form.email.focus(); return; }
    var data = {
      email: email, name: form.name.value, interest: form.interest.value, scripts: form.scripts.value,
      use_case: form.use_case.value, source_page: location.pathname, website: form.website.value
    };

    function viaEmail() {
      var body = "Interest: " + data.interest + "\nLanguages/scripts: " + data.scripts + "\n\n" + data.use_case + "\n\n" + data.name;
      location.href = "mailto:" + FALLBACK_EMAIL + "?subject=" + encodeURIComponent("Early access") + "&body=" + encodeURIComponent(body);
    }
    if (!ENDPOINT) { viaEmail(); return; }

    button.disabled = true; say("Sending…");
    fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok) { form.reset(); say("Thank you, you're on the list. We'll be in touch.", "ok"); }
        else say(res.j.error === "invalid_email" ? "Please enter a valid email address." : res.j.error === "too_many_requests" ? "Too many attempts. Please wait a minute and try again." : "Something went wrong. Please try again, or email " + FALLBACK_EMAIL + ".", "error");
      })
      .catch(function () { say("Opening your email app instead…"); viaEmail(); })
      .then(function () { button.disabled = false; });
  });
})();

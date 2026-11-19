(function () {
  // Cloudflare's always-pass test key. Replace with the production site key once D2 creates the widget.
  var TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
  var PROD_REF = "dlzufbixuxbknhgicevn";
  var DEV_REF = "flkozmvwkxxphuuyyuxl";
  var R2 = "https://pub-e43b58b2016b405091092e415cbbb889.r2.dev/releases/stable";
  var FALLBACK = {
    version: "",
    mac: { url: R2 + "/osx/Exomudra.Desktop-osx-Setup.pkg" },
    win: { url: R2 + "/win/Exomudra.Desktop-win-Setup.exe" },
  };

  var params = new URLSearchParams(location.search);
  var isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  var ref = isLocal && params.get("env") === "dev" ? DEV_REF : PROD_REF;
  var endpoint = "https://" + ref + ".supabase.co/functions/v1/request-download";
  var override = params.get("fn");
  if (isLocal && override) endpoint = override;
  var source = (params.get("src") || "site").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32) || "site";

  var ua = navigator.userAgent || "";
  var os = /Windows/i.test(ua) ? "win" : /Mac/i.test(ua) && !/iPhone|iPad/i.test(ua) ? "mac" : "";

  var form = document.getElementById("dl-form");
  var input = document.getElementById("dl-email");
  var optin = document.getElementById("dl-optin");
  var btn = document.getElementById("dl-submit");
  var btnSpan = btn.querySelector("span");
  var msg = document.getElementById("dl-msg");
  var result = document.getElementById("dl-result");
  var linksEl = document.getElementById("dl-links");
  var metaEl = document.getElementById("dl-meta");
  var noteEl = document.getElementById("dl-email-note");
  var widgetId = null;
  var token = "";

  function say(text, isErr) {
    msg.textContent = text;
    msg.className = "dl-msg" + (isErr ? " err" : "");
  }

  function mb(n) {
    return Math.round(n / 1e6) + " MB";
  }

  function mountWidget() {
    if (widgetId !== null || !window.turnstile) return;
    widgetId = window.turnstile.render("#dl-turnstile", {
      sitekey: TURNSTILE_SITE_KEY,
      callback: function (t) { token = t; },
      "expired-callback": function () { token = ""; },
      "error-callback": function () { token = ""; },
    });
  }
  window.exoTurnstileReady = mountWidget;
  if (window.turnstile) mountWidget();

  function copyLink(url, button) {
    function ok() {
      button.textContent = "Copied";
      setTimeout(function () { button.textContent = "Copy link"; }, 2000);
    }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = url;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var done = false;
      try { done = document.execCommand("copy"); } catch (e) { done = false; }
      document.body.removeChild(ta);
      if (done) ok();
      else window.prompt("Copy this link", url);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(ok, fallback);
    } else {
      fallback();
    }
  }

  function showLinks(links, emailStatus) {
    var rows = [
      { key: "mac", label: "Download for macOS (M1 or later)", ext: ".pkg" },
      { key: "win", label: "Download for Windows", ext: ".exe" },
    ];
    if (os === "win") rows.reverse();
    linksEl.textContent = "";
    var sizes = [];
    rows.forEach(function (r, i) {
      var item = links[r.key];
      if (!item || !item.url) return;
      var row = document.createElement("div");
      row.className = "dl-row";
      var a = document.createElement("a");
      a.href = item.url;
      a.className = "btn-dl" + (i === 0 && os ? " is-first" : "") + (i === 1 ? " alt" : "");
      a.rel = "noopener";
      var s = document.createElement("span");
      s.textContent = r.label;
      a.appendChild(s);
      var cp = document.createElement("button");
      cp.type = "button";
      cp.className = "dl-copy";
      cp.textContent = "Copy link";
      cp.addEventListener("click", function () { copyLink(item.url, cp); });
      row.appendChild(a);
      row.appendChild(cp);
      linksEl.appendChild(row);
      if (item.bytes) sizes.push((r.key === "mac" ? "macOS " : "Windows ") + r.ext + " " + mb(item.bytes));
    });
    var meta = [];
    if (links.version) meta.push("Version " + links.version);
    if (sizes.length) meta.push(sizes.join(" / "));
    metaEl.textContent = meta.join(" · ");
    if (emailStatus === "sent") noteEl.textContent = "We've emailed the link too.";
    else if (emailStatus === "queued") noteEl.textContent = "Our email is busy today, so it may take a few days. Use the link above now, or copy it to send to yourself.";
    else noteEl.textContent = "";
    result.hidden = false;
  }

  function resetForm() {
    btn.disabled = false;
    input.disabled = false;
    optin.disabled = false;
    btnSpan.textContent = "Send me the link";
    if (window.turnstile && widgetId !== null) {
      token = "";
      window.turnstile.reset(widgetId);
    }
  }

  var ERRORS = {
    bad_email: "That email address doesn't look right.",
    bad_request: "Something was missing. Please try again.",
    captcha: "The check didn't pass. Please try it again.",
    too_many: "Too many requests. The links are below, or try again later.",
    closed: "Email delivery is closed right now. The links are below.",
  };

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = input.value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
      say("Please enter a valid email address.", true);
      return;
    }
    btn.disabled = true;
    input.disabled = true;
    optin.disabled = true;
    btnSpan.textContent = "Sending…";
    say("", false);
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email,
        turnstileToken: token || "",
        marketingOptIn: optin.checked,
        consentTextVersion: "download-1.0",
        source: source,
      }),
    })
      .then(function (res) {
        return res.json().then(
          function (j) { return { status: res.status, body: j || {} }; },
          function () { return { status: res.status, body: {} }; }
        );
      })
      .then(function (r) {
        var b = r.body;
        var links = b.links && b.links.mac && b.links.win ? b.links : FALLBACK;
        showLinks(links, r.status === 200 ? b.emailStatus : "");
        if (r.status === 200) {
          say("", false);
        } else {
          say(ERRORS[b.error] || "We couldn't send the email. The links are below.", true);
        }
        resetForm();
      })
      .catch(function () {
        showLinks(FALLBACK, "");
        say("We couldn't reach the server, so no email was sent. The links are below.", true);
        resetForm();
      });
  });
})();

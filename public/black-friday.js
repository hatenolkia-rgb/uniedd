/*
 * UniEDD Black Friday 2026 — drop-in offer script
 * ------------------------------------------------
 * Adds:
 *   1. A top bar on every page (with live countdown)
 *   2. A hero banner on the home page
 *   3. An offer block at the top of /games, /pricing and /practice
 *   4. (Optional) real prices instead of "Fees on request" on /pricing
 * Everything disappears automatically after the offer ends.
 *
 * Loaded on every page by app/layout.tsx (<Script src="/black-friday.js">).
 * To preview before the start date, add ?bf=preview to any page address.
 *
 * EDIT ONLY THE CONFIG BELOW.
 */
(function () {
  "use strict";

  /* ======================= CONFIG ======================= */
  var CONFIG = {
    // The offer, as parents will read it. Edit after you decide with Pius Sir.
    offerShort: "20% off your first month",           // used in the top bar
    offerLong: "20% off your first month + unlimited AI Practice Coach",
    earlyBird: "Enrol by 27 Nov and get 2 extra classes free",

    // Offer window (India time)
    start: "2026-11-20T00:00:00+05:30",
    end: "2026-11-30T23:59:59+05:30",

    // Set to true to show the banners to everyone before the start date.
    // Leave false and use ?bf=preview to check them yourself.
    previewBeforeStart: false,

    // Links
    demoLink: "/#contact",
    gamesLink: "/games",
    practiceLink: "/practice",

    // Real prices on /pricing (in plan order: Foundation, Performance, Elite).
    // Leave as null to keep "Fees on request".
    // Example: { was: "₹4,000/month", now: "₹3,200/month" }
    prices: [null, null, null]
  };
  /* ===================== END CONFIG ===================== */

  var C = {
    blue: "#1F5BB9", orange: "#F0801D", navy: "#14284A",
    cream: "#FFF7EC", peach: "#FFE2C0", sky: "#DEE9FF", grey: "#82858A"
  };

  var startMs = Date.parse(CONFIG.start);
  var endMs = Date.parse(CONFIG.end);
  function now() { return Date.now(); }
  function isLive() {
    var t = now();
    if (t > endMs) return false;
    return CONFIG.previewBeforeStart || /[?&]bf=preview\b/.test(location.search) || t >= startMs;
  }
  if (!isLive()) return;

  /* ---------- styles ---------- */
  var css = [
    ".bf-bar{position:relative;z-index:9999;background:" + C.navy + ";color:#fff;font:600 14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:center;padding:9px 44px 9px 12px}",
    ".bf-bar a{color:" + C.orange + ";text-decoration:underline;margin-left:8px;white-space:nowrap}",
    ".bf-bar .bf-tag{background:" + C.orange + ";color:#fff;border-radius:4px;padding:2px 7px;margin-right:8px;font-size:12px;letter-spacing:.04em}",
    ".bf-bar .bf-cd{opacity:.85;margin-left:8px;font-variant-numeric:tabular-nums}",
    ".bf-x{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:0;color:#fff;font-size:20px;cursor:pointer;line-height:1}",
    ".bf-card{box-sizing:border-box;max-width:1120px;margin:24px auto;padding:28px 32px;border-radius:20px;background:" + C.cream + ";background-image:radial-gradient(circle at 92% 18%," + C.peach + " 0 120px,transparent 121px),radial-gradient(circle at 6% 92%," + C.sky + " 0 110px,transparent 111px);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:" + C.navy + ";display:flex;gap:24px;align-items:center;justify-content:space-between;flex-wrap:wrap;border:1px solid #f3e3cc}",
    ".bf-eyebrow{color:" + C.orange + ";font-weight:700;font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px}",
    ".bf-h{font-size:clamp(22px,3.2vw,34px);font-weight:800;line-height:1.15;margin:0 0 10px}",
    ".bf-h em{font-family:Georgia,'Times New Roman',serif;color:" + C.blue + ";font-weight:700}",
    ".bf-p{font-size:16px;margin:0 0 6px;color:" + C.navy + "}",
    ".bf-small{font-size:14px;color:" + C.grey + ";margin:0}",
    ".bf-btns{display:flex;gap:12px;flex-wrap:wrap}",
    ".bf-btn{display:inline-block;padding:13px 22px;border-radius:999px;font-weight:700;font-size:15px;text-decoration:none;white-space:nowrap}",
    ".bf-btn-o{background:" + C.orange + ";color:#fff}",
    ".bf-btn-b{background:#fff;color:" + C.blue + ";border:2px solid " + C.blue + "}",
    ".bf-timer{display:flex;gap:8px;margin-top:12px}",
    ".bf-timer span{background:" + C.blue + ";color:#fff;border-radius:8px;padding:6px 10px;font-weight:700;font-variant-numeric:tabular-nums;font-size:14px}",
    ".bf-was{text-decoration:line-through;color:" + C.grey + ";font-size:.8em;margin-right:6px}",
    ".bf-now{color:" + C.orange + ";font-weight:800}",
    "@media(max-width:640px){.bf-card{margin:16px 12px;padding:22px 18px}.bf-btn{flex:1;text-align:center}}"
  ].join("");
  var style = document.createElement("style");
  style.id = "bf-style";
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------- countdown ---------- */
  function parts() {
    var ms = Math.max(0, endMs - now());
    var d = Math.floor(ms / 864e5);
    var h = Math.floor((ms % 864e5) / 36e5);
    var m = Math.floor((ms % 36e5) / 6e4);
    var s = Math.floor((ms % 6e4) / 1e3);
    return { d: d, h: h, m: m, s: s };
  }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function tick() {
    if (now() > endMs) { removeAll(); return; }
    var p = parts();
    var txt = p.d + "d " + pad(p.h) + "h " + pad(p.m) + "m";
    document.querySelectorAll(".bf-cd").forEach(function (el) { el.textContent = "Ends in " + txt; });
    document.querySelectorAll(".bf-timer").forEach(function (el) {
      el.innerHTML = "<span>" + p.d + " days</span><span>" + pad(p.h) + " hrs</span><span>" + pad(p.m) + " min</span><span>" + pad(p.s) + " sec</span>";
    });
  }

  /* ---------- top bar (every page) ---------- */
  function addBar() {
    if (document.getElementById("bf-bar")) return;
    try { if (sessionStorage.getItem("bf-bar-closed") === "1") return; } catch (e) {}
    var bar = document.createElement("div");
    bar.id = "bf-bar";
    bar.className = "bf-bar";
    bar.innerHTML =
      '<span class="bf-tag">BLACK FRIDAY</span>' + CONFIG.offerShort + " on live classes" +
      '<span class="bf-cd"></span>' +
      '<a href="' + CONFIG.demoLink + '">Book free demo</a>' +
      '<button class="bf-x" aria-label="Close">×</button>';
    bar.querySelector(".bf-x").onclick = function () {
      bar.remove();
      try { sessionStorage.setItem("bf-bar-closed", "1"); } catch (e) {}
    };
    document.body.insertBefore(bar, document.body.firstChild);
  }

  /* ---------- offer card (home / games / pricing) ---------- */
  function card(id, eyebrow, headline, line, buttons) {
    var el = document.createElement("section");
    el.id = id;
    el.className = "bf-card";
    el.innerHTML =
      "<div>" +
      '<p class="bf-eyebrow">♪ ' + eyebrow + "</p>" +
      '<h2 class="bf-h">' + headline + "</h2>" +
      '<p class="bf-p">' + line + "</p>" +
      '<p class="bf-small">' + CONFIG.earlyBird + ". Offer ends 30 Nov.</p>" +
      '<div class="bf-timer"></div>' +
      "</div>" +
      '<div class="bf-btns">' + buttons + "</div>";
    return el;
  }
  function btn(href, label, orange) {
    return '<a class="bf-btn ' + (orange ? "bf-btn-o" : "bf-btn-b") + '" href="' + href + '">' + label + "</a>";
  }

  function mountPoint() {
    var main = document.querySelector("main");
    if (!main) return null;
    // Skip any breadcrumb / top strip and place the card before the first real section
    return main;
  }

  function addPageCard() {
    var path = location.pathname.replace(/\/+$/, "") || "/";
    var main = mountPoint();
    if (!main) return;
    var el = null;

    if (path === "/") {
      if (document.getElementById("bf-home")) return;
      el = card(
        "bf-home",
        "Black Friday · Parents, don't miss this",
        "Free music games for your child. <em>Best price</em> of the year on live classes.",
        CONFIG.offerLong + ".",
        btn(CONFIG.gamesLink, "Play free games", false) + btn(CONFIG.demoLink, "Book free demo", true)
      );
    } else if (path === "/games") {
      if (document.getElementById("bf-games")) return;
      el = card(
        "bf-games",
        "Black Friday offer",
        "Loved the games? Let a <em>real teacher</em> take it further.",
        "Free 30-min live demo + " + CONFIG.offerLong + ".",
        btn(CONFIG.demoLink, "Book free demo", true)
      );
    } else if (path === "/pricing") {
      if (document.getElementById("bf-pricing")) return;
      el = card(
        "bf-pricing",
        "Black Friday pricing",
        "Our <em>best price</em> of the year ends 30 Nov.",
        CONFIG.offerLong + ".",
        btn(CONFIG.demoLink, "Book free demo", true)
      );
      setPrices();
    } else if (path === "/practice") {
      if (document.getElementById("bf-practice")) return;
      el = card(
        "bf-practice",
        "Black Friday bonus",
        "Enrol now and get <em>unlimited</em> AI Practice Coach.",
        "Visitors get 3 free tries. Students practise as much as they like.",
        btn(CONFIG.demoLink, "Book free demo", true)
      );
    }
    if (!el) return;

    // Insert after the breadcrumb if there is one, otherwise at the top of <main>
    var crumb = main.querySelector("nav[aria-label*='readcrumb'], .breadcrumb, [class*='breadcrumb']");
    if (crumb && crumb.parentNode) crumb.parentNode.insertBefore(el, crumb.nextSibling);
    else main.insertBefore(el, main.firstChild);
    tick();
  }

  /* ---------- real prices on /pricing ---------- */
  function setPrices() {
    if (!CONFIG.prices.some(Boolean)) return;
    var nodes = [];
    var walker = document.createTreeWalker(document.querySelector("main") || document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (/Fees on request/i.test(walker.currentNode.nodeValue)) nodes.push(walker.currentNode);
    }
    nodes.forEach(function (n, i) {
      var p = CONFIG.prices[i];
      if (!p || !n.parentNode || n.parentNode.dataset.bfDone) return;
      n.parentNode.dataset.bfDone = "1";
      n.parentNode.innerHTML = '<span class="bf-was">' + p.was + '</span><span class="bf-now">' + p.now + "</span>";
    });
  }

  /* ---------- cleanup ---------- */
  function removeAll() {
    ["bf-bar", "bf-home", "bf-games", "bf-pricing", "bf-practice", "bf-style"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.remove();
    });
    clearInterval(timer);
    if (observer) observer.disconnect();
  }

  /* ---------- run (works with React / SPA route changes) ---------- */
  function run() { addBar(); addPageCard(); }
  var timer = setInterval(tick, 1000);
  var lastPath = location.pathname;
  var observer = new MutationObserver(function () {
    if (location.pathname !== lastPath) lastPath = location.pathname;
    run();
  });

  function boot() {
    run();
    tick();
    observer.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

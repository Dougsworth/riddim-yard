/* Riddim Yard. Selector deck, clash meter, poster type and the yard map. */
(function () {
  "use strict";

  var doc = document.documentElement;
  doc.classList.add("js");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------- */
  /* hand painted letters: every character sits a little off the line */
  /* ---------------------------------------------------------------- */
  function seeded(seed) {
    return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  }
  Array.prototype.forEach.call(document.querySelectorAll("[data-jitter]"), function (el, n) {
    var rnd = seeded(17 + n * 31);
    var lines = el.innerHTML.split(/<br\s*\/?>/i);
    var label = el.textContent.replace(/\s+/g, " ").trim();
    var out = lines.map(function (line, li) {
      var tmp = document.createElement("div"); tmp.innerHTML = line;
      var text = tmp.textContent;
      var html = "";
      for (var i = 0; i < text.length; i++) {
        var c = text[i];
        if (c === " ") { html += '</span> <span class="wd">'; continue; }
        var rot = ((rnd() - .5) * 5).toFixed(2), dy = ((rnd() - .5) * .05).toFixed(3), dx = ((rnd() - .5) * .02).toFixed(3);
        html += '<span class="ch" style="--rot:' + rot + 'deg;--dy:' + dy + 'em;--dx:' + dx + 'em">' + c + "</span>";
      }
      return '<span class="w' + (li + 1) + '"><span class="wd">' + html + "</span></span>";
    }).join("<br>");
    el.setAttribute("aria-label", label);
    el.innerHTML = '<span aria-hidden="true">' + out + "</span>";
  });

  /* flyers slap onto the wall as they scroll in */
  var slaps = document.querySelectorAll(".slap");
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.style.transitionDelay = (Math.random() * .18).toFixed(2) + "s"; e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: .25, rootMargin: "0px 0px -8% 0px" });
    Array.prototype.forEach.call(slaps, function (s) { io.observe(s); });
  } else {
    Array.prototype.forEach.call(slaps, function (s) { s.classList.add("in"); });
  }

  /* mobile menu */
  var menuBtn = document.querySelector(".menu-btn"), nav = document.getElementById("nav");
  if (menuBtn && nav) {
    menuBtn.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", open);
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") { nav.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); }
    });
  }

  /* ---------------------------------------------------------------- */
  /* the selector: a one drop riddim rendered once, played like vinyl  */
  /* ---------------------------------------------------------------- */
  var BPM = 76, BEAT = 60 / BPM, STEP = BEAT / 4, BARS = 4, LOOP = BEAT * 4 * BARS;
  var AC = window.AudioContext || window.webkitAudioContext;
  var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;

  var ctx = null, master, comp, analyser, stemGain = {}, buffers = null, sources = [], dir = 1;
  var rate = 0, targetRate = 0, pos = 0, motor = false, dragging = false, scratchNoise = null, scratchBand, scratchGain;
  var freq = null, energy = 0;

  function midi(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function noiseBuffer(c, secs) {
    var b = c.createBuffer(1, Math.floor(c.sampleRate * secs), c.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  /* drums: kick and rim together on beat three, that is the one drop */
  function renderDrums(c) {
    var out = c.createGain(); out.connect(c.destination);
    var nb = noiseBuffer(c, 1);
    function kick(t) {
      var o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + .16);
      g.gain.setValueAtTime(1.0, t); g.gain.exponentialRampToValueAtTime(.001, t + .55);
      o.connect(g).connect(out); o.start(t); o.stop(t + .6);
    }
    function rim(t, v) {
      var n = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
      n.buffer = nb; bp.type = "bandpass"; bp.frequency.value = 1900; bp.Q.value = 2.5;
      g.gain.setValueAtTime(.7 * v, t); g.gain.exponentialRampToValueAtTime(.001, t + .09);
      n.connect(bp).connect(g).connect(out); n.start(t); n.stop(t + .1);
      var o = c.createOscillator(), og = c.createGain();
      o.type = "triangle"; o.frequency.value = 820;
      og.gain.setValueAtTime(.35 * v, t); og.gain.exponentialRampToValueAtTime(.001, t + .04);
      o.connect(og).connect(out); o.start(t); o.stop(t + .05);
    }
    function hat(t, v, open) {
      var n = c.createBufferSource(), hp = c.createBiquadFilter(), g = c.createGain();
      n.buffer = nb; hp.type = "highpass"; hp.frequency.value = 7200;
      var len = open ? .22 : .045;
      g.gain.setValueAtTime(.22 * v, t); g.gain.exponentialRampToValueAtTime(.001, t + len);
      n.connect(hp).connect(g).connect(out); n.start(t, Math.random() * .5); n.stop(t + len + .01);
    }
    for (var bar = 0; bar < BARS; bar++) {
      var b0 = bar * BEAT * 4;
      kick(b0 + 8 * STEP); rim(b0 + 8 * STEP, 1);
      if (bar === BARS - 1) { rim(b0 + 14 * STEP, .5); rim(b0 + 15 * STEP, .7); }
      for (var s = 0; s < 16; s += 2) {
        var swing = (s % 4 === 2) ? STEP * .18 : 0;
        hat(b0 + s * STEP + swing, s % 4 === 0 ? .7 : 1, s === 14 && bar % 2 === 1);
      }
      hat(b0 + 7 * STEP, .35); hat(b0 + 11 * STEP, .35);
    }
  }

  /* bass: leaves beat one empty, walks round the root */
  var ROOTS = [45, 45, 50, 52]; /* A, A, D, E */
  function renderBass(c) {
    var lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420; lp.Q.value = .7;
    var out = c.createGain(); out.gain.value = .95; lp.connect(out).connect(c.destination);
    var PAT = [[2, 0, 2], [4, 3, 2], [6, 7, 3], [10, 0, 2], [12, -2, 1], [13, 0, 1], [14, 3, 2]];
    for (var bar = 0; bar < BARS; bar++) {
      var b0 = bar * BEAT * 4, root = ROOTS[bar];
      PAT.forEach(function (p) {
        var t = b0 + p[0] * STEP, len = p[2] * STEP * .92, f = midi(root + p[1] - 12);
        [["sine", 1], ["triangle", .35]].forEach(function (w) {
          var o = c.createOscillator(), g = c.createGain();
          o.type = w[0]; o.frequency.value = f;
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.55 * w[1], t + .012);
          g.gain.setValueAtTime(.55 * w[1], t + len * .7); g.gain.exponentialRampToValueAtTime(.001, t + len);
          o.connect(g).connect(lp); o.start(t); o.stop(t + len + .02);
        });
      });
    }
  }

  /* skank: short chord chops on the and of every beat, plus an organ bubble */
  function renderSkank(c) {
    var bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1300; bp.Q.value = .8;
    var out = c.createGain(); out.gain.value = .5; bp.connect(out).connect(c.destination);
    var org = c.createBiquadFilter(); org.type = "lowpass"; org.frequency.value = 1600;
    var orgOut = c.createGain(); orgOut.gain.value = .14; org.connect(orgOut).connect(c.destination);
    var CH = { 45: [0, 3, 7], 50: [0, 3, 7], 52: [0, 3, 7] };
    for (var bar = 0; bar < BARS; bar++) {
      var b0 = bar * BEAT * 4, root = ROOTS[bar] + 12;
      [2, 6, 10, 14].forEach(function (s) {
        var t = b0 + s * STEP;
        CH[ROOTS[bar]].forEach(function (iv) {
          var o = c.createOscillator(), g = c.createGain();
          o.type = "square"; o.frequency.value = midi(root + 12 + iv);
          g.gain.setValueAtTime(.0, t); g.gain.linearRampToValueAtTime(.12, t + .004); g.gain.exponentialRampToValueAtTime(.001, t + .11);
          o.connect(g).connect(bp); o.start(t); o.stop(t + .12);
        });
      });
      [1, 3, 5, 7, 9, 11, 13, 15].forEach(function (s, i) {
        var t = b0 + s * STEP, note = root + (i % 2 ? 7 : 3);
        var o = c.createOscillator(), g = c.createGain();
        o.type = "sawtooth"; o.frequency.value = midi(note);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.5, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + STEP * .9);
        o.connect(g).connect(org); o.start(t); o.stop(t + STEP);
      });
    }
  }

  function render(fn) {
    var oc = new OAC(1, Math.ceil(44100 * LOOP), 44100);
    fn(oc);
    return oc.startRendering ? new Promise(function (res) {
      var p = oc.startRendering();
      if (p && p.then) p.then(res); else oc.oncomplete = function (e) { res(e.renderedBuffer); };
    }) : Promise.reject();
  }
  function reversed(buf) {
    var r = ctx.createBuffer(1, buf.length, buf.sampleRate), s = buf.getChannelData(0), d = r.getChannelData(0), n = s.length;
    for (var i = 0; i < n; i++) d[i] = s[n - 1 - i];
    return r;
  }

  var ready = null;
  function boot() {
    if (ready) return ready;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = .85;
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    analyser = ctx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = .72;
    freq = new Uint8Array(analyser.frequencyBinCount);
    master.connect(comp).connect(analyser).connect(ctx.destination);
    ["drums", "bass", "skank"].forEach(function (k) { stemGain[k] = ctx.createGain(); stemGain[k].connect(master); });
    setBass(+bassFader.value / 100);

    /* vinyl friction while scratching */
    scratchNoise = ctx.createBufferSource(); scratchNoise.buffer = noiseBuffer(ctx, 2); scratchNoise.loop = true;
    scratchBand = ctx.createBiquadFilter(); scratchBand.type = "bandpass"; scratchBand.Q.value = 3; scratchBand.frequency.value = 600;
    scratchGain = ctx.createGain(); scratchGain.gain.value = 0;
    scratchNoise.connect(scratchBand).connect(scratchGain).connect(master); scratchNoise.start();

    status("Cutting the dub plate...");
    ready = Promise.all([render(renderDrums), render(renderBass), render(renderSkank)]).then(function (b) {
      buffers = { drums: [b[0], reversed(b[0])], bass: [b[1], reversed(b[1])], skank: [b[2], reversed(b[2])] };
      startSources(1);
      status("Riddim loaded. Drag the record to scratch it.");
    });
    return ready;
  }

  function startSources(d) {
    sources.forEach(function (s) { try { s.stop(); } catch (e) {} });
    sources = [];
    dir = d;
    var off = d > 0 ? pos : LOOP - pos;
    off = ((off % LOOP) + LOOP) % LOOP;
    Object.keys(buffers).forEach(function (k) {
      var s = ctx.createBufferSource();
      s.buffer = buffers[k][d > 0 ? 0 : 1]; s.loop = true;
      s.playbackRate.value = Math.max(.0001, Math.abs(rate));
      s.connect(stemGain[k]); s.start(0, off);
      sources.push(s);
    });
  }

  /* fader: pull it down and the bass drops out, the way selectors do it */
  var bassFader = document.getElementById("bass");
  function setBass(v) {
    if (!ctx) return;
    var t = ctx.currentTime;
    stemGain.bass.gain.setTargetAtTime(Math.pow(v, 1.6), t, .015);
  }
  bassFader.addEventListener("input", function () {
    var v = +bassFader.value / 100;
    setBass(v);
    bassFader.setAttribute("aria-valuetext", v < .05 ? "Bass cut" : Math.round(v * 100) + " percent");
  });

  /* air horn: three short blasts and a long one that sags at the end */
  function horn() {
    var go = function () {
      var t0 = ctx.currentTime + .02, blasts = [[0, .12], [.17, .12], [.34, .12], [.52, .85]];
      var shaper = ctx.createWaveShaper(), curve = new Float32Array(1024);
      for (var i = 0; i < 1024; i++) { var x = i / 512 - 1; curve[i] = Math.tanh(x * 3); }
      shaper.curve = curve;
      var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1500; bp.Q.value = .9;
      var g = ctx.createGain(); g.gain.value = 0;
      shaper.connect(bp).connect(g).connect(master);
      blasts.forEach(function (b) {
        var t = t0 + b[0];
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.42, t + .015);
        g.gain.setValueAtTime(.42, t + b[1] - .03); g.gain.linearRampToValueAtTime(0, t + b[1]);
      });
      [0, 7, -9, 12].forEach(function (cents, i) {
        var o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(i === 3 ? 932 : 466, t0);
        o.detune.value = cents;
        var lastStart = t0 + .52;
        o.frequency.setValueAtTime(i === 3 ? 932 : 466, lastStart + .5);
        o.frequency.linearRampToValueAtTime(i === 3 ? 760 : 380, lastStart + .85);
        o.connect(shaper); o.start(t0); o.stop(t0 + 1.45);
      });
    };
    ensure().then(go);
    var hb = document.getElementById("horn");
    hb.classList.remove("blow"); void hb.offsetWidth; hb.classList.add("blow");
    kickVisual(1);
  }

  function ensure() {
    if (!AC || !OAC) { status("This browser cannot make sound, but you can still spin the record."); return Promise.reject(); }
    boot();
    if (ctx.state === "suspended") ctx.resume();
    return ready;
  }

  var deckStatus = document.getElementById("deck-status");
  function status(t) { if (deckStatus) deckStatus.textContent = t; }

  /* ---------- the record itself ---------- */
  var record = document.getElementById("record"), playBtn = document.getElementById("play");
  var plinth = document.querySelector(".plinth"), arm = document.querySelector(".arm");
  var angle = 0, lastAngle = 0, lastT = 0, dragVel = 0, RPM_DEG = 200; /* 33 and a third rpm */

  function setMotor(on) {
    motor = on;
    playBtn.setAttribute("aria-pressed", on);
    playBtn.querySelector("use").setAttribute("href", on ? "#i-stop" : "#i-play");
    playBtn.querySelector("span").textContent = on ? "Stop the riddim" : "Drop the riddim";
    plinth.style.setProperty("--arm", on ? "14deg" : "-8deg");
    if (arm) arm.style.setProperty("--arm", on ? "14deg" : "-8deg");
    if (!dragging) targetRate = on ? 1 : 0;
    record.setAttribute("aria-valuetext", on ? "Playing" : "Stopped");
  }
  playBtn.addEventListener("click", function () {
    var on = !motor;
    if (on) ensure().then(function () { setMotor(true); }, function () { setMotor(true); });
    else setMotor(false);
  });
  document.getElementById("horn").addEventListener("click", horn);

  function centre() { var r = record.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }
  function pAngle(e) { var c = centre(); return Math.atan2(e.clientY - c[1], e.clientX - c[0]) * 180 / Math.PI; }

  record.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    record.setPointerCapture(e.pointerId);
    dragging = true; dragVel = 0;
    lastAngle = pAngle(e); lastT = performance.now();
    ensure().catch(function () {});
  });
  record.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    var a = pAngle(e), now = performance.now();
    var d = a - lastAngle; if (d > 180) d -= 360; if (d < -180) d += 360;
    var dt = Math.max(1, now - lastT) / 1000;
    angle += d;
    dragVel = dragVel * .5 + (d / dt / RPM_DEG) * .5; /* in units of normal speed */
    lastAngle = a; lastT = now;
  });
  function release() { if (!dragging) return; dragging = false; targetRate = motor ? 1 : 0; }
  record.addEventListener("pointerup", release);
  record.addEventListener("pointercancel", release);

  /* keyboard: arrows give the record a push either way */
  var nudge = 0;
  record.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      ensure().catch(function () {});
      nudge = (e.key === "ArrowLeft" || e.key === "ArrowDown") ? -2.6 : 2.6;
    }
  });
  document.addEventListener("keydown", function (e) {
    var tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || e.metaKey || e.ctrlKey || e.altKey) return;
    var inDeck = e.target.closest && e.target.closest(".deck");
    if (e.key === " " && e.target === record) { e.preventDefault(); playBtn.click(); }
    if ((e.key === "h" || e.key === "H") && (inDeck || e.target === document.body)) horn();
  });

  /* ---------- the halftone level strip ---------- */
  var cv = document.getElementById("dots"), g2 = cv.getContext("2d");
  function sizeCanvas() {
    var r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
  }
  sizeCanvas(); window.addEventListener("resize", sizeCanvas);

  var idlePhase = 0;
  function drawDots() {
    var w = cv.width, h = cv.height, cols = Math.max(12, Math.floor(w / (h / 3.2))), rows = 3;
    g2.clearRect(0, 0, w, h);
    var cw = w / cols, ch = h / rows;
    for (var i = 0; i < cols; i++) {
      var v;
      if (freq && (rate > .02 || energy > .02)) {
        var bin = Math.floor(Math.pow(i / cols, 1.6) * (freq.length * .7));
        v = freq[bin] / 255;
      } else {
        v = .08 + .06 * Math.sin(idlePhase + i * .5);
      }
      for (var j = 0; j < rows; j++) {
        var lvl = Math.max(0, Math.min(1, v * 1.25 - (rows - 1 - j) * .22));
        var r = Math.max(.6, lvl * Math.min(cw, ch) * .48);
        g2.fillStyle = j === 0 ? "#E5321C" : (j === 1 ? "#FFC20E" : "#EFE4C8");
        if (lvl < .05) g2.fillStyle = "rgba(239,228,200,.16)";
        g2.beginPath(); g2.arc(i * cw + cw / 2, j * ch + ch / 2, r, 0, Math.PI * 2); g2.fill();
      }
    }
  }

  var kickV = 0;
  function kickVisual(v) { kickV = Math.max(kickV, v); }

  /* ---------- the frame loop ---------- */
  var prev = performance.now();
  function frame(now) {
    var dt = Math.min(.05, (now - prev) / 1000); prev = now;
    idlePhase += dt * 2;

    if (dragging) {
      targetRate = dragVel;
      dragVel *= Math.pow(.02, dt); /* if the hand stops, the record stops */
    } else if (nudge) {
      targetRate = nudge; nudge *= Math.pow(.004, dt);
      if (Math.abs(nudge) < .15) { nudge = 0; targetRate = motor ? 1 : 0; }
    }
    /* motor spins up slow, hand moves instant */
    var k = dragging || nudge ? 1 : (motor ? 1 - Math.pow(.08, dt) : 1 - Math.pow(.02, dt));
    rate += (targetRate - rate) * k;
    if (Math.abs(rate) < .002 && targetRate === 0) rate = 0;

    if (!dragging) angle += rate * RPM_DEG * dt;
    record.style.setProperty("--a", (angle % 360).toFixed(2) + "deg");

    if (buffers) {
      pos = ((pos + rate * dt) % LOOP + LOOP) % LOOP;
      var want = rate < -0.01 ? -1 : 1;
      if (want !== dir) startSources(want);
      var r = Math.max(.0001, Math.min(4, Math.abs(rate)));
      sources.forEach(function (s) { s.playbackRate.setTargetAtTime(r, ctx.currentTime, .012); });
      var scratchy = dragging || nudge ? Math.min(1, Math.abs(rate - (motor ? 1 : 0)) * .8) : 0;
      scratchGain.gain.setTargetAtTime(scratchy * .1, ctx.currentTime, .02);
      scratchBand.frequency.setTargetAtTime(250 + Math.abs(rate) * 1300, ctx.currentTime, .02);
    }

    if (analyser) {
      analyser.getByteFrequencyData(freq);
      var low = 0; for (var i = 1; i < 8; i++) low += freq[i]; low /= 7 * 255;
      energy = energy * .6 + low * .4;
      if (low > .62) kickVisual((low - .62) * 2.6);
    }
    kickV *= Math.pow(.004, dt);
    var kv = reduce ? 0 : Math.min(1, kickV);
    doc.style.setProperty("--kick", kv.toFixed(3));
    meterTick(dt, energy);
    drawDots();
    requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------- */
  /* clash meter                                                      */
  /* ---------------------------------------------------------------- */
  var KEY = "riddimYard.forwards.v1";
  var mine = { a: 0, b: 0 };
  try { var saved = JSON.parse(localStorage.getItem(KEY) || "null"); if (saved && typeof saved.a === "number") mine = saved; } catch (e) {}
  var crowd = { a: 1284, b: 1239 }; /* the rest of the street, simulated */
  var sides = {}, meterStatus = document.getElementById("meter-status");
  Array.prototype.forEach.call(document.querySelectorAll(".meter-side"), function (s) {
    var k = s.dataset.side;
    sides[k] = { el: s, vu: s.querySelector(".vu"), pct: s.querySelector(".pct"), count: s.querySelector(".count"), rig: s.querySelector(".rig-photo"), lvl: .5, peak: .5, hold: 0, punch: 0 };
  });
  var NAMES = { a: "Iron Mango", b: "Duppy Gate" };

  function totals() { return { a: crowd.a + mine.a, b: crowd.b + mine.b }; }
  function share(k) { var t = totals(); return t[k] / (t.a + t.b); }
  function paintNumbers() {
    var t = totals();
    ["a", "b"].forEach(function (k) {
      sides[k].pct.textContent = Math.round(share(k) * 100);
      sides[k].count.textContent = t[k].toLocaleString("en-JM");
    });
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(mine)); } catch (e) {} }

  Array.prototype.forEach.call(document.querySelectorAll("[data-vote]"), function (b) {
    b.addEventListener("click", function () {
      var k = b.dataset.vote;
      mine[k]++; save(); paintNumbers();
      sides[k].punch = 1;
      var n = mine.a + mine.b;
      meterStatus.textContent = mine[k] === 1 && n === 1
        ? "Forward for " + NAMES[k] + ". The MC hears you."
        : "You gave " + NAMES.a + " " + mine.a + " and " + NAMES.b + " " + mine.b + " forwards tonight.";
    });
  });
  if (mine.a + mine.b) meterStatus.textContent = "Welcome back. You gave " + NAMES.a + " " + mine.a + " and " + NAMES.b + " " + mine.b + " forwards tonight.";

  /* the rest of the yard keeps voting in bursts */
  var crowdTimer = 0, wob = 0;
  function meterTick(dt, audio) {
    crowdTimer -= dt; wob += dt;
    if (crowdTimer <= 0) {
      crowdTimer = 1.4 + Math.random() * 2.2;
      var k = Math.random() < .5 ? "a" : "b", n = 1 + Math.floor(Math.random() * 4);
      crowd[k] += n; sides[k].punch = Math.max(sides[k].punch, .35);
      paintNumbers();
    }
    ["a", "b"].forEach(function (k, i) {
      var s = sides[k];
      /* level sits around the vote share, stretched so the gap reads */
      var base = .5 + (share(k) - .5) * 3.2;
      var live = reduce ? 0 : (Math.sin(wob * 7.3 + i * 2) * .025 + Math.sin(wob * 13.1 + i) * .02 + (Math.random() - .5) * .03);
      var target = Math.max(.08, Math.min(.98, base * .82 + live + s.punch * .22 + audio * .12));
      /* real meter ballistics: quick up, slow fall */
      var c = target > s.lvl ? 1 - Math.pow(.0005, dt) : 1 - Math.pow(.15, dt);
      s.lvl += (target - s.lvl) * (reduce ? 1 : c);
      if (s.lvl >= s.peak) { s.peak = s.lvl; s.hold = .8; }
      else if ((s.hold -= dt) <= 0) s.peak = Math.max(s.lvl, s.peak - dt * .25);
      s.punch *= Math.pow(.02, dt);
      s.vu.style.setProperty("--lvl", s.lvl.toFixed(3));
      s.vu.style.setProperty("--peak", s.peak.toFixed(3));
      if (!reduce) s.rig.style.setProperty("--thump", (s.punch + audio * .4).toFixed(3));
    });
  }
  paintNumbers();
  requestAnimationFrame(frame);

  /* ---------------------------------------------------------------- */
  /* the yard map                                                     */
  /* ---------------------------------------------------------------- */
  function startMap() {
    var el = document.getElementById("yard-map"), fig = document.getElementById("map-fig");
    if (!el) return;
    if (!window.L) { fig.classList.add("no-map"); return; }
    var POINTS = [
      { k: "A", name: "The gate and vinyl swap", note: "Wristbands, crates and the painted rules. Free before ten.", at: [17.9722, -76.7941] },
      { k: "B", name: "Iron Mango stack", note: "North end of the block, facing south.", at: [17.9741, -76.7935] },
      { k: "C", name: "Duppy Gate stack", note: "South end, facing north. Stand in the middle if you brave.", at: [17.9710, -76.7936] },
      { k: "D", name: "MC stand and the meter", note: "The vote is read out here at quarter past one.", at: [17.9727, -76.7931] },
      { k: "E", name: "Food row", note: "Jerk pork, fried fish, festival, soup and cold Ting.", at: [17.9731, -76.7945] },
      { k: "F", name: "Taxi drop", note: "Route taxis and pick ups. Ask for the Orange Street dance.", at: [17.9704, -76.7926] }
    ];
    var map = L.map(el, { center: [17.9725, -76.7935], zoom: 17, minZoom: 14, maxZoom: 19, scrollWheelZoom: false, zoomControl: false, attributionControl: true });
    map.attributionControl.setPrefix(false);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    var street = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, className: "yard-tiles", attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
    var sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Esri" });
    var viewBtn = fig.querySelector('[data-map="view"]');
    viewBtn.addEventListener("click", function () {
      var toSat = map.hasLayer(street);
      if (toSat) { map.removeLayer(street); sat.addTo(map); } else { map.removeLayer(sat); street.addTo(map); }
      viewBtn.querySelector("span").textContent = toSat ? "Street view" : "Satellite view";
    });

    /* the closed block, painted like a road marking */
    L.polyline([[17.9744, -76.7935], [17.9709, -76.7938]], { color: "#E5321C", weight: 14, opacity: .45, lineCap: "butt", interactive: false }).addTo(map);
    L.polyline([[17.9744, -76.7935], [17.9709, -76.7938]], { color: "#16130F", weight: 2, dashArray: "8 8", interactive: false }).addTo(map);

    var markers = {}, rows = Array.prototype.slice.call(document.querySelectorAll(".legend .pt"));
    function setActive(k) {
      rows.forEach(function (r) { r.classList.toggle("on", r.dataset.pt === k); r.setAttribute("aria-pressed", r.dataset.pt === k); });
      Object.keys(markers).forEach(function (key) { var n = markers[key].getElement(); if (n) n.classList.toggle("on", key === k); });
    }
    POINTS.forEach(function (p) {
      var m = L.marker(p.at, {
        icon: L.divIcon({ className: "yard-pin", html: "<span>" + p.k + "</span>", iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -20] }),
        title: p.name, keyboard: true, riseOnHover: true
      }).bindPopup('<h3>' + p.k + '. ' + p.name + '</h3><p>' + p.note + '</p>', { className: "yard-popup", maxWidth: 240 }).addTo(map);
      m.on("click", function () { setActive(p.k); });
      m.on("popupclose", function () { setActive(null); });
      markers[p.k] = m;
    });
    rows.forEach(function (r) {
      r.setAttribute("aria-pressed", "false");
      r.addEventListener("click", function () {
        var m = markers[r.dataset.pt]; if (!m) return;
        setActive(r.dataset.pt);
        map.flyTo(m.getLatLng(), 18, { duration: reduce ? 0 : .6 });
        setTimeout(function () { m.openPopup(); }, reduce ? 0 : 650);
      });
    });
    map.fitBounds(L.latLngBounds(POINTS.map(function (p) { return p.at; })).pad(.3));
    map.on("click", function () { map.scrollWheelZoom.enable(); });
    el.addEventListener("mouseleave", function () { map.scrollWheelZoom.disable(); });
  }
  if (document.readyState === "complete") startMap(); else window.addEventListener("load", startMap);
})();

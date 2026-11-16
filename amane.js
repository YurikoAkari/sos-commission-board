/* =====================================================================
   AMANE — the S.O.S. Brigade companion (main board)
   ---------------------------------------------------------------------
   Static, dependency-free. Include once, at the very end of <body>:
       <link rel="stylesheet" href="amane.css">   (in <head>)
       <script src="amane.js"></script>           (after the other scripts)

   File map (search for these banners):
     1. CONFIG ........ every number you might want to tune
     2. DIALOGUE ...... all her lines, English + Vietnamese
     3. SPRITES ....... animation table + placeholder fallback
     4. SCENES ........ one small async function per animation
     5. DIALOGUE LOGIC  bubbles, cooldowns, weighted picking
     6. MINESWEEPER ... reacts to the 'sos:ms' events the game now fires
     7. MUTE .......... the silence button
     8. START-UP ...... waits for the login screen, then wakes her up

   Sprite files go in  assets/companion/  named  amane_<anim>_<n>.png
   (n starts at 1). See assets/companion/README.txt for the full list.
   Any animation whose files are missing automatically uses a labelled
   placeholder, so the site never shows a broken image.
   ===================================================================== */
(() => {
  'use strict';
  if (window.__amaneLoaded) return;          // never start twice
  window.__amaneLoaded = true;

  const $ = id => document.getElementById(id);

  /* ===================================================================
     1. CONFIG
     =================================================================== */
  const CFG = {
    assetDir: 'assets/companion/',
    prefix: 'amane_',
    ext: '.png',

    storageKey: 'sos_amane_mute',      // optional; site works if storage is blocked

    afterLoginMs: 1500,                // wait after the login screen is gone
    firstGreetingDelayMs: 1200,
    mobileTipDelayMs: 9000,            // first mobile reminder
    mobileTipRepeatMs: 10 * 60 * 1000, // later reminders: rarely

    talkMinMs: 45 * 1000,              // random chatter spacing
    talkMaxMs: 90 * 1000,
    waveCooldownMs: 3 * 60 * 1000,     // spontaneous greeting wave
    waveIdleMs: 75 * 1000,             // she must have been idling this long
    strollChance: 0.12,                // chance a quiet moment becomes a walk
    strollPx: 80,
    strollSpeedPxPerSec: 42,
    walkFrameMs: 220,
    dropFrameMs: 200,                  // each frame of the hop off the cloud (drop_1, drop_2)
    standBeatMs: 350,                  // how long she holds the standing pose

    typeMs: 34,                        // Animal-Crossing-style text pop: ms per letter
    typePauseMs: 130,                  // extra pause after . ! ? ~ ♡

    sfx: true,                         // her voice clips (greetings, happy, sad, amazed, lose_1, lose_2)
    sfxDir: 'recorder/',               // where the .mp3 files live (happy, sad, amazed, greetings, lose_1, lose_2)
    sfxExt: '.mp3',
    sfxVolume: .8,                     // 0 - 1

    bubbleMs: 6500,                    // plain bubble lifetime (starts when the text finished typing)
    bubbleActionMs: 11000,             // bubbles that contain a link/button
    recentLineMemory: 8,               // don't repeat a line seen this recently

    /* Minesweeper */
    msYawnMinutes: 15,                 // she gets sleepy (yawn only)
    msReminderMinutes: 30,             // "you are commissioning, not playing"
    msQuickLoseMs: 8000,               // lose this soon after the first click = "Another one? Already?"

    /* Art direction: which way do your sprites face by default? Used only
       to mirror her when she strolls the other way. */
    artFacesLeft: true
  };

  /* Verified links already on the page (see the footer / contact section). */
  const LINKS = {
    artist: 'https://x.com/iburntmytoas_t',
    qa: '#faq',
    terms: '#rules',
    board: '#calc'
  };

  /* ===================================================================
     2. DIALOGUE
     Entry = string, or { text, href?, external?, hint?, action?, needs? }
       text   "[[label]]" turns the label into an inline link to href
       href   link target; with no [[ ]] a hint link is added below
       action 'region' = opens the existing Regional Change dialog
       needs  element id that must exist for the line to be used
     =================================================================== */
  const LANG = /^vi/i.test(document.documentElement.lang || '') ? 'vi' : 'en';

  const D = {
    en: {
      ui: {
        sprite: 'Amane, the Brigade companion. Activate to say hi.',
        mute: 'Silence Amane',
        unmute: 'Let Amane talk again',
        close: 'Dismiss message',
        regionHint: 'Open Regional Change ▸',
        qaHint: 'Open the Q&A ▸'
      },
      greet: [
        'Hi! ♡', "You're still here!", 'Take your time!', "Let's look around!",
        'Have you found something you like? ♡', 'Have you met everyone on this website?',
        "Don't worry! Everything is working as intended!",
        'Remember to save your progress! You never know when the website might explode!',
        'Remember to blink! 👀', 'Remember to drink water every 3 hour!',
        'Have you stretched today?', 'Remember to take breaks! Your health matters!'
      ],
      commission: [
        { text: 'Got questions? Feel free to ask [[Sir Artist]]!', href: LINKS.artist, external: true },
        { text: 'Do you need any help?', href: LINKS.qa, hintKey: 'qaHint' },
        'Found anything you like yet? ♡',
        { text: 'Remember to read the commission terms!', href: LINKS.terms, hint: 'Jump to the rules ▸' },
        "Don't be shy! Feel free to look around!",
        { text: 'Hey! The commission board is over there! →', href: LINKS.board, hint: 'Take me there ▸' },
        "You're still looking? Take your time! ♡"
      ],
      qa: [{ text: 'Do you need any help?', href: LINKS.qa, hintKey: 'qaHint' }],
      mobile: [
        'Remember if you are on mobile you can scroll the taskbar!',
        'Some buttons are hiding over there! →',
        'Having trouble navigating? Try swiping the taskbar!'
      ],
      language: [
        { text: 'Need a translation? Change your language here!', action: 'region', needs: 'reg-btn' },
        { text: "Don't worry! You can switch languages anytime!", action: 'region', needs: 'reg-btn' },
        { text: 'Lost in translation? Let me help!', action: 'region', needs: 'reg-btn' }
      ],
      blush: ['Eep! ♡', 'Hehe~', 'H-hi! ♡', 'That tickles!'],
      yay: ['YAYYYYY!! 🎉', 'YOU DID IT!! ♡', 'I KNEW YOU COULD DO IT!', 'AMAZING!! TIME FOR A BREAK!'],
      lose: ['Oh no... 🥺', 'Maybe we should take a little break...', 'Mmm... wake me up when you win...'],
      quickLose: 'Another one? Already?',
      yawn: '*yaaawn*... still going?',
      reminder: 'Remember that you are commissioning and not playing Minesweeper!',
      muted: 'Oh... okay.',
      unmuted: 'Welcome back! ♡'
    },

    vi: {
      ui: {
        sprite: 'Amane, bạn đồng hành của Brigade. Nhấn để chào.',
        mute: 'Cho Amane im lặng',
        unmute: 'Cho Amane nói chuyện lại',
        close: 'Đóng lời nhắn',
        regionHint: 'Mở Đổi khu vực ▸',
        qaHint: 'Mở phần Hỏi Đáp ▸'
      },
      greet: [
        'Chào nè! ♡', 'Bạn vẫn còn ở đây à!', 'Cứ thong thả nhé!', 'Cùng đi dạo xung quanh nào!',
        'Bạn đã tìm được món ưng ý chưa? ♡', 'Bạn đã gặp mọi người trên trang web này chưa?',
        'Đừng lo! Mọi thứ đang chạy đúng như dự định!',
        'Nhớ lưu tiến trình nhé! Biết đâu trang web nổ tung lúc nào không hay!',
        'Nhớ chớp mắt nha! 👀', 'Nhớ uống nước mỗi 3 tiếng nhé!',
        'Hôm nay bạn đã duỗi người chưa?', 'Nhớ nghỉ giải lao nhé! Sức khỏe quan trọng lắm!'
      ],
      commission: [
        { text: 'Có thắc mắc cứ hỏi [[Sir Artist]] nhé!', href: LINKS.artist, external: true },
        { text: 'Bạn cần giúp gì không?', href: LINKS.qa, hintKey: 'qaHint' },
        'Đã thấy món nào ưng chưa? ♡',
        { text: 'Nhớ đọc điều khoản commission nhé!', href: LINKS.terms, hint: 'Nhảy tới phần luật ▸' },
        'Đừng ngại! Cứ xem thoải mái nhé!',
        { text: 'Này! Bảng commission ở đằng kia kìa! →', href: LINKS.board, hint: 'Dẫn mình tới đó ▸' },
        'Bạn vẫn đang xem à? Cứ thong thả! ♡'
      ],
      qa: [{ text: 'Bạn cần giúp gì không?', href: LINKS.qa, hintKey: 'qaHint' }],
      mobile: [
        'Nhớ là nếu dùng điện thoại, bạn có thể cuộn thanh taskbar nhé!',
        'Có vài nút đang trốn ở đằng kia! →',
        'Khó tìm đường à? Thử vuốt thanh taskbar xem!'
      ],
      language: [
        { text: 'Cần dịch à? Đổi ngôn ngữ ở đây nè!', action: 'region', needs: 'reg-btn' },
        { text: 'Đừng lo! Bạn có thể đổi ngôn ngữ bất cứ lúc nào!', action: 'region', needs: 'reg-btn' },
        { text: 'Lạc trong bản dịch à? Để mình giúp!', action: 'region', needs: 'reg-btn' }
      ],
      blush: ['Ái chà! ♡', 'Hehe~', 'X-xin chào! ♡', 'Nhột quá!'],
      yay: ['YAYYYYY!! 🎉', 'BẠN LÀM ĐƯỢC RỒI!! ♡', 'MÌNH BIẾT BẠN LÀM ĐƯỢC MÀ!', 'TUYỆT VỜI!! NGHỈ GIẢI LAO NÀO!'],
      lose: ['Ôi không... 🥺', 'Hay mình nghỉ một chút nhé...', 'Ưmm... thắng rồi thì gọi mình dậy nhé...'],
      quickLose: 'Lại nữa à? Nhanh vậy sao?',
      yawn: '*ngáp*... bạn vẫn đang chơi à?',
      reminder: 'Nhớ là bạn đang đặt commission chứ không phải chơi Minesweeper nhé!',
      muted: 'Ồ... được thôi.',
      unmuted: 'Chào mừng bạn quay lại! ♡'
    }
  };
  const T = D[LANG];

  /* ===================================================================
     3. SPRITES
     n  = number of frames drawn for that animation (file numbers 1..n)
     ph = placeholder glyph per frame (used only when art is missing)
     =================================================================== */
  const ANIMS = {
    idle:         { n: 1, file: 'amane_idle.gif',        // ONE looping GIF: neutral / leans left / leans right
                    ph: ['🎧', '🎧', '🎧'] },
    walk:         { n: 3, ph: ['🚶', '🧍', '🚶'] },       // left step / neutral / right step
    blush:        { n: 2, ph: ['🤔', '😳'] },            // amane_blush_1.png / amane_blush_2.png: shown when she is clicked
    wave:         { n: 2, ph: ['👋', '🙋'] },            // amane_wave_1.png / amane_wave_2.png: the two waving poses
    drop:         { n: 2, ph: ['😯', '😲'] },            // amane_drop_1.png, amane_drop_2.png: slipping off the cloud
    standing:     { n: 1, file: 'amane_standing.png',   // amane_standing.png: standing next to the cloud
                    ph: ['🧍'] },
    yay:          { n: 5, ph: ['😮', '🙌', '🎉', '🎉', '🥳'] },
    snooze_start: { n: 5, ph: ['👀', '😑', '🥱', '😪', '💤'] }, // look / blink / yawn / droop / curl
    sleep:        { n: 2, ph: ['😴', '💤'] },            // breathing loop
    wakeup:       { n: 2, ph: ['🥺', '😊'] },
    sad:          { n: 1, ph: ['😔'] }                   // amane_sad_1.png: shown when the silence button is pressed
  };
  const ready = {};                    // anim -> true when every PNG loaded
  const missing = new Set();

  const frameUrl = (a, i) => ANIMS[a].file ? CFG.assetDir + ANIMS[a].file
                                            : `${CFG.assetDir}${CFG.prefix}${a}_${i + 1}${CFG.ext}`;
  const frozen = {};                   // anim -> still first frame (data URL) for reduced-motion visitors

  function probe(anim) {
    const { n } = ANIMS[anim];
    const loads = Array.from({ length: n }, (_, i) => new Promise(res => {
      const im = new Image();
      im.onload = () => {
        if (ANIMS[anim].file && reduced()) {          // reduced motion: show the GIF's first frame only
          try { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
                c.getContext('2d').drawImage(im, 0, 0); frozen[anim] = c.toDataURL(); } catch (e) { /* e.g. opened from file:// */ }
        }
        res(true);
      };
      im.onerror = () => { missing.add(frameUrl(anim, i)); res(false); };
      im.src = frameUrl(anim, i);
    }));
    return Promise.all(loads).then(all => { ready[anim] = all.every(Boolean); });
  }

  /* ===================================================================
     DOM (built once)
     =================================================================== */
  const root = document.createElement('div');
  root.className = 'amane';
  root.hidden = true;
  root.dataset.sleeping = 'false';
  root.innerHTML =
    '<div class="amane-sr" role="status" aria-live="polite" aria-atomic="true"></div>' +
    '<div class="amane-bubble"></div>' +
    '<div class="amane-stage">' +
      '<div class="amane-cloud" aria-hidden="true"></div>' +
      '<div class="amane-actor">' +
        '<button class="amane-sprite" type="button">' +
          '<img alt="" draggable="false" hidden>' +
          '<span class="amane-ph" aria-hidden="true"></span>' +
        '</button>' +
      '</div>' +
      '<button class="amane-mute" type="button" aria-pressed="false"><span aria-hidden="true">🔔</span></button>' +
    '</div>';
  document.body.appendChild(root);

  const bubble = root.querySelector('.amane-bubble');
  const srLive = root.querySelector('.amane-sr');
  const cloud = root.querySelector('.amane-cloud');
  const actor = root.querySelector('.amane-actor');
  const sprite = root.querySelector('.amane-sprite');
  const img = sprite.querySelector('img');
  const ph = sprite.querySelector('.amane-ph');
  const muteBtn = root.querySelector('.amane-mute');
  sprite.setAttribute('aria-label', T.ui.sprite);

  /* optional cloud layer */
  { const c = new Image();
    c.onload = () => { cloud.style.backgroundImage = `url(${c.src})`; cloud.classList.add('has-art'); root.classList.add('cloud-art'); };
    c.src = CFG.assetDir + CFG.prefix + 'cloud' + CFG.ext; }

  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const isMobile = () => !!(window.matchMedia && matchMedia('(max-width: 768px), (pointer: coarse)').matches);
  const rand = (a, b) => a + Math.random() * (b - a);

  /* show exactly one frame */
  function show(anim, i) {
    const a = ANIMS[anim];
    i = Math.max(0, Math.min(i, (ready[anim] ? a.n : a.ph.length) - 1));
    sprite.dataset.anim = anim;
    sprite.dataset.frame = String(i);
    if (ready[anim]) {
      ph.hidden = true; img.hidden = false;
      const u = (reduced() && frozen[anim]) || frameUrl(anim, i);
      if (img.getAttribute('src') !== u) img.src = u;
    } else {
      img.hidden = true; ph.hidden = false;
      ph.textContent = a.ph[i] || '🎧';
      ph.title = 'placeholder — missing ' + frameUrl(anim, i);
      ph.classList.toggle('alt', i % 2 === 1 && anim !== 'idle');
      ph.dataset.lean = anim === 'idle' ? ['', 'l', 'r'][i] : '';
    }
  }

  /* ===================================================================
     4. SCENES — state machine
     Only one scene runs at a time (`busy`). `interrupt()` lets important
     events (Minesweeper win/loss) cancel whatever is playing.
     =================================================================== */
  let busy = false;
  let epoch = 0;
  let sleeping = false;
  let idleTimer = null;
  let idleFrame = 0;
  let lastSceneEnd = Date.now();
  const CANCEL = Symbol('cancel');

  const nap = ms => new Promise(r => setTimeout(r, ms));
  async function wait(ms, ep) { await nap(ms); if (ep !== epoch) throw CANCEL; }

  /* ---- voice clips ----
     greetings (hi wave) · happy (clicked) · sad (muted / lost Minesweeper)
     amazed (won Minesweeper) · lose_1 / lose_2 (after the sad, on a loss).
     Silent while she is muted. The one exception is the sad clip played at the
     very moment she is muted (opts.force), as her reaction to being silenced.
     A missing file is simply skipped. Returns a promise that resolves when the
     clip ends (or fails / is stopped), so clips can be chained. */
  let sfxCur = null;
  function stopSfx() { if (sfxCur) { try { sfxCur.pause(); } catch (e) {} sfxCur = null; } }
  function sfx(name, opts) {
    opts = opts || {};
    if (!CFG.sfx || (muted && !opts.force)) return Promise.resolve();
    stopSfx();
    return new Promise(res => {
      try {
        const a = new Audio(CFG.sfxDir + name + CFG.sfxExt);
        a.volume = CFG.sfxVolume;
        sfxCur = a;
        a.onended = () => { if (sfxCur === a) sfxCur = null; res(); };
        a.onerror = () => { if (sfxCur === a) sfxCur = null; res(); };
        const p = a.play(); if (p && p.catch) p.catch(() => { if (sfxCur === a) sfxCur = null; res(); });
      } catch (e) { res(); }
    });
  }

  /* Short UI sound for a message bubble. Separate from voice clips so it
     won't cut off greetings or other character sounds. */
  function bubbleSfx() {
    if (!CFG.sfx || muted) return;
    try {
      const a = new Audio(CFG.sfxDir + 'bubble.mp3');
      a.volume = CFG.sfxVolume;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* missing/blocked sound is harmless */ }
  }

  function setSleeping(v) { sleeping = v; root.dataset.sleeping = String(v); }

  function stopIdleLoop() { clearTimeout(idleTimer); idleTimer = null; }
  const IDLE_SEQ = [0, 1, 0, 2];            // neutral -> lean left -> neutral -> lean right
  const SLEEP_SEQ = [0, 1];                 // breathing in / out
  function startIdleLoop() {
    stopIdleLoop();                                   // never two loops
    const tick = () => {
      if (busy) { idleTimer = null; return; }
      if (!sleeping && ready.idle && ANIMS.idle.file) { show('idle', 0); idleTimer = null; return; }  // the GIF loops itself
      const seq = sleeping ? SLEEP_SEQ : IDLE_SEQ;      // placeholder idle keeps swaying so you can see it
      show(sleeping ? 'sleep' : 'idle', seq[idleFrame++ % seq.length]);
      if (reduced()) { idleTimer = null; return; }    // hold a still frame
      idleTimer = setTimeout(tick, sleeping ? 1500 : 900);
    };
    idleFrame = 0;
    tick();
  }

  function interrupt() { stopSfx(); epoch++; busy = false; actor.style.transition = 'none'; actor.style.transform = ''; actor.classList.remove('flip'); }

  async function runScene(fn) {
    if (busy) return false;
    busy = true; stopIdleLoop();
    const ep = ++epoch;
    try { await fn(ep); }
    catch (e) { if (e !== CANCEL) console.error('[amane]', e); }
    finally { if (ep === epoch) { busy = false; lastSceneEnd = Date.now(); startIdleLoop(); } }
    return true;
  }

  /* --- blush (on click): amane_blush_1.png -> amane_blush_2.png, then back to idle --- */
  const sceneBlush = () => async ep => {
    show('blush', 0); await wait(450, ep);
    show('blush', 1);
    if (Math.random() < .5) say(pick(T.blush));
    await wait(1500, ep);
  };

  /* --- leaving / rejoining the cloud ---
     dropOff: drop_1 -> drop_2 -> standing.  climbBack plays it in reverse.
     Used by every scene where she is on her feet (wave, stroll). */
  async function dropOff(ep) {
    show('drop', 0); await wait(CFG.dropFrameMs, ep);
    show('drop', 1); await wait(CFG.dropFrameMs, ep);
    show('standing', 0); await wait(CFG.standBeatMs, ep);
  }
  async function climbBack(ep) {
    show('standing', 0); await wait(CFG.standBeatMs, ep);
    show('drop', 1); await wait(CFG.dropFrameMs, ep);
    show('drop', 0); await wait(CFG.dropFrameMs, ep);
  }

  /* --- wave: drop off the cloud, stand, THEN start waving.
         The hello bubble pops up on the first wave frame, not before. --- */
  const sceneWave = text => async ep => {
    await dropOff(ep);
    show('wave', 0); if (text) say(text); sfx('greetings');   // wave_1: she starts waving + bubble appears together
    await wait(320, ep);
    for (let k = 0; k < 2; k++) { show('wave', 1); await wait(320, ep); show('wave', 0); await wait(320, ep); }   // wave_2 <-> wave_1
    await climbBack(ep);
  };

  /* --- yay: Minesweeper victory --- */
  const sceneYay = () => async ep => {
    setSleeping(false);
    sfx('amazed');
    show('yay', 0); await wait(300, ep);
    show('yay', 1); say(pick(T.yay)); await wait(320, ep);
    for (let k = 0; k < 3; k++) { show('yay', 2); await wait(240, ep); show('yay', 3); await wait(240, ep); }
    show('yay', 4); sparkles(); await wait(900, ep);
  };

  /* --- snooze: Minesweeper loss. quick=true -> she stares first --- */
  const sceneSnooze = quick => async ep => {
    sfx('sad').then(() => {                            // sad first, then a random lose clip
      if (ep === epoch && !muted) sfx(Math.random() < .5 ? 'lose_1' : 'lose_2');
    });
    show('snooze_start', 0);
    if (quick) { say(T.quickLose); await wait(1700, ep); }
    else { await wait(750, ep); show('snooze_start', 1); await wait(450, ep); }
    show('snooze_start', 2); if (!quick) say(pick(T.lose)); await wait(950, ep);
    show('snooze_start', 3); await wait(800, ep);
    show('snooze_start', 4); await wait(800, ep);
    setSleeping(true);                                 // the idle loop now plays `sleep`
  };

  /* --- wakeup --- */
  const sceneWake = () => async ep => {
    show('wakeup', 0); await wait(550, ep);
    show('wakeup', 1); await wait(450, ep);
    setSleeping(false);
  };

  /* --- yawn only (long play session) --- */
  const sceneYawn = () => async ep => {
    show('snooze_start', 0); await wait(600, ep);
    show('snooze_start', 1); await wait(400, ep);
    show('snooze_start', 2); say(T.yawn); await wait(1200, ep);
  };

  /* --- the silence button reaction --- */
  const sceneSad = text => async ep => {
    sfx('sad', { force: true });                       // her reaction to being silenced
    show('sad', 0); if (text) say(text, { force: true });   // sad_1 + "Oh... okay."
    await wait(2200, ep);
  };

  /* --- stroll: off the cloud, a few steps, and back (walk cycle 1-2-3-2) --- */
  const sceneStroll = () => async ep => {
    const room = Math.max(0, root.getBoundingClientRect().left - 16);
    const dist = Math.min(CFG.strollPx, room);
    if (dist < 30) return;
    const ms = dist / CFG.strollSpeedPxPerSec * 1000;
    const cycle = [0, 1, 2, 1];
    await dropOff(ep);
    const walk = async (dx, flip) => {
      actor.classList.toggle('flip', flip);
      actor.style.transition = `transform ${ms}ms linear`;
      actor.style.transform = `translateX(${dx}px)`;
      const t0 = Date.now(); let k = 0;
      while (Date.now() - t0 < ms) { show('walk', cycle[k++ % 4]); await wait(CFG.walkFrameMs, ep); }
    };
    await walk(-dist, !CFG.artFacesLeft);   // walk left
    show('walk', 1); await wait(500, ep);
    await walk(0, CFG.artFacesLeft);        // walk back
    actor.style.transition = 'none'; actor.classList.remove('flip');
    show('walk', 1); await wait(350, ep);
    await climbBack(ep);
  };

  function sparkles() {
    if (reduced()) return;
    const stage = root.querySelector('.amane-stage');
    for (let k = 0; k < 7; k++) {
      const s = document.createElement('span');
      s.className = 'amane-spark'; s.textContent = '✦'; s.setAttribute('aria-hidden', 'true');
      s.style.left = (10 + Math.random() * 80) + '%';
      s.style.top = (Math.random() * 70) + '%';
      s.style.animationDelay = (k * 90) + 'ms';
      stage.appendChild(s);
      setTimeout(() => s.remove(), 1800);
    }
  }

  /* ===================================================================
     5. DIALOGUE LOGIC
     =================================================================== */
  let muted = false;
  let bubbleTimer = null;
  let bubbleOpen = false;
  let bubbleHeld = false;               // pointer/focus is on it: don't dismiss
  let mutedLineShown = false;
  let lastMobileTip = 0;
  let lastWave = 0;
  const recent = [];

  const keyOf = e => typeof e === 'string' ? e : e.text;
  function pick(list) {
    const pool = list.filter(e => !(e && e.needs && !$(e.needs)));
    const fresh = pool.filter(e => !recent.includes(keyOf(e)));
    const src = fresh.length ? fresh : pool;
    if (!src.length) return null;
    const e = src[Math.floor(Math.random() * src.length)];
    recent.push(keyOf(e)); if (recent.length > CFG.recentLineMemory) recent.shift();
    return e;
  }

  const modalOpen = () => {
    const reg = $('reg'), lb = $('lightbox');
    return document.body.classList.contains('lock')
      || (reg && reg.classList.contains('on'))
      || (lb && getComputedStyle(lb).display !== 'none');
  };
  const canTalk = () => document.visibilityState === 'visible' && !modalOpen();

  let typeTimer = null;
  let skipTyping = null;                // set while a message is still typing

  function hideBubble() {
    clearTimeout(bubbleTimer); bubbleTimer = null;
    clearTimeout(typeTimer); typeTimer = null; skipTyping = null;
    bubbleOpen = false; bubbleHeld = false;
    bubble.classList.remove('open');
    bubble.textContent = '';
    srLive.textContent = '';
  }

  function armBubbleTimer(ms) {
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => { if (bubbleHeld) armBubbleTimer(2000); else hideBubble(); }, ms);
  }

  function pointAtRegion() {
    const b = $('reg-btn'); if (!b) return;
    try { b.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {}
    b.classList.add('amane-point');
    setTimeout(() => b.classList.remove('amane-point'), 6000);
  }

  /* the plain message: text, an optional inline [[link]], an optional hint link/button */
  function buildMsg(entry) {
    const msg = document.createElement('div');
    msg.className = 'amane-msg';
    const m = entry.href && /\[\[(.+?)\]\]/.exec(entry.text);
    if (m) {
      msg.append(document.createTextNode(entry.text.slice(0, m.index)));
      const a = document.createElement('a');
      a.href = entry.href; a.textContent = m[1];
      if (entry.external) { a.target = '_blank'; a.rel = 'noopener'; }
      msg.append(a, document.createTextNode(entry.text.slice(m.index + m[0].length)));
    } else {
      msg.append(document.createTextNode(entry.text));
      const hint = entry.hint || (entry.hintKey && T.ui[entry.hintKey]) || (entry.action === 'region' && T.ui.regionHint);
      if (entry.href && hint) {
        const a = document.createElement('a');
        a.className = 'amane-hint'; a.href = entry.href; a.textContent = hint;
        if (entry.external) { a.target = '_blank'; a.rel = 'noopener'; }
        msg.append(a);
      } else if (entry.action === 'region' && hint) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'amane-act amane-hint'; b.textContent = hint;
        b.addEventListener('click', () => { hideBubble(); const r = $('reg-btn'); if (r) r.click(); });
        msg.append(b);
      }
    }
    // following a link closes the bubble (the page itself navigates)
    msg.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setTimeout(hideBubble, 0)));
    return msg;
  }

  /* turn every letter into a hidden <span> so they can pop in one by one.
     Words are kept together (nowrap) so lines still wrap at spaces only. */
  function splitLetters(root_) {
    const walker = document.createTreeWalker(root_, NodeFilter.SHOW_TEXT);
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      const frag = document.createDocumentFragment();
      n.nodeValue.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.append(document.createTextNode(part)); return; }
        const w = document.createElement('span'); w.className = 'amane-w';
        [...part].forEach(ch => { const s = document.createElement('span'); s.className = 'amane-ch'; s.textContent = ch; w.append(s); });
        frag.append(w);
      });
      n.replaceWith(frag);
    });
  }

  function say(entry, opts) {
    opts = opts || {};
    if (!entry) return false;
    if (muted && !opts.force) return false;       // muted: no dialogue at all
    if (!opts.force && !canTalk()) return false;
    if (typeof entry === 'string') entry = { text: entry };

    hideBubble();
    const actionable = !!(entry.href || entry.action);
    const finalMsg = buildMsg(entry);
    const x = document.createElement('button');
    x.type = 'button'; x.className = 'amane-x'; x.textContent = '×';
    x.setAttribute('aria-label', T.ui.close);
    x.addEventListener('click', hideBubble);

    bubbleOpen = true;
    bubble.classList.add('open');
    bubbleSfx();                                      // play when the message bubble appears
    srLive.textContent = finalMsg.textContent;        // screen readers get the whole line at once
    if (entry.action === 'region') pointAtRegion();

    const finish = () => {                            // swap the animated copy for the plain, fully accessible one
      clearTimeout(typeTimer); typeTimer = null; skipTyping = null;
      if (!bubbleOpen) return;
      bubble.replaceChildren(finalMsg, x);
      armBubbleTimer(actionable ? CFG.bubbleActionMs : CFG.bubbleMs);
    };

    if (reduced()) { finish(); return true; }

    const typed = buildMsg(entry);
    splitLetters(typed);
    typed.setAttribute('aria-hidden', 'true');
    typed.querySelectorAll('a,button').forEach(el => el.setAttribute('tabindex', '-1'));
    bubble.replaceChildren(typed, x);
    const letters = [...typed.querySelectorAll('.amane-ch')];
    const per = Math.min(CFG.typeMs, 2400 / Math.max(1, letters.length));

    // the timeline: when does each letter pop in? (pause a beat after . ! ? ~ ♡)
    const offsets = []; let total = 0;
    letters.forEach((c, j) => {
      offsets.push(total);
      total += /[.!?~♡]/.test(c.textContent) && j < letters.length - 1 ? CFG.typePauseMs : per;
    });

    const start = performance.now();
    let i = 0;
    skipTyping = () => finish();                      // clicking the bubble skips the typing
    const tick = () => {
      const el = performance.now() - start;
      while (i < letters.length && offsets[i] <= el) letters[i++].classList.add('in');
      if (i >= letters.length && el >= total) { finish(); return; }
      typeTimer = setTimeout(tick, 10);
    };
    tick();
    return true;
  }

  bubble.addEventListener('click', e => { if (skipTyping && !e.target.closest('a,button')) skipTyping(); });
  bubble.addEventListener('pointerenter', () => { bubbleHeld = true; });
  bubble.addEventListener('pointerleave', () => { bubbleHeld = false; });
  bubble.addEventListener('focusin', () => { bubbleHeld = true; });
  bubble.addEventListener('focusout', () => { bubbleHeld = false; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && bubbleOpen) hideBubble(); });

  /* weighted random chatter */
  function pickChatter() {
    const now = Date.now();
    const pools = [
      { w: 4, list: T.greet },
      { w: 3, list: T.commission },
      { w: 1, list: T.qa },
      { w: 2, list: T.language.filter(e => $(e.needs)) }
    ];
    if (isMobile() && now - lastMobileTip > CFG.mobileTipRepeatMs) {
      pools.push({ w: 3, list: T.mobile, mobile: true });
    }
    const live = pools.filter(p => p.list.length);
    let r = Math.random() * live.reduce((s, p) => s + p.w, 0);
    for (const p of live) {
      if ((r -= p.w) <= 0) { if (p.mobile) lastMobileTip = now; return pick(p.list); }
    }
    return null;
  }

  /* one timer loop: sometimes talk, sometimes wave, sometimes stroll */
  let talkTimer = null;
  function scheduleTalk() {
    clearTimeout(talkTimer);                          // never two loops
    talkTimer = setTimeout(() => {
      talkTimer = null;
      try { chatterTick(); } finally { scheduleTalk(); }
    }, rand(CFG.talkMinMs, CFG.talkMaxMs));
  }
  function chatterTick() {
    if (!canTalk() && !muted) return;
    if (busy || sleeping || bubbleOpen || ms.playing) return;
    const now = Date.now();
    const r = Math.random();
    if (now - lastWave > CFG.waveCooldownMs && now - lastSceneEnd > CFG.waveIdleMs && r < .25) {
      lastWave = now; runScene(sceneWave(muted ? null : pick(T.greet))); return;
    }
    if (!reduced() && r > 1 - CFG.strollChance) { runScene(sceneStroll()); return; }
    if (!muted) say(pickChatter());
  }

  /* clicking HER (not the bubble): blush (blush_1 -> blush_2), or wake her up */
  sprite.addEventListener('click', () => {
    if (busy) return;                                 // no overlapping animations from rapid clicks
    sfx('happy');
    if (sleeping) { runScene(sceneWake()); return; }
    runScene(sceneBlush());
  });

  /* ===================================================================
     6. MINESWEEPER
     The game (in index.html / board-xp-vi.html) fires
        window 'sos:ms'  detail.type = 'start' | 'reset' | 'win' | 'lose'
     right where it already decides those things. We never guess from the
     screen. Active play time counts only while a round is in progress,
     the Minesweeper window is open and the tab is visible.
     =================================================================== */
  const ms = { playing: false, startAt: 0, activeMs: 0, yawned: false, reminded: false, losses: 0 };

  window.addEventListener('sos:ms', e => {
    const type = e.detail && e.detail.type;
    setTimeout(() => {                                // let the game finish its own paint first
      if (type === 'start') {
        ms.playing = true; ms.startAt = Date.now();
        if (sleeping) { interrupt(); runScene(sceneWake()); }
      } else if (type === 'reset') {
        ms.playing = false;
        if (sleeping) { interrupt(); runScene(sceneWake()); }
      } else if (type === 'win') {
        ms.playing = false; interrupt(); runScene(sceneYay());
      } else if (type === 'lose') {
        ms.playing = false;
        const quick = ms.losses > 0 && (Date.now() - ms.startAt) < CFG.msQuickLoseMs;
        ms.losses++; interrupt(); runScene(sceneSnooze(quick));
      }
    }, 0);
  });

  let lastPlayTick = performance.now();
  setInterval(() => {                                 // exactly one ticker for the whole page
    const now = performance.now();
    const dt = Math.min(now - lastPlayTick, 1500);
    lastPlayTick = now;
    const w = $('ms-win');
    if (!ms.playing || document.visibilityState !== 'visible' || !w || w.hidden) return;
    ms.activeMs += dt;
    const min = ms.activeMs / 60000;
    if (!ms.yawned && min >= CFG.msYawnMinutes) {
      ms.yawned = true;
      runScene(sceneYawn());                          // animation still plays when muted; only text is silenced
    }
    if (!ms.reminded && min >= CFG.msReminderMinutes) {
      ms.reminded = true;
      say(T.reminder);                                // silent when muted; shown once either way
    }
  }, 1000);

  /* ===================================================================
     7. MUTE
     =================================================================== */
  function renderMute() {
    muteBtn.setAttribute('aria-pressed', String(muted));
    const label = muted ? T.ui.unmute : T.ui.mute;
    muteBtn.setAttribute('aria-label', label);
    muteBtn.title = label;
    muteBtn.firstElementChild.textContent = muted ? '🔕' : '🔔';
  }
  function saveMute() { try { localStorage.setItem(CFG.storageKey, muted ? '1' : '0'); } catch (e) {} }

  muteBtn.addEventListener('click', () => {
    muted = !muted; renderMute(); saveMute();
    if (muted) {
      hideBubble(); stopSfx();                        // silence means silence (her sad clip below is the one exception)
      const first = !mutedLineShown; mutedLineShown = true;
      if (!busy) runScene(sceneSad(first ? T.muted : null));
    } else if (!busy) {
      runScene(sceneWave(T.unmuted));                 // bubble pops when she starts waving
    } else {
      say(T.unmuted);
    }
  });

  /* ===================================================================
     8. START-UP
     =================================================================== */
  let started = false;
  function start() {
    if (started) return; started = true;
    try { muted = localStorage.getItem(CFG.storageKey) === '1'; } catch (e) { muted = false; }
    renderMute();
    root.hidden = false;
    startIdleLoop();
    scheduleTalk();

    setTimeout(() => {                                // first hello
      if (busy || sleeping) return;
      lastWave = Date.now();
      runScene(sceneWave(muted ? null : T.greet[0]));
    }, CFG.firstGreetingDelayMs);

    if (isMobile()) {                                 // one early, useful tip
      setTimeout(() => { if (canTalk()) { lastMobileTip = Date.now(); say(pick(T.mobile)); } },
        CFG.firstGreetingDelayMs + CFG.mobileTipDelayMs);
    }
  }

  // show what art is still missing, once, for the artist
  Promise.all(Object.keys(ANIMS).map(probe)).then(() => {
    if (missing.size) console.info('[amane] placeholder art in use. Missing files:\n' + [...missing].join('\n'));
    if (started && !busy) startIdleLoop();            // swap placeholder -> real art as soon as it loads
  });

  // wait for the login screen to finish before she appears
  const afterLogin = () => setTimeout(start, CFG.afterLoginMs);
  if (document.body.classList.contains('lock')) {
    const mo = new MutationObserver(() => {
      if (!document.body.classList.contains('lock')) { mo.disconnect(); afterLogin(); }
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  } else afterLogin();

  // tiny debug handle for testing from the browser console:
  //   AMANE.say('hello')   AMANE.play('wave')   (blush, wave, yay, snooze, wake, yawn, sad, stroll)
  const SCENES = {
    blush: sceneBlush, wave: () => sceneWave('Hi! ♡'), yay: sceneYay, snooze: () => sceneSnooze(false),
    wake: sceneWake, yawn: sceneYawn, sad: () => sceneSad(null), stroll: sceneStroll
  };
  window.AMANE = {
    say: t => say(t, { force: true }),
    play: n => { if (!SCENES[n]) return false; interrupt(); return runScene(SCENES[n]()); }
  };
})();
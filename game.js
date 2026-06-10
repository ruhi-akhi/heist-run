/**
 * HEIST RUN — 3D Endless Thief Runner
 * Play Store style: save progress, mobile controls, level milestones, polish.
 */
(function () {
    "use strict";

    const SAVE_KEY = "heistRunSave_v2";
    const CANVAS_W = 430;
    const CANVAS_H = 760;
    const MAX_LEVEL = 100;
    const LEVEL_FRAMES = 900; // ~15s per level — ধীরে ধীরে কঠিন হয়
    const REVIVE_COST = 50;

    // গতি ব্যালান্স (Play Store স্টাইল — শুরুতে আরাম, পরে বাড়ে)
    const SPEED = {
        START: 1.45,
        LEVEL_ADD: 0.03,
        MAX: 3.8,
        MOVE_MUL: 0.0024,
        DASH_ADD: 0.75,
        SPAWN_START: 105,
        SPAWN_MIN: 52,
        SPAWN_PER_LEVEL: 0.5
    };

    const COIN_SIZE = 28;

    const OBSTACLES = {
        train: { jumpable: false, w: 85, h: 75, kind: "image", img: "train" },
        log:   { jumpable: true,  w: 72, h: 44, kind: "image", img: "log" },
        cone:  { jumpable: true,  w: 48, h: 56, kind: "cone" }
    };

    const LEVEL_THEMES = [
        { min: 1,  name: "Street Heist",   obstacles: [],                        features: "Coins everywhere — learn to run!" },
        { min: 2,  name: "Riverside Run",  obstacles: ["cone"],                  features: "Traffic cones — jump over!" },
        { min: 3,  name: "Metro Escape",   obstacles: ["train", "cone"],       features: "Trains + cones — dodge & jump!" },
        { min: 4,  name: "Timber Trap",    obstacles: ["train", "log", "cone"],  features: "Logs on track — jump!" },
        { min: 5,  name: "Double Trouble", obstacles: ["train", "log", "cone"],  doubleSpawn: true, features: "Double trains — stay sharp!" },
        { min: 10, name: "Sky Loot",       obstacles: ["train", "log", "cone"], airCoinBoost: true, features: "Air coins + obstacles!" },
        { min: 20, name: "Night Raid",     obstacles: ["train", "log", "cone"], doubleSpawn: true, airCoinBoost: true, features: "Max action mode!" },
        { min: 50, name: "Legend Heist",   obstacles: ["train", "log", "cone"], doubleSpawn: true, airCoinBoost: true, features: "Legend difficulty!" }
    ];

    function getSpawnConfig(level) {
        if (level >= 50) return { coinChance: 0.48, minWavesBetweenCoins: 1, forceCoinAfter: 3, minCoins: 3, maxCoins: 6, coinGap: 0.28, startDelay: 0.10, burstChance: 0.18, burstAfter: 1200, obstacleChance: 0.46, spawnBonus: 0, airChance: 0.48 };
        if (level >= 20) return { coinChance: 0.50, minWavesBetweenCoins: 1, forceCoinAfter: 3, minCoins: 3, maxCoins: 5, coinGap: 0.28, startDelay: 0.10, burstChance: 0.15, burstAfter: 1400, obstacleChance: 0.44, spawnBonus: 2, airChance: 0.45 };
        if (level >= 10) return { coinChance: 0.52, minWavesBetweenCoins: 1, forceCoinAfter: 2, minCoins: 2, maxCoins: 5, coinGap: 0.28, startDelay: 0.11, burstChance: 0.13, burstAfter: 1600, obstacleChance: 0.40, spawnBonus: 4, airChance: 0.42 };
        if (level >= 5)  return { coinChance: 0.54, minWavesBetweenCoins: 1, forceCoinAfter: 2, minCoins: 2, maxCoins: 4, coinGap: 0.30, startDelay: 0.12, burstChance: 0.11, burstAfter: 1800, obstacleChance: 0.36, spawnBonus: 6, airChance: 0.38 };
        if (level >= 3)  return { coinChance: 0.58, minWavesBetweenCoins: 1, forceCoinAfter: 2, minCoins: 2, maxCoins: 4, coinGap: 0.30, startDelay: 0.10, burstChance: 0.09, burstAfter: 2000, obstacleChance: 0.28, spawnBonus: 4, airChance: 0.32 };
        if (level >= 2)  return { coinChance: 0.62, minWavesBetweenCoins: 1, forceCoinAfter: 2, minCoins: 2, maxCoins: 4, coinGap: 0.28, startDelay: 0.08, burstChance: 0.07, burstAfter: 2200, obstacleChance: 0.15, spawnBonus: 2, airChance: 0.28 };
        return             { coinChance: 0.68, minWavesBetweenCoins: 1, forceCoinAfter: 2, minCoins: 2, maxCoins: 3, coinGap: 0.26, startDelay: 0.06, burstChance: 0.05, burstAfter: 2500, obstacleChance: 0,    spawnBonus: 0, airChance: 0.22 };
    }

    // প্রতি লেভেলে আলাদা ব্যাকগ্রাউন্ড (images ফোল্ডার অনুযায়ী)
    const LEVEL_BACKGROUNDS = [
        "./images/background_level1.png",
        "./images/background_level2.jpg",
        "./images/background_level3.png",
        "./images/background1.jpg"
    ];

    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");

    function setupCanvas() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(CANVAS_W * dpr);
        canvas.height = Math.round(CANVAS_H * dpr);
        canvas.style.width = CANVAS_W + "px";
        canvas.style.height = CANVAS_H + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = true;
        if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";
    }
    setupCanvas();
    window.addEventListener("resize", setupCanvas);

    function px(n) { return Math.round(n); }

    const vanishingPointX = CANVAS_W / 2;
    const vanishingPointY = CANVAS_H * 0.44;

    // ─── Save (Subway Surfers style) ─────────────────────────────────────────
    const SaveManager = {
        defaults: {
            totalCoins: 0,
            highScore: 0,
            bestLevel: 1,
            totalRuns: 0,
            totalDistance: 0,
            upgrades: { dashBoost: 0, luckyStart: 0 },
            settings: { music: true, sfx: true },
            dailyBest: 0,
            lastPlayDate: ""
        },
        load() {
            try {
                const raw = localStorage.getItem(SAVE_KEY);
                return raw ? { ...this.defaults, ...JSON.parse(raw) } : { ...this.defaults };
            } catch {
                return { ...this.defaults };
            }
        },
        save(data) {
            try {
                localStorage.setItem(SAVE_KEY, JSON.stringify(data));
            } catch (e) {
                console.warn("Save failed:", e);
            }
        },
        persistRun(score, coins, level, distance) {
            const s = this.load();
            s.totalCoins += coins;
            s.highScore = Math.max(s.highScore, score);
            s.bestLevel = Math.max(s.bestLevel, level);
            s.totalRuns += 1;
            s.totalDistance += distance;
            const today = new Date().toDateString();
            if (s.lastPlayDate !== today) {
                s.dailyBest = score;
                s.lastPlayDate = today;
            } else {
                s.dailyBest = Math.max(s.dailyBest, score);
            }
            this.save(s);
            return s;
        }
    };

    let saveData = SaveManager.load();

    // ─── Audio (MP3 + Web Audio fallback) ────────────────────────────────────
    const AudioMgr = {
        unlocked: false,
        bgOk: false,
        fallbackOn: false,
        ac: null,
        fallbackTimer: null,
        fallbackStep: 0,
        melody: [196, 246.94, 293.66, 392, 293.66, 246.94, 220, 196],

        clips: {
            bg: new Audio("./sounds/bg-music.mp3"),
            coin: new Audio("./sounds/coin.mp3"),
            busted: new Audio("./sounds/busted.mp3"),
            jump: new Audio("./sounds/jump.mp3")
        },

        init() {
            this.clips.bg.loop = true;
            this.clips.bg.volume = 0.32;
            this.clips.coin.volume = 0.45;
            this.clips.busted.volume = 0.6;
            this.clips.jump.volume = 0.5;
            this.clips.bg.addEventListener("canplaythrough", () => { this.bgOk = true; });
            this.clips.bg.addEventListener("error", () => { this.bgOk = false; });
            const unlock = () => {
                if (this.unlocked) return;
                this.unlocked = true;
                try {
                    this.ac = new (window.AudioContext || window.webkitAudioContext)();
                    if (this.ac.state === "suspended") this.ac.resume();
                } catch (e) { /* ignore */ }
            };
            window.addEventListener("pointerdown", unlock, { once: true });
            window.addEventListener("keydown", unlock, { once: true });
        },

        beep(freq, dur, vol, type) {
            if (!saveData.settings.sfx || !this.ac) return;
            const t = this.ac.currentTime;
            const osc = this.ac.createOscillator();
            const g = this.ac.createGain();
            osc.type = type || "square";
            osc.frequency.value = freq;
            g.gain.setValueAtTime(vol, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + dur);
            osc.connect(g);
            g.connect(this.ac.destination);
            osc.start(t);
            osc.stop(t + dur);
        },

        startFallbackMusic() {
            if (this.fallbackOn || !saveData.settings.music) return;
            if (!this.ac) {
                try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
            }
            if (this.ac.state === "suspended") this.ac.resume();
            this.fallbackOn = true;
            this.fallbackTimer = setInterval(() => {
                const n = this.melody[this.fallbackStep % this.melody.length];
                this.beep(n, 0.14, 0.045, "triangle");
                if (this.fallbackStep % 2 === 0) this.beep(n / 2, 0.2, 0.03, "sine");
                this.fallbackStep++;
            }, 240);
        },

        stopFallbackMusic() {
            if (this.fallbackTimer) clearInterval(this.fallbackTimer);
            this.fallbackTimer = null;
            this.fallbackOn = false;
        },

        startMusic() {
            if (!saveData.settings.music) return;
            if (!this.unlocked) {
                try {
                    this.ac = new (window.AudioContext || window.webkitAudioContext)();
                    this.unlocked = true;
                } catch (e) { /* ignore */ }
            }
            if (this.bgOk) {
                this.clips.bg.currentTime = 0;
                this.clips.bg.play().catch(() => this.startFallbackMusic());
            } else {
                this.startFallbackMusic();
            }
        },

        stopMusic() {
            this.clips.bg.pause();
            this.stopFallbackMusic();
        },

        playJump() {
            if (!saveData.settings.sfx) return;
            const j = this.clips.jump;
            if (j.readyState >= 2) { j.currentTime = 0; j.play().catch(() => this.beep(520, 0.08, 0.06, "square")); }
            else this.beep(520, 0.08, 0.06, "square");
        },

        playCoin() {
            if (!saveData.settings.sfx) return;
            const c = this.clips.coin;
            if (c.readyState >= 2) { c.currentTime = 0; c.play().catch(() => this.beep(880, 0.1, 0.05, "sine")); }
            else this.beep(880, 0.1, 0.05, "sine");
        },

        playBusted() {
            if (!saveData.settings.sfx) return;
            const b = this.clips.busted;
            if (b.readyState >= 2) { b.currentTime = 0; b.play().catch(() => { this.beep(180, 0.35, 0.08, "sawtooth"); }); }
            else this.beep(180, 0.35, 0.08, "sawtooth");
        }
    };
    AudioMgr.init();

    function startMusic() { AudioMgr.startMusic(); }
    function stopMusic() { AudioMgr.stopMusic(); }
    function playSfx(name) {
        if (name === "jump") AudioMgr.playJump();
        else if (name === "coin") AudioMgr.playCoin();
        else if (name === "busted") AudioMgr.playBusted();
    }

    // ─── Images ──────────────────────────────────────────────────────────────
    const imgs = {
        bg: new Image(),
        thief: new Image(),
        money: new Image(),
        police: new Image(),
        log: new Image(),
        car: new Image(),
        train: new Image()
    };
    imgs.thief.src = "./images/thief.png";
    imgs.money.src = "./images/moneybag.png";
    imgs.police.src = "./images/police.png";
    imgs.log.src = "./images/log_transparent.png";
    imgs.train.src = "./images/train.png";

    const bgPreload = new Image();

    function getTheme(level) {
        let theme = LEVEL_THEMES[0];
        for (const t of LEVEL_THEMES) {
            if (level >= t.min) theme = t;
        }
        return theme;
    }

    function updateBackground(level) {
        const primary = LEVEL_BACKGROUNDS[(level - 1) % LEVEL_BACKGROUNDS.length];
        const fallbacks = [
            primary,
            `./images/background_level${((level - 1) % 3) + 1}.png`,
            `./images/background_level${((level - 1) % 3) + 1}.jpg`,
            "./images/background1.jpg"
        ];
        tryLoadBg(fallbacks, 0);
    }

    function tryLoadBg(paths, i) {
        if (i >= paths.length) return;
        bgPreload.onload = () => { imgs.bg.src = paths[i]; };
        bgPreload.onerror = () => tryLoadBg(paths, i + 1);
        bgPreload.src = paths[i];
    }
    updateBackground(1);

    function syncGameSpeed() {
        if (player.isDashing) {
            gameSpeed = Math.min(SPEED.MAX, baseSpeed + SPEED.DASH_ADD + saveData.upgrades.dashBoost * 0.15);
        } else {
            gameSpeed = baseSpeed;
        }
    }

    // ─── Game state ──────────────────────────────────────────────────────────
    const State = { MENU: 0, PLAYING: 1, LEVEL_UP: 2, PAUSED: 3, GAME_OVER: 4, SHOP: 5 };
    let gameState = State.MENU;

    let score = 0;
    let runCoins = 0;
    let combo = 0;
    let comboTimer = 0;
    let baseSpeed = SPEED.START;
    let gameSpeed = SPEED.START;
    let spawnTimer = 0;
    let items = [];
    let particles = [];
    let floatTexts = [];
    let roadsideDecorations = [];
    let currentLevel = 1;
    let levelTimer = 0;
    let levelUpTimer = 0;
    let lastObstacleLane = -1;
    let revivedThisRun = false;
    let runPersisted = false;
    let screenShake = 0;
    let runDistance = 0;
    let wavesSinceCoin = 0;

    const player = {
        lane: 1,
        x: CANVAS_W / 2,
        baseY: CANVAS_H - 178,
        y: CANVAS_H - 178,
        width: 128,
        height: 158,
        isDashing: false,
        dashTimer: 0,
        dashCooldown: 0,
        animTimer: 0,
        runTilt: 0,
        isJumping: false,
        jumpY: 0,
        jumpVelocity: 0,
        gravity: 0.65,
        magnetRadius: 0
    };

    const police = { x: CANVAS_W / 2, y: CANVAS_H + 150, width: 145, height: 175 };

    // ─── Helpers ─────────────────────────────────────────────────────────────
    function getLaneX(lane, progress) {
        const endX = 75 + lane * 140;
        return vanishingPointX + (endX - vanishingPointX) * progress;
    }

    function getRoadY(progress) {
        return vanishingPointY + (CANVAS_H - vanishingPointY) * progress;
    }

    function getRoadsideX(side, progress) {
        const laneX = side === -1 ? getLaneX(0, progress) : getLaneX(2, progress);
        const offset = 48 + progress * 35;
        return side === -1 ? laneX - offset : laneX + offset;
    }

    function pickObstacleType(level) {
        const types = getTheme(level).obstacles.filter((t) => obstacleReady(t));
        if (!types.length) return null;
        return types[Math.floor(Math.random() * types.length)];
    }

    function obstacleReady(type) {
        const def = OBSTACLES[type];
        if (!def) return false;
        if (def.kind === "image") {
            const img = imgs[def.img];
            return img && img.complete && img.naturalWidth > 0;
        }
        return true;
    }

    function isJumpableObstacle(type) {
        return OBSTACLES[type] ? OBSTACLES[type].jumpable : false;
    }

    function pickObstacleLane() {
        let lane;
        let tries = 0;
        do {
            lane = Math.floor(Math.random() * 3);
            tries++;
        } while (lane === lastObstacleLane && tries < 4 && Math.random() > 0.35);
        lastObstacleLane = lane;
        return lane;
    }

    function spawnObstacle(lane, type) {
        if (!type || !obstacleReady(type)) return;
        const def = OBSTACLES[type];
        items.push({
            lane,
            progress: 0,
            isObstacle: true,
            type,
            width: def.w,
            height: def.h
        });
    }

    function spawnStarterCoins() {
        pushCoin(1, -0.08, false);
        pushCoin(1, -0.32, false);
        pushCoin(0, -0.52, false);
    }

    function pushCoin(lane, progress, isAir) {
        items.push({
            lane,
            progress,
            isObstacle: false,
            isAirCoin: isAir,
            width: COIN_SIZE,
            height: COIN_SIZE
        });
    }

    function spawnCoinWave(theme, cfg, isBurst) {
        const airChance = theme.airCoinBoost ? cfg.airChance + 0.12 : cfg.airChance;
        const waveLane = Math.floor(Math.random() * 3);
        const delay = cfg.startDelay + Math.random() * 0.12;
        let coinCount;

        if (isBurst) {
            coinCount = cfg.maxCoins + Math.floor(Math.random() * 3) + 1;
        } else if (Math.random() < 0.40) {
            coinCount = 1;
        } else {
            coinCount = cfg.minCoins + Math.floor(Math.random() * (cfg.maxCoins - cfg.minCoins + 1));
        }

        const gap = isBurst ? cfg.coinGap * 0.9 : cfg.coinGap;
        const sameLane = coinCount > 1;
        const isAir = Math.random() < airChance;

        for (let i = 0; i < coinCount; i++) {
            const lane = sameLane ? waveLane : Math.floor(Math.random() * 3);
            const air = isAir && (coinCount === 1 || i > 0);
            pushCoin(lane, -(delay + i * gap), air);
        }
    }

    function spawnRoadsideLogs() {
        const stagger = Math.random() * 0.08;
        [-1, 1].forEach((side) => {
            roadsideDecorations.push({
                side,
                progress: -stagger,
                scaleFactor: 0.9 + Math.random() * 0.2
            });
        });
    }

    function spawnWave() {
        const theme = getTheme(currentLevel);
        const cfg = getSpawnConfig(currentLevel);
        const types = theme.obstacles.filter((t) => obstacleReady(t));
        const hasObstacles = types.length > 0;

        wavesSinceCoin++;
        let didSpawn = false;

        if (runDistance > cfg.burstAfter && wavesSinceCoin >= 2 && Math.random() < cfg.burstChance) {
            spawnCoinWave(theme, cfg, true);
            wavesSinceCoin = 0;
            didSpawn = true;
        } else if (wavesSinceCoin >= cfg.minWavesBetweenCoins && Math.random() < cfg.coinChance) {
            spawnCoinWave(theme, cfg, false);
            wavesSinceCoin = 0;
            didSpawn = true;
        } else if (hasObstacles && Math.random() < cfg.obstacleChance) {
            const type = pickObstacleType(currentLevel);
            if (type) {
                spawnObstacle(pickObstacleLane(), type);
                if (theme.doubleSpawn && Math.random() > 0.58) {
                    let lane2 = pickObstacleLane();
                    if (lane2 === lastObstacleLane) lane2 = (lane2 + 1) % 3;
                    spawnObstacle(lane2, pickObstacleType(currentLevel));
                }
                didSpawn = true;
            }
        }

        if (!didSpawn && wavesSinceCoin >= cfg.forceCoinAfter) {
            spawnCoinWave(theme, cfg, false);
            wavesSinceCoin = 0;
        }

        if (roadsideDecorations.length < 14 && Math.random() > 0.60) spawnRoadsideLogs();
    }

    function addParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6 - 2,
                life: 25 + Math.random() * 15,
                color,
                size: 3 + Math.random() * 4
            });
        }
    }

    function addFloatText(x, y, text, color) {
        floatTexts.push({ x, y, text, color, life: 45, vy: -1.2 });
    }

    // ─── Input ───────────────────────────────────────────────────────────────
    let touchStartX = 0;
    let touchStartY = 0;
    let touchTime = 0;

    function moveLeft() {
        if (player.lane > 0) player.lane--;
    }

    function moveRight() {
        if (player.lane < 2) player.lane++;
    }

    function doJump() {
        if (gameState !== State.PLAYING || player.isJumping || player.isDashing) return;
        player.isJumping = true;
        player.jumpVelocity = 14;
        syncGameSpeed();
        playSfx("jump");
    }

    function doDash() {
        if (gameState !== State.PLAYING || player.isJumping) return;
        const cdReduction = saveData.upgrades.dashBoost * 20;
        if (player.dashCooldown > cdReduction || player.isDashing) return;
        player.isDashing = true;
        player.dashTimer = 15;
        player.dashCooldown = Math.max(80, 150 - cdReduction);
        syncGameSpeed();
        playSfx("jump");
    }

    window.addEventListener("keydown", (e) => {
        if (gameState === State.MENU) {
            startMusic();
            if (e.code === "Enter" || e.code === "Space") startGame();
            if (e.code === "KeyS") { gameState = State.SHOP; return; }
            return;
        }
        if (gameState === State.SHOP) {
            if (e.code === "Escape" || e.code === "KeyS") gameState = State.MENU;
            if (e.code === "Digit1" && saveData.totalCoins >= 100) buyUpgrade("dashBoost", 100);
            if (e.code === "Digit2" && saveData.totalCoins >= 150) buyUpgrade("luckyStart", 150);
            return;
        }
        if (gameState === State.GAME_OVER) {
            if (e.code === "KeyR") startGame();
            if (e.code === "Escape") { persistRunIfNeeded(); gameState = State.MENU; stopMusic(); hideOverlay(); }
            if (e.code === "KeyC" && !revivedThisRun && saveData.totalCoins >= REVIVE_COST) tryRevive();
            return;
        }
        if (gameState === State.LEVEL_UP) return;
        if (gameState === State.PAUSED) {
            if (e.code === "Escape" || e.code === "KeyP") gameState = State.PLAYING;
            return;
        }
        if (gameState !== State.PLAYING) return;

        if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
            e.preventDefault();
        }
        if (e.repeat && (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW")) return;

        startMusic();

        if (e.code === "ArrowLeft" || e.code === "KeyA") moveLeft();
        if (e.code === "ArrowRight" || e.code === "KeyD") moveRight();
        if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") doJump();
        if (e.code === "ShiftLeft" || e.code === "ShiftRight") doDash();
        if (e.code === "Escape" || e.code === "KeyP") gameState = State.PAUSED;
    });

    canvas.addEventListener("mousedown", () => {
        if (gameState === State.MENU || gameState === State.PLAYING) startMusic();
    });

    canvas.addEventListener("touchstart", (e) => {
        e.preventDefault();
        if (gameState === State.MENU) startMusic();
        const t = e.touches[0];
        touchStartX = t.clientX;
        touchStartY = t.clientY;
        touchTime = Date.now();
    }, { passive: false });

    canvas.addEventListener("touchend", (e) => {
        e.preventDefault();
        if (gameState === State.MENU) { startMusic(); startGame(); return; }
        if (gameState === State.GAME_OVER) { startGame(); return; }
        if (gameState !== State.PLAYING) return;

        const t = e.changedTouches[0];
        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;
        const dt = Date.now() - touchTime;

        if (Math.abs(dy) > Math.abs(dx) && dy < -35) {
            doJump();
            startMusic();
            return;
        }
        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx < -40) moveLeft();
            else if (dx > 40) moveRight();
        } else if (dt < 250 && Math.abs(dx) < 25 && Math.abs(dy) < 25) {
            doDash();
        } else if (dy > 40 && gameState === State.PAUSED) {
            gameState = State.PLAYING;
        }
        startMusic();
    }, { passive: false });

    document.querySelectorAll("[data-action]").forEach((btn) => {
        btn.addEventListener("touchstart", (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            if (action === "left") moveLeft();
            if (action === "right") moveRight();
            if (action === "jump") doJump();
            if (action === "dash") doDash();
            if (action === "play") startGame();
            if (action === "menu") { gameState = State.MENU; stopMusic(); hideOverlay(); }
            if (action === "shop") gameState = State.SHOP;
            if (action === "revive") tryRevive();
            if (gameState === State.PLAYING) startMusic();
        });
    });

    // ─── Core logic ──────────────────────────────────────────────────────────
    function startGame() {
        if (gameState === State.GAME_OVER && !runPersisted) persistRunIfNeeded();
        score = 0;
        runCoins = 0;
        combo = 0;
        comboTimer = 0;
        baseSpeed = SPEED.START + saveData.upgrades.luckyStart * 0.02;
        gameSpeed = baseSpeed;
        player.isDashing = false;
        syncGameSpeed();
        spawnTimer = 0;
        items = [];
        spawnStarterCoins();
        particles = [];
        floatTexts = [];
        roadsideDecorations = [];
        currentLevel = 1;
        levelTimer = 0;
        lastObstacleLane = -1;
        revivedThisRun = false;
        runPersisted = false;
        screenShake = 0;
        runDistance = 0;
        wavesSinceCoin = 0;
        player.lane = 1;
        player.x = CANVAS_W / 2;
        player.y = player.baseY;
        player.isDashing = false;
        player.dashTimer = 0;
        player.dashCooldown = 0;
        player.isJumping = false;
        player.jumpY = 0;
        player.animTimer = 0;
        player.invincible = 0;
        police.y = CANVAS_H + 150;
        updateBackground(1);
        for (let i = 0; i < 3; i++) {
            const stagger = i * 0.16;
            [-1, 1].forEach((side) => {
                roadsideDecorations.push({
                    side,
                    progress: -stagger,
                    scaleFactor: 0.88 + Math.random() * 0.18
                });
            });
        }
        gameState = State.PLAYING;
        hideOverlay();
        startMusic();
    }

    function persistRunIfNeeded() {
        if (runPersisted) return;
        saveData = SaveManager.persistRun(score, runCoins, currentLevel, runDistance);
        runPersisted = true;
    }

    function tryRevive() {
        if (revivedThisRun || saveData.totalCoins < REVIVE_COST) return;
        saveData.totalCoins -= REVIVE_COST;
        SaveManager.save(saveData);
        revivedThisRun = true;
        gameState = State.PLAYING;
        screenShake = 0;
        police.y = CANVAS_H + 150;
        items = items.filter((it) => it.progress < 0.7);
        player.invincible = 90;
        hideOverlay();
        startMusic();
    }

    function buyUpgrade(key, cost) {
        if (saveData.totalCoins < cost || saveData.upgrades[key] >= 3) return;
        saveData.totalCoins -= cost;
        saveData.upgrades[key]++;
        SaveManager.save(saveData);
    }

    function triggerGameOver() {
        gameState = State.GAME_OVER;
        stopMusic();
        playSfx("busted");
        police.y = CANVAS_H + 60;
        screenShake = 12;
        const canRevive = !revivedThisRun && saveData.totalCoins >= REVIVE_COST;
        if (!canRevive) persistRunIfNeeded();
        showGameOverUI();
    }

    function hideOverlay() {
        const el = document.getElementById("overlay");
        if (el) el.classList.add("hidden");
    }

    function showGameOverUI() {
        const el = document.getElementById("overlay");
        if (!el) return;
        el.classList.remove("hidden");
        el.innerHTML = `
            <div class="panel gameover">
                <h1>BUSTED!</h1>
                <div class="stats">
                    <div><span>Score</span><strong>${score}</strong></div>
                    <div><span>Best</span><strong>${saveData.highScore}</strong></div>
                    <div><span>Coins (run)</span><strong>🪙 ${runCoins}</strong></div>
                    <div><span>Total Coins</span><strong>🪙 ${saveData.totalCoins}</strong></div>
                    <div><span>Level</span><strong>${currentLevel}</strong></div>
                </div>
                ${!revivedThisRun && saveData.totalCoins >= REVIVE_COST ? `<button class="btn btn-gold" data-action="revive">Continue — 🪙 ${REVIVE_COST}</button>` : ""}
                <button class="btn btn-primary" data-action="play">Run Again</button>
                <button class="btn btn-ghost" data-action="menu">Main Menu</button>
            </div>`;
        el.querySelectorAll("[data-action]").forEach((b) => {
            b.addEventListener("click", (e) => {
                e.stopPropagation();
                const a = b.dataset.action;
                if (a === "play") startGame();
                if (a === "menu") { persistRunIfNeeded(); gameState = State.MENU; stopMusic(); hideOverlay(); }
                if (a === "revive") tryRevive();
            });
        });
    }

    function update() {
        // Particles
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.15;
            p.life--;
            if (p.life <= 0) particles.splice(i, 1);
        }
        for (let i = floatTexts.length - 1; i >= 0; i--) {
            const f = floatTexts[i];
            f.y += f.vy;
            f.life--;
            if (f.life <= 0) floatTexts.splice(i, 1);
        }
        if (screenShake > 0) screenShake *= 0.85;

        if (gameState === State.MENU || gameState === State.SHOP || gameState === State.PAUSED) return;

        if (gameState === State.LEVEL_UP) {
            levelUpTimer--;
            if (levelUpTimer <= 0) gameState = State.PLAYING;
            return;
        }

        if (gameState === State.GAME_OVER) {
            if (police.y > player.y - 15) police.y -= 9;
            return;
        }

        if (gameState !== State.PLAYING) return;

        if (player.invincible > 0) player.invincible--;

        syncGameSpeed();

        // Level progression
        if (currentLevel < MAX_LEVEL) {
            levelTimer++;
            if (levelTimer >= LEVEL_FRAMES) {
                currentLevel++;
                baseSpeed = Math.min(SPEED.MAX, baseSpeed + SPEED.LEVEL_ADD);
                syncGameSpeed();
                levelTimer = 0;
                updateBackground(currentLevel);
                gameState = State.LEVEL_UP;
                levelUpTimer = 90;
                playSfx("coin");
            }
        }

        score++;
        runDistance++;
        if (comboTimer > 0) comboTimer--;
        else combo = 0;

        // Player physics
        if (player.isJumping) {
            player.animTimer += 0.14;
            player.jumpY += player.jumpVelocity;
            player.jumpVelocity -= player.gravity;
            if (player.jumpY <= 0) {
                player.jumpY = 0;
                player.isJumping = false;
            }
            player.y = player.baseY - player.jumpY;
            player.runTilt = 0;
        } else {
            player.animTimer += player.isDashing ? 0.45 : 0.34;
            player.y = player.baseY + Math.sin(player.animTimer) * -5;
            player.runTilt = 0;
        }

        police.x = player.x;
        const targetX = 75 + player.lane * 140;
        player.x += (targetX - player.x) * 0.2;

        if (player.isDashing) {
            player.dashTimer--;
            if (player.dashTimer <= 0) {
                player.isDashing = false;
                syncGameSpeed();
            }
        }
        if (player.dashCooldown > 0) player.dashCooldown--;

        spawnTimer++;
        const theme = getTheme(currentLevel);
        const spawnCfg = getSpawnConfig(currentLevel);
        let spawnInterval = Math.max(SPEED.SPAWN_MIN, SPEED.SPAWN_START - currentLevel * SPEED.SPAWN_PER_LEVEL);
        spawnInterval += spawnCfg.spawnBonus;
        if (theme.doubleSpawn) spawnInterval = Math.max(SPEED.SPAWN_MIN + 8, spawnInterval + 6);
        if (spawnTimer > spawnInterval) {
            spawnWave();
            spawnTimer = 0;
        }

        for (let i = roadsideDecorations.length - 1; i >= 0; i--) {
            roadsideDecorations[i].progress += gameSpeed * SPEED.MOVE_MUL;
            if (roadsideDecorations[i].progress > 1.05) roadsideDecorations.splice(i, 1);
        }

        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            item.progress += gameSpeed * SPEED.MOVE_MUL;
            if (item.progress < 0) continue;

            const ix = getLaneX(item.lane, item.progress);
            const iy = vanishingPointY + (CANVAS_H - vanishingPointY) * item.progress;

            // Magnet-style near collect for dash
            if (!item.isObstacle && player.isDashing && item.progress > 0.75 && item.progress < 0.98) {
                const dx = Math.abs(player.x - ix);
                if (dx < 80 && Math.abs(player.lane - item.lane) <= 1) {
                    item.lane = player.lane;
                }
            }

            if (item.progress >= 0.86 && item.progress <= 0.97) {
                if (player.lane === item.lane) {
                    if (item.isObstacle) {
                        if (player.invincible > 0) continue;
                        const canJump = isJumpableObstacle(item.type) && player.jumpY > 42;
                        if (!player.isJumping || !canJump) {
                            triggerGameOver();
                            return;
                        }
                    } else {
                        let ok = false;
                        if (item.isAirCoin && player.jumpY > 38) ok = true;
                        else if (!item.isAirCoin && player.jumpY < 60) ok = true;

                        if (ok) {
                            combo++;
                            comboTimer = 120;
                            const bonus = 100 + combo * 15;
                            score += bonus;
                            runCoins++;
                            playSfx("coin");
                            addParticles(ix, iy, "#ffcc00", 8);
                            addFloatText(ix, iy - 30, combo > 1 ? `+${bonus} x${combo}` : `+${bonus}`, "#ffcc00");
                            items.splice(i, 1);
                            continue;
                        }
                    }
                }
            }

            if (item.progress > 1.05) items.splice(i, 1);
        }
    }

    // ─── Draw ────────────────────────────────────────────────────────────────
    function drawImageOrRect(img, x, y, w, h, color) {
        if (img.complete && img.naturalWidth) ctx.drawImage(img, x, y, w, h);
        else { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
    }

    function drawThiefSprite(dx, dy, dw, dh, alpha) {
        if (!imgs.thief.complete || !imgs.thief.naturalWidth) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.drawImage(imgs.thief, px(dx), px(dy), dw, dh);
        ctx.restore();
    }

    function drawFootSparks(x, y) {
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2 + player.animTimer;
            const dist = 6 + (i % 3) * 4;
            ctx.fillStyle = i % 2 === 0 ? "#ffd54f" : "#fff8e1";
            ctx.globalAlpha = 0.55 - i * 0.08;
            ctx.beginPath();
            ctx.arc(px(x + Math.cos(a) * dist), px(y + Math.sin(a) * dist * 0.4), 2 + i * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawProThief() {
        const cx = player.x;
        const cy = player.y;
        const w = player.width;
        const h = player.height;
        const t = player.animTimer;
        const jump = player.isJumping;
        const footY = player.baseY + h - 6;

        const shadowW = Math.max(22, 42 - player.jumpY * 0.18);
        ctx.fillStyle = "rgba(0,0,0,0.32)";
        ctx.beginPath();
        ctx.ellipse(px(cx), px(footY + 4), shadowW, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        const runBob = jump ? 0 : Math.sin(t) * 3;
        const runSway = jump ? 0 : Math.sin(t * 2) * 1.5;
        const squash = jump ? 1.04 : 1 - Math.abs(Math.sin(t)) * 0.025;
        const targetX = 75 + player.lane * 140;
        const lean = Math.max(-0.06, Math.min(0.06, (targetX - cx) * 0.0008));

        if (player.isDashing && imgs.thief.complete) {
            for (let g = 3; g >= 1; g--) {
                drawThiefSprite(cx - w / 2 - g * 10, cy + runBob + 2, w, h, 0.12 * g);
            }
        }

        if (!jump && Math.sin(t) > 0.82) {
            drawFootSparks(cx, footY);
        }

        ctx.save();
        if (player.invincible > 0 && Math.floor(player.invincible / 8) % 2 === 0) {
            ctx.globalAlpha = 0.55;
        }

        ctx.translate(px(cx + runSway), px(cy + h / 2 + runBob));
        ctx.rotate(lean);
        ctx.scale(1, squash);

        if (imgs.thief.complete && imgs.thief.naturalWidth) {
            ctx.shadowColor = "rgba(0,0,0,0.45)";
            ctx.shadowBlur = jump ? 12 : 7;
            ctx.shadowOffsetY = 4;
            ctx.drawImage(imgs.thief, px(-w / 2), px(-h / 2), w, h);
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
        } else {
            ctx.fillStyle = "#5b6ee1";
            ctx.fillRect(px(-w / 2), px(-h / 2), w, h);
        }

        ctx.restore();
    }

    function drawCoin(cx, cy, size) {
        const x = px(cx);
        const y = px(cy);
        const r = size / 2;

        ctx.save();
        ctx.shadowColor = "rgba(255,200,0,0.55)";
        ctx.shadowBlur = 10;
        const g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.1, x, y, r);
        g.addColorStop(0, "#fff4a8");
        g.addColorStop(0.45, "#ffc107");
        g.addColorStop(1, "#e68a00");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = "#b8730a";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#8b5a00";
        ctx.font = `bold ${Math.max(10, Math.floor(r * 0.9))}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("$", x, y + 1);
        ctx.restore();
    }

    function drawObstacleItem(type, cx, cy, sw, sh) {
        const def = OBSTACLES[type];
        if (!def) return;
        const x = px(cx - sw / 2);
        const y = px(cy - sh);

        if (def.kind === "image") {
            const img = imgs[def.img];
            if (img && img.complete && img.naturalWidth) {
                ctx.drawImage(img, x, y, sw, sh);
                return;
            }
        }
        if (type === "cone") {
            ctx.fillStyle = "#ff6b35";
            ctx.beginPath();
            ctx.moveTo(cx, y);
            ctx.lineTo(x + sw, y + sh);
            ctx.lineTo(x, y + sh);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "#fff";
            ctx.fillRect(x + sw * 0.15, y + sh * 0.55, sw * 0.7, sh * 0.12);
            ctx.fillStyle = "#444";
            ctx.fillRect(x + sw * 0.05, y + sh * 0.88, sw * 0.9, sh * 0.12);
        }
    }

    function drawMenu() {
        const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
        g.addColorStop(0, "#0f172a");
        g.addColorStop(1, "#1e3a5f");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        ctx.textAlign = "center";
        ctx.fillStyle = "#ff3838";
        ctx.font = "bold 48px sans-serif";
        ctx.fillText("HEIST RUN", CANVAS_W / 2, 140);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "16px sans-serif";
        ctx.fillText("Endless Thief Runner", CANVAS_W / 2, 175);

        const menuT = Date.now() / 180;
        const saved = { x: player.x, y: player.y, baseY: player.baseY, w: player.width, h: player.height, t: player.animTimer };
        player.x = CANVAS_W / 2;
        player.y = 300;
        player.baseY = 300;
        player.width = 128;
        player.height = 158;
        player.animTimer = menuT;
        player.isJumping = false;
        player.jumpY = 0;
        drawProThief();
        player.x = saved.x;
        player.y = saved.y;
        player.baseY = saved.baseY;
        player.width = saved.w;
        player.height = saved.h;
        player.animTimer = saved.t;

        ctx.fillStyle = "#fff";
        ctx.font = "bold 18px sans-serif";
        ctx.fillText("▶  TAP or ENTER to Play", CANVAS_W / 2, 430);
        ctx.fillStyle = "#ffcc00";
        ctx.font = "14px sans-serif";
        ctx.fillText(`🪙 ${saveData.totalCoins}  |  Best: ${saveData.highScore}  |  Lvl ${saveData.bestLevel}`, CANVAS_W / 2, 465);
        ctx.fillStyle = "#64748b";
        ctx.font = "12px sans-serif";
        ctx.fillText("Swipe: ← → lanes  |  ↑ jump  |  Tap: dash", CANVAS_W / 2, 500);
        ctx.fillText("S = Shop  |  ← → A D = lanes  |  Shift = dash", CANVAS_W / 2, 525);
        ctx.textAlign = "left";
    }

    function drawShop() {
        drawMenu();
        ctx.fillStyle = "rgba(0,0,0,0.75)";
        ctx.fillRect(40, 280, CANVAS_W - 80, 280);
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffcc00";
        ctx.font = "bold 22px sans-serif";
        ctx.fillText("🛒 UPGRADE SHOP", CANVAS_W / 2, 320);
        ctx.fillStyle = "#fff";
        ctx.font = "14px sans-serif";
        const u = saveData.upgrades;
        ctx.fillText(`[1] Dash Boost Lv${u.dashBoost}/3 — 100🪙 (faster dash cooldown)`, CANVAS_W / 2, 360);
        ctx.fillText(`[2] Lucky Start Lv${u.luckyStart}/3 — 150🪙 (slightly faster start)`, CANVAS_W / 2, 395);
        ctx.fillStyle = "#94a3b8";
        ctx.fillText("Press S or Esc to close", CANVAS_W / 2, 440);
        ctx.textAlign = "left";
    }

    function drawLevelUp() {
        const theme = getTheme(currentLevel);
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, CANVAS_H / 2 - 80, CANVAS_W, 160);
        ctx.textAlign = "center";
        ctx.fillStyle = "#00ffcc";
        ctx.font = "bold 28px sans-serif";
        ctx.fillText(`LEVEL ${currentLevel}!`, CANVAS_W / 2, CANVAS_H / 2 - 30);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 18px sans-serif";
        ctx.fillText(theme.name, CANVAS_W / 2, CANVAS_H / 2 + 5);
        ctx.fillStyle = "#ffcc00";
        ctx.font = "13px sans-serif";
        ctx.fillText(theme.features, CANVAS_W / 2, CANVAS_H / 2 + 35);
        ctx.textAlign = "left";
    }

    function draw() {
        ctx.save();
        if (gameState === State.GAME_OVER && screenShake > 0.5) {
            ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
        }

        if (gameState === State.MENU) {
            drawMenu();
            ctx.restore();
            return;
        }
        if (gameState === State.SHOP) {
            drawShop();
            ctx.restore();
            return;
        }

        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

        if (imgs.bg.complete && imgs.bg.naturalWidth) {
            ctx.drawImage(imgs.bg, 0, 0, CANVAS_W, CANVAS_H);
        } else {
            const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
            g.addColorStop(0, "#1a365d");
            g.addColorStop(1, "#0d1f33");
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        }

        roadsideDecorations.forEach((dec) => {
            if (dec.progress < 0 || dec.progress > 1.05) return;
            const roadY = px(getRoadY(dec.progress));
            const cx = px(getRoadsideX(dec.side, dec.progress));
            const scale = (0.25 + dec.progress * 3.8) * (dec.scaleFactor || 1);
            const sw = px(95 * scale);
            const sh = px(42 * scale);
            if (imgs.log.complete && imgs.log.naturalWidth) {
                ctx.drawImage(imgs.log, px(cx - sw / 2), px(roadY - sh), sw, sh);
            }
        });

        items.forEach((item) => {
            if (item.progress < 0) return;
            const cx = px(getLaneX(item.lane, item.progress));
            const baseY = vanishingPointY + (CANVAS_H - vanishingPointY) * item.progress;
            const cy = px(item.isAirCoin ? baseY - 65 * item.progress * 2 : baseY);
            const sw = px(item.width + item.width * item.progress * 4.5);
            const sh = px(item.height + item.height * item.progress * 4.5);

            if (item.isObstacle) {
                drawObstacleItem(item.type, cx, cy, sw, sh);
            } else {
                const coinSz = Math.min(52, COIN_SIZE * (0.4 + item.progress * 1.8));
                drawCoin(cx, cy - coinSz * 0.2, coinSz);
            }
        });

        particles.forEach((p) => {
            ctx.globalAlpha = p.life / 40;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        floatTexts.forEach((f) => {
            ctx.globalAlpha = f.life / 45;
            ctx.fillStyle = f.color;
            ctx.font = "bold 14px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(f.text, f.x, f.y);
        });
        ctx.globalAlpha = 1;
        ctx.textAlign = "left";

        drawProThief();

        if (gameState === State.GAME_OVER && imgs.police.complete) {
            drawImageOrRect(imgs.police, police.x - police.width / 2, police.y, police.width, police.height, "#1e40af");
        }

        // HUD bar
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(10, 10, CANVAS_W - 20, 58, 10);
        else ctx.rect(10, 10, CANVAS_W - 20, 58);
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.font = "bold 13px 'Courier New', sans-serif";
        ctx.fillText("SCORE:" + score, 22, 38);
        ctx.fillStyle = "#ffcc00";
        ctx.fillText("🪙" + runCoins, 130, 38);
        ctx.fillStyle = "#00ffcc";
        ctx.fillText("LV" + currentLevel, 200, 38);
        if (combo > 1) {
            ctx.fillStyle = "#ff6b6b";
            ctx.fillText("x" + combo + " COMBO", 250, 38);
        }
        ctx.fillStyle = player.dashCooldown === 0 ? "#00ffff" : "#888";
        ctx.font = "bold 10px sans-serif";
        ctx.fillText(player.dashCooldown === 0 ? "⚡ DASH READY" : "⏳ Dash...", CANVAS_W - 115, 38);

        const theme = getTheme(currentLevel);
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "10px sans-serif";
        ctx.fillText(theme.name, 22, 58);

        if (gameState === State.LEVEL_UP) drawLevelUp();

        if (gameState === State.PAUSED) {
            ctx.fillStyle = "rgba(0,0,0,0.8)";
            ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
            ctx.textAlign = "center";
            ctx.fillStyle = "#fff";
            ctx.font = "bold 32px sans-serif";
            ctx.fillText("PAUSED", CANVAS_W / 2, CANVAS_H / 2);
            ctx.font = "14px sans-serif";
            ctx.fillText("P or Esc to resume", CANVAS_W / 2, CANVAS_H / 2 + 35);
            ctx.textAlign = "left";
        }

        ctx.restore();
    }

    let loopStarted = false;
    function gameLoop() {
        update();
        draw();
        requestAnimationFrame(gameLoop);
    }
    function bootGame() {
        if (loopStarted) return;
        loopStarted = true;
        gameLoop();
    }
    bootGame();
})();

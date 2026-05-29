/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    // =============================================
    // BITNODE MULTIPLIER DETECTION
    // =============================================
    let BN = {};
    try {
        BN = ns.getBitNodeMultipliers();
    } catch (e) {
        // Jika tidak ada akses (butuh Source File 5), pakai nilai default BN1
        BN = {
            HackingLevelMultiplier: 1, ScriptHackMoney: 1,
            ServerMaxMoney: 1, ServerGrowthRate: 1,
            ServerStartingSecurity: 1, ServerWeakenRate: 1,
            HackExpGain: 1
        };
    }

    const HAS_FORMULAS = ns.fileExists("Formulas.exe", "home");
    // T_DELAY: jeda antar phase dalam 1 batch (W1→H→G→W2)
    // 60ms terlalu agresif → desync pada server besar (omega-net, silver-helix)
    // 100ms lebih aman, sedikit mengurangi batch per window tapi jauh lebih stabil
    const T_DELAY = 100;

    // STEAL CAP adaptif: Kompensasi ScriptHackMoney rendah (BN5 = 0.2x)
    // Di BN5, pencurian lebih sedikit per thread → naikkan agresivitas steal
    const BASE_STEAL_CAP = Math.min(0.50, 0.15 / Math.max(0.1, BN.ScriptHackMoney));

    const HACK_RAM = ns.getScriptRam("/pro-v3/payload/hack.js");
    const GROW_RAM = ns.getScriptRam("/pro-v3/payload/grow.js");
    const WEAK_RAM = ns.getScriptRam("/pro-v3/payload/weaken1.js");

    // Reserve RAM home: 1% dari max RAM home (min 32GB, max 128GB)
    // Ini mencegah home terlalu banyak dipakai untuk workers sehingga script utama tidak cukup RAM
    const HOME_RESERVE = Math.min(128, Math.max(32, ns.getServerMaxRam("home") * 0.01));

    let WORKER_MODE = "all";
    let rawArgs = [...ns.args];
    if (rawArgs.includes("--pserv")) { WORKER_MODE = "pserv"; rawArgs = rawArgs.filter(a => a !== "--pserv"); }
    if (rawArgs.includes("--home")) { WORKER_MODE = "home"; rawArgs = rawArgs.filter(a => a !== "--home"); }
    const WORKER_MODE_LABEL = WORKER_MODE === "pserv" ? "home+pserv" : WORKER_MODE === "home" ? "home only" : "all rooted";

    ns.print("============================================");
    ns.print(" 🌐 HWGW ENGINE V5 — BitNode Adaptive      ");
    ns.print(`    Formulas : ${HAS_FORMULAS ? "✅ YES" : "⚡ NO (estimasi)"}`);
    ns.print(`    Workers  : ${WORKER_MODE_LABEL}`);
    ns.print(`    BN Hack$ : ${(BN.ScriptHackMoney * 100).toFixed(0)}% | Grow: ${(BN.ServerGrowthRate * 100).toFixed(0)}% | Sec: ${BN.ServerStartingSecurity}x`);
    ns.print(`    StealCap : ${(BASE_STEAL_CAP * 100).toFixed(1)}%`);
    ns.print("============================================");

    let targetLocks  = {};
    let recoverLocks = {};  // lock terpisah untuk background recovery
    let initializedWorkers = new Set(["home"]);

    while (true) {
        let workers = filterWorkers(getWorkers(ns), WORKER_MODE);

        // Auto-sync payload ke worker baru
        for (let s of workers) {
            if (!initializedWorkers.has(s)) {
                await ns.scp([
                    "/pro-v3/payload/hack.js", "/pro-v3/payload/grow.js",
                    "/pro-v3/payload/weaken1.js", "/pro-v3/payload/weaken2.js"
                ], s, "home");
                initializedWorkers.add(s);
                ns.print(`✅ Sinkronisasi payload ke server baru: ${s}`);
            }
        }

        let totalFreeRam = calcTotalRam(ns, workers, HOME_RESERVE);

        // maxTargets adaptif RAM — semulus mungkin menyerap miliaran RAM
        let maxTargets = 1;
        if (totalFreeRam > 64) maxTargets = 2;
        if (totalFreeRam > 512) maxTargets = 4;
        if (totalFreeRam > 2000) maxTargets = 7;
        if (totalFreeRam > 8000) maxTargets = 12;
        if (totalFreeRam > 30000) maxTargets = 20;
        if (totalFreeRam > 100000) maxTargets = 30;
        if (totalFreeRam > 500000) maxTargets = 50;

        // Steal cap per loop naik seiring RAM tersedia
        // Untuk server bernilai tinggi (>$500M), batasi steal agar grow bisa kompensasi tepat waktu
        let stealCap = BASE_STEAL_CAP;
        if (totalFreeRam > 1000) stealCap = Math.min(BASE_STEAL_CAP * 1.5, 0.40);
        if (totalFreeRam > 10000) stealCap = Math.min(BASE_STEAL_CAP * 2.0, 0.45);

        let targets = getTopTargets(ns, HAS_FORMULAS, maxTargets, BN);

        // --- DIAGNOSTICS (5% peluang tiap loop) ---
        if (Math.random() < 0.05) {
            ns.print(`\n📊 [DIAGNOSTICS] RAM: ${ns.format.ram(totalFreeRam)} | Targets: TOP ${maxTargets} | Steal Cap: ${(stealCap * 100).toFixed(1)}%`);
            for (let t of targets) {
                let sec = ns.getServerSecurityLevel(t);
                let minSec = ns.getServerMinSecurityLevel(t);
                let money = ns.getServerMoneyAvailable(t);
                let maxMoney = ns.getServerMaxMoney(t);
                let rem = targetLocks[t] ? Math.max(0, Math.ceil((targetLocks[t] - Date.now()) / 1000)) : 0;
                ns.print(`   ${t.padEnd(20)} sec:${sec.toFixed(1)}/${minSec} | $:${ns.format.number(money)}/${ns.format.number(maxMoney)} | lock:${rem}s`);
            }
        }

        // ── PRE-PASS: Server yang depleted (<5% money) mendapat jatah RAM dulu ───
        // Ini mencegah phantasy-like servers memakan seluruh RAM dan menstarve server lain
        let now = Date.now();   // deklarasi di sini, dipakai di pre-pass dan main loop
        let prepTargets = targets.filter(t => {
            if (targetLocks[t] && now < targetLocks[t]) return false;
            let money = ns.getServerMoneyAvailable(t);
            let maxMoney = ns.getServerMaxMoney(t);
            let sec = ns.getServerSecurityLevel(t);
            let minSec = ns.getServerMinSecurityLevel(t);
            let secTolerance = Math.max(0.5, BN.ServerStartingSecurity * 0.3);
            let growThreshold = Math.max(0.70, 0.95 - BN.ScriptHackMoney * 0.10);
            return sec > minSec + secTolerance || money < maxMoney * growThreshold;
        });

        // Bagi RAM secara adil antar semua target yang butuh prep
        let ramPerPrepTarget = prepTargets.length > 0
            ? Math.floor(calcTotalRam(ns, workers, HOME_RESERVE) / prepTargets.length)
            : 0;

        for (let target of prepTargets) {
            now = Date.now();
            if (targetLocks[target] && now < targetLocks[target]) continue;
            let minSec = ns.getServerMinSecurityLevel(target);
            let sec    = ns.getServerSecurityLevel(target);
            let maxMoney = ns.getServerMaxMoney(target);
            let money    = ns.getServerMoneyAvailable(target);
            let secTolerance = Math.max(0.5, BN.ServerStartingSecurity * 0.3);
            let growThreshold = Math.max(0.70, 0.95 - BN.ScriptHackMoney * 0.10);
            let needWeaken = sec > minSec + secTolerance;
            let needGrow   = money < maxMoney * growThreshold;
            if (!needWeaken && !needGrow) continue;

            let ramSlice = Math.min(ramPerPrepTarget, calcTotalRam(ns, workers, HOME_RESERVE));
            let prepTime = performPrepCapped(ns, target, workers, needWeaken, needGrow, sec, minSec, money, maxMoney, BN, ramSlice);
            if (prepTime > 0) {
                targetLocks[target] = now + prepTime + 500;
                ns.print(`🛠️  PREP ${target.padEnd(18)} | RAM slice: ${ns.format.ram(ramSlice)}`);
            }
        }

        for (let target of targets) {
            now = Date.now();
            if (targetLocks[target] && now < targetLocks[target]) continue;

            let minSec = ns.getServerMinSecurityLevel(target);
            let sec = ns.getServerSecurityLevel(target);
            let maxMoney = ns.getServerMaxMoney(target);
            let money = ns.getServerMoneyAvailable(target);

            // BN-adaptive threshold:
            let secTolerance = Math.max(0.5, BN.ServerStartingSecurity * 0.3);
            let growThreshold = Math.max(0.70, 0.95 - BN.ScriptHackMoney * 0.10);

            let needWeaken = sec > minSec + secTolerance;
            let needGrow = money < maxMoney * growThreshold;

            // Target yang perlu prep sudah ditangani di pre-pass, skip di sini
            if (needWeaken || needGrow) continue;

            // ============ BATCH DISPATCH ============
            let networkRam = calcTotalRam(ns, workers);
            let weakTime = ns.getWeakenTime(target);
            let maxBatches = Math.max(1, Math.floor(weakTime / (T_DELAY * 4)));

            let steal = findBestStealPercent(ns, target, networkRam, HACK_RAM, GROW_RAM, WEAK_RAM, stealCap, HAS_FORMULAS, BN);
            let batch = calculateBatch(ns, target, steal, HAS_FORMULAS, BN);
            if (!batch) { targetLocks[target] = now + 5000; continue; }

            let ramPerBatch = batch.tHack * HACK_RAM + batch.tWeak1 * WEAK_RAM + batch.tGrow * GROW_RAM + batch.tWeak2 * WEAK_RAM;

            // Anti-Fragmentation: pastikan RAM cukup minimal 1 batch penuh
            if (networkRam < ramPerBatch) { targetLocks[target] = now + 3000; continue; }

            let batches = Math.min(maxBatches, Math.max(1, Math.floor(networkRam / ramPerBatch)));

            let tHack = ns.getHackTime(target);
            let tGrow = ns.getGrowTime(target);
            let tWeak = ns.getWeakenTime(target);

            let dW2 = 0;
            let dG = tWeak - tGrow - T_DELAY;
            let dW1 = 0 - T_DELAY * 2;
            let dH = tWeak - tHack - T_DELAY * 3;

            let minDelay = Math.min(dW2, dG, dW1, dH);
            if (minDelay < 0) { dW2 -= minDelay; dG -= minDelay; dW1 -= minDelay; dH -= minDelay; }

            let sent = 0;
            for (let b = 0; b < batches; b++) {
                if (calcTotalRam(ns, workers, HOME_RESERVE) < ramPerBatch) break;
                let off = b * T_DELAY * 4;
                runDistributed(ns, "/pro-v3/payload/hack.js", target, batch.tHack, dH + off, b, workers, HOME_RESERVE);
                runDistributed(ns, "/pro-v3/payload/weaken1.js", target, batch.tWeak1, dW1 + off, b, workers, HOME_RESERVE);
                runDistributed(ns, "/pro-v3/payload/grow.js", target, batch.tGrow, dG + off, b, workers, HOME_RESERVE);
                runDistributed(ns, "/pro-v3/payload/weaken2.js", target, batch.tWeak2, dW2 + off, b, workers, HOME_RESERVE);
                sent++;
            }

            if (sent > 0) {
                let cycle = -minDelay + tWeak + sent * T_DELAY * 4;
                targetLocks[target] = now + cycle;
                ns.print(`🚀 ${target.padEnd(18)} | ${sent.toString().padStart(3)} batch | steal: ${(batch.actualSteal * 100).toFixed(1)}% | lock: ${(cycle / 1000).toFixed(1)}s`);
            } else {
                targetLocks[target] = now + 5000;
            }
        }

        // ── BACKGROUND RECOVERY: Pulihkan server depleted yang bukan top target ──
        // Server yang sudah di-hack habis tapi tidak lagi masuk top-N
        // akan dipulihkan secara perlahan menggunakan RAM yang tidak terpakai.
        let currentFreeRam = calcTotalRam(ns, workers, HOME_RESERVE);
        let idleRamPct = totalFreeRam > 0 ? currentFreeRam / totalFreeRam : 0;

        // Hanya jalankan recovery jika ada cukup RAM idle (>10%)
        if (idleRamPct > 0.10) {
            let recoveryBudget = currentFreeRam * 0.35;  // naik dari 20% ke 35%
            let targetSet = new Set(targets);

            // Scan semua server hackable yang tidak ada di target list utama
            let allHackable = getAllHackableServers(ns);
            let needRecovery = allHackable.filter(s => {
                if (targetSet.has(s)) return false;  // sudah di-handle di main loop
                let lock = recoverLocks[s];
                if (lock && Date.now() < lock) return false;  // masih dalam recovery
                let money = ns.getServerMoneyAvailable(s);
                let maxMoney = ns.getServerMaxMoney(s);
                let sec = ns.getServerSecurityLevel(s);
                let minSec = ns.getServerMinSecurityLevel(s);
                return money < maxMoney * 0.50 || sec > minSec + 2;  // threshold lebih longgar
            });

            // Urutkan: paling parah dulu
            needRecovery.sort((a, b) => {
                let pa = ns.getServerMoneyAvailable(a) / ns.getServerMaxMoney(a);
                let pb = ns.getServerMoneyAvailable(b) / ns.getServerMaxMoney(b);
                return pa - pb;
            });

            // Recovery untuk tiap server (satu per satu, pakai budget kecil)
            let remainingBudget = recoveryBudget;
            for (let s of needRecovery) {
                if (remainingBudget < 3.5) break;  // kurang dari ~2 thread
                let budgetPerServer = Math.min(remainingBudget / Math.max(1, needRecovery.length), remainingBudget);
                let money  = ns.getServerMoneyAvailable(s);
                let maxMoney = ns.getServerMaxMoney(s);
                let minSec = ns.getServerMinSecurityLevel(s);
                let sec    = ns.getServerSecurityLevel(s);
                let secTolerance = Math.max(0.5, BN.ServerStartingSecurity * 0.3);
                let growThreshold = 0.50;
                let needW = sec > minSec + secTolerance;
                let needG = money < maxMoney * growThreshold;
                let rTime = performPrepCapped(ns, s, workers, needW, needG, sec, minSec, money, maxMoney, BN, budgetPerServer);
                if (rTime > 0) {
                    recoverLocks[s] = Date.now() + rTime + 500;
                    remainingBudget -= budgetPerServer;
                    ns.print(`♻️  RECOVER ${s.padEnd(16)} | ${(money/maxMoney*100).toFixed(0)}% | budget: ${ns.format.ram(budgetPerServer)}`);
                }
            }
        }

        await ns.sleep(300);

    }
}

// =============================================
// PREP: Weaken + Grow SERENTAK (tidak bergantian)
// =============================================
function performPrep(ns, target, workers, needWeaken, needGrow, sec, minSec, money, maxMoney, BN) {
    const weakScript = "/pro-v3/payload/weaken1.js";
    const growScript = "/pro-v3/payload/grow.js";
    const weakRam = ns.getScriptRam(weakScript);
    const growRam = ns.getScriptRam(growScript);
    const weakEffect = 0.05 * (BN.ServerWeakenRate || 1);

    let weakNeeded = needWeaken ? Math.ceil((sec - minSec) / weakEffect) : 0;
    let growNeeded = needGrow
        ? Math.ceil(ns.growthAnalyze(target, maxMoney / Math.max(1, money)) / (BN.ServerGrowthRate || 1))
        : 0;
    // Kompensasi security dari grow threads (+0.004 per thread)
    let growWeakComp = growNeeded > 0 ? Math.ceil(growNeeded * 0.004 / weakEffect) : 0;
    weakNeeded += growWeakComp;

    // Hitung total RAM yang dibutuhkan untuk masing-masing
    let totalWeakRam = weakNeeded * weakRam;
    let totalGrowRam = growNeeded * growRam;
    let totalNeeded = totalWeakRam + totalGrowRam;

    let weakSent = 0, growSent = 0;

    for (let s of workers) {
        let free = ns.getServerMaxRam(s) - ns.getServerUsedRam(s);
        if (s === "home") free -= 32;
        if (free <= 0) continue;

        if (totalNeeded > 0) {
            // PROPORSIONAL: Bagi RAM sesuai rasio kebutuhan masing-masing
            let weakShare = totalWeakRam > 0 ? Math.ceil(free * (totalWeakRam / totalNeeded)) : 0;
            let growShare = free - weakShare;

            if (weakSent < weakNeeded && weakShare >= weakRam) {
                let use = Math.min(Math.floor(weakShare / weakRam), weakNeeded - weakSent);
                if (use > 0 && ns.exec(weakScript, s, use, target, 0, "pw", Math.random()) > 0) {
                    weakSent += use;
                }
            }
            if (growSent < growNeeded && growShare >= growRam) {
                let use = Math.min(Math.floor(growShare / growRam), growNeeded - growSent);
                if (use > 0 && ns.exec(growScript, s, use, target, 0, "pg", Math.random()) > 0) {
                    growSent += use;
                }
            }
        }
        if (weakSent >= weakNeeded && growSent >= growNeeded) break;
    }

    let parts = [];
    if (weakSent > 0) parts.push(`weaken ×${weakSent}/${weakNeeded}`);
    if (growSent > 0) parts.push(`grow ×${growSent}/${growNeeded}`);
    if (parts.length > 0) ns.print(`🛠️  PREP ${target.padEnd(18)} | ${parts.join(" + ")}`);

    return (weakSent > 0 || growSent > 0) ? ns.getWeakenTime(target) : 0;
}

// Versi performPrep dengan batas RAM (untuk fair-share multi-target prep)
function performPrepCapped(ns, target, workers, needWeaken, needGrow, sec, minSec, money, maxMoney, BN, ramCap) {
    const weakScript = "/pro-v3/payload/weaken1.js";
    const growScript  = "/pro-v3/payload/grow.js";
    const weakRam    = ns.getScriptRam(weakScript);
    const growRam    = ns.getScriptRam(growScript);
    const weakEffect = 0.05 * (BN.ServerWeakenRate || 1);

    let weakNeeded = needWeaken ? Math.ceil((sec - minSec) / weakEffect) : 0;
    let growNeeded = needGrow
        ? Math.ceil(ns.growthAnalyze(target, maxMoney / Math.max(1, money)) / (BN.ServerGrowthRate || 1))
        : 0;
    let growWeakComp = growNeeded > 0 ? Math.ceil(growNeeded * 0.004 / weakEffect) : 0;
    weakNeeded += growWeakComp;

    let totalWeakRam = weakNeeded * weakRam;
    let totalGrowRam = growNeeded * growRam;
    let totalNeeded  = totalWeakRam + totalGrowRam;

    let weakSent = 0, growSent = 0;
    let ramUsed  = 0;

    for (let s of workers) {
        if (ramUsed >= ramCap) break;
        let serverFree = ns.getServerMaxRam(s) - ns.getServerUsedRam(s);
        if (s === "home") serverFree -= 32;
        if (serverFree <= 0) continue;

        // Batasi ke sisa jatah RAM
        let free = Math.min(serverFree, ramCap - ramUsed);
        if (free < Math.min(weakRam, growRam)) continue;

        if (totalNeeded > 0) {
            let weakShare = totalWeakRam > 0 ? Math.ceil(free * (totalWeakRam / totalNeeded)) : 0;
            let growShare = free - weakShare;

            if (weakSent < weakNeeded && weakShare >= weakRam) {
                let use = Math.min(Math.floor(weakShare / weakRam), weakNeeded - weakSent);
                if (use > 0 && ns.exec(weakScript, s, use, target, 0, "pw", Math.random()) > 0) {
                    weakSent += use;
                    ramUsed  += use * weakRam;
                }
            }
            if (growSent < growNeeded && growShare >= growRam) {
                let use = Math.min(Math.floor(growShare / growRam), growNeeded - growSent);
                if (use > 0 && ns.exec(growScript, s, use, target, 0, "pg", Math.random()) > 0) {
                    growSent += use;
                    ramUsed  += use * growRam;
                }
            }
        }
        if (weakSent >= weakNeeded && growSent >= growNeeded) break;
    }

    let parts = [];
    if (weakSent > 0) parts.push(`weaken ×${weakSent}/${weakNeeded}`);
    if (growSent > 0) parts.push(`grow ×${growSent}/${growNeeded}`);
    if (parts.length > 0) ns.print(`🛠️  PREP ${target.padEnd(18)} | ${parts.join(" + ")}`);

    return (weakSent > 0 || growSent > 0) ? ns.getWeakenTime(target) : 0;
}

// =============================================
// TARGET SCORING (BN-aware)
// =============================================
function getTopTargets(ns, hasFormulas, limit, BN) {
    let visited = new Set(), stack = ["home"];
    while (stack.length) { let s = stack.pop(); if (!visited.has(s)) { visited.add(s); ns.scan(s).forEach(n => stack.push(n)); } }

    let list = [];
    let player = hasFormulas ? ns.getPlayer() : null;

    for (let s of [...visited]) {
        if (!ns.hasRootAccess(s)) continue;
        let maxMoney = ns.getServerMaxMoney(s);
        if (maxMoney <= 0) continue;
        let reqHack = ns.getServerRequiredHackingLevel(s);
        // Hapus limit "/ 2". Skor sudah memperhitungkan waktu Weaken (yang secara alami penalti untuk hack tinggi)
        // Hanya hindari server yang memang secara mutlak dilarang dihack oleh game system.
        if (reqHack > ns.getHackingLevel()) continue;

        let score;
        if (hasFormulas) {
            let srv = ns.getServer(s);
            srv.hackDifficulty = srv.minDifficulty;
            srv.moneyAvailable = srv.moneyMax;
            let hackChance = ns.formulas.hacking.hackChance(srv, player);
            let hackPct = ns.formulas.hacking.hackPercent(srv, player);
            let weakTime = ns.formulas.hacking.weakenTime(srv, player);
            // Sesuaikan skor dengan BN multiplier (ScriptHackMoney)
            score = (maxMoney * hackPct * hackChance * BN.ScriptHackMoney) / weakTime;
        } else {
            score = (maxMoney * ns.hackAnalyzeChance(s) * ns.hackAnalyze(s) * BN.ScriptHackMoney) / ns.getWeakenTime(s);
        }
        // Penalti depletion: server dengan money < 10% max mendapat skor dikalikan ratio aktual
        // Ini mencegah server depleted (e.g. $7k dari $600M) tetap di top list
        let moneyRatio = ns.getServerMoneyAvailable(s) / maxMoney;
        if (moneyRatio < 0.10) score *= moneyRatio;  // penalti berat jika sangat depleted

        list.push({ s, score });
    }
    list.sort((a, b) => b.score - a.score);
    return list.slice(0, limit).map(t => t.s);
}

// =============================================
// BATCH CALCULATION (BN-aware Formulas)
// =============================================
function calculateBatch(ns, target, steal, hasFormulas, BN) {
    let server = ns.getServer(target);
    let player = hasFormulas ? ns.getPlayer() : null;
    server.hackDifficulty = server.minDifficulty;
    server.moneyAvailable = server.moneyMax;

    let hackPct = hasFormulas
        ? ns.formulas.hacking.hackPercent(server, player)
        : ns.hackAnalyze(target);
    if (hackPct <= 0) return null;

    let tHack = Math.max(1, Math.floor(steal / hackPct));
    let actualSteal = tHack * hackPct;
    if (actualSteal > 1) actualSteal = 1;

    // BN-aware weaken threads: ServerWeakenRate mempengaruhi efek per thread
    const weakEffect = 0.05 * (BN.ServerWeakenRate || 1);
    let tWeak1 = Math.ceil((tHack * 0.002) / weakEffect);
    server.moneyAvailable = server.moneyMax * (1 - actualSteal);

    let tGrow;
    if (hasFormulas) {
        tGrow = Math.ceil(ns.formulas.hacking.growThreads(server, player, server.moneyMax) / (BN.ServerGrowthRate || 1));
    } else {
        let mult = 1 / Math.max(0.01, 1 - actualSteal);
        tGrow = Math.ceil(ns.growthAnalyze(target, mult) / (BN.ServerGrowthRate || 1));
    }
    tGrow = Math.ceil(tGrow * 1.05); // buffer 5%
    let tWeak2 = Math.ceil((tGrow * 0.004) / weakEffect);

    return { tHack, tWeak1, tGrow, tWeak2, actualSteal };
}

// =============================================
// BINARY SEARCH STEAL %
// =============================================
function findBestStealPercent(ns, target, totalRam, hRam, gRam, wRam, maxCap, hasFormulas, BN) {
    let lo = 0.001, hi = maxCap, best = lo;
    for (let i = 0; i < 20; i++) {
        let mid = (lo + hi) / 2;
        let b = calculateBatch(ns, target, mid, hasFormulas, BN);
        if (!b) { hi = mid; continue; }
        let ram = b.tHack * hRam + b.tWeak1 * wRam + b.tGrow * gRam + b.tWeak2 * wRam;
        if (ram <= totalRam) { best = mid; lo = mid; } else { hi = mid; }
    }
    return best;
}

// =============================================
// HELPERS
// =============================================
function runDistributed(ns, script, target, threads, delay, batch, workers, homeReserve) {
    // Grow diprioritaskan ke home karena CPU cores home lebih banyak
    // (cores meningkatkan efektivitas grow per thread)
    const isGrow = script.includes("grow");
    const ordered = isGrow
        ? [...workers].sort((a, b) => (a === "home" ? -1 : b === "home" ? 1 : 0))
        : workers;

    for (let s of ordered) {
        if (threads <= 0) return;
        let free = ns.getServerMaxRam(s) - ns.getServerUsedRam(s);
        if (s === "home") free -= (homeReserve ?? 32);
        let use = Math.min(Math.floor(free / ns.getScriptRam(script)), threads);
        if (use > 0 && ns.exec(script, s, use, target, delay, batch, Math.random()) > 0) threads -= use;
    }
}

function calcTotalRam(ns, workers, homeReserve) {
    let total = 0;
    for (let w of workers) {
        let free = ns.getServerMaxRam(w) - ns.getServerUsedRam(w);
        if (w === "home") free -= (homeReserve ?? 32);
        if (free > 0) total += free;
    }
    return total;
}

function getWorkers(ns) {
    let visited = new Set(), stack = ["home"];
    while (stack.length) { let s = stack.pop(); if (!visited.has(s)) { visited.add(s); ns.scan(s).forEach(n => stack.push(n)); } }
    return [...visited].filter(s => ns.hasRootAccess(s) && ns.getServerMaxRam(s) > 0);
}

function filterWorkers(workers, mode) {
    if (mode === "home") return workers.filter(s => s === "home");
    if (mode === "pserv") return workers.filter(s => s === "home" || s.startsWith("pserv-"));
    return workers;
}

// Helper untuk mendeteksi apakah suatu target sedang diprep di SEMUA workers
function isPrepping(target, ns, workers) {
    for (let w of workers) {
        try {
            if (ns.ps(w).some(p =>
                (p.filename.includes("weaken") || p.filename.includes("grow")) &&
                p.args.includes(target)
            )) return true;
        } catch { }
    }
    return false;
}

// Scan seluruh jaringan untuk server yang bisa di-hack
function getAllHackableServers(ns) {
    let visited = new Set(), stack = ["home"];
    while (stack.length) {
        let s = stack.pop();
        if (!visited.has(s)) { visited.add(s); ns.scan(s).forEach(n => stack.push(n)); }
    }
    return [...visited].filter(s =>
        ns.hasRootAccess(s) &&
        ns.getServerMaxMoney(s) > 0 &&
        ns.getServerRequiredHackingLevel(s) <= ns.getHackingLevel()
    );
}

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
    const T_DELAY = 60;

    // STEAL CAP adaptif: Kompensasi ScriptHackMoney rendah (BN5 = 0.2x)
    // Di BN5, pencurian lebih sedikit per thread → naikkan agresivitas steal
    const BASE_STEAL_CAP = Math.min(0.50, 0.15 / Math.max(0.1, BN.ScriptHackMoney));

    const HACK_RAM = ns.getScriptRam("/pro-v3/payload/hack.js");
    const GROW_RAM = ns.getScriptRam("/pro-v3/payload/grow.js");
    const WEAK_RAM = ns.getScriptRam("/pro-v3/payload/weaken1.js");

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

    let targetLocks = {};
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

        let totalFreeRam = calcTotalRam(ns, workers);

        // maxTargets adaptif RAM
        let maxTargets = 1;
        if (totalFreeRam > 30000) maxTargets = 3;
        if (totalFreeRam > 100000) maxTargets = 4;

        // Steal cap per loop naik seiring RAM tersedia
        let stealCap = BASE_STEAL_CAP;
        if (totalFreeRam > 1000) stealCap = Math.min(BASE_STEAL_CAP * 1.5, 0.50);
        if (totalFreeRam > 10000) stealCap = Math.min(BASE_STEAL_CAP * 2.0, 0.50);

        let targets = getTopTargets(ns, HAS_FORMULAS, maxTargets, BN);

        // --- DIAGNOSTICS (5% peluang tiap loop) ---
        if (Math.random() < 0.05) {
            ns.print(`\n📊 [DIAGNOSTICS] RAM: ${ns.formatRam(totalFreeRam)} | Targets: TOP ${maxTargets} | Steal Cap: ${(stealCap * 100).toFixed(1)}%`);
            for (let t of targets) {
                let sec = ns.getServerSecurityLevel(t);
                let minSec = ns.getServerMinSecurityLevel(t);
                let money = ns.getServerMoneyAvailable(t);
                let maxMoney = ns.getServerMaxMoney(t);
                let rem = targetLocks[t] ? Math.max(0, Math.ceil((targetLocks[t] - Date.now()) / 1000)) : 0;
                ns.print(`   ${t.padEnd(20)} sec:${sec.toFixed(1)}/${minSec} | $:${ns.formatNumber(money)}/${ns.formatNumber(maxMoney)} | lock:${rem}s`);
            }
        }

        let now = Date.now();
        // Hanya 1 target boleh prep bersamaan untuk menghindari RAM starvation
        let numPrepping = targets.filter(t => targetLocks[t] && now < targetLocks[t] && isPrepping(t, ns)).length;

        for (let target of targets) {
            now = Date.now();
            if (targetLocks[target] && now < targetLocks[target]) continue;

            let minSec = ns.getServerMinSecurityLevel(target);
            let sec = ns.getServerSecurityLevel(target);
            let maxMoney = ns.getServerMaxMoney(target);
            let money = ns.getServerMoneyAvailable(target);

            // BN-adaptive threshold:
            // ServerStartingSecurity tinggi → lebih banyak weaken → toleransi lebih longgar
            let secTolerance = Math.max(0.5, BN.ServerStartingSecurity * 0.3);
            // Grow threshold: di BN5 ServerMaxMoney 0.2x → uang lebih sedikit, toleransi lebih ketat
            let growThreshold = Math.max(0.70, 0.95 - BN.ScriptHackMoney * 0.10);

            let needWeaken = sec > minSec + secTolerance;
            let needGrow = money < maxMoney * growThreshold;

            if (needWeaken || needGrow) {
                if (numPrepping >= 1) continue; // Satu prep sekaligus

                let prepTime = performPrep(ns, target, workers, needWeaken, needGrow, sec, minSec, money, maxMoney, BN);
                if (prepTime > 0) {
                    targetLocks[target] = now + prepTime + 500;
                    numPrepping++;
                }
                continue;
            }

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
                if (calcTotalRam(ns, workers) < ramPerBatch) break;
                let off = b * T_DELAY * 4;
                runDistributed(ns, "/pro-v3/payload/hack.js", target, batch.tHack, dH + off, b, workers);
                runDistributed(ns, "/pro-v3/payload/weaken1.js", target, batch.tWeak1, dW1 + off, b, workers);
                runDistributed(ns, "/pro-v3/payload/grow.js", target, batch.tGrow, dG + off, b, workers);
                runDistributed(ns, "/pro-v3/payload/weaken2.js", target, batch.tWeak2, dW2 + off, b, workers);
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
        if (reqHack > ns.getHackingLevel() / 2) continue;

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

    let tWeak1 = Math.ceil((tHack * 0.002) / 0.05);
    server.moneyAvailable = server.moneyMax * (1 - actualSteal);

    let tGrow;
    if (hasFormulas) {
        tGrow = Math.ceil(ns.formulas.hacking.growThreads(server, player, server.moneyMax) / (BN.ServerGrowthRate || 1));
    } else {
        let mult = 1 / Math.max(0.01, 1 - actualSteal);
        tGrow = Math.ceil(ns.growthAnalyze(target, mult) / (BN.ServerGrowthRate || 1));
    }
    tGrow = Math.ceil(tGrow * 1.05); // buffer 5%
    let tWeak2 = Math.ceil((tGrow * 0.004) / 0.05);

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
function runDistributed(ns, script, target, threads, delay, batch, workers) {
    for (let s of workers) {
        if (threads <= 0) return;
        let free = ns.getServerMaxRam(s) - ns.getServerUsedRam(s);
        if (s === "home") free -= 32;
        let use = Math.min(Math.floor(free / ns.getScriptRam(script)), threads);
        if (use > 0 && ns.exec(script, s, use, target, delay, batch, Math.random()) > 0) threads -= use;
    }
}

function calcTotalRam(ns, workers) {
    let total = 0;
    for (let w of workers) {
        let free = ns.getServerMaxRam(w) - ns.getServerUsedRam(w);
        if (w === "home") free -= 32;
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

// Helper untuk mendeteksi apakah suatu target sedang diprep (proses bg berjalan)
function isPrepping(target, ns) {
    return ns.ps("home").some(p =>
        (p.filename.includes("weaken") || p.filename.includes("grow")) &&
        p.args.includes(target)
    );
}

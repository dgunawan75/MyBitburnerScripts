/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    // =============== KONFIGURASI ===============
    const T_DELAY = 50;
    const HAS_FORMULAS = ns.fileExists("Formulas.exe", "home");
    const MAX_CONCURRENT_TARGETS = 10; // Capped to top 10 servers to guarantee CPU/RAM efficiency
    const MAX_STEAL_CAP = 0.35; // Maksimal steal 35% agar RAM cukup tersebar ke target lain

    // =============== PARSING ARGUMEN ===============
    let WORKER_MODE = "all";   // "all" | "pserv" | "home"
    let rawArgs = [...ns.args];

    if (rawArgs.includes("--pserv")) {
        WORKER_MODE = "pserv";
        rawArgs = rawArgs.filter(a => a !== "--pserv");
    } else if (rawArgs.includes("--home")) {
        WORKER_MODE = "home";
        rawArgs = rawArgs.filter(a => a !== "--home");
    }

    const WORKER_MODE_LABEL = WORKER_MODE === "pserv" ? "🖥️ home + pserv-*" :
        WORKER_MODE === "home" ? "🏠 home saja" : "🌐 Semua Server";

    const HACK_RAM = ns.getScriptRam("/pro-v3/payload/hack.js");
    const GROW_RAM = ns.getScriptRam("/pro-v3/payload/grow.js");
    const WEAK_RAM = ns.getScriptRam("/pro-v3/payload/weaken1.js");

    ns.print(`=========================================`);
    ns.print(` 🌐 HYPER BATCH DISTRIBUTED ENGINE v4   `);
    ns.print(` 🎯 MODE   : MULTI-TARGET CONCURRENCY   `);
    ns.print(` 🧮 Formulas : ${HAS_FORMULAS ? "✅ Presisi" : "⚡ Estimasi"}`);
    ns.print(` 💻 Workers  : ${WORKER_MODE_LABEL}`);
    ns.print(`=========================================`);

    let initialWorkers = filterWorkers(getWorkers(ns), WORKER_MODE);
    for (let s of initialWorkers) {
        if (s !== "home") {
            await ns.scp([
                "/pro-v3/payload/hack.js",
                "/pro-v3/payload/grow.js",
                "/pro-v3/payload/weaken1.js",
                "/pro-v3/payload/weaken2.js"
            ], s, "home");
        }
    }

    let targetLocks = {}; // { "serverName": timestamp_unlock }

    // Main Engine Loop (Non-blocking Target Scheduler)
    while (true) {
        let workers = filterWorkers(getWorkers(ns), WORKER_MODE);
        // Selalu ambil target terbaik (kalau level berubah maka prioritas akan geser dinamis!)
        let topTargets = getTopTargets(ns, HAS_FORMULAS, MAX_CONCURRENT_TARGETS, workers);

        if (Math.random() < 0.1) ns.print(`\n--- 🔄 SIKLUS EVALUASI JARINGAN [${new Date().toLocaleTimeString()}] ---`);

        for (let target of topTargets) {
            let now = Date.now();

            // 1. Skip jika target ini masih dalam perlindungan jadwal penguncian (belum selesai ditembak prep / pipeline)
            if (targetLocks[target] && now < targetLocks[target]) continue;

            // 2. Cek apakah ada RAM (walau sedikit)
            let networkRam = calcTotalRam(ns, workers);
            if (networkRam < (HACK_RAM + WEAK_RAM + GROW_RAM + WEAK_RAM)) {
                break; // Network sudah kehabisan RAM, hentikan iterasi multi-target ini
            }

            // 3. FASE PREP: Cek apakah target harus dibersihkan dulu
            let minSec = ns.getServerMinSecurityLevel(target);
            let sec = ns.getServerSecurityLevel(target);
            let maxMoney = ns.getServerMaxMoney(target);
            let money = ns.getServerMoneyAvailable(target);

            let isWeakenNeeded = sec > minSec + 0.1;
            let isGrowNeeded = money < maxMoney * 0.99;

            if (isWeakenNeeded || isGrowNeeded) {
                let pTime = performPrep(ns, target, workers, HAS_FORMULAS, isWeakenNeeded, sec, minSec, money, maxMoney);
                if (pTime > 0) {
                    targetLocks[target] = now + pTime + 1000; // Dikunci sampai PREP mendarat + 1 dtk
                } else {
                    ns.print(`⚠️ OOM saat Prep untuk ${target}.`);
                }
                continue; // Lanjut ke server berikutnya
            }

            // 4. FASE BATCHING: Eksekusi Distributed Pipeline (Multi-Target Isolation)
            let weakTime = ns.getWeakenTime(target);
            let theoreticalMaxBatches = Math.floor(weakTime / (T_DELAY * 4));

            let percentToSteal = findBestStealPercent(ns, target, networkRam, theoreticalMaxBatches, HACK_RAM, GROW_RAM, WEAK_RAM, HAS_FORMULAS, MAX_STEAL_CAP);
            let batchData = calculateBatch(ns, target, percentToSteal, HAS_FORMULAS);

            if (!batchData) {
                targetLocks[target] = now + 5000;
                continue;
            }

            let ramPerBatch = (batchData.tHack * HACK_RAM) + (batchData.tWeak1 * WEAK_RAM) + (batchData.tGrow * GROW_RAM) + (batchData.tWeak2 * WEAK_RAM);
            let actualMaxBatches = Math.min(theoreticalMaxBatches, Math.max(1, Math.floor(networkRam / ramPerBatch)));

            // Dispatch Setup
            let dW2 = 0;
            let tHack = ns.getHackTime(target);
            let tGrow = ns.getGrowTime(target);
            let tWeaken = ns.getWeakenTime(target);

            let dG = tWeaken - tGrow - T_DELAY;
            let dW1 = tWeaken - tWeaken - (T_DELAY * 2);
            let dH = tWeaken - tHack - (T_DELAY * 3);

            let minDelay = Math.min(dW2, dG, dW1, dH);
            if (minDelay < 0) { dW2 -= minDelay; dG -= minDelay; dW1 -= minDelay; dH -= minDelay; }

            let successfullyDispatched = 0;
            for (let b = 1; b <= actualMaxBatches; b++) {
                let offset = (b - 1) * T_DELAY * 4;

                // Verifikasi validitas sisa RAM untuk menghindari broken batch di tengah - tengah!
                if (calcTotalRam(ns, workers) < ramPerBatch) break;

                runDistributed(ns, "/pro-v3/payload/hack.js", target, batchData.tHack, dH + offset, b, workers);
                runDistributed(ns, "/pro-v3/payload/weaken1.js", target, batchData.tWeak1, dW1 + offset, b, workers);
                runDistributed(ns, "/pro-v3/payload/grow.js", target, batchData.tGrow, dG + offset, b, workers);
                runDistributed(ns, "/pro-v3/payload/weaken2.js", target, batchData.tWeak2, dW2 + offset, b, workers);

                successfullyDispatched++;
            }

            if (successfullyDispatched > 0) {
                let totalAirTime = -minDelay + tWeaken + (successfullyDispatched - 1) * T_DELAY * 4;
                targetLocks[target] = now + totalAirTime + 500;
                ns.print(`🚀 ${target.padEnd(16)} | 📦 ${successfullyDispatched.toString().padStart(3)} Batches | Steal: ${(batchData.actualSteal * 100).toFixed(1)}% | 🔒 ${(totalAirTime / 1000).toFixed(1)}s`);
            } else {
                targetLocks[target] = now + 5000; // Coba lagi nanti jika gagal sama sekali
            }
        }

        await ns.sleep(1000); // Polling detak jantung scheduler multi-target
    }
}

// =====================================
// HELPER: PREP Scheduler
// =====================================
function performPrep(ns, target, workers, hasFormulas, isWeakenNeeded, sec, minSec, money, maxMoney) {
    let script = isWeakenNeeded ? "/pro-v3/payload/weaken1.js" : "/pro-v3/payload/grow.js";
    let waitTime = isWeakenNeeded ? ns.getWeakenTime(target) : ns.getGrowTime(target);
    let threadsNeeded = Infinity;

    if (hasFormulas && isWeakenNeeded) {
        threadsNeeded = Math.ceil((sec - minSec) / 0.05);
    } else if (hasFormulas && !isWeakenNeeded) {
        let srv = ns.getServer(target);
        let player = ns.getPlayer();
        srv.moneyAvailable = money;
        srv.hackDifficulty = minSec;
        threadsNeeded = Math.ceil(ns.formulas.hacking.growThreads(srv, player, maxMoney) * 1.02);
    } else if (!hasFormulas && !isWeakenNeeded) {
        let mult = maxMoney / money;
        if (mult === Infinity) mult = 1000;
        threadsNeeded = Math.ceil(ns.growthAnalyze(target, mult) * 1.05);
    }

    let totalSended = 0;
    for (let server of workers) {
        if (totalSended >= threadsNeeded) break;
        let free = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
        if (server === "home") free -= Math.min(128, ns.getServerMaxRam("home") * 0.1);
        let t = Math.floor(free / ns.getScriptRam(script));
        t = Math.min(t, threadsNeeded - totalSended);
        if (t > 0) {
            ns.exec(script, server, t, target, 0, "PREP", Math.random());
            totalSended += t;
        }
    }

    if (totalSended > 0) {
        ns.print(`🛠️ ${target.padEnd(16)} | PREP ${isWeakenNeeded ? "Weaken" : "Grow"} (${totalSended}) 🔒 ${(waitTime / 1000).toFixed(1)}s`);
        return waitTime;
    }
    return 0;
}

// =====================================
// HELPER: TOP TARGETS SORTING (v6 Score Engine)
// =====================================
function getTopTargets(ns, hasFormulas, limit, workers) {
    let targets = [];
    let player = hasFormulas ? ns.getPlayer() : null;

    let scanAll = (ns) => {
        let visited = new Set();
        let stack = ["home"];
        while (stack.length) {
            let s = stack.pop();
            if (visited.has(s)) continue;
            visited.add(s);
            for (let n of ns.scan(s)) stack.push(n);
        }
        return [...visited];
    };

    let allServers = scanAll(ns);

    for (let s of allServers) {
        if (!ns.hasRootAccess(s)) continue;
        let maxMoney = ns.getServerMaxMoney(s);
        if (maxMoney <= 0) continue;
        let requiredHack = ns.getServerRequiredHackingLevel(s);
        if (requiredHack > ns.getHackingLevel() / 2) continue;

        let score = 0;
        if (hasFormulas) {
            let server = ns.getServer(s);
            server.hackDifficulty = server.minDifficulty;
            server.moneyAvailable = server.moneyMax;
            let hackChance = ns.formulas.hacking.hackChance(server, player);
            let hackPct = ns.formulas.hacking.hackPercent(server, player);
            let weakTime = ns.formulas.hacking.weakenTime(server, player);
            score = (maxMoney * hackPct * hackChance) / weakTime;
        } else {
            let weakenTime = ns.getWeakenTime(s);
            let hackChance = ns.hackAnalyzeChance(s);
            let hackPct = ns.hackAnalyze(s);
            score = (maxMoney * hackChance * hackPct) / weakenTime;
        }

        targets.push({ name: s, score: score });
    }

    targets.sort((a, b) => b.score - a.score);
    return targets.slice(0, limit).map(t => t.name);
}

// =====================================
// HELPER: MENGHITUNG THREAD PRESISI + ACTUAL STEAL
// =====================================
function calculateBatch(ns, target, steal, hasFormulas) {
    let server = ns.getServer(target);
    let player = ns.getPlayer();
    server.hackDifficulty = server.minDifficulty;
    let maxMoney = server.moneyMax;
    server.moneyAvailable = maxMoney;

    let hackAmtPerThread = hasFormulas ? ns.formulas.hacking.hackPercent(server, player) : ns.hackAnalyze(target);
    if (hackAmtPerThread <= 0) return null;

    let tHack = Math.floor(steal / hackAmtPerThread);
    if (tHack === 0) tHack = 1;

    let actualSteal = tHack * hackAmtPerThread;
    if (actualSteal > 1) actualSteal = 1;
    if (actualSteal <= 0) return null;

    let tWeak1 = Math.ceil((tHack * 0.002) / 0.05);
    server.moneyAvailable = maxMoney * (1 - actualSteal);

    let tGrow = 0;
    if (hasFormulas) {
        tGrow = ns.formulas.hacking.growThreads(server, player, maxMoney);
    } else {
        let growMult = 1 / (1 - actualSteal);
        if (growMult === Infinity) growMult = 1000;
        tGrow = ns.growthAnalyze(target, growMult);
    }

    tGrow = Math.ceil(tGrow * 1.05);
    let tWeak2 = Math.ceil((tGrow * 0.004) / 0.05);

    return { tHack, tWeak1, tGrow, tWeak2, actualSteal };
}

// =====================================
// HELPER: BINARY SEARCH STEAL (RAM CAPPED)
// =====================================
function findBestStealPercent(ns, target, totalRam, maxBatches, hackRam, growRam, weakRam, hasFormulas, maxStealCap) {
    let lo = 0.001, hi = maxStealCap, best = 0.001;
    for (let i = 0; i < 20; i++) {
        let mid = (lo + hi) / 2;
        let batch = calculateBatch(ns, target, mid, hasFormulas);
        if (!batch) { hi = mid; continue; }

        let ram = (batch.tHack * hackRam) + (batch.tWeak1 * weakRam) + (batch.tGrow * growRam) + (batch.tWeak2 * weakRam);
        if (ram * maxBatches <= totalRam) {
            best = mid;
            lo = mid;
        } else {
            hi = mid;
        }
    }
    return best;
}

// =====================================
// HELPER: DISTRIBUTE PAYLOADS
// =====================================
function runDistributed(ns, script, target, threadsLeft, delay, batchNumber, workers) {
    if (threadsLeft <= 0) return;
    for (let server of workers) {
        let free = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
        if (server === "home") free -= Math.min(128, ns.getServerMaxRam("home") * 0.1);

        let stepRam = ns.getScriptRam(script);
        let possible = Math.floor(free / stepRam);
        if (possible <= 0) continue;

        let use = Math.min(possible, threadsLeft);
        if (use > 0) {
            ns.exec(script, server, use, target, delay, batchNumber, Math.random());
            threadsLeft -= use;
        }
        if (threadsLeft <= 0) return;
    }
}

// =====================================
// CORE UTIL: WORKERS & RAM
// =====================================
function calcTotalRam(ns, workers) {
    let total = 0;
    for (let w of workers) {
        let free = ns.getServerMaxRam(w) - ns.getServerUsedRam(w);
        if (w === "home") free -= Math.min(128, ns.getServerMaxRam("home") * 0.1);
        if (free > 0) total += free;
    }
    return total;
}

function getWorkers(ns) {
    let visited = new Set(), stack = ["home"];
    while (stack.length) {
        let s = stack.pop();
        if (visited.has(s)) continue;
        visited.add(s);
        for (let n of ns.scan(s)) stack.push(n);
    }
    return [...visited].filter(s => ns.hasRootAccess(s) && ns.getServerMaxRam(s) > 0);
}

function filterWorkers(workers, mode) {
    if (mode === "home") return workers.filter(s => s === "home");
    if (mode === "pserv") return workers.filter(s => s === "home" || s.startsWith("pserv-"));
    return workers;
}

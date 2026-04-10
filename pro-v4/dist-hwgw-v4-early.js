/** @param {NS} ns **/
export async function main(ns) {

    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    const T_DELAY = 80;

    // [FIX 2] MAX_STEAL_CAP digeser secara dinamis per-loop (bukan konstanta)
    // Jika total RAM jaringan besar, kita boleh steal lebih agresif
    const BASE_STEAL_CAP = 0.08;
    const HAS_FORMULAS = ns.fileExists("Formulas.exe", "home"); // Dicek sekali saat start

    const HACK_RAM = ns.getScriptRam("/pro-v3/payload/hack.js");
    const GROW_RAM = ns.getScriptRam("/pro-v3/payload/grow.js");
    const WEAK_RAM = ns.getScriptRam("/pro-v3/payload/weaken1.js");

    let WORKER_MODE = "all";
    let rawArgs = [...ns.args];

    if (rawArgs.includes("--pserv")) {
        WORKER_MODE = "pserv";
        rawArgs = rawArgs.filter(a => a !== "--pserv");
    }

    if (rawArgs.includes("--home")) {
        WORKER_MODE = "home";
        rawArgs = rawArgs.filter(a => a !== "--home");
    }

    const WORKER_MODE_LABEL =
        WORKER_MODE === "pserv" ? "🖥️ home+pserv" :
            WORKER_MODE === "home" ? "🏠 home only" :
                "🌐 all rooted";

    ns.print("=====================================");
    ns.print(" EARLY GAME HWGW ENGINE");
    ns.print(` Formulas: ${HAS_FORMULAS ? "YES" : "NO"}`);
    ns.print(` Workers : ${WORKER_MODE_LABEL}`);
    ns.print("=====================================");

    let targetLocks = {};
    let initializedWorkers = new Set(["home"]);

    while (true) {

        let workers = filterWorkers(getWorkers(ns), WORKER_MODE);

        for (let s of workers) {
            if (!initializedWorkers.has(s)) {

                await ns.scp([
                    "/pro-v3/payload/hack.js",
                    "/pro-v3/payload/grow.js",
                    "/pro-v3/payload/weaken1.js",
                    "/pro-v3/payload/weaken2.js"
                ], s, "home");

                initializedWorkers.add(s);
            }
        }

        let totalFreeRam = calcTotalRam(ns, workers);

        // [FIX 1] maxTargets adaptif terhadap RAM tersedia (naik lebih agresif)
        let maxTargets = 1;
        if (totalFreeRam > 64) maxTargets = 2;
        if (totalFreeRam > 256) maxTargets = 3;
        if (totalFreeRam > 1000) maxTargets = 5;
        if (totalFreeRam > 5000) maxTargets = 8;
        if (totalFreeRam > 20000) maxTargets = 12;

        // [FIX 2] Steal cap adaptif: makin besar RAM makin berani
        let MAX_STEAL_CAP = BASE_STEAL_CAP;
        if (totalFreeRam > 500) MAX_STEAL_CAP = 0.12;
        if (totalFreeRam > 2000) MAX_STEAL_CAP = 0.20;
        if (totalFreeRam > 10000) MAX_STEAL_CAP = 0.30;

        let targets = getTopTargets(ns, maxTargets);

        // --- DIAGNOSTICS (10% chance per loop) ---
        if (Math.random() < 0.1) {
            for (let t of targets) {
                let sec = ns.getServerSecurityLevel(t);
                let minSec = ns.getServerMinSecurityLevel(t);
                let money = ns.getServerMoneyAvailable(t);
                let maxMoney = ns.getServerMaxMoney(t);
                let locked = targetLocks[t] ? Math.max(0, Math.ceil((targetLocks[t] - Date.now()) / 1000)) : 0;
                ns.print(`📊 ${t.padEnd(18)} | sec: ${sec.toFixed(1)}/${minSec} | $: ${ns.formatNumber(money)}/${ns.formatNumber(maxMoney)} | lock: ${locked}s`);
            }
        }

        // --- Cek berapa target yang sedang dalam prep (locked) ---
        let now = Date.now();
        let numPrepping = targets.filter(t => targetLocks[t] && now < targetLocks[t]).length;

        for (let target of targets) {

            let now = Date.now();

            if (targetLocks[target] && now < targetLocks[target]) continue;

            let minSec = ns.getServerMinSecurityLevel(target);
            let sec = ns.getServerSecurityLevel(target);

            let maxMoney = ns.getServerMaxMoney(target);
            let money = ns.getServerMoneyAvailable(target);

            let needWeaken = sec > minSec + 0.5;
            // Threshold 0.85: Toleransi kehilangan 15% max money sebelum re-prep
            // Ini sesuai dengan steal cap 8-20% di batch. Jika < 0.85, server memang perlu grown.
            let needGrow = money < maxMoney * 0.85;

            if (needWeaken || needGrow) {
                // Jika sudah ada 1 target yang sedang diprep, jangan tambah target baru
                // Ini mencegah RAM starvation di mana 3 target berlomba RAM prep bersamaan
                if (numPrepping >= 1) continue;

                let prepTime = performPrep(
                    ns, target, workers,
                    needWeaken, needGrow,
                    sec, minSec, money, maxMoney
                );

                if (prepTime > 0) {
                    targetLocks[target] = now + prepTime + 500;
                    numPrepping++; // Update counter agar target berikutnya tidak langsung prep
                }
                continue;
            }

            let networkRam = calcTotalRam(ns, workers);

            let steal = findBestStealPercent(
                ns,
                target,
                networkRam,
                HACK_RAM,
                GROW_RAM,
                WEAK_RAM,
                MAX_STEAL_CAP
            );

            let batch = calculateBatch(ns, target, steal);

            if (!batch) continue;

            let ramPerBatch =
                batch.tHack * HACK_RAM +
                batch.tGrow * GROW_RAM +
                batch.tWeak1 * WEAK_RAM +
                batch.tWeak2 * WEAK_RAM;

            // Anti-Fragmentation: Pastikan RAM cukup untuk 1 batch PENUH sebelum dispatch.
            // Jika tidak, batalkan seluruh target ini dan coba lagi nanti.
            if (networkRam < ramPerBatch) {
                // Tidak cukup RAM bahkan untuk 1 batch → skip dan tunggu
                targetLocks[target] = now + 3000;
                continue;
            }

            // Hitung jumlah batch yang benar-benar muat (dibatasi oleh waktu pipeline)
            let weakTime = ns.getWeakenTime(target);
            let theoreticalMaxBatches = Math.max(1, Math.floor(weakTime / (T_DELAY * 4)));
            let batches = Math.min(
                theoreticalMaxBatches,
                Math.max(1, Math.floor(networkRam / ramPerBatch))
            );

            let tHack = ns.getHackTime(target);
            let tGrow = ns.getGrowTime(target);
            let tWeak = ns.getWeakenTime(target);

            let dW2 = 0;
            let dG = tWeak - tGrow - T_DELAY;
            let dW1 = tWeak - tWeak - (T_DELAY * 2);
            let dH = tWeak - tHack - (T_DELAY * 3);

            let minDelay = Math.min(dW2, dG, dW1, dH);

            if (minDelay < 0) {
                dW2 -= minDelay;
                dG -= minDelay;
                dW1 -= minDelay;
                dH -= minDelay;
            }

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

                ns.print(`🚀 ${target} | ${sent} batch | steal ${(batch.actualSteal * 100).toFixed(1)}%`);
            }
        }

        await ns.sleep(250);
    }
}

// Mengirim WEAKEN dan GROW secara bersamaan dalam satu siklus prep
// Ini menghindari loop tak berujung di mana grow menaikkan security
// dan weaken menurunkan money secara bergantian tanpa selesai.
function performPrep(ns, target, workers, needWeaken, needGrow, sec, minSec, money, maxMoney) {

    let weakScript = "/pro-v3/payload/weaken1.js";
    let growScript = "/pro-v3/payload/grow.js";
    let weakRam = ns.getScriptRam(weakScript);
    let growRam = ns.getScriptRam(growScript);

    // Hitung thread yang dibutuhkan untuk masing-masing
    let weakThreadsNeeded = needWeaken ? Math.ceil((sec - minSec) / 0.05) : 0;
    let growThreadsNeeded = needGrow
        ? Math.ceil(ns.growthAnalyze(target, maxMoney / Math.max(1, money)))
        : 0;

    // Setiap grow butuh kompensasi weaken tambahan: 1 grow = +0.004 security
    // Tambahkan weaken kompensasi agar server langsung bersih setelah grow selesai
    if (needGrow && growThreadsNeeded > 0) {
        weakThreadsNeeded += Math.ceil(growThreadsNeeded * 0.004 / 0.05);
    }

    let weakSent = 0, growSent = 0;

    for (let s of workers) {
        let free = ns.getServerMaxRam(s) - ns.getServerUsedRam(s);
        if (s === "home") free -= getHomeReserve(ns);
        if (free <= 0) continue;

        // Prioritas: Selesaikan weaken dulu, sisa RAM untuk grow
        if (weakSent < weakThreadsNeeded) {
            let can = Math.floor(free / weakRam);
            let use = Math.min(can, weakThreadsNeeded - weakSent);
            if (use > 0 && ns.exec(weakScript, s, use, target, 0, "pw", Math.random()) > 0) {
                weakSent += use;
                free -= use * weakRam;
            }
        }

        if (growSent < growThreadsNeeded && free > growRam) {
            let can = Math.floor(free / growRam);
            let use = Math.min(can, growThreadsNeeded - growSent);
            if (use > 0 && ns.exec(growScript, s, use, target, 0, "pg", Math.random()) > 0) {
                growSent += use;
            }
        }

        if (weakSent >= weakThreadsNeeded && growSent >= growThreadsNeeded) break;
    }

    let parts = [];
    if (weakSent > 0) parts.push(`weaken ${weakSent}`);
    if (growSent > 0) parts.push(`grow ${growSent}`);
    if (parts.length > 0) ns.print(`🛠️ PREP ${target} | ${parts.join(" + ")}`);

    // Lock time = weaken time (lebih lama dari grow, aman untuk keduanya)
    return (weakSent > 0 || growSent > 0) ? ns.getWeakenTime(target) : 0;
}

function getTopTargets(ns, limit) {

    let visited = new Set();
    let stack = ["home"];

    while (stack.length) {

        let s = stack.pop();

        if (visited.has(s)) continue;

        visited.add(s);

        for (let n of ns.scan(s)) stack.push(n);
    }

    let list = [];

    for (let s of visited) {

        if (!ns.hasRootAccess(s)) continue;

        let max = ns.getServerMaxMoney(s);

        if (max <= 0) continue;

        let req = ns.getServerRequiredHackingLevel(s);

        if (req > ns.getHackingLevel() / 3) continue;

        let score = (max * ns.hackAnalyzeChance(s) * ns.hackAnalyze(s))
            / ns.getWeakenTime(s);

        list.push({ s, score });
    }

    list.sort((a, b) => b.score - a.score);

    return list.slice(0, limit).map(t => t.s);
}

function calculateBatch(ns, target, steal) {

    let hackPct = ns.hackAnalyze(target);

    if (hackPct <= 0) return null;

    let tHack = Math.max(1, Math.floor(steal / hackPct));

    let actual = tHack * hackPct;

    let tWeak1 = Math.ceil((tHack * 0.002) / 0.05);

    let growMult = 1 / (1 - actual);

    let tGrow = Math.ceil(ns.growthAnalyze(target, growMult) * 1.03);

    let tWeak2 = Math.ceil((tGrow * 0.004) / 0.05);

    return { tHack, tGrow, tWeak1, tWeak2, actualSteal: actual };
}

function findBestStealPercent(ns, target, ram, hRam, gRam, wRam, maxCap) {

    let lo = 0.001;
    let hi = maxCap;
    let best = lo;

    for (let i = 0; i < 15; i++) {

        let mid = (lo + hi) / 2;

        let b = calculateBatch(ns, target, mid);

        if (!b) { hi = mid; continue; }

        let need =
            b.tHack * hRam +
            b.tGrow * gRam +
            b.tWeak1 * wRam +
            b.tWeak2 * wRam;

        if (need <= ram) {

            best = mid;
            lo = mid;

        } else {

            hi = mid;
        }
    }

    return best;
}

function runDistributed(ns, script, target, threads, delay, batch, workers) {

    for (let s of workers) {

        if (threads <= 0) return;

        let free = ns.getServerMaxRam(s) - ns.getServerUsedRam(s);

        // [FIX 4] konsisten dengan reserve proporsional
        if (s === "home") free -= getHomeReserve(ns);

        let step = ns.getScriptRam(script);

        let can = Math.floor(free / step);

        let use = Math.min(can, threads);

        if (use > 0) {

            if (ns.exec(script, s, use, target, delay, batch, Math.random()) > 0) {

                threads -= use;
            }
        }
    }
}

function calcTotalRam(ns, workers) {

    let total = 0;

    for (let w of workers) {

        let free = ns.getServerMaxRam(w) - ns.getServerUsedRam(w);

        // [FIX 4] Konsisten dengan reservasi proporsional
        if (w === "home") free -= getHomeReserve(ns);

        if (free > 0) total += free;
    }

    return total;
}

// Home reserve: flat 32 GB cukup untuk semua skrip background (orchestrator, gang, pserv, dll)
function getHomeReserve(ns) {
    return 32;
}

function getWorkers(ns) {

    let visited = new Set();
    let stack = ["home"];

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
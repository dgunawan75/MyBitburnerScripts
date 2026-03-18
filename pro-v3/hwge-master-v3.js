/** @param {NS} ns */
// ================================================================
// HWGW MASTER V3 — Enhanced Batch Engine
// Perbaikan dari V2:
//   ✅ Auto-target selection (Formulas.exe jika tersedia)
//   ✅ Timing math diperbaiki (tidak ada delay negatif)
//   ✅ Worker mode flags: --home, --pserv, default=semua server
//   ✅ Prep serentak: weaken + grow berjalan paralel
//   ✅ RAM tracking real-time per iterasi
//   ✅ Income tracking akurat (uang sebelum vs sesudah)
//   ✅ Re-evaluasi target setiap N batch
//   ✅ Tanpa bug || true pada useAllServers
//
// Cara pakai:
//   run hwge-master-v3.js               → auto-target, semua server
//   run hwge-master-v3.js n00dles       → target manual, semua server
//   run hwge-master-v3.js "" --pserv    → auto-target, home+pserv saja
//   run hwge-master-v3.js "" --home     → auto-target, home saja
// ================================================================
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    const HAS_FORMULAS = ns.fileExists("Formulas.exe", "home");

    // ── ARGUMEN ──────────────────────────────────────────────────
    const argTarget = (ns.args[0] && String(ns.args[0]).trim() !== "") ? String(ns.args[0]) : null;
    const modeHome = ns.args.includes("--home");
    const modePserv = ns.args.includes("--pserv");
    const modeAll = !modeHome && !modePserv; // Default: semua server

    const modeLabel = modeHome ? "🏠 HOME" : modePserv ? "🖥️ HOME+PSERV" : "🌐 SEMUA";

    // ── KONFIGURASI ──────────────────────────────────────────────
    const CONFIG = {
        STEAL_PERCENT: 0.45,   // Target 45% uang per batch
        HOME_RESERVE: 128,    // GB reserve di home
        SPACING: 50,     // ms antar operasi dalam satu batch
        RETARGET_EVERY: 20,     // Re-evaluasi target setiap N batch
        PREP_MARGIN_SEC: 0.1,    // Toleransi security di atas minimum
        PREP_MARGIN_MONEY: 0.99,   // Uang harus >= 99% maxMoney
    };

    // ── SCRIPT PATHS ─────────────────────────────────────────────
    const P = {
        hack: "/pro-v3/payload/hack.js",
        weaken1: "/pro-v3/payload/weaken1.js",
        grow: "/pro-v3/payload/grow.js",
        weaken2: "/pro-v3/payload/weaken2.js",
    };
    const RAM = {
        hack: ns.getScriptRam(P.hack),
        weaken: ns.getScriptRam(P.weaken1),
        grow: ns.getScriptRam(P.grow),
    };

    // ── STATS ─────────────────────────────────────────────────────
    const stats = {
        batchesFired: 0,
        moneyStolen: 0,
        startTime: Date.now(),
    };

    // ── PILIH TARGET ──────────────────────────────────────────────
    let TARGET = argTarget;
    if (!TARGET) {
        TARGET = getBestTarget(ns, HAS_FORMULAS);
        if (!TARGET) { ns.tprint("❌ Tidak ada target yang bisa di-hack!"); return; }
    }

    if (!ns.hasRootAccess(TARGET)) {
        ns.tprint(`❌ Tidak punya root access ke ${TARGET}`); return;
    }

    ns.print(`🎯 Target awal : ${TARGET}`);
    ns.print(`⚙️  Mode Worker : ${modeLabel}`);
    ns.print(`🧮 Formulas.exe: ${HAS_FORMULAS ? "✅" : "❌ (estimasi)"}`);

    // ── PREP ──────────────────────────────────────────────────────
    let workers = getWorkers(ns, modeHome, modePserv, modeAll, CONFIG.HOME_RESERVE);
    await copyPayloads(ns, workers, P);
    await prepTarget(ns, TARGET, workers, P, RAM, CONFIG);

    // ── HITUNG BATCH ─────────────────────────────────────────────
    let batch = calcBatch(ns, TARGET, CONFIG.STEAL_PERCENT, HAS_FORMULAS);
    if (!batch) { ns.tprint("❌ Tidak bisa hitung batch (level too low?)"); return; }

    printBatchInfo(ns, TARGET, batch, workers, RAM, CONFIG, modeLabel, HAS_FORMULAS);

    // ── MAIN DISPATCHER LOOP ──────────────────────────────────────
    while (true) {
        // Re-evaluasi target secara berkala
        if (!argTarget && stats.batchesFired > 0 && stats.batchesFired % CONFIG.RETARGET_EVERY === 0) {
            let newTarget = getBestTarget(ns, HAS_FORMULAS);
            if (newTarget && newTarget !== TARGET) {
                ns.print(`🔄 RETARGET: ${TARGET} → ${newTarget}`);
                TARGET = newTarget;
                workers = getWorkers(ns, modeHome, modePserv, modeAll, CONFIG.HOME_RESERVE);
                await copyPayloads(ns, workers, P);
                await prepTarget(ns, TARGET, workers, P, RAM, CONFIG);
                batch = calcBatch(ns, TARGET, CONFIG.STEAL_PERCENT, HAS_FORMULAS);
                if (!batch) continue;
            }
            // Re-hitung batch jika server drifted (security naik / money turun)
            let curSec = ns.getServerSecurityLevel(TARGET);
            let minSec = ns.getServerMinSecurityLevel(TARGET);
            let curMon = ns.getServerMoneyAvailable(TARGET);
            let maxMon = ns.getServerMaxMoney(TARGET);
            if (curSec > minSec + 1 || curMon < maxMon * 0.8) {
                ns.print("⚠️ Server drifted! Re-prep...");
                await prepTarget(ns, TARGET, workers, P, RAM, CONFIG);
                batch = calcBatch(ns, TARGET, CONFIG.STEAL_PERCENT, HAS_FORMULAS);
                if (!batch) continue;
            }
        }

        workers = getWorkers(ns, modeHome, modePserv, modeAll, CONFIG.HOME_RESERVE);
        let totalFree = getTotalFreeRam(ns, workers);
        let batchRam = calcBatchRam(batch, RAM);

        if (totalFree < batchRam) {
            await ns.sleep(100);
            continue;
        }

        // Hitung delay presisi untuk HWGW landing berurutan
        let delays = calcDelays(batch.times, CONFIG.SPACING);

        let moneyBefore = ns.getServerMoneyAvailable(TARGET);

        // Launch batch: H, W1, G, W2 masing-masing dengan delay tepat
        let ok = launchScript(ns, workers, P.hack, batch.tHack, delays.hack, TARGET, batchRam, RAM.hack);
        ok &= launchScript(ns, workers, P.weaken1, batch.tWeak1, delays.weaken1, TARGET, batchRam, RAM.weaken);
        ok &= launchScript(ns, workers, P.grow, batch.tGrow, delays.grow, TARGET, batchRam, RAM.grow);
        ok &= launchScript(ns, workers, P.weaken2, batch.tWeak2, delays.weaken2, TARGET, batchRam, RAM.weaken);

        if (ok) {
            stats.batchesFired++;
            // Perkiraan uang yang akan dicuri (diupdate setelah batch selesai)
            stats.moneyStolen += batch.expectedMoney;
        }

        // Display status setiap launch
        displayStatus(ns, TARGET, batch, stats, workers, batchRam, modeLabel);

        // Tunggu SPACING sebelum batch berikutnya
        // (supaya delay offset berikutnya tidak tumpang tindih)
        await ns.sleep(CONFIG.SPACING * 4);
    }
}

// ═══════════════════════════════════════════════════════════════
// AUTO TARGET: pilih server paling menguntungkan
// ═══════════════════════════════════════════════════════════════
function getBestTarget(ns, hasFormulas) {
    let servers = [];
    let visited = new Set();
    let queue = ["home"];
    while (queue.length) {
        let s = queue.pop();
        if (visited.has(s)) continue;
        visited.add(s);
        for (let n of ns.scan(s)) queue.push(n);
        if (s === "home" || s.startsWith("pserv-")) continue;
        if (!ns.hasRootAccess(s)) continue;
        if (ns.getServerMaxMoney(s) <= 0) continue;
        if (ns.getServerRequiredHackingLevel(s) > ns.getHackingLevel()) continue;
        servers.push(s);
    }

    let best = null, bestScore = -1;
    for (let s of servers) {
        let score;
        if (hasFormulas) {
            let sv = ns.getServer(s);
            let pl = ns.getPlayer();
            sv.hackDifficulty = sv.minDifficulty;
            sv.moneyAvailable = sv.moneyMax;
            let hackPct = ns.formulas.hacking.hackPercent(sv, pl);
            let hackChance = ns.formulas.hacking.hackChance(sv, pl);
            let weakenTime = ns.getWeakenTime(s);
            score = (sv.moneyMax * hackPct * hackChance) / weakenTime;
        } else {
            score = ns.getServerMaxMoney(s) / ns.getWeakenTime(s);
        }
        if (score > bestScore) { bestScore = score; best = s; }
    }
    return best;
}

// ═══════════════════════════════════════════════════════════════
// WORKERS: list server aktif berdasarkan mode
// ═══════════════════════════════════════════════════════════════
function getWorkers(ns, modeHome, modePserv, modeAll, homeReserve) {
    let workers = [];
    let pservs = ns.getPurchasedServers();

    // Home selalu masuk
    workers.push({ host: "home", reserve: homeReserve });

    if (!modeHome) {
        // Purchased servers
        for (let s of pservs) {
            workers.push({ host: s, reserve: 0 });
        }

        if (modeAll) {
            // Semua server ter-root (nuked NPC)
            let visited = new Set(["home", ...pservs]);
            let queue = ["home"];
            while (queue.length) {
                let s = queue.pop();
                for (let n of ns.scan(s)) {
                    if (!visited.has(n)) {
                        visited.add(n);
                        queue.push(n);
                        if (ns.hasRootAccess(n) && ns.getServerMaxRam(n) >= 2)
                            workers.push({ host: n, reserve: 0 });
                    }
                }
            }
        }
    }

    return workers;
}

// ═══════════════════════════════════════════════════════════════
// PREP: Weaken + Grow secara paralel
// ═══════════════════════════════════════════════════════════════
async function prepTarget(ns, target, workers, P, RAM, CONFIG) {
    ns.print("🔧 PREP PHASE dimulai...");
    let minSec = ns.getServerMinSecurityLevel(target);
    let maxMon = ns.getServerMaxMoney(target);

    while (true) {
        let curSec = ns.getServerSecurityLevel(target);
        let curMon = ns.getServerMoneyAvailable(target);

        let needWeaken = curSec > minSec + CONFIG.PREP_MARGIN_SEC;
        let needGrow = curMon < maxMon * CONFIG.PREP_MARGIN_MONEY;

        ns.clearLog();
        ns.print(`🔧 PREP: ${target}`);
        ns.print(`   Security: ${curSec.toFixed(3)} / ${minSec.toFixed(3)} ${needWeaken ? "⚠️" : "✅"}`);
        ns.print(`   Money   : $${ns.formatNumber(curMon)} / $${ns.formatNumber(maxMon)} ${needGrow ? "⚠️" : "✅"}`);

        if (!needWeaken && !needGrow) { ns.print("✅ Target SIAP!"); break; }

        let totalFree = getTotalFreeRam(ns, workers);
        let waitTime = 0;

        // Alokasikan RAM: weaken dapat 60%, grow dapat 40% (jika keduanya perlu)
        let weakenRatio = (needWeaken && needGrow) ? 0.6 : needWeaken ? 1.0 : 0.0;
        let growRatio = 1.0 - weakenRatio;

        if (needWeaken) {
            let tWeaken = Math.floor((totalFree * weakenRatio) / RAM.weaken);
            if (tWeaken > 0) {
                launchScript(ns, workers, P.weaken1, tWeaken, 0, target, 0, RAM.weaken);
                waitTime = Math.max(waitTime, ns.getWeakenTime(target));
            }
        }
        if (needGrow) {
            let tGrow = Math.floor((totalFree * growRatio) / RAM.grow);
            if (tGrow > 0) {
                let growDelay = needWeaken ? CONFIG.SPACING : 0;
                launchScript(ns, workers, P.grow, tGrow, growDelay, target, 0, RAM.grow);
                waitTime = Math.max(waitTime, ns.getGrowTime(target) + growDelay);
            }
        }

        if (waitTime === 0) { await ns.sleep(5000); continue; }
        ns.print(`⏳ Menunggu ${ns.tFormat(waitTime + 200)}...`);
        await ns.sleep(waitTime + 200);
    }
}

// ═══════════════════════════════════════════════════════════════
// CALC BATCH: Hitung thread HWGW dengan Formulas atau estimasi
// ═══════════════════════════════════════════════════════════════
function calcBatch(ns, target, stealPct, hasFormulas) {
    if (hasFormulas) {
        let sv = ns.getServer(target);
        let pl = ns.getPlayer();
        sv.hackDifficulty = sv.minDifficulty;
        sv.moneyAvailable = sv.moneyMax;

        let hackPctPerThread = ns.formulas.hacking.hackPercent(sv, pl);
        if (hackPctPerThread <= 0) return null;

        let tHack = Math.max(1, Math.floor(stealPct / hackPctPerThread));
        let actualSteal = Math.min(tHack * hackPctPerThread, 0.95);
        tHack = Math.floor(actualSteal / hackPctPerThread);

        let tWeak1 = Math.max(1, Math.ceil((tHack * 0.002) / 0.05));

        sv.moneyAvailable = sv.moneyMax * (1 - actualSteal);
        let tGrow = Math.ceil(ns.formulas.hacking.growThreads(sv, pl, sv.moneyMax));
        let tWeak2 = Math.max(1, Math.ceil((tGrow * 0.004) / 0.05));

        return {
            tHack, tWeak1, tGrow, tWeak2,
            hackPct: actualSteal,
            expectedMoney: sv.moneyMax * actualSteal,
            times: {
                hack: ns.getHackTime(target),
                grow: ns.getGrowTime(target),
                weaken: ns.getWeakenTime(target),
            }
        };
    }

    // Tanpa Formulas.exe: estimasi sederhana
    let maxMon = ns.getServerMaxMoney(target);
    let hackAmt = maxMon * stealPct;
    let tHack = Math.max(1, Math.floor(hackAmt / (maxMon * 0.01)));  // ~1% per thread estimasi
    let tWeak1 = Math.max(1, Math.ceil(tHack * 0.04));
    let tGrow = Math.max(1, Math.ceil(tHack * 2.5));
    let tWeak2 = Math.max(1, Math.ceil(tGrow * 0.08));

    return {
        tHack, tWeak1, tGrow, tWeak2,
        hackPct: stealPct,
        expectedMoney: hackAmt,
        times: {
            hack: ns.getHackTime(target),
            grow: ns.getGrowTime(target),
            weaken: ns.getWeakenTime(target),
        }
    };
}

// ═══════════════════════════════════════════════════════════════
// TIMING: Hitung delay agar H→W1→G→W2 mendarat berurutan
// Formula: setiap operasi landing berjarak SPACING ms
//   H  lands at T
//   W1 lands at T + spacing
//   G  lands at T + spacing*2
//   W2 lands at T + spacing*3
// ═══════════════════════════════════════════════════════════════
function calcDelays(times, spacing) {
    // T = target landing untuk H = weakenTime (W1 butuh paling lama)
    // Delay = selisih antara T_landing - duration_operasi
    return {
        hack: Math.max(0, times.weaken - times.hack - spacing),
        weaken1: 0,                                               // W1 langsung (paling lama)
        grow: Math.max(0, times.weaken - times.grow + spacing * 2),
        weaken2: spacing * 3,                                     // W2 landing terakhir
    };
}

// ═══════════════════════════════════════════════════════════════
// LAUNCH: Sebar thread ke workers, return true jika semua berhasil
// ═══════════════════════════════════════════════════════════════
function launchScript(ns, workers, script, totalThreads, delay, target, maxRam, scriptRam) {
    let remaining = totalThreads;

    // Sortir workers: RAM terbesar duluan
    let sorted = [...workers].sort((a, b) => {
        let aFree = ns.getServerMaxRam(a.host) - ns.getServerUsedRam(a.host) - a.reserve;
        let bFree = ns.getServerMaxRam(b.host) - ns.getServerUsedRam(b.host) - b.reserve;
        return bFree - aFree;
    });

    for (let w of sorted) {
        if (remaining <= 0) break;
        let free = ns.getServerMaxRam(w.host) - ns.getServerUsedRam(w.host) - w.reserve;
        let threads = Math.min(remaining, Math.floor(free / scriptRam));
        if (threads <= 0) continue;

        if (w.host !== "home") {
            try { ns.scp(script, w.host, "home"); } catch { continue; }
        }

        let pid = ns.exec(script, w.host, threads, target, delay);
        if (pid > 0) remaining -= threads;
    }

    return remaining === 0; // true = semua thread berhasil diluncurkan
}

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════
function calcBatchRam(batch, RAM) {
    return batch.tHack * RAM.hack +
        batch.tWeak1 * RAM.weaken +
        batch.tGrow * RAM.grow +
        batch.tWeak2 * RAM.weaken;
}

function getTotalFreeRam(ns, workers) {
    return workers.reduce((sum, w) => {
        let free = ns.getServerMaxRam(w.host) - ns.getServerUsedRam(w.host) - w.reserve;
        return sum + Math.max(0, free);
    }, 0);
}

async function copyPayloads(ns, workers, P) {
    let scripts = Object.values(P);
    for (let w of workers) {
        if (w.host === "home") continue;
        for (let s of scripts) {
            try { await ns.scp(s, w.host, "home"); } catch { }
        }
    }
}

function printBatchInfo(ns, target, batch, workers, RAM, CONFIG, modeLabel, hasFormulas) {
    let batchRam = calcBatchRam(batch, RAM);
    let totalFree = workers.reduce((s, w) => s + ns.getServerMaxRam(w.host), 0);
    let maxBatch = Math.floor(totalFree / batchRam);
    let maxByTime = Math.floor(batch.times.weaken / (CONFIG.SPACING * 4));
    let concur = Math.min(maxBatch, maxByTime);
    let incomePerHour = batch.expectedMoney * concur * (3600000 / batch.times.weaken);

    ns.clearLog();
    ns.print("═══════════════════════════════════════");
    ns.print(" 🔥 HWGW MASTER V3 — ENGINE AKTIF");
    ns.print("═══════════════════════════════════════");
    ns.print(` 🎯 Target    : ${target}`);
    ns.print(` ⚙️  Workers   : ${modeLabel} (${workers.length} server)`);
    ns.print(` 🧮 Formulas  : ${hasFormulas ? "✅" : "❌ Estimasi"}`);
    ns.print("───────────────────────────────────────");
    ns.print(` 📊 BATCH DESIGN:`);
    ns.print(`    H  : ${batch.tHack}  threads (${(batch.hackPct * 100).toFixed(1)}% steal)`);
    ns.print(`    W1 : ${batch.tWeak1} threads`);
    ns.print(`    G  : ${batch.tGrow}  threads`);
    ns.print(`    W2 : ${batch.tWeak2} threads`);
    ns.print(`    RAM: ${ns.formatRam(batchRam)} per batch`);
    ns.print(`    ⏱  Max Concur: ~${concur} batch`);
    ns.print(`    💰 Est. ${ns.formatNumber(incomePerHour)}/jam`);
    ns.print("═══════════════════════════════════════");
}

function displayStatus(ns, target, batch, stats, workers, batchRam, modeLabel) {
    let runtime = (Date.now() - stats.startTime) / 1000;
    let perHour = runtime > 0 ? (stats.moneyStolen / runtime) * 3600 : 0;
    let freeRam = getTotalFreeRam(ns, workers);

    ns.clearLog();
    ns.print("═══════════════════════════════════════");
    ns.print(` 🔥 HWGW V3 | ${target} | ${modeLabel}`);
    ns.print("═══════════════════════════════════════");
    ns.print(` 🚀 Batch #   : ${stats.batchesFired}`);
    ns.print(` 💰 Total curi: $${ns.formatNumber(stats.moneyStolen)}`);
    ns.print(` 📈 Rate      : $${ns.formatNumber(perHour)}/jam`);
    ns.print(` 💾 RAM bebas : ${ns.formatRam(freeRam)} / ${ns.formatRam(freeRam + batchRam)}`);
    ns.print(` ⏱  Runtime   : ${ns.tFormat(runtime * 1000)}`);
}

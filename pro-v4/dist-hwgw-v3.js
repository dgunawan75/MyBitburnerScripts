/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    // =============== KONFIGURASI ===============
    const T_DELAY = 50; // Jeda milidetik antar peluru agar tidak tabrakan (50ms sangat aman)

    // Cek apakah Formulas.exe tersedia
    const HAS_FORMULAS = ns.fileExists("Formulas.exe", "home");

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

    // Sisa argumen pertama (jika ada) = target server
    let TARGET = rawArgs[0] || getBestTarget(ns, HAS_FORMULAS);
    let lockedTarget = !!rawArgs[0]; // Jika diisi manual via args, jangan auto-switch

    const WORKER_MODE_LABEL = WORKER_MODE === "pserv" ? "🖥️ home + pserv-*" :
        WORKER_MODE === "home" ? "🏠 home saja" :
            "🌐 Semua Server";

    // RAM Cost dari Script Payload
    const HACK_RAM = ns.getScriptRam("/pro-v3/payload/hack.js");
    const GROW_RAM = ns.getScriptRam("/pro-v3/payload/grow.js");
    const WEAK_RAM = ns.getScriptRam("/pro-v3/payload/weaken1.js");

    ns.print(`=========================================`);
    ns.print(` 🌐 DISTRIBUTED H.W.G.W ENGINE v3       `);
    ns.print(` 🎯 TARGET AKTIF: ${TARGET.toUpperCase()}`);
    ns.print(` 🧮 Formulas : ${HAS_FORMULAS ? "✅ Presisi" : "⚡ Estimasi"}`);
    ns.print(` 💻 Workers  : ${WORKER_MODE_LABEL}`);
    ns.print(`=========================================`);

    // Helper: Pindah payload ke semua worker yang relevan
    let workers = filterWorkers(getWorkers(ns), WORKER_MODE);
    for (let s of workers) {
        if (s !== "home") {
            await ns.scp([
                "/pro-v3/payload/hack.js",
                "/pro-v3/payload/grow.js",
                "/pro-v3/payload/weaken1.js",
                "/pro-v3/payload/weaken2.js"
            ], s, "home");
        }
    }

    // Main Engine Loop
    while (true) {
        // Cache worker list sekali per loop — filter sesuai mode yang dipilih
        workers = filterWorkers(getWorkers(ns), WORKER_MODE);

        // 0. AUTO RE-TARGET: Cek ulang apakah ada target yang lebih optimal setiap siklus
        if (!lockedTarget) {
            let newTarget = getBestTarget(ns, HAS_FORMULAS);
            if (newTarget !== TARGET) {
                ns.print(`\n🔀 TARGET BERGANTI: ${TARGET} → ${newTarget}`);
                ns.print(`   (Memilih server dengan yield termaksimal)`);
                TARGET = newTarget;
                // Re-copy payload ke semua worker agar server baru siap digunakan
                for (let s of workers) {
                    if (s !== "home") {
                        await ns.scp([
                            "/pro-v3/payload/hack.js",
                            "/pro-v3/payload/grow.js",
                            "/pro-v3/payload/weaken1.js",
                            "/pro-v3/payload/weaken2.js"
                        ], s, "home");
                    }
                }
            }
        }

        // 1. FASE PREP: Pastikan server target dalam keadaan sempurna 100% uang dan 0% security
        await prepServer(ns, TARGET, workers, HAS_FORMULAS);

        // 2. FASE KALKULASI DISTRIBUTED
        ns.print(`\n📊 Menghitung batas optimal jaringan terdistribusi...`);

        let totalNetworkRam = calcTotalRam(ns, workers);
        let weakTime = ns.getWeakenTime(TARGET);
        let maxBatches = Math.floor(weakTime / (T_DELAY * 4));

        // Cari langsung persentase optimum menggunakan Binary Search
        let percentToSteal = findBestStealPercent(ns, TARGET, totalNetworkRam, maxBatches, HACK_RAM, GROW_RAM, WEAK_RAM, HAS_FORMULAS);

        let batchData = calculateBatch(ns, TARGET, percentToSteal, HAS_FORMULAS);

        // Safety check jika target tidak bisa diretas sama sekali saat ini
        if (!batchData) {
            ns.print(`⚠️ Target curian / hack analyze tidak valid. Menunggu sebentar lalu coba lagi...`);
            await ns.sleep(5000);
            continue;
        }

        let ramPerBatch = (batchData.tHack * HACK_RAM) + (batchData.tWeak1 * WEAK_RAM) + (batchData.tGrow * GROW_RAM) + (batchData.tWeak2 * WEAK_RAM);

        // Jika ramnya masih melebihi kapasitas, potong jumlah batch yang bisa terbang bersamaan
        if (ramPerBatch * maxBatches > totalNetworkRam) {
            maxBatches = Math.max(1, Math.floor(totalNetworkRam / ramPerBatch));
        }

        // Dapatkan persentase curian Aktual (sesudah floor thread)
        let actualSteal = batchData.actualSteal || percentToSteal;

        ns.print(`💰 Target Curian: ${(actualSteal * 100).toFixed(1)}%`);
        ns.print(`🚀 Max Udara    : ${maxBatches} Cycle Batches`);
        ns.print(`⚙️ RAM 1 Batch  : ${ns.formatRam(ramPerBatch)}`);
        ns.print(`🧵 Total Network: ${ns.formatRam(totalNetworkRam)} Tersedia`);

        // 3. FASE PENEMBAKAN (DISPATCHER) V3 - Offset Injection Pipeline (Menyelesaikan Sleep Drift)
        let dW2 = 0;                        // W2 landing terakhir — referensi 0 delay
        let tHack = ns.getHackTime(TARGET);
        let tGrow = ns.getGrowTime(TARGET);
        let tWeaken = ns.getWeakenTime(TARGET);

        let dG = tWeaken - tGrow - T_DELAY;  // G harus mendarat T_DELAY sebelum W2
        let dW1 = tWeaken - tWeaken - (T_DELAY * 2); // W1 mendarat T_DELAY sebelum G
        let dH = tWeaken - tHack - (T_DELAY * 3);  // H mendarat T_DELAY sebelum W1

        // Normalize delay agar tidak ada negatif
        let minDelay = Math.min(dW2, dG, dW1, dH);
        if (minDelay < 0) { dW2 -= minDelay; dG -= minDelay; dW1 -= minDelay; dH -= minDelay; }

        let batchNumber = 1;

        // Tembak secara instant semua pipeline batch
        while (batchNumber <= maxBatches) {
            // Pekerja dicache di atas, tidak memboroskan overhead pencarian worker didalam iterasi peluncuran
            let offset = (batchNumber - 1) * T_DELAY * 4;

            runDistributed(ns, "/pro-v3/payload/hack.js", TARGET, batchData.tHack, dH + offset, batchNumber, workers);
            runDistributed(ns, "/pro-v3/payload/weaken1.js", TARGET, batchData.tWeak1, dW1 + offset, batchNumber, workers);
            runDistributed(ns, "/pro-v3/payload/grow.js", TARGET, batchData.tGrow, dG + offset, batchNumber, workers);
            runDistributed(ns, "/pro-v3/payload/weaken2.js", TARGET, batchData.tWeak2, dW2 + offset, batchNumber, workers);

            batchNumber++;
        }

        // Kalkulasi waktu tunggu sampai unit terakhir (W2 di batch terakhir) mendarat dengan aman
        let totalAirTime = -minDelay + tWeaken + (maxBatches - 1) * T_DELAY * 4;

        ns.print(`⏰ Total ${maxBatches} batch meluncur tanpa jeda (offset synced).`);
        ns.print(`⏳ Menunggu ${ns.tFormat(totalAirTime)} mendarat...`);

        await ns.sleep(totalAirTime + 500); // 500ms safety buffer
    }
}

// =====================================
// HELPER: Hitung total RAM jaringan
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

// =====================================
// HELPER: BINARY SEARCH persentase curian optimal
// =====================================
function findBestStealPercent(ns, target, totalRam, maxBatches, hackRam, growRam, weakRam, hasFormulas) {
    let lo = 0.001, hi = 0.99, best = 0.001;

    for (let i = 0; i < 20; i++) {
        let mid = (lo + hi) / 2;
        let batch = calculateBatch(ns, target, mid, hasFormulas);
        if (!batch) { hi = mid; continue; }

        let ram = (batch.tHack * hackRam) + (batch.tWeak1 * weakRam) + (batch.tGrow * growRam) + (batch.tWeak2 * weakRam);
        if (ram * maxBatches <= totalRam) {
            best = mid;
            lo = mid; // Masih muat, coba lebih besar
        } else {
            hi = mid; // Terlalu besar, kecilkan
        }
    }
    return best;
}

// =====================================
// HELPER: Mendapatkan semua Server yang di-root (cache-friendly)
// =====================================
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

// =====================================
// HELPER: Filter worker sesuai mode yang dipilih
// =====================================
function filterWorkers(workers, mode) {
    if (mode === "home") return workers.filter(s => s === "home");
    if (mode === "pserv") return workers.filter(s => s === "home" || s.startsWith("pserv-"));
    return workers;
}

// =====================================
// HELPER: Eksekutor Terdistribusi (Pecah Thread!)
// =====================================
function runDistributed(ns, script, target, threadsLeft, delay, batchNumber, workers) {
    if (threadsLeft <= 0) return;

    for (let server of workers) {
        let free = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
        if (server === "home") {
            let reserve = Math.min(128, ns.getServerMaxRam("home") * 0.1);
            free -= reserve;
        }

        let stepRam = ns.getScriptRam(script);
        let possible = Math.floor(free / stepRam);
        if (possible <= 0) continue;

        let use = Math.min(possible, threadsLeft);
        if (use > 0) {
            // Gunakan kombinasi Math.random untuk memastikan unik argumen per peluncuran terdistribusi
            ns.exec(script, server, use, target, delay, batchNumber, Math.random());
            threadsLeft -= use;
        }

        if (threadsLeft <= 0) return;
    }

    if (threadsLeft > 0) {
        ns.print(`⚠️ Kurang RAM! Gagal tembak ${threadsLeft} threads ${script}.`);
    }
}

// =====================================
// HELPER: SUPER PREP SERVER
// =====================================
async function prepServer(ns, target, workers, hasFormulas) {
    let minSec = ns.getServerMinSecurityLevel(target);
    let maxMoney = ns.getServerMaxMoney(target);

    while (true) {
        let sec = ns.getServerSecurityLevel(target);
        let money = ns.getServerMoneyAvailable(target);

        if (sec <= minSec + 0.1 && money >= maxMoney * 0.99) break;

        ns.clearLog();
        ns.print(`--- FASE PERSIAPAN (${target}) ---`);
        ns.print(`Security: ${sec.toFixed(2)} / ${minSec.toFixed(2)}`);
        ns.print(`Money   : $${ns.formatNumber(money)} / $${ns.formatNumber(maxMoney)}`);

        let isWeaken = sec > minSec + 0.1;
        let script = isWeaken ? "/pro-v3/payload/weaken1.js" : "/pro-v3/payload/grow.js";
        let waitTime = isWeaken ? ns.getWeakenTime(target) : ns.getGrowTime(target);

        let threadsNeeded = Infinity;
        if (hasFormulas && isWeaken) {
            let secDiff = sec - minSec;
            threadsNeeded = Math.ceil(secDiff / 0.05);
        } else if (hasFormulas && !isWeaken) {
            let srv = ns.getServer(target);
            let player = ns.getPlayer();
            srv.moneyAvailable = money;
            srv.hackDifficulty = minSec;
            threadsNeeded = Math.ceil(ns.formulas.hacking.growThreads(srv, player, maxMoney) * 1.02);
        }

        let totalSended = 0;
        for (let server of workers) {
            if (totalSended >= threadsNeeded) break;

            let free = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
            if (server === "home") free -= Math.min(128, ns.getServerMaxRam("home") * 0.1);

            let threads = Math.floor(free / ns.getScriptRam(script));
            threads = Math.min(threads, threadsNeeded - totalSended);
            if (threads > 0) {
                ns.exec(script, server, threads, target, 0, "PREP", Math.random());
                totalSended += threads;
            }
        }

        if (totalSended > 0) {
            ns.print(`🚀 PREP ${isWeaken ? "Weaken" : "Grow"} -> ${totalSended} threads${hasFormulas ? " (presisi)" : " (semua RAM)"}`);
            ns.print(`⏳ Tidur selama ${ns.tFormat(waitTime)}...`);
            await ns.sleep(waitTime + 1000);
        } else {
            ns.print("💤 RAM penuh. Menunggu 60 dtk...");
            await ns.sleep(60000);
        }
    }
}

// =====================================
// HELPER: MENGHITUNG THREAD V3 (Memanfaatkan actualSteal untuk Efisiensi RAM)
// =====================================
function calculateBatch(ns, target, steal, hasFormulas) {
    let server = ns.getServer(target);
    let player = ns.getPlayer();

    server.hackDifficulty = server.minDifficulty;
    let maxMoney = server.moneyMax;
    server.moneyAvailable = maxMoney;

    let hackAmtPerThread = 0;
    if (hasFormulas) {
        hackAmtPerThread = ns.formulas.hacking.hackPercent(server, player);
    } else {
        hackAmtPerThread = ns.hackAnalyze(target);
    }

    if (hackAmtPerThread <= 0) return null;

    let tHack = Math.floor(steal / hackAmtPerThread);
    if (tHack === 0) {
        tHack = 1;
    }

    // PENYEMPURNAAN V3: Gunakan actualSteal dari uang yang benar-benar diambil Math.floor tHack
    let actualSteal = tHack * hackAmtPerThread;
    if (actualSteal > 1) actualSteal = 1;

    // Cegah null reference
    if (actualSteal <= 0) return null;

    let tWeak1 = Math.ceil((tHack * 0.002) / 0.05);

    // V3 Fix: Kurangkan uang aktual yang diretas, bukan persentase abstrak
    server.moneyAvailable = maxMoney * (1 - actualSteal);

    let tGrow = 0;
    if (hasFormulas) {
        tGrow = ns.formulas.hacking.growThreads(server, player, maxMoney);
    } else {
        let growMult = 1 / (1 - actualSteal);
        if (growMult === Infinity) growMult = 1000;
        tGrow = ns.growthAnalyze(target, growMult);
    }

    tGrow = Math.ceil(tGrow * 1.05); // +5% safety padding
    let tWeak2 = Math.ceil((tGrow * 0.004) / 0.05);

    return { tHack, tWeak1, tGrow, tWeak2, actualSteal };
}

// =====================================
// HELPER: MENCARI TARGET TERBAIK V3 (Adopsi Fallback v6 Script)
// =====================================
function getBestTarget(ns, hasFormulas) {
    let best = "n00dles";
    let bestScore = 0;
    let player = hasFormulas ? ns.getPlayer() : null;

    for (let s of getWorkers(ns)) {
        if (!ns.hasRootAccess(s)) continue;

        let maxMoney = ns.getServerMaxMoney(s);
        if (maxMoney <= 0) continue;

        let requiredHack = ns.getServerRequiredHackingLevel(s);
        if (requiredHack > ns.getHackingLevel() / 2) continue;

        let score = 0;
        if (hasFormulas) {
            // Skor presisi
            let server = ns.getServer(s);
            server.hackDifficulty = server.minDifficulty;
            server.moneyAvailable = server.moneyMax;

            let hackChance = ns.formulas.hacking.hackChance(server, player);
            let hackPct = ns.formulas.hacking.hackPercent(server, player);
            let weakTime = ns.formulas.hacking.weakenTime(server, player);

            score = (maxMoney * hackPct * hackChance) / weakTime;
        } else {
            // PENYEMPURNAAN V3: Skor fallback lebih pintar kalkukasi Yield per Second murni ala v6
            let weakenTime = ns.getWeakenTime(s);
            let hackChance = ns.hackAnalyzeChance(s);
            let hackPct = ns.hackAnalyze(s);

            score = (maxMoney * hackChance * hackPct) / weakenTime;
        }

        if (score > bestScore) {
            bestScore = score;
            best = s;
        }
    }

    return best;
}

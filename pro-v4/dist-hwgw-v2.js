/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    // =============== KONFIGURASI ===============
    const T_DELAY = 50; // Jeda milidetik antar peluru agar tidak tabrakan (50ms sangat aman)

    // Cek apakah Formulas.exe tersedia
    const HAS_FORMULAS = ns.fileExists("Formulas.exe", "home");

    // Default Target Otomatis jika argumen kosong
    // Gunakan `let` agar bisa di-update otomatis seiring naiknya level hacking
    let TARGET = ns.args[0] || getBestTarget(ns, HAS_FORMULAS);
    let lockedTarget = !!ns.args[0]; // Jika diisi manual via args, jangan auto-switch

    // RAM Cost dari Script Payload
    const HACK_RAM = ns.getScriptRam("/pro-v3/payload/hack.js");
    const GROW_RAM = ns.getScriptRam("/pro-v3/payload/grow.js");
    const WEAK_RAM = ns.getScriptRam("/pro-v3/payload/weaken1.js");

    ns.print(`=========================================`);
    ns.print(` 🌐 DISTRIBUTED H.W.G.W ENGINE v2       `);
    ns.print(` 🎯 TARGET AKTIF: ${TARGET.toUpperCase()}`);
    ns.print(` 🧮 Mode: ${HAS_FORMULAS ? "✅ Formulas.exe (Presisi)" : "⚡ Fallback (Estimasi)"}`);
    ns.print(`=========================================`);

    // Helper: Pindah payload ke semua worker
    let workers = getWorkers(ns);
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
        // Cache worker list sekali per loop agar tidak scan berulang
        workers = getWorkers(ns);

        // 0. AUTO RE-TARGET: Cek ulang apakah ada target yang lebih optimal setiap siklus
        //    (hanya jika target tidak dikunci manual via argumen)
        if (!lockedTarget) {
            let newTarget = getBestTarget(ns, HAS_FORMULAS);
            if (newTarget !== TARGET) {
                ns.print(`\n🔀 TARGET BERGANTI: ${TARGET} → ${newTarget}`);
                ns.print(`   (Hack Level naik atau ada server baru yang lebih menguntungkan)`);
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

        // Cari langsung persentase optimum menggunakan Binary Search — bukan loop step 1% lagi!
        let percentToSteal = findBestStealPercent(ns, TARGET, totalNetworkRam, maxBatches, HACK_RAM, GROW_RAM, WEAK_RAM, HAS_FORMULAS);

        let batchData = calculateBatch(ns, TARGET, percentToSteal, HAS_FORMULAS);
        let ramPerBatch = (batchData.tHack * HACK_RAM) + (batchData.tWeak1 * WEAK_RAM) + (batchData.tGrow * GROW_RAM) + (batchData.tWeak2 * WEAK_RAM);

        // Jika ramnya masih melebihi kapasitas, potong jumlah batch yang bisa terbang bersamaan
        if (ramPerBatch * maxBatches > totalNetworkRam) {
            maxBatches = Math.max(1, Math.floor(totalNetworkRam / ramPerBatch));
        }

        ns.print(`💰 Target Curian: ${(percentToSteal * 100).toFixed(1)}%`);
        ns.print(`🚀 Max Udara    : ${maxBatches} Cycle Batches`);
        ns.print(`⚙️ RAM 1 Batch  : ${ns.formatRam(ramPerBatch)}`);
        ns.print(`🧵 Total Network: ${ns.formatRam(totalNetworkRam)} Tersedia`);

        // 3. FASE PENEMBAKAN (DISPATCHER)
        let batchNumber = 1;
        while (batchNumber <= maxBatches) {
            // Cache workers sekali per batch — tidak scan ulang setiap script
            workers = getWorkers(ns);

            // Hitung ulang delay presisi (level hack bisa naik di tengah jalan!)
            let tHack = ns.getHackTime(TARGET);
            let tGrow = ns.getGrowTime(TARGET);
            let tWeaken = ns.getWeakenTime(TARGET);

            // Waktu Mendarat (Sync Sempurna): H -> W1 -> G -> W2 tiap T_DELAY ms
            let dW2 = 0;                        // W2 landing terakhir — referensi 0 delay
            let dG = tWeaken - tGrow - T_DELAY;  // G harus mendarat T_DELAY sebelum W2
            let dW1 = tWeaken - tWeaken - (T_DELAY * 2); // W1 mendarat T_DELAY sebelum G
            let dH = tWeaken - tHack - (T_DELAY * 3);  // H mendarat T_DELAY sebelum W1

            // Normalize delay agar tidak ada negatif (jika hack sangat cepat)
            let minDelay = Math.min(dW2, dG, dW1, dH);
            if (minDelay < 0) { dW2 -= minDelay; dG -= minDelay; dW1 -= minDelay; dH -= minDelay; }

            runDistributed(ns, "/pro-v3/payload/hack.js", TARGET, batchData.tHack, dH, batchNumber, workers);
            runDistributed(ns, "/pro-v3/payload/weaken1.js", TARGET, batchData.tWeak1, dW1, batchNumber, workers);
            runDistributed(ns, "/pro-v3/payload/grow.js", TARGET, batchData.tGrow, dG, batchNumber, workers);
            runDistributed(ns, "/pro-v3/payload/weaken2.js", TARGET, batchData.tWeak2, dW2, batchNumber, workers);

            batchNumber++;
            await ns.sleep(T_DELAY * 4);
        }

        ns.print(`⏰ Total ${maxBatches} batch di udara. Menunggu ${ns.tFormat(weakTime)} mendarat...`);
        await ns.sleep(weakTime + 500);
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
// Jauh lebih cepat dari loop step 0.01 yang lama
// =====================================
function findBestStealPercent(ns, target, totalRam, maxBatches, hackRam, growRam, weakRam, hasFormulas) {
    let lo = 0.001, hi = 0.99, best = 0.001;

    for (let i = 0; i < 20; i++) { // 20 iterasi sudah sangat presisi untuk binary search
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
// HELPER: Eksekutor Terdistribusi (Pecah Thread! — home duluan, lalu menyebar ke network)
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
// HELPER: SUPER PREP SERVER (Dengan kalkulasi presisi jika ada Formulas.exe)
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

        // Kalkulasi presisi: berapa thread yang benar-benar dibutuhkan?
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
// HELPER: MENGHITUNG THREAD (Dengan Formulas.exe jika ada, fallback jika tidak)
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
        steal = hackAmtPerThread;
    }

    let tWeak1 = Math.ceil((tHack * 0.002) / 0.05);

    server.moneyAvailable = maxMoney * (1 - steal);

    let tGrow = 0;
    if (hasFormulas) {
        tGrow = ns.formulas.hacking.growThreads(server, player, maxMoney);
    } else {
        let growMult = 1 / (1 - steal);
        tGrow = ns.growthAnalyze(target, growMult);
    }

    tGrow = Math.ceil(tGrow * 1.05); // +5% safety padding
    let tWeak2 = Math.ceil((tGrow * 0.004) / 0.05);

    return { tHack, tWeak1, tGrow, tWeak2 };
}

// =====================================
// HELPER: MENCARI TARGET TERBAIK
// Pakai Formulas.exe jika tersedia (estimasi $ per detik actual)
// Fallback ke maxMoney / weakenTime jika tidak ada
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
            // Skor akurat: estimasi dollar per milidetik dengan memperhitungkan hack chance
            let server = ns.getServer(s);
            server.hackDifficulty = server.minDifficulty;
            server.moneyAvailable = server.moneyMax;

            let hackChance = ns.formulas.hacking.hackChance(server, player);
            let hackPct = ns.formulas.hacking.hackPercent(server, player);
            let weakTime = ns.formulas.hacking.weakenTime(server, player);

            // Dollar per ms = (maxMoney × % per thread × 1 thread × peluang berhasil) / waktu satu siklus
            score = (maxMoney * hackPct * hackChance) / weakTime;
        } else {
            // Skor fallback: maxMoney / weakenTime (metode lama yang masih valid)
            let weakenTime = ns.getWeakenTime(s);
            score = maxMoney / weakenTime;
        }

        if (score > bestScore) {
            bestScore = score;
            best = s;
        }
    }

    return best;
}

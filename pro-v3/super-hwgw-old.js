/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.tail();

    ns.print(`=========================================`);
    ns.print(` ≡ƒÅå SUPER HWGW ENGINE (AUTO-TARGETING)   `);
    ns.print(`=========================================`);

    // Konfigurasi Delay Presisi (dalam milidetik)
    const T_DELAY = 40; // Diperketat menjadi 40ms untuk batching lebih rapat

    const HACK_RAM = ns.getScriptRam("/pro-v3/payload/hack.js");
    const WEAK_RAM = ns.getScriptRam("/pro-v3/payload/weaken1.js");
    const GROW_RAM = ns.getScriptRam("/pro-v3/payload/grow.js");

    let currentTarget = null;

    while (true) {
        // 1. CARI TARGET TERBAIK SAAT INI
        let bestTarget = getBestTarget(ns);

        if (!bestTarget) {
            ns.print("ΓÅ│ Tidak ada target yang bisa di-hack saat ini. Menunggu...");
            await ns.sleep(60000);
            continue;
        }

        if (currentTarget !== bestTarget) {
            ns.print(`\n≡ƒÄ» TARGET BARU DITEMUKAN: ${bestTarget.toUpperCase()}`);
            ns.print(`   Beralih dari ${currentTarget || "Tidak Ada"} ke ${bestTarget}`);
            currentTarget = bestTarget;

            // FASE PERSIAPAN (PREP PHASE)
            await prepServer(ns, currentTarget);
        }

        ns.clearLog();
        ns.print(`=========================================`);
        ns.print(` ≡ƒÅå SUPER HWGW ENGINE BEKERJA            `);
        ns.print(` ≡ƒÄ» TARGET AKTIF: ${currentTarget.toUpperCase()}`);
        ns.print(`=========================================`);

        // 2. FASE PERHITUNGAN BATCH
        // Coba curi uang secara agresif, tapi sesuaikan dengan ukuran target
        let percentToSteal = 0.50; // Default 50%
        let batchData = null;

        // Loop untuk mencari persentase curian ideal yang RAM-nya muat
        while (percentToSteal > 0.05) {
            batchData = calculateBatch(ns, currentTarget, percentToSteal);
            if (batchData) {
                let ramPerBatch = (batchData.tHack * HACK_RAM) + (batchData.tWeak1 * WEAK_RAM) + (batchData.tGrow * GROW_RAM) + (batchData.tWeak2 * WEAK_RAM);
                // Pastikan Home masih sanggup menembak minimal 1 batch jika semua server lain mati
                let homePservMax = Math.max(
                    ns.getServerMaxRam("home") - 128,
                    ...ns.getPurchasedServers().map(s => ns.getServerMaxRam(s))
                );

                if (ramPerBatch <= homePservMax) {
                    break; // Ukuran batch ini muat di server kita, bungkus!
                }
            }
            percentToSteal -= 0.05; // Kurangi persentase curian
        }

        if (!batchData) {
            ns.print(`Γ¥î ERROR: Gagal kalkulasi batch untuk ${currentTarget}. Mencoba target lain dalam 1 menit...`);
            currentTarget = null; // Paksa cari target baru di loop berikutnya
            await ns.sleep(60000);
            continue;
        }

        let ramPerBatch = (batchData.tHack * HACK_RAM) + (batchData.tWeak1 * WEAK_RAM) + (batchData.tGrow * GROW_RAM) + (batchData.tWeak2 * WEAK_RAM);
        ns.print(`≡ƒÆ░ Target Curian : ${(percentToSteal * 100).toFixed(0)}% (${ns.formatNumber(ns.getServerMaxMoney(currentTarget) * percentToSteal)})`);
        ns.print(`ΓÜÖ∩╕Å RAM 1 Batch   : ${ns.formatNumber(ramPerBatch)} GB`);
        ns.print(`≡ƒº╡ Threads/Batch : H(${batchData.tHack}) W1(${batchData.tWeak1}) G(${batchData.tGrow}) W2(${batchData.tWeak2})`);

        // 3. FASE PENEMBAKAN (DISPATCH PHASE) - Berjalan selama 10 Menit sebelum re-evaluasi target
        await runBatchDispatcher(ns, currentTarget, batchData, ramPerBatch, T_DELAY, 600000);
    }
}

// ==========================================
// FUNGSI AUTO-TARGETING (PENCARI MANGSA TERBAIK)
// ==========================================
function getBestTarget(ns) {
    let servers = scanAllServers(ns);
    let player = ns.getPlayer();

    let bestServer = null;
    let bestScore = 0;

    for (let target of servers) {
        if (!ns.hasRootAccess(target)) continue;
        let reqHack = ns.getServerRequiredHackingLevel(target);
        if (reqHack > player.skills.hacking) continue; // Skip jika level belum cukup

        let maxMoney = ns.getServerMaxMoney(target);
        if (maxMoney === 0) continue;

        let server = ns.getServer(target);
        server.hackDifficulty = server.minDifficulty;
        server.moneyAvailable = maxMoney;

        // Gunakan Formulas API untuk mensimulasikan "Uang Per Detik" (Profitability Score)
        let hackTime = ns.formulas.hacking.hackTime(server, player);
        let hackChance = ns.formulas.hacking.hackChance(server, player);
        let hackPercent = ns.formulas.hacking.hackPercent(server, player);

        if (hackTime === 0 || hackPercent === 0) continue;

        // Simulasi jika kita mencuri 10%, berapa persen chance dan waktunya?
        // Score = (Uang yang dicuri * Peluang) / Waktu Hack
        let theoreticalSteal = maxMoney * hackPercent;
        let score = (theoreticalSteal * hackChance) / hackTime;

        if (score > bestScore) {
            bestScore = score;
            bestServer = target;
        }
    }

    return bestServer;
}

function scanAllServers(ns) {
    let visited = new Set();
    let queue = ["home"];
    let servers = [];

    while (queue.length > 0) {
        let current = queue.shift();
        if (visited.has(current)) continue;

        visited.add(current);
        if (current !== "home" && !current.startsWith("pserv-")) {
            servers.push(current);
        }

        let neighbors = ns.scan(current);
        for (let neighbor of neighbors) {
            if (!visited.has(neighbor)) queue.push(neighbor);
        }
    }
    return servers;
}

// ==========================================
// FUNGSI 1: PERSIAPAN TARGET
// ==========================================
async function prepServer(ns, target) {
    let minSec = ns.getServerMinSecurityLevel(target);
    let maxMoney = ns.getServerMaxMoney(target);

    while (true) {
        let sec = ns.getServerSecurityLevel(target);
        let money = ns.getServerMoneyAvailable(target);

        ns.clearLog();
        ns.print(`--- FASE PERSIAPAN (${target}) ---`);
        ns.print(`Security: ${ns.formatNumber(sec)} / ${ns.formatNumber(minSec)}`);
        ns.print(`Money   : $${ns.formatNumber(money)} / $${ns.formatNumber(maxMoney)}`);

        if (sec <= minSec + 0.1 && money >= maxMoney * 0.99) break;

        let pservs = ns.getPurchasedServers();
        let workers = ["home", ...pservs];
        let isWeaken = sec > minSec + 0.1;

        let scriptToRun = isWeaken ? "/pro-v3/payload/weaken1.js" : "/pro-v3/payload/grow.js";
        let waitTime = isWeaken ? ns.getWeakenTime(target) : ns.getGrowTime(target);
        let totalThreads = 0;

        for (let w of workers) {
            let ram = ns.getServerMaxRam(w) - ns.getServerUsedRam(w);
            if (w === "home") ram -= 128; // Sisakan 128GB di home untuk keamanan extra

            let threads = Math.floor(ram / 1.75);
            if (threads > 0) {
                if (w !== "home") ns.scp(scriptToRun, w, "home");
                ns.exec(scriptToRun, w, threads, target, 0);
                totalThreads += threads;
            }
        }

        if (totalThreads > 0) {
            ns.print(`≡ƒÜÇ PREP MASSAL ${isWeaken ? "Weaken" : "Grow"} (${totalThreads} trds)`);
            ns.print(`ΓÅ│ Mode Tidur. Menunggu ${ns.tFormat(waitTime)}...`);
            await ns.sleep(waitTime + 1000);
        } else {
            ns.print("≡ƒÆñ Seluruh RAM penuh. Menunggu 60 dtk...");
            await ns.sleep(60000);
        }
    }
}

// ==========================================
// FUNGSI 2: MATEMATIKA FORMULAS 
// ==========================================
function calculateBatch(ns, target, percentToSteal) {
    let server = ns.getServer(target);
    let player = ns.getPlayer();

    server.hackDifficulty = server.minDifficulty;
    let maxMoney = server.moneyMax;
    server.moneyAvailable = maxMoney;

    let hackAmtPerThread = ns.formulas.hacking.hackPercent(server, player);
    if (hackAmtPerThread <= 0) return null;

    let tHack = Math.floor(percentToSteal / hackAmtPerThread);
    if (tHack === 0) {
        tHack = 1;
        percentToSteal = hackAmtPerThread;
    }

    let securityIncreaseFromHack = tHack * 0.002;
    let tWeak1 = Math.ceil(securityIncreaseFromHack / 0.05);

    server.moneyAvailable = maxMoney * (1 - percentToSteal);
    let tGrow = Math.ceil(ns.formulas.hacking.growThreads(server, player, maxMoney));

    // Safety padding for grow
    tGrow = Math.ceil(tGrow * 1.05);

    let securityIncreaseFromGrow = tGrow * 0.004;
    let tWeak2 = Math.ceil(securityIncreaseFromGrow / 0.05);

    return { tHack, tWeak1, tGrow, tWeak2 };
}

// ==========================================
// FUNGSI 3: PENEMBAK (DISPATCHER)
// ==========================================
async function runBatchDispatcher(ns, target, batchData, ramPerBatch, tDelay, durationMs) {
    let batchNumber = 1;
    let startTime = Date.now();

    // Copy payload ke semua pservs di awal dispatcher agar tidak spam SCP tiap milidetik
    let pservs = ns.getPurchasedServers();
    for (let p of pservs) {
        ns.scp(["/pro-v3/payload/hack.js", "/pro-v3/payload/weaken1.js", "/pro-v3/payload/grow.js", "/pro-v3/payload/weaken2.js"], p, "home");
    }

    while (Date.now() - startTime < durationMs) {
        pservs = ns.getPurchasedServers();
        // Cari server yang paling lega RAM-nya (prioritaskan pserv, baru home di akhir)
        let workers = [...pservs, "home"].sort((a, b) => {
            let ramA = ns.getServerMaxRam(a) - ns.getServerUsedRam(a) - (a === "home" ? 128 : 0);
            let ramB = ns.getServerMaxRam(b) - ns.getServerUsedRam(b) - (b === "home" ? 128 : 0);
            return ramB - ramA;
        });

        let bestWorker = workers[0];
        let availableRam = ns.getServerMaxRam(bestWorker) - ns.getServerUsedRam(bestWorker) - (bestWorker === "home" ? 128 : 0);

        if (availableRam < ramPerBatch) {
            await ns.sleep(100);
            continue;
        }

        let timeHack = ns.getHackTime(target);
        let timeGrow = ns.getGrowTime(target);
        let timeWeaken = ns.getWeakenTime(target);

        let timeEnd_W2 = timeWeaken;
        let timeEnd_G = timeEnd_W2 - tDelay;
        let timeEnd_W1 = timeEnd_G - tDelay;
        let timeEnd_H = timeEnd_W1 - tDelay;

        let delay_W2 = timeEnd_W2 - timeWeaken;
        let delay_G = timeEnd_G - timeGrow;
        let delay_W1 = timeEnd_W1 - timeWeaken;
        let delay_H = timeEnd_H - timeHack;

        ns.print(`[BATCH ${batchNumber}] Ditembakkan ke -> ${bestWorker}`);

        if (batchData.tHack > 0) ns.exec("/pro-v3/payload/hack.js", bestWorker, batchData.tHack, target, delay_H, batchNumber);
        if (batchData.tWeak1 > 0) ns.exec("/pro-v3/payload/weaken1.js", bestWorker, batchData.tWeak1, target, delay_W1, batchNumber);
        if (batchData.tGrow > 0) ns.exec("/pro-v3/payload/grow.js", bestWorker, batchData.tGrow, target, delay_G, batchNumber);
        if (batchData.tWeak2 > 0) ns.exec("/pro-v3/payload/weaken2.js", bestWorker, batchData.tWeak2, target, delay_W2, batchNumber);

        batchNumber += 1;
        await ns.sleep(tDelay * 4);
    }

    ns.print(`ΓÅ░ Siklus ${ns.tFormat(durationMs)} selesai. Mencari target baru...`);
}

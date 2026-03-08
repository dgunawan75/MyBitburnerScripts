/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.tail();

    // Pastikan user memberikan target yang valid
    const target = ns.args[0];
    if (!target) {
        ns.tprint("ERROR: Harap berikan nama server target. Contoh: run /pro-v3/hwgw-master.js megacorp");
        return;
    }

    if (!ns.hasRootAccess(target)) {
        ns.tprint(`ERROR: Anda belum memiliki akses Root (Nuke) ke ${target}.`);
        return;
    }

    ns.print(`=========================================`);
    ns.print(` H.W.G.W BATCHING ENGINE INITIALIZED     `);
    ns.print(` TARGET: ${target.toUpperCase()}`);
    ns.print(`=========================================`);

    // Konfigurasi Delay Presisi (dalam milidetik)
    // Delay ini memastikan 4 aksi mendarat bergantian tanpa bertabrakan
    const T_DELAY = 50;

    // RAM cost dari masing-masing payload script 
    // (Script payload yang kita buat butuh tepat 1.70 GB dan 1.75 GB / thread)
    const HACK_RAM = ns.getScriptRam("/pro-v3/payload/hack.js");
    const WEAK_RAM = ns.getScriptRam("/pro-v3/payload/weaken1.js");
    const GROW_RAM = ns.getScriptRam("/pro-v3/payload/grow.js");

    // 1. FASE PERSIAPAN (PREP PHASE)
    // Server harus 100% penuh uangnya dan 0% security-nya sebelum Batch bisa dihitung presisi.
    await prepServer(ns, target);

    ns.print("🟢 Target siap. Menghitung Matematika Formulas API...");

    // 2. FASE PERHITUNGAN BATCH (MATH PHASE)
    // Menghitung berapa persisnya thread Hack, Weaken, dan Grow yang dibutuhkan untuk mencuri X% uang.
    // Kita targetkan mencuri 50% max money per kalinya (agar sisa uang masih cukup untuk dicloning dengan efisien).
    const batchData = calculateBatch(ns, target, 0.50);

    if (!batchData) {
        ns.print("❌ ERROR: Kalkulasi batch gagal. RAM atau Skill Hacking mungkin tidak memadai.");
        return;
    }

    // Hitung total RAM yang dibutuhkan untuk 1 siklus HWGW penuh
    const ramPerBatch = (batchData.tHack * HACK_RAM) +
        (batchData.tWeak1 * WEAK_RAM) +
        (batchData.tGrow * GROW_RAM) +
        (batchData.tWeak2 * WEAK_RAM);

    ns.print(`⚙️ Kebutuhan RAM 1 Batch : ${ns.formatNumber(ramPerBatch)} GB`);
    ns.print(`🧵 Threads per Batch     : H(${batchData.tHack}) W1(${batchData.tWeak1}) G(${batchData.tGrow}) W2(${batchData.tWeak2})`);

    // 3. FASE PENEMBAKAN (DISPATCH PHASE)
    await runBatchDispatcher(ns, target, batchData, ramPerBatch, T_DELAY);
}

// ==========================================
// FUNGSI 1: PERSIAPAN TARGET (MAX MONEY & MIN SEC)
// ==========================================
async function prepServer(ns, target) {
    let minSec = ns.getServerMinSecurityLevel(target);
    let maxMoney = ns.getServerMaxMoney(target);

    while (true) {
        let sec = ns.getServerSecurityLevel(target);
        let money = ns.getServerMoneyAvailable(target);

        ns.clearLog();
        ns.print("--- FASE PERSIAPAN (PREP) ---");
        ns.print(`Security: ${ns.formatNumber(sec)} / ${ns.formatNumber(minSec)}`);
        ns.print(`Money   : $${ns.formatNumber(money)} / $${ns.formatNumber(maxMoney)}`);

        // Jika sudah sempurna, keluar dari loop
        if (sec <= minSec + 0.1 && money >= maxMoney * 0.99) {
            break;
        }

        // Tembakkan peluru kasar dari `home` & semua `pserv-` untuk memperbaiki server MASSAL
        let pservs = ns.getPurchasedServers();
        let workers = ["home", ...pservs];

        let weakTime = ns.getWeakenTime(target);
        let growTime = ns.getGrowTime(target);
        let isWeaken = sec > minSec + 0.1;

        let scriptToRun = isWeaken ? "/pro-v3/payload/weaken1.js" : "/pro-v3/payload/grow.js";
        let waitTime = isWeaken ? weakTime : growTime;

        let totalThreads = 0;

        for (let w of workers) {
            let ram = ns.getServerMaxRam(w) - ns.getServerUsedRam(w);
            if (w === "home") ram -= 64; // Sisakan 64GB di home

            let threads = Math.floor(ram / 1.75);
            if (threads > 0) {
                if (w !== "home") ns.scp(scriptToRun, w, "home");
                // Eksekusi payload dengan delay 0
                ns.exec(scriptToRun, w, threads, target, 0);
                totalThreads += threads;
            }
        }

        if (totalThreads > 0) {
            ns.print(`🚀 Menembakkan MASSAL ${isWeaken ? "Weaken" : "Grow"} (${totalThreads} threads)...`);
            ns.print(`⏳ Mesin HWGW akan masuk ke "Mode Tidur". Silakan mainkan game Anda.`);
            ns.print(`⏳ Peluru diprediksi mendarat dalam ${ns.tFormat(waitTime)}`);

            // ==========================================
            // TRIK PRO: MODE TIDUR PANJANG (BACKGROUND)
            // ==========================================
            // Alih-alih membuat game ngelag karena script mngecek terus tiap milidetik,
            // kita PAKSA script ini untuk "tidur mati" selama waktu jatuhnya peluru.
            // Saat tidur, script ini mengonsumsi 0 CPU/RAM.
            await ns.sleep(waitTime + 1000);
        } else {
            // Jika tidak ada sisa RAM sama sekali di seluruh jaringan, tidur 1 menit sebelum mencoba lagi
            ns.print("💤 Seluruh RAM sedang penuh. Menunggu 60 detik...");
            await ns.sleep(60000);
        }
    }
}

// ==========================================
// FUNGSI 2: MATEMATIKA FORMULAS (MENGHITUNG THREADS AKTUAL)
// ==========================================
function calculateBatch(ns, target, percentToSteal) {
    let server = ns.getServer(target);
    let player = ns.getPlayer();

    // KETATKAN KONDISI KE TARGET IDEAL
    server.hackDifficulty = server.minDifficulty;
    let maxMoney = server.moneyMax;
    server.moneyAvailable = maxMoney;

    // 1. Berapa thread Hack yang butuh untuk curi persenan uang?
    let hackAmtPerThread = ns.formulas.hacking.hackPercent(server, player);

    if (hackAmtPerThread <= 0) {
        ns.print(`❌ ERROR LOGIKA: Hacking Level Anda (${player.skills.hacking}) masih di bawah batas minimal atau belum cukup jago untuk me-hack ${target} (${server.requiredHackingSkill}).`);
        return null;
    }

    let tHack = Math.floor(percentToSteal / hackAmtPerThread);

    // Perbaikan Bug: Jika 1 thread Hack rupanya mencuri MELAmpaui 50% target kita
    if (tHack === 0) {
        tHack = 1;
        percentToSteal = hackAmtPerThread; // Sesuaikan target persentase curian dengan kenyataan 1 thread
    }

    // Saat di-hack, Security naik 0.002 per thread
    let securityIncreaseFromHack = tHack * 0.002;

    // 2. Berapa thread Weaken ke-1 (tWeak1) untuk menetralkannya?
    let tWeak1 = Math.ceil(securityIncreaseFromHack / 0.05);

    // 3. Setelah uang dicuri x%, tinggal (1-x)%.
    // Berapa thread Grow untuk membesarkannya kembali ke 100%?
    server.moneyAvailable = maxMoney * (1 - percentToSteal);
    let tGrow = ns.formulas.hacking.growThreads(server, player, maxMoney);

    // Saat uang di-grow, Security naik 0.004 per thread
    let securityIncreaseFromGrow = tGrow * 0.004;

    // 4. Berapa thread Weaken ke-2 (tWeak2) untuk menetralkannya?
    let tWeak2 = Math.ceil(securityIncreaseFromGrow / 0.05);

    return {
        tHack: tHack,
        tWeak1: tWeak1,
        tGrow: tGrow,
        tWeak2: tWeak2,
    };
}

// ==========================================
// FUNGSI 3: PENEMBAK (DISPATCHER)
// ==========================================
async function runBatchDispatcher(ns, target, batchData, ramPerBatch, tDelay) {
    let batchNumber = 1;

    // Ini adalah delay maksimum yang kita perbolehkan agar script tidak overlapping dengan dirinya sendiri di siklus berikutnya
    let weakTime = ns.getWeakenTime(target);
    let maxBatches = Math.floor(weakTime / (tDelay * 4));

    ns.print(`⚡ Max Safe Concurrent Batches: ${maxBatches}`);

    while (true) {
        // Cek sisa RAM di Home
        let homeRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home") - 64;

        if (homeRam < ramPerBatch) {
            await ns.sleep(100);
            continue; // Tunggu sampai ada batch yang selesai dan RAM kembali
        }

        // Hitung ulang waktu dinamis
        let timeHack = ns.getHackTime(target);
        let timeGrow = ns.getGrowTime(target);
        let timeWeaken = ns.getWeakenTime(target);

        // KUNCI HWGW: Keempat aksi harus MENDARAT dalam urutan H -> W1 -> G -> W2 dengan jarak 50ms.
        // Karena Waktu Eksekusi berbeda (Weaken terlama, Hack tercepat), kita memundurkan waktu peluncurannya (Delay).

        // Asumsi: Kita atur W2 mendarat di "Waktu Weaken" penuh.
        let timeEnd_W2 = timeWeaken;                 // Peluru ke-4 mendarat
        let timeEnd_G = timeEnd_W2 - tDelay;        // Peluru ke-3 mendarat 50ms sebelumnya
        let timeEnd_W1 = timeEnd_G - tDelay;         // Peluru ke-2 mendarat 50ms sebelumnya
        let timeEnd_H = timeEnd_W1 - tDelay;        // Peluru ke-1 mendarat 50ms sebelumnya

        // Hitung Delay Meluncur (Kapan mereka harus dilemparkan dari server home)
        // Delay Meluncur = Waktu Target Mendarat - Waktu Tempuh Peluru
        let delay_W2 = timeEnd_W2 - timeWeaken;
        let delay_G = timeEnd_G - timeGrow;
        let delay_W1 = timeEnd_W1 - timeWeaken;
        let delay_H = timeEnd_H - timeHack;

        // TEMBAK PELURU! (Penting: script harus ditambahkan identitas unik agar bisa dijalankan berkali-kali secara paralel. Kita pakai batchNumber)
        ns.print(`[BATCH ${batchNumber}] Sedang Meluncur...`);

        if (batchData.tHack > 0) ns.exec("/pro-v3/payload/hack.js", "home", batchData.tHack, target, delay_H, batchNumber);
        if (batchData.tWeak1 > 0) ns.exec("/pro-v3/payload/weaken1.js", "home", batchData.tWeak1, target, delay_W1, batchNumber);
        if (batchData.tGrow > 0) ns.exec("/pro-v3/payload/grow.js", "home", batchData.tGrow, target, delay_G, batchNumber);
        if (batchData.tWeak2 > 0) ns.exec("/pro-v3/payload/weaken2.js", "home", batchData.tWeak2, target, delay_W2, batchNumber);

        batchNumber += 1;

        // Tunggu sejenak sebelum menembakkan rombongan Batch berikutnya
        await ns.sleep(tDelay * 4);
    }
}

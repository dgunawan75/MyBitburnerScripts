/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.print("=== [SINGULARITY AUGMENTATION CALCULATOR] ===");

    // Dalam Bitburner, konstanta kenaikannya selalu 1.9 per augment (bisa berubah di BitNode 11 dsb)
    // Untuk lebih akurat, Bitburner punya konstanta bawaan
    const PRICE_MULTI = 1.9;

    let joinedFactions = ns.getPlayer().factions;
    let ownedAugs = ns.singularity.getOwnedAugmentations(true); // Termasuk yang dibeli tapi belum install

    // 1. Kumpulkan semua Augments yang BISA DIBELI saat ini (Reputasi Cukup)
    let availableAugs = [];
    let processed = new Set();

    for (let f of joinedFactions) {
        let augs = ns.singularity.getAugmentationsFromFaction(f);
        let factRep = ns.singularity.getFactionRep(f);

        for (let a of augs) {
            // Abaikan NeuroFlux untuk nanti
            if (a === "NeuroFlux Governor") continue;

            // Abaikan jika sudah punya
            if (ownedAugs.includes(a)) continue;

            // Masukkan jika belum diproses dan reputasi cukup
            if (!processed.has(a)) {
                let reqRep = ns.singularity.getAugmentationRepReq(a);
                if (factRep >= reqRep) {
                    let cost = ns.singularity.getAugmentationBasePrice(a);
                    availableAugs.push({
                        name: a,
                        faction: f,
                        baseCost: cost,
                        prereqs: ns.singularity.getAugmentationPrereq(a)
                    });
                    processed.add(a);
                }
            }
        }
    }

    if (availableAugs.length === 0) {
        ns.print("❌ Tidak ada Augmentation baru yang reputasinya cukup untuk dibeli saat ini.");
        return;
    }

    // 2. SORTING (Paling Penting!)
    // Formula dasar: Beli yang PALING MAHAL lebih dulu.
    availableAugs.sort((a, b) => b.baseCost - a.baseCost);

    // 3. DEPENDENCY (Prereq) RESOLUTION
    // Jika sebuah augment butuh augment lain, kita TIDAK BISA membelinya lebih awal.
    // Kita harus menggeser augment PRASYARAT agar dibeli sebelum augment utamanya.
    let finalOrder = [];
    let boughtInSim = [...ownedAugs];

    // Fungsi rekursif untuk menambahkan prasyarat lebih dulu
    function addToOrder(aug) {
        if (finalOrder.includes(aug)) return;

        // Cek prasyarat
        for (let pre of aug.prereqs) {
            if (!boughtInSim.includes(pre)) {
                // Cari data prasyarat di daftar yang tersedia
                let preData = availableAugs.find(x => x.name === pre);
                if (preData) {
                    addToOrder(preData);
                } else {
                    // Prasyarat tidak bisa dibeli (reputasi kurang dll)
                    return false;
                }
            }
        }

        finalOrder.push(aug);
        boughtInSim.push(aug.name);
        return true;
    }

    for (let aug of availableAugs) {
        addToOrder(aug);
    }

    // 4. KALKULASI HARGA TOTAL (Dengan eksponen 1.9x)
    let totalCost = 0;
    let affordableOrder = [];
    let money = ns.getServerMoneyAvailable("home");

    ns.print("\n📋 [FORMULA: SIMULASI URUTAN PEMBELIAN TERBAIK]");

    for (let i = 0; i < finalOrder.length; i++) {
        let aug = finalOrder[i];

        // Harga Asli x (1.9 ^ jumlah augment yang sudah dibeli di siklus ini)
        let actualPrice = aug.baseCost * Math.pow(PRICE_MULTI, i);

        if (money >= totalCost + actualPrice) {
            totalCost += actualPrice;
            affordableOrder.push(aug);
            let costStr = ns.formatNumber(actualPrice);
            let baseStr = ns.formatNumber(aug.baseCost);
            ns.print(` [${i + 1}] ${aug.name} | Harga asli: $${baseStr} -> Kena Inflasi: $${costStr}`);
        } else {
            ns.print(` ❌ [TIDAK CUKUP UANG] ${aug.name} butuh $${ns.formatNumber(actualPrice)}, sisa uang: $${ns.formatNumber(money - totalCost)}`);
            break; // Jika 1 gagal dibeli karena kemahalan, stop rantainya.
        }
    }

    // 5. EKSEKUSI PEMBELIAN?
    ns.print(`\n💰 Total Uang Anda: $${ns.formatNumber(money)}`);
    ns.print(`💸 Estimasi Total Biaya Murni: $${ns.formatNumber(totalCost)}`);

    if (affordableOrder.length > 0) {
        ns.print(`\n🔧 Jika Anda setuju dengan kalkulasi ini, script bisa membelinya secara otomatis.`);

        // Hanya eksekusi jika pengguna memanggil dengan parameter "buy"
        // Contoh terminal: run ai/auto-augments.js buy
        if (ns.args[0] === "buy") {
            ns.print("🚀 MENGEKSEKUSI PEMBELIAN...");
            for (let aug of affordableOrder) {
                if (ns.singularity.purchaseAugmentation(aug.faction, aug.name)) {
                    ns.print(`  ✔️ BERHASIL MEMBELI: ${aug.name}`);
                }
            }

            // HABISKAN SISA UANG UNTUK MENG-UPGRADE NEUROFLUX GOVERNOR
            ns.print("\n🌌 MENCARI NEUROFLUX GOVERNOR DENGAN SISA UANG...");
            let factions = ns.getPlayer().factions;
            let boughtNF = 0;
            while (true) {
                let boughtThisRound = false;
                for (let f of factions) {
                    if (ns.singularity.purchaseAugmentation(f, "NeuroFlux Governor")) {
                        boughtNF++;
                        boughtThisRound = true;
                        break;
                    }
                }
                if (!boughtThisRound) break; // Uang / Reputasi sudah tidak cukup lagi
            }
            if (boughtNF > 0) ns.print(`  ✔️ Memborong sukses: +${boughtNF} Level NeuroFlux Governor!`);

            ns.print("\n🔄 TRANSAKSI BERES. SIlakan jalankan [ns.singularity.installAugmentations('ai/orchestrator.js')] untuk REBIRTH!");

        } else {
            ns.print("\n⚠️ KETIK PERINTAH INI DI TERMINAL UNTUK MEMBELI:");
            ns.print("   run ai/auto-augments.js buy");
        }
    }
}

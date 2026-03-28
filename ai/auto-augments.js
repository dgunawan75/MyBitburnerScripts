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

    // 3. KEPUTUSAN HARGA MURNI (SIMPLE DESCENDING)
    // Berkat ide Anda, skrip tidak akan lagi memaksa menaikkan Prasyarat Augment Murah ke atas.
    // Jika prasyaratnya kebetulan dibeli lebih dulu (karena secara alami lebih mahal), ia akan dibeli.
    // Tetapi jika prasyaratnya lebih murah, skrip akan melewatinya dan lanjut berburu augment mahal lainnya
    // demi menyelamatkan pengali inflasi 1.9x untuk run selanjutnya.
    let finalOrder = availableAugs;

    // 4. KALKULASI HARGA TOTAL (Dengan eksponen 1.9x)
    let totalCost = 0;
    let affordableOrder = [];
    let money = ns.getServerMoneyAvailable("home");

    ns.print("\n📋 [FORMULA: SIMULASI URUTAN PEMBELIAN TERBAIK]");

    for (let i = 0; i < finalOrder.length; i++) {
        let aug = finalOrder[i];

        let canBuy = true;
        for (let pre of aug.prereqs) {
            if (!ownedAugs.includes(pre) && !affordableOrder.find(x => x.name === pre)) {
                canBuy = false;
                break;
            }
        }

        if (!canBuy) {
            continue;
        }

        // Harga Asli x (1.9 ^ jumlah augment AKTUAL di keranjang)
        let actualPrice = aug.baseCost * Math.pow(PRICE_MULTI, affordableOrder.length);

        if (money >= totalCost + actualPrice) {
            totalCost += actualPrice;
            affordableOrder.push(aug);
            let costStr = ns.formatNumber(actualPrice);
            let baseStr = ns.formatNumber(aug.baseCost);
            ns.print(` [${affordableOrder.length}] ${aug.name} | Harga asli: $${baseStr} -> Kena Inflasi: $${costStr}`);
        } else {
            // Uang tidak cukup. Lewati secara diam-diam dan cari augment yang lebih murah.
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

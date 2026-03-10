/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.tail();

    ns.print("=========================================");
    ns.print(" 🧬 AUTO-AUGMENTATION PURCHASER (PRO-V6) ");
    ns.print("=========================================");

    // Cek apakah pemain memiliki Singularity API (Dibutuhkan untuk membeli Augmentasi via Script)
    // Singularity API didapat dari menyelesaikan BitNode-4
    let hasSingularity = false;
    try {
        ns.singularity.getOwnedAugmentations();
        hasSingularity = true;
    } catch (e) {
        ns.print("❌ ERROR STRATEGIS:");
        ns.print("Script pencari Augmentasi otomatis memerlukan [Singularity API].");
        ns.print("API ini didapatkan setelah Anda menamatkan BitNode-4.");
        ns.print("Untuk saat ini, Anda harus membeli Augmentasi secara MANUAL di tab Faksi.");
        return;
    }

    if (!hasSingularity) return;

    ns.print("🔄 Memindai seluruh faksi dan ketersediaan Augmentasi...");

    let myFactions = ns.getPlayer().factions;
    let ownedAugs = ns.singularity.getOwnedAugmentations(true); // true = termasuk yang baru dibeli tapi belum di-install
    let money = ns.getServerMoneyAvailable("home");

    // Daftar semua augmentasi yang bisa kita beli saat ini
    let availableAugs = [];

    for (let faction of myFactions) {
        let factionRep = ns.singularity.getFactionRep(faction);
        let augsInFaction = ns.singularity.getAugmentationsFromFaction(faction);

        for (let aug of augsInFaction) {
            // Lewati jika sudah punya
            if (ownedAugs.includes(aug)) continue;

            // NeuroFlux Governor bisa dibeli berkali-kali, tapi logika ini khusus untuk aug unik dulu
            if (aug === "NeuroFlux Governor") continue;

            let reqRep = ns.singularity.getAugmentationRepReq(aug);
            let basePrice = ns.singularity.getAugmentationBasePrice(aug);

            // Cek prasyarat augmentasi (beberapa aug butuh aug lain terinstall dulu)
            let prereqs = ns.singularity.getAugmentationPrereq(aug);
            let prereqsMet = prereqs.every(req => ownedAugs.includes(req));

            if (factionRep >= reqRep && prereqsMet) {
                // Jangan masukkan duplikat jika aug ini juga dijual oleh faksi lain
                if (!availableAugs.some(a => a.name === aug)) {
                    availableAugs.push({
                        name: aug,
                        faction: faction,
                        price: basePrice
                    });
                }
            }
        }
    }

    if (availableAugs.length === 0) {
        ns.print("✅ Tidak ada Augmentasi baru yang bisa dibeli saat ini.");
        ns.print("Mungkin uang atau reputasi Anda belum cukup, atau Anda sudah memborong semua.");

        // Coba beli NeuroFlux Governor sebanyak mungkin sebagai sisa uang
        buyNeuroFlux(ns, myFactions, ownedAugs);
        return;
    }

    // ==========================================
    // RUMUS MAGIC: URUTAN PEMBELIAN (Paling Mahal -> Paling Murah)
    // ==========================================
    // Di Bitburner, setiap kali Anda membeli 1 Augmentasi, harga SEMUA Augmentasi lainnya
    // akan naik berlipat ganda secara eksponensial (Multiplier).
    // Rumus agar uang Anda paling efektif: BELI DARI YANG PALING MAHAL ke YANG PALING MURAH.
    availableAugs.sort((a, b) => b.price - a.price);

    ns.print(`Ditemukan ${availableAugs.length} Augmentasi yang siap dibeli.`);

    let buyCount = 0;
    for (let aug of availableAugs) {
        // Cek harga TERBARU karena harga terus naik setelah tiap pembelian
        let currentPrice = ns.singularity.getAugmentationPrice(aug.name);
        money = ns.getServerMoneyAvailable("home");

        if (money >= currentPrice) {
            let success = ns.singularity.purchaseAugmentation(aug.faction, aug.name);
            if (success) {
                ns.print(`💰 MEMBELI: ${aug.name} dari ${aug.faction} (Harga: $${ns.formatNumber(currentPrice)})`);
                buyCount++;
            }
        }
    }

    // Setelah memborong semua aug unik, habiskan sisa uang untuk NeuroFlux Governor
    buyNeuroFlux(ns, myFactions, ownedAugs);

    ns.print("\n=========================================");
    ns.print(`🎉 SELESAI! Berhasil memborong ${buyCount} Augmentasi Khusus.`);
    ns.print("Tugas Anda sekarang hanyalah menekan tombol [Install Augmentations].");
    ns.print("Sampai jumpa di kehidupan berikutnya!");
    ns.print("=========================================");
}

function buyNeuroFlux(ns, myFactions, ownedAugs) {
    // NeuroFlux Governor tersedia di semua faksi, cari faksi yang rep-nya paling tinggi untuk memborongnya
    let bestFaction = "";
    let highestRep = 0;

    for (let faction of myFactions) {
        let rep = ns.singularity.getFactionRep(faction);
        if (rep > highestRep) {
            highestRep = rep;
            bestFaction = faction;
        }
    }

    if (bestFaction === "") return;

    let boughtItems = 0;
    while (true) {
        let price = ns.singularity.getAugmentationPrice("NeuroFlux Governor");
        let repReq = ns.singularity.getAugmentationRepReq("NeuroFlux Governor");
        let money = ns.getServerMoneyAvailable("home");

        if (money >= price && highestRep >= repReq) {
            let success = ns.singularity.purchaseAugmentation(bestFaction, "NeuroFlux Governor");
            if (success) {
                boughtItems++;
            } else {
                break;
            }
        } else {
            break;
        }
    }

    if (boughtItems > 0) {
        ns.print(`💉 Extra Bonus: Memborong ${boughtItems} Level NeuroFlux Governor dari ${bestFaction}.`);
    }
}

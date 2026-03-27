/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("Menjalankan Auto-Faction Worker (Grinder Reputasi Cerdas)");
    ns.ui.openTail();

    // Hacking Gangs Factions - Reputasi mereka sudah diurus otomatis oleh GENG!
    // Tidak akan diblacklist secara absolut, tetapi kita memprioritaskan Faksi di luar geng.
    const GANG_FACTIONS = ["NiteSec", "The Black Hand", "Slum Snakes", "Tetrads", "Speakers for the Dead", "The Syndicate", "The Dark Army"];

    while (true) {
        // Jika pemain sedang sibuk (sekolah, kuliah, GYM, kriminal, dll),
        // Worker TIDAK AKAN JALAN untuk menghormati tugas Orchestrator dan Player
        let currentWork = ns.singularity.getCurrentWork();
        // Hanya boleh ngambil alih jika player sedang idle, ATAU sedang melakukan pekerjaan faksi (untuk diperbarui)
        if (currentWork && currentWork.type !== "FACTION") {
            await ns.sleep(10000);
            continue;
        }

        let ownedAugs = ns.singularity.getOwnedAugmentations(true);
        let myFactions = ns.getPlayer().factions;

        let targetFaction = null;
        let targetAug = null;
        let maxRepOff = 0; // Selisih reputasi terjauh yang paling GAMPANG dicapai

        for (let f of myFactions) {
            // Lebarkan jalan untuk Faksi lain karena Geng biasanya Reputasinya pasif
            if (GANG_FACTIONS.includes(f)) continue;

            let augs = ns.singularity.getAugmentationsFromFaction(f);
            let factRep = ns.singularity.getFactionRep(f);

            for (let a of augs) {
                if (a === "NeuroFlux Governor") continue; // Diurus akhir siklus

                if (!ownedAugs.includes(a)) {
                    let reqRep = ns.singularity.getAugmentationRepReq(a);
                    if (reqRep > factRep) {
                        let off = reqRep - factRep;
                        // Kita mencari beban yang paling KECIL dulu (low-hanging fruit)
                        if (targetFaction === null || off < maxRepOff) {
                            targetFaction = f;
                            targetAug = a;
                            maxRepOff = off;
                        }
                    }
                }
            }
        }

        if (targetFaction) {
            let working = false;
            // Gunakan metode Hacking Contracts karena stat Hack pemain murni paling tinggi biasa
            if (ns.singularity.workForFaction(targetFaction, "Hacking Contracts", false)) working = true;
            else if (ns.singularity.workForFaction(targetFaction, "Field Work", false)) working = true;
            else if (ns.singularity.workForFaction(targetFaction, "Security Work", false)) working = true;

            if (working) {
                ns.print(`👔 DIKONTRAK! Meretas rahasia demi Faksi: ${targetFaction}`);
                ns.print(`   > Mengejar Augment Langka: ${targetAug} (Butuh: +${ns.formatNumber(maxRepOff)} Reputasi)`);
            }
        } else {
            // Semua faksi Non-Gang sudah selesai? (Bisa jadi idle)
            // ns.print("🎉 Seluruh Faksi luar telah dieksploitasi kepentingannya. Tidak ada augment tertinggal.");
            if (currentWork && currentWork.type === "FACTION") {
                ns.singularity.stopAction();
                ns.print("✅ Tugas Selesai. Istirahat.");
            }
        }

        await ns.sleep(60000); // Check satu menit sekali agar hemat performa
    }
}

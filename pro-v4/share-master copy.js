/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.tail();

    ns.print("=========================================");
    ns.print(" FACTION SHARE MASTER (PRO-V4) ENGINE    ");
    ns.print(" Tujuan: Memaksimalkan Reputasi Faksi    ");
    ns.print("=========================================");

    const SHARE_SCRIPT = "/workers/share.js";
    const SHARE_RAM = ns.getScriptRam(SHARE_SCRIPT);

    while (true) {
        let servers = scanNetwork(ns);
        let totalThreads = 0;

        for (let server of servers) {
            // Abaikan server yang belum di root
            if (!ns.hasRootAccess(server)) continue;

            // INSTRUKSI USER: Jangan gunakan "home" maupun "pserv-" (server yang dibeli)
            // Biarkan semua RAM premium tersebut fokus untuk memompa uang di HWGW.
            // Share power BISA murni dijalankan dari ratusan server NPC yang sudah di-Nuke.
            if (server === "home" || server.startsWith("pserv-")) continue;

            let maxRam = ns.getServerMaxRam(server);
            let usedRam = ns.getServerUsedRam(server);

            let freeRam = maxRam - usedRam;
            let threads = Math.floor(freeRam / SHARE_RAM);

            if (threads > 0) {
                // Kopi script share ke node (jika belum ada)
                if (!ns.fileExists(SHARE_SCRIPT, server)) {
                    await ns.scp(SHARE_SCRIPT, server, "home");
                }

                // Eksekusi share script sebanyak mungkin
                ns.exec(SHARE_SCRIPT, server, threads);
            }

            // Tambahkan semua threads share yang sedang jalan di server ini
            // (termasuk yang mungkin sudah jalan sejak loop sebelumnya)
            let runningThreads = getRunningShareThreads(ns, server, SHARE_SCRIPT);
            totalThreads += runningThreads;
        }

        let sharePower = ns.getSharePower();
        ns.clearLog();
        ns.print("=========================================");
        ns.print(" FACTION SHARE MASTER (PRO-V4) ENGINE    ");
        ns.print("=========================================");
        ns.print(`⚡ Share Threads Aktif : ${ns.formatNumber(totalThreads)}`);

        // Share power default adalah 1. Tiap thread menambah koma desimal, yang mempercepat reputasi.
        let bonusPercent = ((sharePower - 1) * 100).toFixed(2);
        ns.print(`🌟 Booster Reputasi    : +${bonusPercent}%`);
        ns.print(`⏳ Mesin berjalan murni di background...`);

        await ns.sleep(10000); // Update log setiap 10 detik
    }
}

// Fungsi rekursif untuk memindai SEMUA server di jaringan (Home, Pserv-, dan Node musuh)
function scanNetwork(ns) {
    let servers = ["home"];
    for (let i = 0; i < servers.length; i++) {
        let current = servers[i];
        let neighbors = ns.scan(current);
        for (let j = 0; j < neighbors.length; j++) {
            if (!servers.includes(neighbors[j])) {
                servers.push(neighbors[j]);
            }
        }
    }
    return servers;
}

// Menghitung berapa banyak thread share yang sedang jalan di suatu server
function getRunningShareThreads(ns, server, scriptName) {
    let ps = ns.ps(server);
    let threads = 0;
    for (let p of ps) {
        if (p.filename === scriptName) {
            threads += p.threads;
        }
    }
    return threads;
}

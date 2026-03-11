/* normal buat Nuke server
    -- pserv include pserv server
    -- all include pserv server and home server
*/
/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    ns.print("=========================================");
    ns.print(" FACTION SHARE MASTER (PRO-V4) ENGINE    ");
    ns.print(" Tujuan: Memaksimalkan Reputasi Faksi    ");
    ns.print("=========================================");

    const useAll = ns.args.includes("--all");
    const usePserv = ns.args.includes("--pserv") || useAll;

    ns.print("=========================================");
    ns.print(" FACTION SHARE MASTER (PRO-V4) ENGINE    ");
    ns.print(" Tujuan: Memaksimalkan Reputasi Faksi    ");
    ns.print(` Mode: ${useAll ? "ALL (Termasuk HOME)" : usePserv ? "PSERV + NPC (Tanpa HOME)" : "NPC ONLY (Nuked Server)"}`);
    ns.print("=========================================");

    const SHARE_SCRIPT = "/workers/share.js";
    const SHARE_RAM = ns.getScriptRam(SHARE_SCRIPT);

    while (true) {
        let servers = scanNetwork(ns);
        let totalThreads = 0;

        for (let server of servers) {
            // Abaikan server yang belum di root
            if (!ns.hasRootAccess(server)) continue;

            // Filter server berdasarkan mode argumen CLI
            if (server === "home" && !useAll) continue;
            if (server.startsWith("pserv-") && !usePserv) continue;

            let maxRam = ns.getServerMaxRam(server);
            let usedRam = ns.getServerUsedRam(server);

            // Jika mode --all aktif dan kita mengeksekusi di home, sisakan RAM untuk HWGW
            if (server === "home") {
                let safetyMargin = 128; // Instruksi user: Cukup sisakan 128GB mutlak
                maxRam -= safetyMargin;
            }

            let freeRam = maxRam - usedRam;
            let threads = Math.floor(freeRam / SHARE_RAM);

            if (threads > 0) {
                // Kopi script share ke node (jika belum ada)
                if (server !== "home" && !ns.fileExists(SHARE_SCRIPT, server)) {
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

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("Menjalankan Auto-Pserv (Smart Proportion Purchaser)");
    ns.ui.openTail();

    // RAM awal terkecil yang sudi kita beli (biar gak mubazir limit 25 server)
    const MIN_RAM = 256;
    const MAX_RAM = 1048576; // 1 PB

    while (true) {
        let money = ns.getServerMoneyAvailable("home");
        let reserve = getReserve(ns);

        if (money < reserve) {
            await ns.sleep(30000);
            continue;
        }

        // PENTING: Batas ukurannya adalah HARUS LEBIH KECIL dari 2% total uang kas Anda.
        // Jika kita di ambang batas 2%, meskipun kita merombak 25 server sekaligus, 
        // total pengeluarannya hanya memakan 50% tabungan utuh! Sangat Sangat Aman!
        let allowedCost = (money - reserve) * 0.02;
        let maxAffordableRam = 0;

        // Cek mulai dari dewa (1 PB) trus turun ke MIN_RAM
        for (let r = MAX_RAM; r >= MIN_RAM; r /= 2) {
            if (ns.getPurchasedServerCost(r) <= allowedCost) {
                maxAffordableRam = r;
                break;
            }
        }

        if (maxAffordableRam > 0) {
            let pservs = ns.getPurchasedServers();

            // 1. Coba Beli Baru jika slot belum penuh (25)
            if (pservs.length < ns.getPurchasedServerLimit()) {
                let name = ns.purchaseServer("pserv", maxAffordableRam);
                if (name) {
                    ns.print(`[+] Beli Server Baru: ${name} (${maxAffordableRam} GB) seharga $${ns.formatNumber(ns.getPurchasedServerCost(maxAffordableRam))}`);
                }
            }
            // 2. Jika sudah mentok 25 server, KORBANKAN yang terlemah
            else {
                let weakest = pservs.reduce((minSv, sv) =>
                    ns.getServerMaxRam(sv) < ns.getServerMaxRam(minSv) ? sv : minSv
                );

                let wRam = ns.getServerMaxRam(weakest);
                // Hanya Upgrade jika RAM Target secara matematis lebih besar dari RAM server terlemah
                if (wRam < maxAffordableRam) {
                    try {
                        if (ns.upgradePurchasedServer(weakest, maxAffordableRam)) {
                            ns.print(`[🚀] UPGRADE: Server ${weakest} meloncat dari ${wRam} GB ke ${maxAffordableRam} GB`);
                        }
                    } catch (e) {
                        ns.print(`[!] Fungsi upgrade gagal, memutus dan membunuh server lama untuk mengganti baru.`);
                        ns.killall(weakest);
                        ns.deleteServer(weakest);
                        ns.purchaseServer(weakest, maxAffordableRam);
                        ns.print(`[+] REPLACE: Mengganti ulang ${weakest} menjadi ${maxAffordableRam} GB`);
                    }
                }
            }
        }

        // Putaran santai perlahan agar tidak menguras CPU
        await ns.sleep(30000);
    }
}

// Terhubung dengan MASTER BOARD
function getReserve(ns) {
    let raw = ns.read("config.txt");
    if (!raw) return 100_000_000;
    for (let line of raw.split("\n")) {
        let p = line.trim().split(/[\s:]+/);
        if (p.length >= 2 && p[0].toLowerCase() === "reserve") {
            let v = p[1].toLowerCase();
            let m = 1;
            if (v.endsWith("k")) m = 1e3; else if (v.endsWith("m")) m = 1e6; else if (v.endsWith("b")) m = 1e9; else if (v.endsWith("t")) m = 1e12;
            return parseFloat(v) * m;
        }
    }
    return 100_000_000;
}

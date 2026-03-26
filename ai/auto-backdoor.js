/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    ns.print("Memulai Auto-Backdoor Scanner...");

    // Menyimpan daftar server yang sudah di-scan agar tidak terjadi infinite loop (berputar balik)
    let scanned = new Set();
    let hackingLevel = ns.getHackingLevel();
    let backdoorCount = 0;

    // Fungsi rekursif DFS nyata (menggerakkan terminal pemain langkah demi langkah)
    async function scanAndBackdoor(currentServer, parentServer) {
        // Cek target di mana terminal sedang berada
        if (currentServer !== "home" && !currentServer.startsWith("pserv-")) {
            let hasRoot = ns.hasRootAccess(currentServer);
            let reqLevel = ns.getServerRequiredHackingLevel(currentServer);
            let isBackdoored = ns.getServer(currentServer).backdoorInstalled;

            if (hasRoot && ns.getHackingLevel() >= reqLevel && !isBackdoored) {
                ns.print(`[+] Ditemukan celah backdoor di: ${currentServer}`);
                ns.print(`    Level: ${reqLevel} | Mencoba backdoor...`);

                await ns.singularity.installBackdoor();

                ns.print(`    > SUKSES! Backdoor terpasang di ${currentServer}`);
                backdoorCount++;
            }
        }

        let neighbors = ns.scan(currentServer);
        for (let nextServer of neighbors) {
            // Hindari kembali melangkah ke node sebelumnya di dalam loop
            if (nextServer !== parentServer) {
                // Melangkah MAJU ke server terdalam
                ns.singularity.connect(nextServer);

                // Terus masuk merekursif cabang ini
                await scanAndBackdoor(nextServer, currentServer);

                // Melangkah MUNDUR kembali ke server asal agar path tidak putus
                ns.singularity.connect(currentServer);
            }
        }
    }

    // Eksekusi fungsi dimulai dari server rumah
    await scanAndBackdoor("home", null);

    // Kembali ke home untuk memastikan terminal aktif kita tidak tersesat
    ns.singularity.connect("home");

    if (backdoorCount > 0) {
        ns.print(`\n🎉 Proses Selesai. Berhasil menginstal backdoor di ${backdoorCount} server baru!`);
    } else {
        ns.print(`\n✅ Proses Selesai. Tidak ada server baru yang bisa di-backdoor saat ini.`);
        ns.print("   Cobalah naikkan level hacking Anda atau buka port lebih banyak.");
    }
}

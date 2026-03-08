/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.tail();

    ns.print("Memulai Auto-Backdoor Scanner...");

    // Menyimpan daftar server yang sudah di-scan agar tidak terjadi infinite loop (berputar balik)
    let scanned = new Set();
    let hackingLevel = ns.getHackingLevel();
    let backdoorCount = 0;

    // Fungsi rekursif untuk scanning seluruh jaringan mulai dari "home"
    async function scanAndBackdoor(currentServer) {
        scanned.add(currentServer);

        let neighbors = ns.scan(currentServer);

        for (let nextServer of neighbors) {
            // Jangan scan server yang sudah pernah di scan
            // Abaikan server hasil pembelian kita ("pserv-")
            if (!scanned.has(nextServer) && !nextServer.startsWith("pserv-")) {

                // Harus punya hak akses root dulu (Nuke berhasil)
                let hasRoot = ns.hasRootAccess(nextServer);
                // Level hack kita harus lebih tinggi atau sama dengan syarat
                let reqLevel = ns.getServerRequiredHackingLevel(nextServer);
                // Cek apakah server ini sudah pernah di-backdoor sebelumnya
                let serverObj = ns.getServer(nextServer);
                let isBackdoored = serverObj.backdoorInstalled;

                if (hasRoot && hackingLevel >= reqLevel && !isBackdoored) {
                    ns.print(`[+] Ditemukan celah backdoor di: ${nextServer}`);
                    ns.print(`    Level: ${reqLevel} | Mencoba backdoor...`);

                    // Proses backdoor akan memakan waktu sepersekian detik per server
                    await ns.singularity.connect(nextServer);
                    await ns.singularity.installBackdoor();
                    await ns.singularity.connect("home");

                    ns.print(`    > SUKSES! Backdoor terpasang di ${nextServer}`);
                    backdoorCount++;
                }

                // Terus masuk lebih dalam ke dalam jaringan dari server ini
                await scanAndBackdoor(nextServer);
            }
        }
    }

    // Eksekusi fungsi dimulai dari server rumah
    await scanAndBackdoor("home");

    // Kembali ke home untuk memastikan terminal aktif kita tidak tersesat
    ns.singularity.connect("home");

    if (backdoorCount > 0) {
        ns.print(`\n🎉 Proses Selesai. Berhasil menginstal backdoor di ${backdoorCount} server baru!`);
    } else {
        ns.print(`\n✅ Proses Selesai. Tidak ada server baru yang bisa di-backdoor saat ini.`);
        ns.print("   Cobalah naikkan level hacking Anda atau buka port lebih banyak.");
    }
}

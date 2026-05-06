/** @param {NS} ns
 * Skrip ini HARUS dijalankan DARI DALAM server darknet (bukan dari home!)
 * Deploy ke server darknet, lalu ia akan melaporkan tetangganya ke home.
 * Jalankan dengan: run ai/darknet-probe.js [target-server]
 */
export async function main(ns) {
    const targetServer = ns.args[0] || "darkweb";
    const REPORT_FILE = "/darknet-report.txt";
    const reportForHost = (host) => `/darknet-report-${host.replace(/[^a-z0-9]/gi, "_")}.txt`;
    const HOME = "home";

    ns.disableLog("ALL");

    // ================================================
    // MODE 1: Jika dijalankan dari HOME → deploy ke target
    // ================================================
    if (ns.getHostname() === HOME) {
        ns.tprint(`📡 Mengirim mata-mata ke: ${targetServer}...`);

        // Cek apakah kita bisa langsung akses (darkweb bisa langsung di-exec)
        let scriptRam = ns.getScriptRam("ai/darknet-probe.js");
        let targetRam = ns.getServerMaxRam(targetServer);
        let usedRam = ns.getServerUsedRam(targetServer);
        let freeRam = targetRam - usedRam;

        ns.tprint(`   💾 RAM ${targetServer}: ${freeRam.toFixed(0)}GB tersedia`);

        if (freeRam < scriptRam) {
            ns.tprint(`   ❌ RAM tidak cukup! Butuh ${scriptRam}GB, ada ${freeRam.toFixed(0)}GB`);
            return;
        }

        // Salin skrip ke target dan jalankan dari sana
        await ns.scp("ai/darknet-probe.js", targetServer, HOME);
        ns.exec("ai/darknet-probe.js", targetServer);

        ns.tprint(`   ✅ Mata-mata berhasil dikirim! Menunggu laporan...`);
        ns.tprint(`   📄 Hasil akan muncul di: ${REPORT_FILE}`);

        // Tunggu laporan muncul
        let waited = 0;
        while (!ns.fileExists(REPORT_FILE, HOME) && waited < 30000) {
            await ns.sleep(1000);
            waited += 1000;
        }

        if (ns.fileExists(REPORT_FILE, HOME)) {
            let report = ns.read(REPORT_FILE);
            ns.tprint("🌑 LAPORAN DARKNET:");
            ns.tprint(report);
        } else {
            ns.tprint("⚠️ Laporan tidak diterima dalam 30 detik.");
        }
        return;
    }

    // ================================================
    // MODE 2: Skrip berjalan DI DALAM server darknet
    // ================================================
    let myHost = ns.getHostname();
    let report = [];

    report.push(`=== LAPORAN DARI: ${myHost} ===`);
    report.push(`Waktu: ${new Date().toISOString()}`);
    report.push("");

    // Probe tetangga darknet dari sini
    try {
        let neighbors = ns.dnet.probe();
        report.push(`🔍 Server Darknet Terdekat (${neighbors.length} ditemukan):`);

        for (let host of neighbors) {
            report.push(`\n--- ${host} ---`);
            try {
                let details = ns.dnet.getServerAuthDetails(host);
                report.push(`   Online    : ${details.isOnline ? "✅ YA" : "❌ OFFLINE"}`);
                report.push(`   Terhubung : ${details.isConnectedToCurrentServer ? "✅ YA" : "❌ TIDAK"}`);
                report.push(`   Model ID  : ${details.modelId || "?"}`);
                report.push(`   Password Hint: ${details.passwordHint || "?"}`);

                // Cek RAM server
                let maxRam = ns.getServerMaxRam(host);
                let usedRam = ns.getServerUsedRam(host);
                report.push(`   RAM: ${(maxRam - usedRam).toFixed(0)} / ${maxRam.toFixed(0)} GB bebas`);

                // Cek file cache
                let files = ns.ls(host);
                let cacheFiles = files.filter(f => f.endsWith(".cache"));
                if (cacheFiles.length > 0) {
                    report.push(`   💾 Cache Files: ${cacheFiles.join(", ")}`);
                }
            } catch (e) {
                report.push(`   ⚠️ Error detail: ${e}`);
            }
        }

        if (neighbors.length === 0) {
            report.push("   ⚠️ Tidak ada server gelap di sekitar sini.");
        }
    } catch (e) {
        report.push(`❌ Probe gagal: ${e}`);
        report.push("   (Mungkin DarkscapeNavigator.exe tidak ada di server ini)");
    }

    // Kirim laporan kembali ke home
    let reportContent = report.join("\n");
    let specificFile = reportForHost(myHost);
    ns.write(REPORT_FILE, reportContent, "w");        // latest report (overwrite)
    ns.write(specificFile, reportContent, "w");       // per-server report
    // Salin kedua laporan ke home
    await ns.scp(REPORT_FILE, HOME, myHost);
    await ns.scp(specificFile, HOME, myHost);
    ns.tprint(`📡 [${myHost}] Laporan dikirim ke home! (${specificFile})`);
}

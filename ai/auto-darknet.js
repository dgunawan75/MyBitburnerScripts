/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    // Daftar semua program hacking yang ingin dibeli otomatis
    const HACK_PROGRAMS = [
        "BruteSSH.exe",
        "FTPCrack.exe",
        "relaySMTP.exe",
        "HTTPWorm.exe",
        "SQLInject.exe",
        "ServerProfiler.exe",
        "DeepscanV1.exe",
        "DeepscanV2.exe",
        "AutoLink.exe",
        "Formulas.exe"
    ];

    const DARKSCOPE_COST = 50_000_000; // $50 juta

    while (true) {
        ns.clearLog();
        ns.print("===========================================");
        ns.print(" 🌑 AUTO DARKNET — DarkscapeNavigator V3  ");
        ns.print("===========================================");

        let money = ns.getServerMoneyAvailable("home");
        ns.print(`💰 Kas Tersedia : $${ns.format.number(money)}`);
        ns.print("");

        // ==============================
        // LANGKAH 1: Beli DarkscapeNavigator.exe
        // ==============================
        let hasDarkscope = ns.fileExists("DarkscapeNavigator.exe", "home");
        if (!hasDarkscope) {
            ns.print(`🔒 DarkscapeNavigator.exe belum dimiliki.`);
            if (money >= DARKSCOPE_COST) {
                ns.print(`   💸 Membeli DarkscapeNavigator.exe ($${ns.format.number(DARKSCOPE_COST)})...`);
                if (ns.singularity.purchaseProgram("DarkscapeNavigator.exe")) {
                    ns.print(`   ✅ BERHASIL! Darknet kini terbuka!`);
                    hasDarkscope = true;
                }
            } else {
                let kekurangan = DARKSCOPE_COST - money;
                ns.print(`   ⏳ Butuh $${ns.format.number(kekurangan)} lagi untuk membukanya.`);
            }
        }

        // ==============================
        // LANGKAH 2: Probe Darknet Servers (API V3 baru!)
        // ==============================
        if (hasDarkscope) {
            ns.print("🌐 Menjelajahi Darknet...");
            try {
                let darknetServers = ns.dnet.probe();
                if (darknetServers && darknetServers.length > 0) {
                    ns.print(`   Ditemukan ${darknetServers.length} server gelap:`);
                    for (let srv of darknetServers) {
                        ns.print(`   🖥️  ${srv}`);
                    }
                } else {
                    ns.print("   ⚠️ Tidak ada server darknet ditemukan.");
                }
            } catch (e) {
                ns.print(`   ⚠️ Darknet probe error: ${e}`);
            }
        }

        // ==============================
        // LANGKAH 3: Auto-beli semua Program Hacking
        // ==============================
        ns.print("\n📦 Status Program Hacking:");
        let allOwned = true;
        for (let prog of HACK_PROGRAMS) {
            if (ns.fileExists(prog, "home")) {
                ns.print(`   ✅ ${prog}`);
            } else {
                allOwned = false;
                try {
                    if (ns.singularity.purchaseProgram(prog)) {
                        ns.print(`   🛍️ DIBELI: ${prog}!`);
                    } else {
                        ns.print(`   ❌ ${prog} — Belum mampu beli.`);
                    }
                } catch (e) {
                    ns.print(`   ❌ ${prog} — Error: ${e}`);
                }
            }
        }

        if (allOwned) {
            ns.print("\n🎉 Semua program telah dimiliki! Misi darknet selesai.");
        }

        // Cek kembali setiap 1 menit
        await ns.sleep(60_000);
    }
}

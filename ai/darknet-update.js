/** @param {NS} ns
 *  DARKNET FORCE UPDATE
 *  Jalankan dari home: run ai/darknet-update.js
 *
 *  Kill semua instance lama di semua server yang sudah di-hack,
 *  lalu deploy ulang versi terbaru dari home.
 *  Gunakan setelah ada update script besar (fix crack algorithm, dll).
 */
export async function main(ns) {
    ns.disableLog("ALL");
    const HOME    = "home";
    const PASS_DB = "/darknet-passwords.txt";
    const FULL    = "ai/darknet-worker-v4.js";
    const LITE    = "ai/darknet-worker-lite.js";
    const SCRIPTS  = [FULL, LITE];

    // ── Muat password DB ──────────────────────────────────────────────────────
    let saved = {};
    try {
        if (ns.fileExists(PASS_DB, HOME)) saved = JSON.parse(ns.read(PASS_DB));
    } catch { }

    const hosts = Object.keys(saved);
    if (hosts.length === 0) {
        ns.tprint("❌ Tidak ada server di password DB. Jalankan darknet-worker-v4.js dulu.");
        return;
    }

    ns.tprint(`🔄 Force-update ${hosts.length} server...`);
    let updated = 0, skipped = 0, failed = 0;

    for (const host of hosts) {
        const pw = saved[host];

        // Coba reconnect session
        // Setelah browser restart: session expire → perlu authenticate ulang
        // Saat script saja yang dikill: session masih ada → cukup connectToSession
        if (pw === "__manual__") {
            let det = null;
            try { det = ns.dnet.getServerAuthDetails(host); } catch { }
            if (!det?.hasSession) {
                ns.tprint(`   ⚠️ ${host}: manual session expired, skip`);
                skipped++;
                continue;
            }
        } else {
            let sessionOk = false;

            // Coba 1: connectToSession (cepat, jika session masih aktif)
            try {
                ns.dnet.connectToSession(host, pw);
                sessionOk = true;
            } catch { }

            // Coba 2: authenticate ulang (perlu jika session expired/browser restart)
            if (!sessionOk) {
                try {
                    let r = await ns.dnet.authenticate(host, pw);
                    sessionOk = r?.success === true;
                } catch { }
            }

            if (!sessionOk) {
                ns.tprint(`   ❌ ${host}: session gagal (pw mungkin sudah berubah)`);
                failed++;
                continue;
            }
        }

        // Kill semua instance script lama
        let killed = 0;
        for (const script of SCRIPTS) {
            try {
                if (ns.isRunning(script, host)) {
                    ns.kill(script, host);
                    killed++;
                }
            } catch { }
        }
        if (killed > 0) await ns.sleep(300); // tunggu RAM terbebaskan

        // Copy script versi terbaru
        try {
            await ns.scp(FULL, host, HOME);
            await ns.scp(LITE, host, HOME);
        } catch (e) {
            ns.tprint(`   ❌ ${host}: SCP gagal — ${e}`);
            failed++;
            continue;
        }

        // Tentukan script yang akan dijalankan (full atau lite)
        const fullRam = ns.getScriptRam(FULL);
        const liteRam = ns.getScriptRam(LITE);
        const freeRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);

        let launched = false;
        if (freeRam >= fullRam) {
            let pid = ns.exec(FULL, host);
            if (pid > 0) {
                ns.tprint(`   ✅ ${host}: FULL (PID ${pid})`);
                launched = true;
            }
        }
        if (!launched && freeRam >= liteRam) {
            let pid = ns.exec(LITE, host);
            if (pid > 0) {
                ns.tprint(`   ✅ ${host}: LITE (PID ${pid})`);
                launched = true;
            }
        }
        if (!launched) {
            ns.tprint(`   ⚠️ ${host}: RAM tidak cukup (${freeRam.toFixed(1)}GB free, butuh ${liteRam.toFixed(1)}GB)`);
            skipped++;
            continue;
        }

        updated++;
        await ns.sleep(100);
    }

    ns.tprint(`\n✅ Selesai: ${updated} diupdate, ${skipped} dilewati, ${failed} gagal`);
    ns.tprint(`💡 Tip: Jalankan 'run ai/darknet-status.js --watch' untuk memantau`);
}

export function autocomplete() { return []; }

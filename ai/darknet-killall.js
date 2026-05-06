/** @param {NS} ns
 *  DARKNET KILLALL — Matikan semua script di seluruh server darknet
 *  Jalankan dari home: run ai/darknet-killall.js
 *
 *  Berguna ketika ingin update script worker dan me-restart semua instance.
 *  Akan membunuh semua script KECUALI dirinya sendiri.
 */
export async function main(ns) {
    ns.disableLog("ALL");
    const PASS_DB  = "/darknet-passwords.txt";
    const HOME     = "home";
    const myPid    = ns.pid;
    const myScript = ns.getScriptName();

    // Opsi: --dry-run hanya list tanpa kill
    const dryRun = ns.args.includes("--dry-run");

    if (dryRun) {
        ns.tprint("🔍 DRY RUN — tidak ada yang di-kill");
    } else {
        ns.tprint("🔪 DARKNET KILLALL — Membunuh semua script worker di darknet...");
    }

    // ── Load semua server yang diketahui dari password DB ─────────────────
    let knownServers = {};
    try {
        if (ns.fileExists(PASS_DB, HOME)) {
            knownServers = JSON.parse(ns.read(PASS_DB));
        }
    } catch {
        ns.tprint("⚠️ Tidak bisa baca password DB. Hanya akan probe dari darkweb.");
    }

    // ── Tambahkan server dari probe darkweb langsung ───────────────────────
    // (untuk menangkap server yang mungkin tidak ada di DB)
    let allServers = new Set(Object.keys(knownServers));

    // Probe dari darkweb
    try {
        let near = ns.dnet.probe();
        for (let s of near) allServers.add(s);
    } catch { }

    ns.tprint(`📋 Total server diketahui: ${allServers.size}`);

    // ── Kill semua script di tiap server ──────────────────────────────────
    let killed   = 0;
    let skipped  = 0;
    let noAccess = 0;

    for (let hostname of allServers) {
        if (hostname === HOME) continue;

        // Reconnect session jika perlu
        let pw = knownServers[hostname];
        if (pw && pw !== "__manual__") {
            try { ns.dnet.connectToSession(hostname, pw); } catch { }
        }

        // Cek apakah ada script yang berjalan
        let procs = [];
        try { procs = ns.ps(hostname); }
        catch {
            ns.tprint(`   ⛔ [${hostname}] Tidak bisa akses (tidak ada session?)`);
            noAccess++;
            continue;
        }

        if (procs.length === 0) {
            ns.tprint(`   ✅ [${hostname}] Tidak ada script berjalan`);
            continue;
        }

        if (dryRun) {
            ns.tprint(`   🔍 [${hostname}] ${procs.length} script: ${procs.map(p => p.filename).join(", ")}`);
            skipped += procs.length;
            continue;
        }

        // Kill semua script
        try {
            ns.killall(hostname, true); // true = kill semua termasuk yang sleep
            killed += procs.length;
            ns.tprint(`   🔪 [${hostname}] Killed ${procs.length} script(s): ${procs.map(p => p.filename).join(", ")}`);
        } catch (e) {
            ns.tprint(`   ⚠️ [${hostname}] killall gagal: ${e}`);
        }

        await ns.sleep(100); // jangan flood
    }

    // ── Ringkasan ─────────────────────────────────────────────────────────
    ns.tprint("─".repeat(40));
    if (dryRun) {
        ns.tprint(`📊 Dry run selesai: ${skipped} script ditemukan, ${noAccess} server tidak bisa diakses`);
    } else {
        ns.tprint(`📊 Selesai: ${killed} script di-kill, ${noAccess} server tidak bisa diakses`);
        ns.tprint(`✨ Sekarang aman untuk update dan restart worker!`);
        ns.tprint(`   → run ai/darknet-worker.js --tail`);
    }
}

export function autocomplete(data) { return ["--dry-run"]; }

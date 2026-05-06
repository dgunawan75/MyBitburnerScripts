/** @param {NS} ns
 *  DARKNET WORKER LITE — Versi RAM minimal
 *  Untuk server dengan RAM kecil (8-16GB).
 *  Hanya: crack + spread + phishing.
 *  Tanpa: memoryReallocation, openCache, heartbleed (hemat RAM).
 *
 *  RAM ~4-6GB (jauh lebih kecil dari worker penuh ~10GB+)
 */
export async function main(ns) {
    ns.disableLog("ALL");
    const HOME    = "home";
    const PASS_DB = "/darknet-passwords.txt";
    const ME      = ns.getScriptName();
    const myHost  = ns.getHostname();

    // Load password DB
    let savedPasswords = {};
    try {
        if (ns.fileExists(PASS_DB)) {
            savedPasswords = JSON.parse(ns.read(PASS_DB));
        }
    } catch { }

    while (true) {
        let nearbyServers = [];
        try { nearbyServers = ns.dnet.probe(); } catch { }

        for (const hostname of nearbyServers) {
            if (hostname === myHost) continue;

            let details;
            try { details = ns.dnet.getServerAuthDetails(hostname); }
            catch { continue; }

            if (!details.isOnline || !details.isConnectedToCurrentServer) continue;

            // Sudah punya session → langsung spread
            if (details.hasSession) {
                await spreadSelf(ns, hostname, ME, HOME);
                continue;
            }

            // Password sudah di DB → connectToSession
            if (hostname in savedPasswords) {
                try {
                    ns.dnet.connectToSession(hostname, savedPasswords[hostname]);
                    await spreadSelf(ns, hostname, ME, HOME);
                } catch {
                    delete savedPasswords[hostname];
                }
                continue;
            }

            // Crack dengan strategi sederhana (sesuai hint + model)
            let pw = await simpleCrack(ns, hostname, details);
            if (pw !== null) {
                savedPasswords[hostname] = pw;
                ns.write(PASS_DB, JSON.stringify(savedPasswords, null, 2), "w");
                await spreadSelf(ns, hostname, ME, HOME);
            }
        }

        // Phishing attack pasif
        try { await ns.dnet.phishingAttack(); } catch { }

        await ns.sleep(5000);
    }
}

async function simpleCrack(ns, hostname, details) {
    let hint  = details.passwordHint ?? details.hint ?? "";
    let model = details.modelId ?? "";
    let pwLen = details.passwordLength ?? details.length ?? 0;
    let fmt   = (details.passwordFormat ?? details.format ?? "").toLowerCase();

    // Kandidat dari hint: pola "is X"
    let candidates = new Set();
    let isMatch = hint.match(/(?:is|pin|secret|password|code|key)\s+([^\s,\.]{1,20})/i);
    if (isMatch) candidates.add(isMatch[1]);
    // Semua angka dari hint
    for (let n of (hint.match(/\d+/g) || [])) candidates.add(n);
    // Model-spesifik
    if (model === "ZeroLogon") ["", "password", "0", "0000", "12345", "null", "admin"].forEach(c => candidates.add(c));
    if (model === "NIL")       ["", "nil", "null", "none", "undefined"].forEach(c => candidates.add(c));
    // Universal
    ["", "password", "admin", "0000", "12345", "1234"].forEach(c => candidates.add(c));

    let list = [...candidates];
    if (pwLen > 0) {
        let exact = list.filter(p => String(p).length === pwLen);
        if (exact.length > 0) list = exact;
    }
    if (fmt === "numeric") {
        let nums = list.filter(p => /^\d+$/.test(String(p)));
        if (nums.length > 0) list = nums;
    }

    for (let pw of list) {
        let result = await ns.dnet.authenticate(hostname, pw);
        if (result.success) return pw;
        await ns.sleep(100);
    }
    return null;
}

async function spreadSelf(ns, hostname, scriptName, home) {
    try {
        let ram  = ns.getScriptRam(scriptName);
        let free = ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname);
        if (free >= ram) {
            await ns.scp(scriptName, hostname, home);
            ns.exec(scriptName, hostname, { preventDuplicates: true });
        }
    } catch { }
}

export function autocomplete(data) { return ["--tail"]; }

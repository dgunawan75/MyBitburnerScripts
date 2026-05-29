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
    let pwLen = details.passwordLength ?? details.length;
    if (pwLen === undefined) {
        let mLen = hint.match(/length:\s*(\d+)/i);
        if (mLen) pwLen = parseInt(mLen[1]);
    }
    let fmt = (details.passwordFormat ?? details.format ?? "").toLowerCase();

    // ── Shortcut: Length 0 → pasti password kosong ─────────────────
    if (pwLen === 0 || pwLen === "0") {
        let r = await ns.dnet.authenticate(hostname, "");
        if (r.success) return "";
        return null; // jika Length=0 tapi kosong gagal, tidak ada yg bisa dilakukan
    }

    // ── ZeroLogon: bypass tanpa password ─────────────────────────────────────
    if (model.toUpperCase().includes("ZEROLOGON")) {
        for (let bypass of ["", "0", "null", "empty", "nothing", "undefined"]) {
            let r = await ns.dnet.authenticate(hostname, bypass);
            if (r.success) return bypass;
            await ns.sleep(50);
        }
        return null;
    }

    // ── NIL Mastermind: Adaptive Probe ───────────────────────────────────────
    // "yes" = digit tepat di posisi ini, "yesn't" = bukan posisi ini
    // Strategi: kunci posisi yang diketahui, uji digit baru di semua posisi unknown
    // Worst case: 10 probe saja — TIDAK perlu brute force
    if (model.toUpperCase().includes("NIL")) {
        let len = (pwLen > 0) ? pwLen : 6;
        let posDigit   = new Array(len).fill(null);   // digit terkonfirmasi per posisi
        let posExcl    = Array.from({ length: len }, () => new Set()); // digit yang BUKAN di posisi ini
        let confirmed  = 0;

        for (let d = 0; d <= 9; d++) {
            // Kunci posisi yang sudah diketahui, uji d di posisi yang belum
            let pw = posDigit.map(k => k !== null ? k : String(d)).join("");
            let r  = await ns.dnet.authenticate(hostname, pw);
            if (r.success) return pw;

            // Parse feedback: "yes,yesn't,yes,..." atau array
            let fb = [];
            if (Array.isArray(r.data)) {
                fb = r.data.map(x => String(x ?? "").trim().toLowerCase());
            } else {
                fb = String(r.data ?? "").split(",").map(x => x.trim().toLowerCase());
            }

            for (let i = 0; i < len; i++) {
                if (posDigit[i] !== null) continue;
                let isYes = ["yes","true","1","correct","match","hit"].includes(fb[i]);
                if (isYes) { posDigit[i] = String(d); confirmed++; }
                else       { posExcl[i].add(String(d)); }
            }
            if (confirmed >= len) break;
            await ns.sleep(40);
        }

        // Semua posisi terkonfirmasi → coba password final
        if (confirmed >= len) {
            let finalPw = posDigit.join("");
            let r = await ns.dnet.authenticate(hostname, finalPw);
            if (r.success) return finalPw;
        }

        // Safety net: posisi yang masih unknown → brute force kandidat yang tersisa
        let unknowns = posDigit.map((d, i) => d === null ? i : -1).filter(i => i >= 0);
        if (unknowns.length > 0 && unknowns.length <= 3) {
            let posCands = unknowns.map(i => {
                let c = [];
                for (let d = 0; d <= 9; d++) if (!posExcl[i].has(String(d))) c.push(String(d));
                return c.length > 0 ? c : ["0","1","2","3","4","5","6","7","8","9"];
            });
            // Iterasi semua kombinasi
            const idx = new Array(unknowns.length).fill(0);
            while (true) {
                let attempt = [...posDigit];
                for (let j = 0; j < unknowns.length; j++) attempt[unknowns[j]] = posCands[j][idx[j]];
                let r = await ns.dnet.authenticate(hostname, attempt.join(""));
                if (r.success) return attempt.join("");
                await ns.sleep(30);
                let carry = 1;
                for (let j = unknowns.length - 1; j >= 0 && carry; j--) {
                    idx[j]++;
                    if (idx[j] >= posCands[j].length) { idx[j] = 0; } else carry = 0;
                }
                if (carry) break;
            }
        }
        return null;
    }

    // ── Kandidat dari hint + model-spesifik ──────────────────────
    let candidates = new Set();
    let isMatch = hint.match(/(?:is|pin|secret|password|code|key)\s+([^\s,\.]{1,20})/i);
    if (isMatch) candidates.add(isMatch[1]);
    // Angka dari hint
    for (let n of (hint.match(/\d+/g) || [])) candidates.add(n);
    // Digit dari data (CloudBlare, dll)
    let data = String(details.data ?? details.passwordData ?? "");
    if (data) {
        let digs = (data.match(/\d/g) || []).join("");
        if (digs) candidates.add(digs);
        if (pwLen > 0 && digs.length !== pwLen) candidates.add(digs.slice(0, pwLen));
    }
    // Model-spesifik
    if (model === "NIL") ["nil", "null", "none", "undefined"].forEach(c => candidates.add(c));
    // Universal fallback
    ["", "password", "admin", "0000", "12345", "1234", "0"].forEach(c => candidates.add(c));

    let list = [...candidates];

    // Filter panjang
    if (pwLen !== undefined && pwLen > 0) {
        let exact = list.filter(p => String(p).length === pwLen);
        if (exact.length > 0) list = exact;
    }
    // Filter format numeric: gunakan \d* bukan \d+ agar string kosong "" tetap lolos
    if (fmt === "numeric") {
        let nums = list.filter(p => /^\d*$/.test(String(p)));
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

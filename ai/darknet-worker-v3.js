/** @param {NS} ns
 *  DARKNET WORKER v3 — Self-Replicating Worm
 *  Jalankan dari darkweb: run ai/darknet-worker-v3.js --tail
 *  Script ini menyebar ke seluruh darknet + menghasilkan uang pasif.
 */
export async function main(ns) {
    ns.disableLog("ALL");
    const HOME    = "home";
    const PASS_DB = "/darknet-passwords.txt";
    const LITE    = "ai/darknet-worker-lite.js";
    const ME      = ns.getScriptName();
    const myHost  = ns.getHostname();

    // Hanya buka tail jika diminta dengan --tail
    if (ns.args.includes("--tail")) ns.ui.openTail();
    ns.print(`🌑 DARKNET WORKER aktif di: ${myHost}`);

    // Load password DB
    let saved = {};
    try {
        if (ns.fileExists(PASS_DB, HOME)) saved = JSON.parse(ns.read(PASS_DB));
    } catch { }

    // Bebaskan RAM & buka cache di server ini sendiri dulu
    await liberateRam(ns, myHost);
    await openAllCaches(ns, myHost);

    let iter = 0;
    const failCooldown = {};     // { hostname: lastFailTimestamp }
    const FAIL_WAIT_MS = 120000; // 2 menit sebelum retry server yang gagal
    while (true) {
        iter++;
        ns.print(`\n── Iterasi #${iter} @ ${myHost} ──`);

        let neighbors = [];
        try { neighbors = ns.dnet.probe(); } catch { }

        for (const host of neighbors) {
            if (host === myHost) continue;

            let det;
            try { det = ns.dnet.getServerAuthDetails(host); } catch { continue; }
            if (!det.isOnline || !det.isConnectedToCurrentServer) continue;

            // Sudah punya session → langsung spread
            // Ini juga menangkap server yang di-crack manual via GUI!
            if (det.hasSession) {
                if (!(host in saved)) {
                    // Di-crack manual → simpan marker supaya tidak di-crack ulang
                    saved[host] = "__manual__";
                    ns.write(PASS_DB, JSON.stringify(saved, null, 2), "w");
                    ns.print(`   🖱️ [${host}] Terdeteksi manual crack → disimpan`);
                }
                delete failCooldown[host]; // Reset cooldown
                await doSpread(ns, host, ME, LITE, HOME, PASS_DB, saved);
                continue;
            }

            // Password sudah di DB → connectToSession
            if (host in saved) {
                if (saved[host] === "__manual__") {
                    // Session dari manual crack sudah expired → hapus, akan di-crack ulang
                    ns.print(`   🔄 [${host}] Manual session expired, re-crack...`);
                    delete saved[host];
                } else {
                    try {
                        ns.dnet.connectToSession(host, saved[host]);
                        ns.print(`   🔑 [${host}] Reconnect OK → spread`);
                        delete failCooldown[host];
                        await doSpread(ns, host, ME, LITE, HOME, PASS_DB, saved);
                    } catch {
                        ns.print(`   ⚠️ [${host}] Session expired, re-crack...`);
                        delete saved[host];
                    }
                    continue;
                }
            }

            // Cooldown: jangan retry server yang baru saja gagal
            let lastFail = failCooldown[host] || 0;
            if (Date.now() - lastFail < FAIL_WAIT_MS) {
                ns.print(`   ⏳ [${host}] Cooldown (${Math.round((FAIL_WAIT_MS - (Date.now() - lastFail)) / 1000)}s)`);
                continue;
            }

            // Crack baru
            ns.print(`   🎯 [${host}] Crack... (${det.modelId})`);
            let result = await crack(ns, host, det);
            if (result.cracked) {
                saved[host] = result.password;
                ns.write(PASS_DB, JSON.stringify(saved, null, 2), "w");
                try { await ns.scp(PASS_DB, HOME, myHost); } catch { }
                delete failCooldown[host];
                await doSpread(ns, host, ME, LITE, HOME, PASS_DB, saved);
            } else {
                // Cek sekali lagi apakah user sudah manual crack saat kita mencoba
                let detAfter = ns.dnet.getServerAuthDetails(host);
                if (detAfter.hasSession) {
                    ns.print(`   🖱️ [${host}] Manual crack terdeteksi setelah gagal!`);
                    saved[host] = "__manual__";
                    ns.write(PASS_DB, JSON.stringify(saved, null, 2), "w");
                    await doSpread(ns, host, ME, LITE, HOME, PASS_DB, saved);
                } else {
                    failCooldown[host] = Date.now();
                    ns.print(`   ❌ [${host}] Gagal. Retry dalam ${FAIL_WAIT_MS / 60000} menit.`);
                }
            }
        }

        // Phishing pasif di server ini
        try {
            let r = await ns.dnet.phishingAttack();
            if (r && r.money) ns.print(`   💰 Phishing: +$${ns.format.number(r.money)}`);
        } catch { }

        // Cek cache baru
        await openAllCaches(ns, myHost);

        await ns.sleep(5000);
    }
}

// ═══ CRACK ═════════════════════════════════════════════════════════════════
async function crack(ns, hostname, det) {
    let hintStr = det.passwordHint ?? det.hint ?? "";
    let model = det.modelId ?? "";
    if (!model) {
        let mM = hintStr.match(/model:\s*([a-z0-9_\-\.]+)/i);
        if (mM) model = mM[1];
    }

    let pwLen = det.passwordLength ?? det.length;
    if (pwLen === undefined) {
        let mLen = hintStr.match(/length:\s*(\d+)/i);
        if (mLen) pwLen = parseInt(mLen[1]);
    }

    let fmt = (det.passwordFormat ?? det.format ?? "").toLowerCase();
    if (!fmt) {
        let mFmt = hintStr.match(/format:\s*([a-z]+)/i);
        if (mFmt) fmt = mFmt[1].toLowerCase();
    }

    // ── ZeroLogon: bypass semua logika ────────────────
    if (model === "ZeroLogon") {
        for (let bypass of ["", "0", "0000", "empty", "null", undefined]) {
            let r = await ns.dnet.authenticate(hostname, bypass);
            if (r.success) {
                ns.print(`   ✅ ZeroLogon cracked [${hostname}] → "${bypass}"`);
                return { cracked: true, password: bypass };
            }
            await ns.sleep(20);
        }
    }

    // ── Factori-Os: password harus bisa dibagi dengan suatu angka ──────────
    // Error: "Password is not divisible by 'X'" → divisor ada di error message
    if (model.startsWith("Factori")) {
        return await crackFactoriOs(ns, hostname, det, pwLen);
    }

    // ── NIL: Positional feedback (Mastermind) ───────────────────────────────
    if (model === "NIL") {
        return await crackNILMastermind(ns, hostname, pwLen);
    }

    // ── Pr0verFl0: Buffer Overflow Bypass ───────────────────────────────────
    if (model === "Pr0verFl0") {
        // Buffer besarnya dinamis (pwLen). Kita harus mengirimkan string sebesar 2x pwLen.
        // Setengah pertama akan mengisi buffer input, setengah kedua akan meluber (overflow)
        // dan menimpa buffer passwordExpected di memori server.
        let baseStr = "overflow1234567890".substring(0, pwLen > 0 ? pwLen : 6);
        let payload = baseStr + baseStr; // Contoh: jika len 6 -> "overfloverfl" (tapi overfl + overfl)
        
        let r = await ns.dnet.authenticate(hostname, payload);
        if (r.success) {
            ns.print(`   ✅ Pr0verFl0 cracked [${hostname}] → "${payload}"`);
            return { cracked: true, password: payload };
        }
    }

    // ── OpenWebAccessPoint: Smart Parser ────────────────────────────────────
    if (model === "OpenWebAccessPoint") {
        let probePw = "0".repeat(pwLen > 0 ? pwLen : 3);
        let probe = await ns.dnet.authenticate(hostname, probePw);
        if (probe.success) return { cracked: true, password: probePw };
        
        if (typeof probe.data === "string") {
            // Teks biasanya menyembunyikan "NamaKafe:Password" di tengah kalimat
            // Contoh: "The_Depth5:592"
            let regex = /[a-zA-Z0-9_]+:(\d+)/g;
            let match;
            while ((match = regex.exec(probe.data)) !== null) {
                let pw = match[1];
                if (pwLen === undefined || pw.length === pwLen) {
                    let r = await ns.dnet.authenticate(hostname, pw);
                    if (r.success) {
                        ns.print(`   ✅ OpenWebAccessPoint cracked [${hostname}] → "${pw}"`);
                        return { cracked: true, password: pw };
                    }
                }
            }
        }
    }

    // ── Universal: coba kandidat dari hint + fallback ───────────────────────
    let candidates = buildCandidates(det, hintStr, model, pwLen);
    
    // Strict Filtering: Hapus kandidat yang panjang/formatnya tidak sesuai
    if (pwLen !== undefined) {
        candidates = candidates.filter(p => String(p).length === pwLen);
    }
    if (fmt === "numeric") {
        candidates = candidates.filter(p => /^\d*$/.test(String(p)));
    }

    for (let pw of candidates) {
        let r = await ns.dnet.authenticate(hostname, pw);
        if (r.success) {
            ns.print(`   ✅ Cracked [${hostname}] → "${pw}"`);
            return { cracked: true, password: pw };
        }
        // Gunakan feedback dari response jika ada
        if (r.message) ns.print(`   📋 ${JSON.stringify({ msg: r.message, data: r.data })}`);
        
        // Auto-Exploit jika server membocorkan passwordExpected
        if (r.data && typeof r.data.passwordExpected === "string") {
            let exp = r.data.passwordExpected;
            // Hindari infinite loop dan hindari teks sensor seperti "■■■■"
            if (!candidates.includes(exp) && !exp.includes("■")) {
                ns.print(`   💡 Auto-Exploit: Server membocorkan passwordExpected -> "${exp}"`);
                candidates.push(exp);
            }
        }

        await ns.sleep(50);
    }

    // ── Targeted Brute Force: Sangat efektif untuk numeric length kecil ─────
    if (fmt === "numeric" && pwLen !== undefined && pwLen > 0 && pwLen <= 5) {
        ns.print(`   🔢 Brute forcing numeric (length ${pwLen})...`);
        let max = Math.pow(10, pwLen);
        for (let i = 0; i < max; i++) {
            let pw = String(i).padStart(pwLen, "0");
            if (candidates.includes(pw)) continue;
            let r = await ns.dnet.authenticate(hostname, pw);
            if (r.success) {
                ns.print(`   ✅ Cracked [${hostname}] → "${pw}"`);
                return { cracked: true, password: pw };
            }
            // Yield sesekali agar game tidak lag
            if (i % 50 === 0) await ns.sleep(1); 
        }
    }

    // Heartbleed fallback
    try {
        let bleed = await ns.dnet.heartbleed(hostname, { peek: true });
        let logText = (bleed.logs || []).join("\n");
        if (logText) {
            let logCandidates = buildCandidatesFromText(logText, pwLen, fmt);
            if (pwLen !== undefined) logCandidates = logCandidates.filter(p => String(p).length === pwLen);
            if (fmt === "numeric") logCandidates = logCandidates.filter(p => /^\d*$/.test(String(p)));

            for (let pw of logCandidates) {
                let r = await ns.dnet.authenticate(hostname, pw);
                if (r.success) {
                    ns.print(`   ✅ (log) Cracked [${hostname}] → "${pw}"`);
                    return { cracked: true, password: pw };
                }
                await ns.sleep(50);
            }
        }
    } catch { }

    return { cracked: false, password: null };
}

// Factori-Os: Cari divisor dari error message, lalu brute-force kelipatannya
async function crackFactoriOs(ns, hostname, det, pwLen) {
    let hint = det.passwordHint ?? det.hint ?? "";
    // Coba probe awal untuk dapat error message dengan divisor
    let divisor = 0;

    // Ekstrak dari hint dulu
    let hintMatch = hint.match(/\b(\d+)\b/);
    if (hintMatch) divisor = parseInt(hintMatch[1]);

    // Jika belum, coba satu auth dulu untuk dapat error message
    if (!divisor) {
        let probe = await ns.dnet.authenticate(hostname, "1");
        if (probe.success) return { cracked: true, password: "1" };
        // Error: "Password is not divisible by '7'"
        let errMatch = (probe.message || "").match(/divisible by ['"']?(\d+)['"']?/i);
        if (errMatch) divisor = parseInt(errMatch[1]);
    }

    if (!divisor || divisor <= 0) return { cracked: false, password: null };
    ns.print(`   ➗ Factori-Os: divisor=${divisor}, len=${pwLen}`);

    // Shortcut: divisor=1 → semua angka valid, langsung coba angka pertama di range!
    if (divisor === 1) {
        let pw = pwLen > 0 ? String(Math.pow(10, pwLen - 1)) : "10";
        let r  = await ns.dnet.authenticate(hostname, pw);
        if (r.success) {
            ns.print(`   ✅ Factori-Os (div=1) cracked [${hostname}] → "${pw}"`);
            return { cracked: true, password: pw };
        }
    }

    // Brute-force kelipatan divisor dengan panjang pwLen digit
    let start = pwLen > 0 ? Math.pow(10, pwLen - 1) : 1;
    let end   = pwLen > 0 ? Math.pow(10, pwLen) - 1 : 9999;
    // Mulai dari kelipatan pertama dalam range
    let first = Math.ceil(start / divisor) * divisor;

    for (let n = first; n <= end; n += divisor) {
        let pw = String(n);
        let r  = await ns.dnet.authenticate(hostname, pw);
        if (r.success) {
            ns.print(`   ✅ Factori-Os cracked [${hostname}] → "${pw}"`);
            return { cracked: true, password: pw };
        }
        // Update divisor dari error jika berubah
        let errMatch = (r.message || "").match(/divisible by ['"']?(\d+)['"']?/i);
        if (errMatch) {
            let newDiv = parseInt(errMatch[1]);
            if (newDiv !== divisor) {
                divisor = newDiv;
                first = Math.ceil(n / divisor) * divisor;
                n = first - divisor; // loop akan tambah divisor lagi
                ns.print(`   ➗ Divisor berubah → ${divisor}`);
            }
        }
        await ns.sleep(80);
    }
    return { cracked: false, password: null };
}

// NIL Mastermind: menebak per karakter dengan menembak angka berulang (00000, 11111, 22222)
// Ini adalah cara paling efisien yang memetakan seluruh password maksimal dalam 10 request!
async function crackNILMastermind(ns, hostname, pwLen) {
    if (pwLen <= 0) pwLen = 6; // fallback jika tidak diketahui

    let finalPw = new Array(pwLen).fill("0");
    let digitsFound = 0;

    for (let d = 0; d <= 9; d++) {
        let pw = String(d).repeat(pwLen);
        let r  = await ns.dnet.authenticate(hostname, pw);
        if (r.success) {
            ns.print(`   ✅ NIL Mastermind cracked [${hostname}] → "${pw}"`);
            return { cracked: true, password: pw };
        }
        
        // Parse feedback: bisa berupa Array atau String "yesn't,yes,yesn't,..."
        let feedback = [];
        if (Array.isArray(r.data)) {
            feedback = r.data.map(f => String(f).trim());
        } else {
            feedback = String(r.data || "").split(",").map(f => f.trim());
        }

        for (let i = 0; i < pwLen; i++) {
            if (feedback[i] === "yes") {
                finalPw[i] = String(d);
                digitsFound++;
                ns.print(`   🎯 NIL: Posisi [${i}] adalah '${d}'`);
            }
        }

        // Jika semua posisi sudah terisi, tidak perlu mencoba angka berikutnya
        if (digitsFound >= pwLen) break;
        
        await ns.sleep(40);
    }

    // Coba hasil akhir yang sudah dirangkai
    let finalString = finalPw.join("");
    let finalR  = await ns.dnet.authenticate(hostname, finalString);
    if (finalR.success) {
        ns.print(`   ✅ NIL Mastermind final → "${finalString}"`);
        return { cracked: true, password: finalString };
    }
    return { cracked: false, password: null };
}


// ═══ SPREAD ════════════════════════════════════════════════════════════════
async function doSpread(ns, hostname, fullScript, liteScript, home, passDb, saved) {
    try {
        await liberateRam(ns, hostname);
        await openAllCaches(ns, hostname);

        // Jika script FULL atau LITE sudah berjalan di server ini, tidak perlu spread lagi
        if (ns.isRunning(fullScript, hostname) || ns.isRunning(liteScript, hostname)) {
            return; // Sudah terinfeksi, lewati dengan diam
        }

        let fullRam = ns.getScriptRam(fullScript);
        let liteRam = ns.getScriptRam(liteScript);
        let freeRam = ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname);

        // Copy password DB
        if (ns.fileExists(passDb, home)) await ns.scp(passDb, hostname, home);

        if (freeRam >= fullRam) {
            await ns.scp(fullScript, hostname, home);
            await ns.scp(liteScript, hostname, home);
            let pid = ns.exec(fullScript, hostname, { preventDuplicates: true });
            if (pid > 0) ns.print(`   🚀 [${hostname}] FULL (PID ${pid}, ${freeRam.toFixed(0)}GB free)`);
        } else if (freeRam >= liteRam) {
            await ns.scp(liteScript, hostname, home);
            let pid = ns.exec(liteScript, hostname, { preventDuplicates: true });
            if (pid > 0) ns.print(`   🚀 [${hostname}] LITE (PID ${pid}, ${freeRam.toFixed(0)}GB free)`);
        } else {
            // Jangan terlalu spammy jika RAM benar-benar tidak cukup secara permanen
            // ns.print(`   ⚠️ [${hostname}] RAM tidak cukup (${freeRam.toFixed(0)}/${liteRam.toFixed(0)}GB)`);
        }
    } catch (e) {
        ns.print(`   ⚠️ Spread gagal ke ${hostname}: ${e}`);
    }
}

// ═══ LIBERATE RAM ══════════════════════════════════════════════════════════
async function liberateRam(ns, hostname) {
    try {
        for (let i = 0; i < 15; i++) {
            let r = ns.dnet.influence?.memoryReallocation
                ? ns.dnet.influence.memoryReallocation(hostname) : null;
            if (!r || r.done) break;
            await ns.sleep(300);
        }
    } catch { }
}

// ═══ OPEN CACHES ═══════════════════════════════════════════════════════════
async function openAllCaches(ns, hostname) {
    try {
        for (let f of ns.ls(hostname, ".cache")) {
            try {
                let r = ns.dnet.openCache(f);
                ns.print(`   💾 Cache: ${f} → ${JSON.stringify(r)}`);
            } catch { }
        }
    } catch { }
}

// ═══ CANDIDATE BUILDERS ════════════════════════════════════════════════════
function buildCandidates(det, hintStr, model, pwLen) {
    let set = new Set();
    // Note: empty string "" harus diizinkan (ZeroLogon, dll)
    const add = (v) => { if (v !== undefined && v !== null) set.add(String(v)); };
    const addIfNonEmpty = (v) => { if (v !== undefined && v !== null && String(v).length > 0) set.add(String(v)); };

    let data  = det.data ?? det.passwordData ?? "";

    // Pola "between X and Y"
    let btw = hintStr.match(/between\s+(\d+)\s+and\s+(\d+)/i);
    if (btw) {
        let start = parseInt(btw[1]);
        let end = parseInt(btw[2]);
        for (let i = start; i <= end; i++) add(i);
    }

    // Pola "is X"
    let m = hintStr.match(/(?:is|pin|secret|password|code|key)\s+([^\s,\.]{1,20})/i);
    if (m) add(m[1]);

    // Angka dari hint
    for (let n of (hintStr.match(/\d+/g) || [])) add(n);

    // Digit dari data (CloudBlare)
    if (data) {
        let digits = data.match(/\d/g) || [];
        if (digits.length > 0) {
            add(digits.join(""));
            if (pwLen > 0) add(digits.slice(0, pwLen).join(""));
        }
    }

    // Base Conversion (OctantVoxel dll)
    if (data && typeof data === "string") {
        let mData = data.trim().match(/^(\d+),([0-9a-zA-Z]+)$/);
        if (mData) {
            let base = parseInt(mData[1]);
            let val = parseInt(mData[2], base);
            if (!isNaN(val)) add(val);
        }
    }

    // Roman Numerals (BellaCuore dll)
    if (data && typeof data === "string" && /^[IVXLCDM]+$/i.test(data.trim())) {
        const romanToInt = (s) => {
            const roman = { 'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000 };
            let res = 0;
            for (let i = 0; i < s.length; i++) {
                let curr = roman[s[i].toUpperCase()];
                let next = roman[s[i + 1]?.toUpperCase()];
                if (next && curr < next) res -= curr;
                else res += curr;
            }
            return res;
        };
        add(romanToInt(data.trim()));
    }

    // Permutasi PHP
    if (model.startsWith("PHP")) {
        let nm = hintStr.match(/\d+/);
        if (nm) {
            for (let p of [...new Set(permute(nm[0].split("")).map(x => x.join("")))]) addIfNonEmpty(p);
        }
    }

    // Token kata
    for (let w of (hintStr.match(/\b[a-zA-Z0-9_\-]{1,20}\b/g) || [])) addIfNonEmpty(w);

    // Model-spesifik
    if (model === "Laika4")    ["fido", "spot", "rover", "max", "dog", "dogs", "laika"].forEach(addIfNonEmpty);
    if (model === "NIL")       ["nil", "null", "none", "nothing", "undefined"].forEach(addIfNonEmpty);

    // Universal fallback (non-empty)
    ["password", "admin", "0000", "12345", "1234", "root", "default"].forEach(addIfNonEmpty);
    
    // Selalu tambahkan empty string sebagai fallback akhir
    set.add("");

    return [...set];
}

function buildCandidatesFromText(text, pwLen, fmt) {
    let set = new Set();
    let m = text.match(/(?:is|pin|secret|password|code|key)\s+([^\s,\.]{1,20})/gi);
    if (m) for (let x of m) set.add(x.split(/\s+/).pop());
    for (let n of (text.match(/\d+/g) || [])) set.add(n);
    let digits = text.match(/\d/g) || [];
    if (digits.length > 0) {
        set.add(digits.join(""));
        if (pwLen > 0) set.add(digits.slice(0, pwLen).join(""));
    }
    return [...set];
}

function permute(arr) {
    if (arr.length <= 1) return [arr];
    let r = [];
    for (let i = 0; i < arr.length; i++) {
        let rest = arr.slice(0, i).concat(arr.slice(i + 1));
        for (let p of permute(rest)) r.push([arr[i], ...p]);
    }
    return r;
}

export function autocomplete(data) { return ["--tail"]; }

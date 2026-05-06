/** @param {NS} ns
 *  DARKNET CRACKER v1.0
 *  Jalankan dari home: run ai/darknet-cracker.js
 *  Akan deploy dirinya ke darkweb, lalu crack semua server tetangga.
 */
export async function main(ns) {
    ns.disableLog("ALL");
    const HOME = "home";
    const PASS_DB = "/darknet-passwords.txt";

    // ============================================================
    // MODE 1: Jika di HOME → deploy ke darkweb dan tunggu laporan
    // ============================================================
    if (ns.getHostname() === HOME) {
        ns.ui.openTail();
        ns.print("🌑 DARKNET CRACKER — Mengirim ke darkweb...");

        let scriptName = "ai/darknet-craker.js";
        let files = ["ai/darknet-craker.js", "ai/darknet-probe.js"];
        for (let f of files) {
            await ns.scp(f, "darkweb", HOME);
        }

        // Cek RAM sebelum exec
        let scriptRam = ns.getScriptRam(scriptName);
        let freeRam = ns.getServerMaxRam("darkweb") - ns.getServerUsedRam("darkweb");
        ns.print(`   📊 RAM Cracker: ${scriptRam.toFixed(1)}GB | RAM Bebas darkweb: ${freeRam.toFixed(1)}GB`);

        if (freeRam < scriptRam) {
            ns.print(`   ❌ RAM darkweb tidak cukup (butuh ${scriptRam.toFixed(1)}GB, ada ${freeRam.toFixed(1)}GB)`);
            ns.print(`   💡 Jalankan manual dari terminal:`);
            ns.print(`      > connect darkweb`);
            ns.print(`      > run ai/darknet-cracker.js`);
            return;
        }

        let pid = ns.exec(scriptName, "darkweb");
        if (pid === 0) {
            ns.print("❌ Gagal exec ke darkweb. Jalankan manual:");
            ns.print("   > connect darkweb");
            ns.print("   > run ai/darknet-cracker.js");
        } else {
            ns.print("✅ Cracker berhasil diluncurkan di darkweb!");
        }
        return;
    }

    // ============================================================
    // MODE 2: Berjalan DI DALAM server darknet → crack tetangga
    // ============================================================
    let myHost = ns.getHostname();
    ns.print(`🏴‍☠️ CRACKER aktif di: ${myHost}`);
    ns.print("🔍 Mencari target...\n");

    let neighbors = ns.dnet.probe();
    let savedPasswords = {};

    // Load password DB yang sudah ada jika ada
    if (ns.fileExists(PASS_DB, HOME)) {
        try { savedPasswords = JSON.parse(ns.read(PASS_DB)); } catch { }
    }

    for (let target of neighbors) {
        ns.print(`\n🎯 TARGET: ${target}`);

        let details = ns.dnet.getServerAuthDetails(target);
        if (!details.isOnline) {
            ns.print("   ⚫ Server offline, lewati.");
            continue;
        }
        if (!details.isConnectedToCurrentServer) {
            ns.print("   ⚡ Tidak terhubung langsung, lewati.");
            continue;
        }

        // Jika password sudah diketahui sebelumnya
        // Note: gunakan 'in' bukan truthy check, karena password kosong "" adalah valid!
        if (target in savedPasswords) {
            ns.print(`   🔑 Password sudah ada: "${savedPasswords[target]}"`);
            ns.dnet.connectToSession(target, savedPasswords[target]);
            await spreadCracker(ns, target, HOME);
            continue;
        }

        // Log SEMUA field dari details (untuk debugging & model baru)
        ns.print(`   📋 ${JSON.stringify(details)}`);

        let cracked = false;

        // ============================================================
        // BANGUN DAFTAR KANDIDAT PASSWORD (Universal, semua model)
        // ============================================================
        let candidates = buildCandidates(ns, details);

        // Filter berdasarkan length (jika diketahui)
        let pwLen = details.passwordLength ?? details.length ?? 0;
        if (pwLen > 0) {
            let exact = candidates.filter(p => String(p).length === pwLen);
            if (exact.length > 0) {
                ns.print(`   🎯 Filter length=${pwLen}: ${exact.length} kandidat tersisa`);
                candidates = exact;
            }
        }

        // Filter berdasarkan format
        let fmt = (details.passwordFormat ?? details.format ?? "").toLowerCase();
        if (fmt === "numeric") {
            let numOnly = candidates.filter(p => /^\d+$/.test(String(p)));
            if (numOnly.length > 0) candidates = numOnly;
        } else if (fmt === "alpha") {
            let alphaOnly = candidates.filter(p => /^[a-zA-Z]+$/.test(String(p)));
            if (alphaOnly.length > 0) candidates = alphaOnly;
        }

        ns.print(`   🔑 Total kandidat: ${candidates.length}`);

        // ============================================================
        // COBA SEMUA KANDIDAT
        // ============================================================
        for (let pw of candidates) {
            let result = await ns.dnet.authenticate(target, pw);
            if (result.success) {
                ns.print(`   ✅ BERHASIL! Password = "${pw}"`);
                savedPasswords[target] = pw;
                cracked = true;
                break;
            }
            await ns.sleep(150);
        }

        // ============================================================
        // FALLBACK: Heartbleed untuk petunjuk tambahan
        // ============================================================
        if (!cracked) {
            try {
                let bleed = await ns.dnet.heartbleed(target, { peek: true });
                let logText = (bleed.logs || []).join("\n");
                if (logText) {
                    ns.print(`   📋 Log: ${logText.slice(0, 300)}`);
                    // Coba ekstrak password dari log
                    let logCandidates = buildCandidatesFromText(logText, pwLen, fmt);
                    for (let pw of logCandidates) {
                        let result = await ns.dnet.authenticate(target, pw);
                        if (result.success) {
                            ns.print(`   ✅ (dari log) BERHASIL! Password = "${pw}"`);
                            savedPasswords[target] = pw;
                            cracked = true;
                            break;
                        }
                        await ns.sleep(150);
                    }
                }
            } catch { }
        }

        // Jika berhasil crack → sebar probe ke lebih dalam
        if (cracked) {
            // Simpan password ke database
            ns.write(PASS_DB, JSON.stringify(savedPasswords, null, 2), "w");
            await ns.scp(PASS_DB, HOME, myHost);

            // Loot RAM yang terblokir
            try {
                ns.print(`   🧹 Membebaskan RAM yang terkunci...`);
                let iter = 0;
                while (iter++ < 10) {
                    let result = ns.dnet.influence?.memoryReallocation
                        ? ns.dnet.influence.memoryReallocation(target)
                        : null;
                    if (!result || result.done) break;
                    await ns.sleep(500);
                }
            } catch { }

            // Cek cache files
            try {
                let files = ns.ls(target, ".cache");
                if (files.length > 0) {
                    ns.print(`   💾 Cache ditemukan: ${files.join(", ")}`);
                    for (let f of files) {
                        ns.dnet.openCache(f);
                        ns.print(`   📦 Membuka cache: ${f}`);
                    }
                }
            } catch { }

            // Spread probe ke server yang baru di-crack
            await spreadCracker(ns, target, HOME);
        } else {
            ns.print(`   ❌ Gagal crack ${target}. Perlu analisis lebih lanjut.`);
        }
    }

    // Simpan final password DB
    ns.write(PASS_DB, JSON.stringify(savedPasswords, null, 2), "w");
    await ns.scp(PASS_DB, HOME, myHost);
    ns.print(`\n✅ Selesai! Password database disimpan di ${PASS_DB}`);
}

// Menyebarkan CRACKER + PROBE ke server yang baru berhasil di-crack
// Sehingga eksplorasi berjalan rekursif / self-propagating
async function spreadCracker(ns, target, home) {
    try {
        const CRACKER = "ai/darknet-craker.js";
        const PROBE   = "ai/darknet-probe.js";

        let crackerRam = ns.getScriptRam(CRACKER);
        let freeRam    = ns.getServerMaxRam(target) - ns.getServerUsedRam(target);

        // Selalu copy probe (ringan)
        await ns.scp(PROBE, target, home);

        if (freeRam >= crackerRam) {
            // Copy cracker juga, lalu jalankan otomatis dari sana
            await ns.scp(CRACKER, target, home);
            let pid = ns.exec(CRACKER, target);
            if (pid > 0) {
                ns.print(`   🚀 Cracker self-propagated ke ${target} (PID ${pid})!`);
            } else {
                // Exec gagal (butuh sesi?), jalankan probe saja
                ns.exec(PROBE, target);
                ns.print(`   📡 Probe disebarkan ke ${target} (cracker exec gagal).`);
            }
        } else {
            // RAM tidak cukup untuk cracker, cukup probe saja
            ns.exec(PROBE, target);
            ns.print(`   📡 Probe saja di ${target} (RAM kurang untuk cracker: ${freeRam.toFixed(0)}/${crackerRam.toFixed(0)}GB).`);
        }

        // Baca .lit dan .cache files yang ada di server baru
        try {
            let files = ns.ls(target);
            let lits   = files.filter(f => f.endsWith(".lit"));
            let caches = files.filter(f => f.endsWith(".cache"));
            if (lits.length > 0) {
                ns.print(`   📖 .lit files: ${lits.join(", ")}`);
                // Copy .lit files ke home untuk dibaca nanti
                for (let lit of lits) {
                    await ns.scp(lit, home, target);
                    // Ekstrak password kandidat dari isi .lit
                    let content = ns.read(lit);
                    let hints = parseLitForPasswords(content);
                    if (hints.length > 0) {
                        ns.print(`   🔑 Kata kunci dari ${lit}: ${hints.join(", ")}`);
                    }
                }
            }
            if (caches.length > 0) ns.print(`   💾 .cache files: ${caches.join(", ")}`);
        } catch { }

    } catch (e) {
        ns.print(`   ⚠️ Gagal spread ke ${target}: ${e}`);
    }
}

// Menghasilkan semua permutasi array (untuk PHP 5.4 strategy)
function permute(arr) {
    if (arr.length <= 1) return [arr];
    let result = [];
    for (let i = 0; i < arr.length; i++) {
        let rest = arr.slice(0, i).concat(arr.slice(i + 1));
        for (let perm of permute(rest)) {
            result.push([arr[i], ...perm]);
        }
    }
    return result;
}

// Mengekstrak kandidat password dari isi file .lit
// Contoh: "admin, password, 0000, 12345" → ["admin", "password", "0000", "12345"]
function parseLitForPasswords(content) {
    let candidates = new Set();

    // Ekstrak string dalam tanda kutip: "admin" atau 'secret'
    let quoted = content.match(/["']([^"']{1,30})["']/g) || [];
    for (let q of quoted) candidates.add(q.slice(1, -1));

    // Ekstrak kata setelah kata kunci: "password is X", "PIN is X", "secret is X", "code is X"
    let keywordMatches = content.match(/(?:password|pin|secret|code|key)\s+(?:is\s+)?([^\s,\.]{1,20})/gi) || [];
    for (let m of keywordMatches) {
        let val = m.split(/\s+/).pop();
        candidates.add(val);
    }

    // Ekstrak semua angka 2-8 digit
    let nums = content.match(/\b\d{2,8}\b/g) || [];
    for (let n of nums) candidates.add(n);

    // Ekstrak kata-kata biasa yang terpisah koma (daftar password)
    let commaWords = content.match(/\b[a-zA-Z0-9_]{3,15}\b/g) || [];
    for (let w of commaWords) candidates.add(w);

    return [...candidates].filter(c => c.length > 0).slice(0, 30);
}

// =============================================================
// UNIVERSAL CANDIDATE BUILDER — Pakai semua field dari details
// =============================================================
function buildCandidates(ns, details) {
    let set = new Set();
    const add = (v) => { if (v !== undefined && v !== null && String(v).length > 0) set.add(String(v)); };

    let hint  = details.passwordHint ?? details.hint ?? "";
    let model = details.modelId ?? "";
    let data  = details.data ?? details.passwordData ?? "";
    let pwLen = details.passwordLength ?? details.length ?? 0;

    // 1. Pola "is X" / "PIN X" / "password X" / "secret X"
    //    Contoh: "The password is 601" → "601"
    let isMatch = hint.match(/(?:is|pin|secret|password|code|key)\s+([^\s,\.]{1,20})/i);
    if (isMatch) add(isMatch[1]);

    // 2. Semua angka dari hint
    for (let n of (hint.match(/\d+/g) || [])) add(n);

    // 3. Data field (CloudBlare) → ekstrak digit
    if (data) {
        let digits = data.match(/\d/g) || [];
        if (digits.length > 0) {
            add(digits.join(""));
            if (pwLen > 0) add(digits.slice(0, pwLen).join(""));
        }
    }

    // 4. Permutasi untuk PHP (shuffled)
    if (model.startsWith("PHP")) {
        let numMatch = hint.match(/\d+/);
        if (numMatch) {
            let perms = [...new Set(permute(numMatch[0].split("")).map(p => p.join("")))];
            for (let p of perms) add(p);
        }
    }

    // 5. Semua token kata dari hint
    for (let w of (hint.match(/\b[a-zA-Z0-9_\-]{1,20}\b/g) || [])) add(w);

    // 6. Keyword model-spesifik
    if (model === "ZeroLogon") {
        ["", "password", "0", "0000", "12345", "null", "admin", "1234", "default"].forEach(add);
    } else if (model === "NIL") {
        ["", "nil", "null", "none", "nothing", "undefined"].forEach(add);
    }

    // 7. Universal fallback
    ["", "password", "admin", "0000", "12345", "1234", "root", "default"].forEach(add);

    return [...set];
}

// Bangun kandidat dari teks heartbleed log
function buildCandidatesFromText(text, pwLen, fmt) {
    let set = new Set();
    let isMatch = text.match(/(?:is|pin|secret|password|code|key)\s+([^\s,\.]{1,20})/gi);
    if (isMatch) for (let m of isMatch) set.add(m.split(/\s+/).pop());
    for (let n of (text.match(/\d+/g) || [])) set.add(n);
    let digits = text.match(/\d/g) || [];
    if (digits.length > 0) {
        set.add(digits.join(""));
        if (pwLen > 0) set.add(digits.slice(0, pwLen).join(""));
    }
    return [...set];
}

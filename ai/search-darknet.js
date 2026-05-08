export async function main(ns) {
    let saved = {};
    try {
        saved = JSON.parse(ns.read("/darknet-passwords.txt"));
    } catch {
        ns.tprint("Gagal membaca password DB.");
        return;
    }

    let crackedHosts = Object.keys(saved);
    ns.tprint(`Mencari file teks di ${crackedHosts.length} server darknet yang sudah terbobol...`);

    for (let host of crackedHosts) {
        if (host === "home") continue;
        
        // Cek apakah server masih ada di jaringan (karena darknet dinamis)
        if (!ns.serverExists(host)) continue;

        let files = [];
        try {
            files = ns.ls(host);
        } catch (e) {
            continue; // Abaikan jika tetap error
        }
        let textFiles = files.filter(f => 
            (f.endsWith(".txt") || f.endsWith(".msg") || f.endsWith(".doc") || f.endsWith(".lit")) && 
            !f.includes("darknet-passwords.txt")
        );
        
        if (textFiles.length > 0) {
            ns.tprint(`\n🎯 Ditemukan file di server: [${host}]`);
            for (let f of textFiles) {
                ns.tprint(`   📄 File: ${f}`);
                // Membaca file dari server remote (pastikan Bitburner mendukung argument ke-2 untuk ns.read)
                try {
                    let content = ns.read(f, host);
                    if (!content && ns.fileExists(f, host)) {
                        // Parameter ns.scp adalah (file, destination, source)
                        await ns.scp(f, "home", host);
                        content = ns.read(f, "home"); // baca file yang sudah di-copy di home
                        ns.rm(f, "home"); // bersihkan setelah dibaca
                    }
                    ns.tprint(`   --- Isi File ---`);
                    ns.tprint(content);
                    ns.tprint(`   ----------------\n`);
                } catch (e) {
                    ns.tprint(`   (Gagal membaca file: ${e})`);
                }
            }
        }
    }
}

/** @param {NS} ns **/
// ================================================================
// HARI 2: Kontrol Alur — if, else if, else, Ternary
// Jalankan di Bitburner: run learn/hari-2.js
// ================================================================

export async function main(ns) {
    ns.ui.openTail();
    ns.clearLog();
    ns.print("=== HARI 2: Kontrol Alur (if/else) ===\n");

    // ---------------------------------------------------------
    // MATERI 2.1: if / else if / else
    // Contoh nyata: logic tugas gang di gang-master-med.js
    // ---------------------------------------------------------
    function tentukanTugas(avgStats, anggotaCount, needVigilante) {
        let tugas = "";

        if (avgStats < 400) {
            tugas = "Train Combat";           // Pemula → latihan
        } else if (needVigilante) {
            tugas = "Vigilante Justice";      // Wanted tinggi → jadi polisi
        } else if (anggotaCount < 6) {
            tugas = "Terrorism";              // Sedikit anggota → cari respect cepat
        } else if (avgStats < 500) {
            tugas = "Mug People";             // Kekuatan rendah → copet
        } else if (avgStats < 1200) {
            tugas = "Strongarm Assassinations";
        } else {
            tugas = "Human Trafficking";      // Paling kuat → uang terbesar
        }

        return tugas;
    }

    let anggota = [
        { nama: "Preman-1", stats: 200 },
        { nama: "Preman-2", stats: 450 },
        { nama: "Preman-3", stats: 800 },
        { nama: "Preman-4", stats: 1500 },
    ];

    ns.print("[2.1] Simulasi Penugasan Gang:");
    for (let a of anggota) {
        let tugas = tentukanTugas(a.stats, anggota.length, false);
        ns.print(`  ${a.nama} (stats: ${a.stats}) → ${tugas}`);
    }
    ns.print("");

    // ---------------------------------------------------------
    // MATERI 2.2: Operator Logika && || !
    // ---------------------------------------------------------
    let hackLevel = 150;
    let reqLevel = 100;
    let isRooted = true;
    let uang = 500_000_000; // 500 juta

    // && = AND (keduanya harus true)
    let bisaHack = hackLevel >= reqLevel && isRooted;
    ns.print(`[2.2] Bisa hack? (level >= req AND sudah rooted) → ${bisaHack}`);

    // || = OR (salah satu cukup)
    let butuhUpgrade = uang > 1_000_000_000 || hackLevel > 500;
    ns.print(`[2.2] Perlu Upgrade server? (kaya OR level tinggi) → ${butuhUpgrade}`);

    // ! = NOT (kebalikan)
    let belumRooted = !isRooted;
    ns.print(`[2.2] Belum rooted? → ${belumRooted}`);
    ns.print("");

    // ---------------------------------------------------------
    // MATERI 2.3: Ternary Operator (if singkat dalam 1 baris)
    // Format: kondisi ? nilaiJikaTrue : nilaiJikaFalse
    // ---------------------------------------------------------
    let profit = 1_200_000;
    let icon = profit >= 0 ? "✅ Untung" : "🔴 Rugi";
    ns.print(`[2.3] Status: ${icon} ($${profit.toLocaleString()})`);

    let modeLabel = hackLevel > 300 ? "🌐 Semua Server"
        : hackLevel > 100 ? "🖥️ pserv-* saja"
            : "🏠 Home saja";
    ns.print(`[2.3] Mode operasi: ${modeLabel}`);
    ns.print("");

    // ---------------------------------------------------------
    // MATERI 2.4: Tes Pemahaman
    // ---------------------------------------------------------
    ns.print("[2.4] Simulasi Keputusan Beli Server:");

    let kasBank = 2_000_000_000; // 2 Miliar
    let hargaServer8GB = 55_000;
    let hargaServer64GB = 440_000;
    let hargaServer1TB = 28_000_000;

    if (kasBank >= hargaServer1TB * 10) {
        ns.print("  → Beli 10x Server 1TB! Kaya raya!");
    } else if (kasBank >= hargaServer64GB * 5) {
        ns.print("  → Beli 5x Server 64GB. Lumayan!");
    } else if (kasBank >= hargaServer8GB) {
        ns.print("  → Beli 1x Server 8GB. Mulai dari bawah.");
    } else {
        ns.print("  → Belum mampu beli server apapun. Terus hack!");
    }

    ns.print("");
    ns.print("=== ✅ Selesai Hari 2! ===");
    ns.print("");
    ns.print("📝 LATIHAN:");
    ns.print("  1. Ubah nilai 'hackLevel' jadi 50, 200, 600 — lihat modeLabel berubah");
    ns.print("  2. Tambah anggota baru dengan stats=1800, lihat tugasnya apa");
    ns.print("  3. Buat fungsi: isAffordable(harga, uang) → return true/false");
}

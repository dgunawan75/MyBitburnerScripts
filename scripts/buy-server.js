/** @param {NS} ns */
export async function main(ns) {
    // Tampilkan Harga Jika dijalankan tanpa Parameter (run scripts/buy-server.js)
    if (ns.args.length === 0) {
        ns.tprint("===== DAFTAR HARGA PERSONAL SERVER =====");
        ns.tprint("Gunakan perintah: run scripts/buy-server.js [KODE NOMOR]");
        ns.tprint("Contoh jika ingin RAM 1 TB [Kode 10] : run scripts/buy-server.js 10\n");

        for (let i = 1; i <= 20; i++) { // Limit 1 PetaByte (Max)
            let ram = Math.pow(2, i);
            let cost = ns.getPurchasedServerCost(ram);
            let ramStr = ns.formatRam(ram).padEnd(9, " ");
            let costStr = ("$" + ns.formatNumber(cost)).padStart(10, " ");
            ns.tprint(`[${i.toString().padStart(2, "0")}] RAM: ${ramStr} | Harga: ${costStr}`);
        }
        return;
    }

    let targetIndex = parseInt(ns.args[0]);

    // Validasi Index Pembelian (1 hingga 20)
    if (isNaN(targetIndex) || targetIndex < 1 || targetIndex > 20) {
        ns.tprint("❌ ERROR: Harap masukkan [KODE NOMOR] dari tabel (antara 1 sampai 20)!");
        ns.tprint("💡 Ketik 'run scripts/buy-server.js' tanpa embel-embel angka untuk melihat kode.");
        return;
    }

    let targetRam = Math.pow(2, targetIndex);

    let cost = ns.getPurchasedServerCost(targetRam);
    let money = ns.getServerMoneyAvailable("home");

    if (money < cost) {
        ns.tprint(`❌ ERROR: Anda Terlalu Miskin! Uang saat ini hanya $${ns.formatNumber(money)}, sedangkan server ${ns.formatRam(targetRam)} butuh $${ns.formatNumber(cost)}.`);
        return;
    }

    let pservs = ns.getPurchasedServers();
    let limit = ns.getPurchasedServerLimit();

    // Skenario 1: Beli Baru (Slot belum penuh 25)
    if (pservs.length < limit) {
        // Deteksi Otomatis untuk mencetak nama pserv berturut-turut (pserv-0, pserv-1, dst...)
        let nextIndex = 0;
        while (pservs.includes("pserv-" + nextIndex)) {
            nextIndex++;
        }
        let serverName = "pserv-" + nextIndex;
        let pId = ns.purchaseServer(serverName, targetRam);

        if (pId) ns.tprint(`✅ [BERHASIL] Mengakuisisi server baru "${serverName}" (${ns.formatRam(targetRam)}) seharga $${ns.formatNumber(cost)}!`);
        else ns.tprint("❌ ERROR: Sistem Gagal melakukan eksekusi pembelian ke API.");
    }
    // Skenario 2: Slot 25 Sudah Mentok (Menuju ke Upgrade paksa)
    else {
        // Cari Server yang ukurannya paling kecil untuk ditimpa/diupgrade
        let weakest = pservs.reduce((minSv, sv) =>
            ns.getServerMaxRam(sv) < ns.getServerMaxRam(minSv) ? sv : minSv
        );
        let wRam = ns.getServerMaxRam(weakest);

        // Anti-Dungu: Cegah pengguna membeli RAM yang tidak memiliki lonjakan manfaat
        if (targetRam <= wRam) {
            ns.tprint(`⚠️ INFO: Seluruh 25 server Anda saat ini (Paling kecil: ${weakest}) sudah memiliki minimal RAM ${ns.formatRam(wRam)}! Penambahan RAM ${ns.formatRam(targetRam)} ditolak karenal hal ini sia-sia.`);
            return;
        }

        ns.tprint(`🚀 Mencoba menaikkan (UPGRADE) kapasitas perangkat keras ${weakest} dari ${ns.formatRam(wRam)} -> ${ns.formatRam(targetRam)}...`);

        try {
            // API V2 Bitburner
            if (ns.upgradePurchasedServer(weakest, targetRam)) {
                ns.tprint(`✅ [BERHASIL] Fisik server ${weakest} telah selesai diremajakan menjadi ${ns.formatRam(targetRam)}! Uang melayang: $${ns.formatNumber(cost)}`);
            } else {
                ns.tprint("❌ ERROR: Syntax fungsi Upgrade gagal.");
            }
        } catch (e) {
            // API V1 Bitburner (Fallback bagi pengguna game versi lawas)
            ns.tprint("🛠️ Sedang Membongkar dan merusak server lama demi server kapasitas baru...");
            ns.killall(weakest);
            ns.deleteServer(weakest);
            let result = ns.purchaseServer(weakest, targetRam);
            if (result) ns.tprint(`✅ [BERHASIL] Peremajaan sukses! Server ${weakest} lahir kembali dengan ${ns.formatRam(targetRam)}!`);
            else ns.tprint("❌ ERROR FATAL: Server lama dihancurkan, tapi server baru gagal diakuisisi! Anda minus 1 server.");
        }
    }
}

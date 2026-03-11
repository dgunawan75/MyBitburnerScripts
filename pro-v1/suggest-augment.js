/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    ns.print("=========================================");
    ns.print(" 📖 PANDUAN BELANJA AUGMENTASI (NEWBIE)  ");
    ns.print("=========================================");

    // Dihapus ns.getBitNodeMultipliers() karena butuh Source-File 5.
    // Asumsi kita ada di Node standar (BitNode 1), maka Base Price 100%.

    ns.print("🔍 Opsi: Panduan ini HANYA menampilkan teori RUMUS MATEMATIKA yang optimal.");
    ns.print("Silakan buka tab [Factions] Anda, dan masukkan target belanjaan Anda (Nama Augment) ke otak Anda.");

    // Karena kita tidak punya Singularity API untuk membaca inventaris Faksi secara instan, 
    // kita akan menggunakan sistem interaktif kecil melalui prompt() UI game.

    let shoppingCart = [];

    ns.print("\n=== CARA PENGGUNAAN ===");
    ns.print("1. Anda bisa memakai kalkulator ini untuk simulasi harga sebelum memencet 'Purchase' di Faction.");
    ns.print("2. Multiplier Jahat Bitburner: Tiap beli 1 Aug, harga Aug lain naik 1.9x!");
    ns.print("3. Selalu beli dari yang PALING MAHAL ke PALING MURAH.");

    let runSim = await ns.prompt("Apakah Anda ingin menghitung simulasi Multiplier Harga?");
    if (!runSim) {
        ns.print("\nBaiklah, matikan script ini dan berbelanjalah dengan bijak!");
        return;
    }

    // Tanya User berapa Aug yang mau mereka beli (Simulasi Manual Input)
    let augCountStr = await ns.prompt("Berapa banyak Augmentasi yang ingin Anda borong di sesi ini?", { type: "text" });
    let howMany = parseInt(augCountStr);

    if (isNaN(howMany) || howMany <= 0) {
        ns.print("❌ Input tidak valid.");
        return;
    }

    ns.print(`\n✍️ Masukkan Harga ASLI (Base Price) dari tiap Augmentasi yang tertera di menu Faksi:`);

    for (let i = 0; i < howMany; i++) {
        let priceStr = await ns.prompt(`Masukkan HARGA di game untuk Augmentasi ke-${i + 1} (contoh: 50m, 1.5b, 400k):`, { type: "text" });
        if (!priceStr) return;

        let priceRaw = parseMoney(priceStr);
        if (priceRaw <= 0) {
            ns.print("❌ Format harga salah. Gunakan k, m, b, t (huruf kecil).");
            return;
        }
        shoppingCart.push(priceRaw);
    }

    // Urutkan dari yang paling mahal ke paling murah
    shoppingCart.sort((a, b) => b - a);

    ns.print("\n=========================================");
    ns.print(" 👑 SIMULASI DAFTAR BELANJA (URUTAN TERBAIK) ");
    ns.print("=========================================");

    let totalCost = 0;
    let currentMultiplier = 1.0;

    for (let i = 0; i < shoppingCart.length; i++) {
        let base = shoppingCart[i];
        let finalPrice = base * currentMultiplier;
        totalCost += finalPrice;

        ns.print(`🛒 Beli #${i + 1}: Harga Asli $${ns.formatNumber(base)} 👉 Jadi: $${ns.formatNumber(finalPrice)}`);

        // Multiplier 1.9x akan aktif SETELAH pembelian ini
        currentMultiplier *= 1.9;
    }

    let myMoney = ns.getServerMoneyAvailable("home");

    ns.print("\n📊 RINGKASAN BIAYA:");
    ns.print(`Total Uang Anda  : $${ns.formatNumber(myMoney)}`);
    ns.print(`Total Harga Beli : $${ns.formatNumber(totalCost)}`);

    if (myMoney >= totalCost) {
        ns.print("✅ Uang Anda cukup! Silakan beli secara manual di menu Faksi mengikuti urutan harga termahal -> termurah.");
    } else {
        ns.print(`❌ Uang Anda KURANG $${ns.formatNumber(totalCost - myMoney)}!`);
        ns.print("Solusi: Coret Augmentasi termurah dari daftar, atau tunggu Super-HWGW mencetak uang lagi.");
    }
}

// Fungsi pembantu mengekstrak teks "1.5b" menjadi angka 1500000000
function parseMoney(str) {
    str = str.toLowerCase().replace(/,/g, '').replace(/\s/g, '').replace('$', '');
    let mult = 1;
    if (str.endsWith('k')) mult = 1e3;
    else if (str.endsWith('m')) mult = 1e6;
    else if (str.endsWith('b')) mult = 1e9;
    else if (str.endsWith('t')) mult = 1e12;
    else if (str.endsWith('q')) mult = 1e15;

    let numStr = str.replace(/[kmbtq]/g, '');
    let num = parseFloat(numStr);
    return isNaN(num) ? 0 : num * mult;
}

/** @param {NS} ns **/
// Usage: run .vscode/corp/get-industry-data.js "Chemical"
// Daftar industri: Agriculture, Water Utilities, Chemical, Fishing,
//   Mining, Refinery, Restaurant, Tobacco, Pharmaceutical,
//   Computer Hardware, Robotics, Software, Healthcare, Real Estate
export async function main(ns) {
    const industryName = ns.args[0] ?? "Chemical";
    try {
        const data = ns.corporation.getIndustryData(industryName);
        ns.tprint(`\n=== INDUSTRY DATA: ${industryName} ===`);
        ns.tprint(JSON.stringify(data, null, 2));

        // Hitung boost factors yang ditemukan
        const factors = [];
        if (data.hardwareFactor  !== undefined) factors.push({ mat: "Hardware",     size: 0.06,  factor: data.hardwareFactor  });
        if (data.robotFactor     !== undefined) factors.push({ mat: "Robots",       size: 0.50,  factor: data.robotFactor     });
        if (data.aiCoreFactor    !== undefined) factors.push({ mat: "AI Cores",     size: 0.10,  factor: data.aiCoreFactor    });
        if (data.realEstateFactor!== undefined) factors.push({ mat: "Real Estate",  size: 0.005, factor: data.realEstateFactor});

        ns.tprint(`\n--- Boost Materials (${factors.length} found) ---`);
        for (const f of factors) ns.tprint(`  ${f.mat.padEnd(15)}: factor=${f.factor}, size=${f.size}`);

        ns.tprint(`\n--- Required Inputs ---`);
        ns.tprint(JSON.stringify(data.requiredMaterials ?? {}));
        ns.tprint(`\n--- Produces ---`);
        ns.tprint(JSON.stringify(data.producedMaterials ?? []));
    } catch (e) {
        ns.tprint(`ERROR: ${e}`);
    }
}

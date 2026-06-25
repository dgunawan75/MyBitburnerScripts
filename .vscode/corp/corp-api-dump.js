/** @param {NS} ns **/
export async function main(ns) {
    const corp = ns.corporation.getCorporation();

    ns.tprint("=== CORPORATION ===");
    ns.tprint(JSON.stringify(corp, null, 2));

    for (const div of corp.divisions) {
        ns.tprint(`=== DIVISION ${div} ===`);
        ns.tprint(JSON.stringify(
            ns.corporation.getDivision(div),
            null,
            2
        ));

        try {
            const industry = ns.corporation.getDivision(div).type;

            ns.tprint(`=== INDUSTRY DATA ${industry} ===`);
            ns.tprint(JSON.stringify(
                ns.corporation.getIndustryData(industry),
                null,
                2
            ));
        } catch (e) { }
    }
}
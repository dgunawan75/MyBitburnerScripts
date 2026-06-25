/** @param {NS} ns **/
export async function main(ns) {

    const division = ns.args[0];

    if (!division) {
        ns.tprint("Usage:");
        ns.tprint("run corp-material-optimizer-v1.js Agro");
        return;
    }

    const corp = ns.corporation;
    const div = corp.getDivision(division);

    ns.tprint("");
    ns.tprint("========================================");
    ns.tprint(`DIVISION ${division}`);
    ns.tprint("========================================");

    for (const city of div.cities) {

        const wh = corp.getWarehouse(division, city);

        const usage =
            (wh.sizeUsed / wh.size) * 100;

        ns.tprint("");
        ns.tprint(`=== ${city} ===`);

        ns.tprint(
            `Warehouse: ${wh.sizeUsed.toFixed(1)} / ${wh.size.toFixed(1)} (${usage.toFixed(1)}%)`
        );

        let largestConsumer = null;
        let largestSpace = 0;

        const materials = [
            "Hardware",
            "Robots",
            "AI Cores",
            "Real Estate",

            "Water",
            "Chemicals",
            "Plants",
            "Food"
        ];

        let accumulations = [];

        for (const matName of materials) {

            try {

                const mat =
                    corp.getMaterial(
                        division,
                        city,
                        matName
                    );

                const size =
                    MATERIAL_SIZE[matName] ?? 0;

                const space =
                    mat.stored * size;

                if (space > largestSpace) {

                    largestSpace = space;
                    largestConsumer = matName;

                }

                const netFlow =
                    mat.productionAmount +
                    mat.importAmount -
                    mat.actualSellAmount;

                if (netFlow > 0.01) {

                    accumulations.push({
                        name: matName,
                        netFlow,
                        stored: mat.stored,
                        space
                    });

                }

            } catch {
                // material not present
            }
        }

        ns.tprint(
            `Largest Consumer: ${largestConsumer} (${largestSpace.toFixed(1)} WH)`
        );

        if (usage > 95) {

            ns.tprint("STATUS: WAREHOUSE CRITICAL");

        } else if (usage > 85) {

            ns.tprint("STATUS: WAREHOUSE WARNING");

        } else {

            ns.tprint("STATUS: OK");

        }

        if (accumulations.length > 0) {

            ns.tprint("");
            ns.tprint("Accumulating Materials:");

            for (const a of accumulations) {

                ns.tprint(
                    `${a.name}: +${a.netFlow.toFixed(2)}/cycle | Stored=${a.stored.toFixed(0)}`
                );

            }
        }
    }
}
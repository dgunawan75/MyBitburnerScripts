/** @param {NS} ns **/
export async function main(ns) {

    const corp = ns.corporation;

    if (!corp.hasCorporation()) {
        ns.tprint("No corporation");
        return;
    }

    const corpData = corp.getCorporation();

    ns.tprint("");
    ns.tprint("======================================");
    ns.tprint("CORP MANAGER V3");
    ns.tprint("Sales Driven");
    ns.tprint("======================================");
    ns.tprint("");

    for (const divName of corpData.divisions) {

        const div = corp.getDivision(divName);

        if (!div.makesProducts) continue;

        ns.tprint("--------------------------------------");
        ns.tprint(`${divName} (${div.type})`);
        ns.tprint("--------------------------------------");

        const finishedProducts = [];

        for (const p of div.products) {

            const prod = corp.getProduct(divName, p);

            if (prod.developmentProgress >= 100) {
                finishedProducts.push(prod);
            }
        }

        if (finishedProducts.length === 0) continue;

        const newest =
            finishedProducts[finishedProducts.length - 1];

        for (const city of div.cities) {

            const office =
                corp.getOffice(divName, city);

            const jobs =
                office.employeeJobs;

            const prod =
                corp.getProduct(divName,
                    newest.name);

            const production =
                prod.productionAmount || 0;

            const sales =
                prod.actualSellAmount || 0;

            const ratio =
                sales > 0
                    ? production / sales
                    : 999;

            ns.tprint("");
            ns.tprint(city);

            ns.tprint(
                `Production : ${ns.format.number(production)}`
            );

            ns.tprint(
                `Sales      : ${ns.format.number(sales)}`
            );

            ns.tprint(
                `Ratio      : ${ratio.toFixed(2)}`
            );

            if (ratio > 1.25) {

                ns.tprint(
                    "ACTION : OVERPRODUCTION"
                );

                if ((jobs.Operations || 0) > 1) {

                    corp.setAutoJobAssignment(
                        divName,
                        city,
                        "Operations",
                        jobs.Operations - 1
                    );

                    corp.setAutoJobAssignment(
                        divName,
                        city,
                        "Business",
                        (jobs.Business || 0) + 1
                    );

                    ns.tprint(
                        "Moved 1 Operations -> Business"
                    );
                }
                else if ((jobs.Engineer || 0) > 1) {

                    corp.setAutoJobAssignment(
                        divName,
                        city,
                        "Engineer",
                        jobs.Engineer - 1
                    );

                    corp.setAutoJobAssignment(
                        divName,
                        city,
                        "Business",
                        (jobs.Business || 0) + 1
                    );

                    ns.tprint(
                        "Moved 1 Engineer -> Business"
                    );
                }

            } else if (ratio < 0.95) {

                ns.tprint(
                    "ACTION : SALES STRONG"
                );

                if ((jobs.Business || 0) > 2) {

                    corp.setAutoJobAssignment(
                        divName,
                        city,
                        "Business",
                        jobs.Business - 1
                    );

                    corp.setAutoJobAssignment(
                        divName,
                        city,
                        "Engineer",
                        (jobs.Engineer || 0) + 1
                    );

                    ns.tprint(
                        "Moved 1 Business -> Engineer"
                    );
                }

            } else {

                ns.tprint(
                    "Balanced"
                );
            }

            const wh =
                corp.getWarehouse(divName, city);

            const usage =
                wh.sizeUsed / wh.size;

            if (usage > 0.95) {

                ns.tprint(
                    `Warehouse ${(usage * 100).toFixed(1)}%`
                );

                ns.tprint(
                    "Check stock before upgrade"
                );
            }
        }
    }

    ns.tprint("");
    ns.tprint("Done");
}
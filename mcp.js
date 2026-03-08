/** 
 * @param {NS} ns 
 **/



const SEC_DIF = 5
const MON_PERC = 0.5
const SLEEP_TIME = 1
let SERVERS = {
	"crush-fitness": { "action": null, "servers": ["CSEC"] }, // 0 B
	"johnson-ortho": { "action": null, "servers": ['avmnite-02h'] }, // 0 B
	"computek": { "action": null, "servers": ["I.I.I.I"] }, // 0 B
	"snap-fitness": { "action": null, "servers": ["run4theh111z"] }, // 0 B
	"syscore": { "action": null, "servers": [] }, // 0 B TODO: change to serv0
	"applied-energetics": { "action": null, "servers": [] }, // 0 B
	"4sigma": { "action": null, "servers": [] }, // 0 B
	"fulcrumassets": { "action": null, "servers": [] },
	"nwo": { "action": null, "servers": [] },
}
const EXECUTE_SCRIPT = "scripts/execute.js"

function disable_logs(ns) {
	let logs = ["scan", "run", 'getServerSecurityLevel', 'getServerMoneyAvailable', 'getServerMoneyAvailable', 'getServerMaxMoney', 'getServerMinSecurityLevel']
	for (let i in logs) {
		ns.disableLog(logs[i])
	}
}

function get_action(ns, host) {
	let actions = ns.ps(host)
	if (actions.length == 0) {
		ns.print(host, " has no scripts.")
		return null
	}
	return actions[0].filename.replace("scripts/", "").replace(".js", "")
}

function get_all_servers(ns) {
	let servers = ["home"]
	let result = []
	let i = 0
	while (i < servers.length) {
		let server = servers[i]
		let s = ns.scan(server)
		for (let j in s) {
			let con = s[j]
			if (servers.indexOf(con) < 0) {
				servers.push(con)
				result.push(con)
			}
		}
		i += 1
	}
	return result
}

function update_servers(ns, SERVERS) {
	let all_servers = get_all_servers(ns)
	for (let i in all_servers) {
		let server = all_servers[i]
		if (parseInt(ns.getServerMaxMoney(server)) == 0) { 
			ns.print(`Skipping ${server}`)
			continue 
		}
		if (!(server in SERVERS)) {
		  SERVERS[server] = { "action": null, "servers": [] }
    	}
		SERVERS[server]["action"] = get_action(ns, server)
	}
}

function determine_action(ns, server){	
	let money = ns.getServerMoneyAvailable(server)	
	let mon_perc = money / ns.getServerMaxMoney(server)	
	let sec_dif = ns.getServerSecurityLevel(server) - ns.getServerMinSecurityLevel(server)	
	// determine action	
	if (sec_dif >= SEC_DIF) { return "weaken" }	
	else if (mon_perc < MON_PERC) { return "grow" }	
	else { return "hack" }
}

/** 
 * @param {NS} ns 
**/
export async function main(ns) {
	disable_logs(ns)
	while (true) {
		update_servers(ns, SERVERS)
		for (let server in SERVERS) {
			if (!ns.hasRootAccess(server)) {
				continue
			}
			let action = determine_action(ns, server)
			// execute action if the current action is different.
			if (SERVERS[server]["action"] != action) {
				SERVERS[server]["action"] = action
				ns.run(EXECUTE_SCRIPT, 1, action, server, server)
				await ns.sleep(500)
				for (let i in SERVERS[server]["servers"]) {
					let host = SERVERS[server]["servers"][i]
					ns.run(EXECUTE_SCRIPT, 1, action, server, host)
					await ns.sleep(500)
				}
			} else {
				ns.print(`No action taken for ${server}. ${SERVERS[server]["action"]} == ${action}`)
			}
			if (ns.serverExists(server + "-serv") && get_action(ns, server + "-serv") != action)
        		ns.run(EXECUTE_SCRIPT, 1, action, server, server + "-serv")
		}
		await ns.sleep(60000 * SLEEP_TIME)
	}
}
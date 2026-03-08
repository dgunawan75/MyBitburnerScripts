function print_connect(ns, parents, dest) {
	var print_parents = ""
	for (let parent of parents){
		print_parents = print_parents + ";connect " + parent
	}
	ns.tprint(print_parents + ";connect " + dest)
}
/** @param {NS} ns */
export function super_connect(ns, dest){
	var servers = [["home", []]]
	var serv_set = ["home"]
	var i = 0
	while (i < servers.length) {
		var tuple = servers[i]
		let server = tuple[0]
		let parents = [...tuple[1]]
		if (server == dest){
			return parents
		}
		if (server != "home"){
			parents.push(server)
		}
		var s = ns.scan(server)
		for (var j in s) {
			var con = s[j]
			// check if we've seen this server
			if (serv_set.indexOf(con) < 0) {
				serv_set.push(con)
				servers.push([con, parents])
			}
		}
		i += 1
	}
}

export async function main(ns) {
	let dest = ns.args[0]
	let parents = super_connect(ns, dest)
	print_connect(ns, parents, dest)
}
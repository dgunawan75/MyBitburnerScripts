/** @param {NS} ns */
export async function main(ns) {
    // Matikan log default agar terminal tetap rapi
    ns.disableLog("scan");
    ns.disableLog("sleep");

    // Kumpulan solver (hasil adaptasi dari cct-apps.js dan script Python kita)
    const solvers = {
        "Find Largest Prime Factor": (data) => {
            let fac = 2;
            let n = data;
            while (n > (fac - 1) * (fac - 1)) {
                while (n % fac === 0) {
                    n = Math.round(n / fac);
                }
                ++fac;
            }
            return (n === 1 ? fac - 1 : n);
        },
        "Subarray with Maximum Sum": (data) => {
            const nums = data.slice();
            for (let i = 1; i < nums.length; i++) {
                nums[i] = Math.max(nums[i], nums[i] + nums[i - 1]);
            }
            return Math.max(...nums);
        },
        "Total Ways to Sum": (data) => {
            const ways = [1];
            ways.length = data + 1;
            ways.fill(0, 1);
            for (let i = 1; i < data; ++i) {
                for (let j = i; j <= data; ++j) {
                    ways[j] += ways[j - i];
                }
            }
            return ways[data];
        },
        "Total Ways to Sum II": (data) => {
            const n = data[0];
            const s = data[1];
            const ways = [1];
            ways.length = n + 1;
            ways.fill(0, 1);
            for (let i = 0; i < s.length; i++) {
                for (let j = s[i]; j <= n; j++) {
                    ways[j] += ways[j - s[i]];
                }
            }
            return ways[n];
        },
        "Spiralize Matrix": (data) => {
            const spiral = [];
            const m = data.length;
            const n = data[0].length;
            let u = 0;
            let d = m - 1;
            let l = 0;
            let r = n - 1;
            let k = 0;
            let done = false;
            while (!done) {
                // Up
                for (let col = l; col <= r; col++) {
                    spiral[k] = data[u][col];
                    ++k;
                }
                if (++u > d) { done = true; continue; }
                // Right
                for (let row = u; row <= d; row++) {
                    spiral[k] = data[row][r];
                    ++k;
                }
                if (--r < l) { done = true; continue; }
                // Down
                for (let col = r; col >= l; col--) {
                    spiral[k] = data[d][col];
                    ++k;
                }
                if (--d < u) { done = true; continue; }
                // Left
                for (let row = d; row >= u; row--) {
                    spiral[k] = data[row][l];
                    ++k;
                }
                if (++l > r) { done = true; continue; }
            }
            return spiral;
        },
        "Array Jumping Game": (data) => {
            const n = data.length;
            let i = 0;
            for (let reach = 0; i < n && i <= reach; ++i) {
                reach = Math.max(i + data[i], reach);
            }
            return i === n ? 1 : 0;
        },
        "Array Jumping Game II": (data) => {
            const n = data.length;
            let reach = 0;
            let jumps = 0;
            let lastJump = -1;
            while (reach < n - 1) {
                let jumpedFrom = -1;
                for (let i = reach; i > lastJump; i--) {
                    if (i + data[i] > reach) {
                        reach = i + data[i];
                        jumpedFrom = i;
                    }
                }
                if (jumpedFrom === -1) {
                    jumps = 0;
                    break;
                }
                lastJump = jumpedFrom;
                jumps++;
            }
            return jumps;
        },
        "Merge Overlapping Intervals": (data) => {
            const intervals = data.slice();
            intervals.sort((a, b) => {
                return a[0] - b[0];
            });
            const result = [];
            let start = intervals[0][0];
            let end = intervals[0][1];
            for (const interval of intervals) {
                if (interval[0] <= end) {
                    end = Math.max(end, interval[1]);
                } else {
                    result.push([start, end]);
                    start = interval[0];
                    end = interval[1];
                }
            }
            result.push([start, end]);
            return result;
        },
        "Generate IP Addresses": (data) => {
            const ret = [];
            for (let a = 1; a <= 3; ++a) {
                for (let b = 1; b <= 3; ++b) {
                    for (let c = 1; c <= 3; ++c) {
                        for (let d = 1; d <= 3; ++d) {
                            if (a + b + c + d === data.length) {
                                const A = parseInt(data.substring(0, a), 10);
                                const B = parseInt(data.substring(a, a + b), 10);
                                const C = parseInt(data.substring(a + b, a + b + c), 10);
                                const D = parseInt(data.substring(a + b + c, a + b + c + d), 10);
                                if (A <= 255 && B <= 255 && C <= 255 && D <= 255) {
                                    const ip = [A.toString(), ".", B.toString(), ".", C.toString(), ".", D.toString()].join("");
                                    if (ip.length === data.length + 3) {
                                        ret.push(ip);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return ret;
        },
        "Algorithmic Stock Trader I": (data) => {
            let maxCur = 0;
            let maxSoFar = 0;
            for (let i = 1; i < data.length; ++i) {
                maxCur = Math.max(0, (maxCur += data[i] - data[i - 1]));
                maxSoFar = Math.max(maxCur, maxSoFar);
            }
            return maxSoFar;
        },
        "Algorithmic Stock Trader II": (data) => {
            let profit = 0;
            for (let p = 1; p < data.length; ++p) {
                profit += Math.max(data[p] - data[p - 1], 0);
            }
            return profit;
        },
        "Algorithmic Stock Trader III": (data) => {
            let hold1 = Number.MIN_SAFE_INTEGER;
            let hold2 = Number.MIN_SAFE_INTEGER;
            let release1 = 0;
            let release2 = 0;
            for (const price of data) {
                release2 = Math.max(release2, hold2 + price);
                hold2 = Math.max(hold2, release1 - price);
                release1 = Math.max(release1, hold1 + price);
                hold1 = Math.max(hold1, price * -1);
            }
            return release2;
        },
        "Algorithmic Stock Trader IV": (data) => {
            const k = data[0];
            const prices = data[1];
            const len = prices.length;
            if (len < 2) return 0;
            if (k > len / 2) {
                let res = 0;
                for (let i = 1; i < len; ++i) {
                    res += Math.max(prices[i] - prices[i - 1], 0);
                }
                return res;
            }
            const hold = [];
            const rele = [];
            hold.length = k + 1;
            rele.length = k + 1;
            for (let i = 0; i <= k; ++i) {
                hold[i] = Number.MIN_SAFE_INTEGER;
                rele[i] = 0;
            }
            let cur;
            for (let i = 0; i < len; ++i) {
                cur = prices[i];
                for (let j = k; j > 0; --j) {
                    rele[j] = Math.max(rele[j], hold[j] + cur);
                    hold[j] = Math.max(hold[j], rele[j - 1] - cur);
                }
            }
            return rele[k];
        },
        "Minimum Path Sum in a Triangle": (data) => {
            const n = data.length;
            const dp = data[n - 1].slice();
            for (let i = n - 2; i > -1; --i) {
                for (let j = 0; j < data[i].length; ++j) {
                    dp[j] = Math.min(dp[j], dp[j + 1]) + data[i][j];
                }
            }
            return dp[0];
        },
        "Unique Paths in a Grid I": (data) => {
            const n = data[0];
            const m = data[1];
            const currentRow = [];
            currentRow.length = n;
            for (let i = 0; i < n; i++) {
                currentRow[i] = 1;
            }
            for (let row = 1; row < m; row++) {
                for (let i = 1; i < n; i++) {
                    currentRow[i] += currentRow[i - 1];
                }
            }
            return currentRow[n - 1];
        },
        "Unique Paths in a Grid II": (data) => {
            const obstacleGrid = [];
            obstacleGrid.length = data.length;
            for (let i = 0; i < obstacleGrid.length; ++i) {
                obstacleGrid[i] = data[i].slice();
            }
            for (let i = 0; i < obstacleGrid.length; i++) {
                for (let j = 0; j < obstacleGrid[0].length; j++) {
                    if (obstacleGrid[i][j] == 1) {
                        obstacleGrid[i][j] = 0;
                    } else if (i == 0 && j == 0) {
                        obstacleGrid[0][0] = 1;
                    } else {
                        obstacleGrid[i][j] = (i > 0 ? obstacleGrid[i - 1][j] : 0) + (j > 0 ? obstacleGrid[i][j - 1] : 0);
                    }
                }
            }
            return obstacleGrid[obstacleGrid.length - 1][obstacleGrid[0].length - 1];
        },
        "Shortest Path in a Grid": (data) => {
            const width = data[0].length;
            const height = data.length;
            const dstY = height - 1;
            const dstX = width - 1;

            const distance = new Array(height);
            const queue = [];

            for (let y = 0; y < height; y++) {
                distance[y] = new Array(width).fill(Infinity);
            }

            function validPosition(y, x) {
                return y >= 0 && y < height && x >= 0 && x < width && data[y][x] == 0;
            }

            function* neighbors(y, x) {
                if (validPosition(y - 1, x)) yield [y - 1, x];
                if (validPosition(y + 1, x)) yield [y + 1, x];
                if (validPosition(y, x - 1)) yield [y, x - 1];
                if (validPosition(y, x + 1)) yield [y, x + 1];
            }

            distance[0][0] = 0;
            queue.push([0, 0]);

            while (queue.length > 0) {
                const [y, x] = queue.shift();
                for (const [yN, xN] of neighbors(y, x)) {
                    if (distance[yN][xN] == Infinity) {
                        queue.push([yN, xN]);
                        distance[yN][xN] = distance[y][x] + 1;
                    }
                }
            }

            if (distance[dstY][dstX] == Infinity) return "";

            let path = "";
            let [yC, xC] = [dstY, dstX];
            while (xC != 0 || yC != 0) {
                const dist = distance[yC][xC];
                for (const [yF, xF] of neighbors(yC, xC)) {
                    if (distance[yF][xF] == dist - 1) {
                        path = (xC == xF ? (yC == yF + 1 ? "D" : "U") : (xC == xF + 1 ? "R" : "L")) + path;
                        [yC, xC] = [yF, xF];
                        break;
                    }
                }
            }
            return path;
        },
        "Sanitize Parentheses in Expression": (data) => {
            let left = 0;
            let right = 0;
            const res = [];

            for (let i = 0; i < data.length; ++i) {
                if (data[i] === "(") {
                    ++left;
                } else if (data[i] === ")") {
                    left > 0 ? --left : ++right;
                }
            }

            function dfs(pair, index, left, right, s, solution, res) {
                if (s.length === index) {
                    if (left === 0 && right === 0 && pair === 0) {
                        for (let i = 0; i < res.length; i++) {
                            if (res[i] === solution) return;
                        }
                        res.push(solution);
                    }
                    return;
                }

                if (s[index] === "(") {
                    if (left > 0) dfs(pair, index + 1, left - 1, right, s, solution, res);
                    dfs(pair + 1, index + 1, left, right, s, solution + s[index], res);
                } else if (s[index] === ")") {
                    if (right > 0) dfs(pair, index + 1, left, right - 1, s, solution, res);
                    if (pair > 0) dfs(pair - 1, index + 1, left, right, s, solution + s[index], res);
                } else {
                    dfs(pair, index + 1, left, right, s, solution + s[index], res);
                }
            }
            dfs(0, 0, left, right, data, "", res);
            return res;
        },
        "Find All Valid Math Expressions": (data) => {
            const num = data[0];
            const target = data[1];

            function helper(res, path, num, target, pos, evaluated, multed) {
                if (pos === num.length) {
                    if (target === evaluated) {
                        res.push(path);
                    }
                    return;
                }

                for (let i = pos; i < num.length; ++i) {
                    if (i != pos && num[pos] == "0") break;
                    const cur = parseInt(num.substring(pos, i + 1));

                    if (pos === 0) {
                        helper(res, path + cur, num, target, i + 1, cur, cur);
                    } else {
                        helper(res, path + "+" + cur, num, target, i + 1, evaluated + cur, cur);
                        helper(res, path + "-" + cur, num, target, i + 1, evaluated - cur, -cur);
                        helper(res, path + "*" + cur, num, target, i + 1, evaluated - multed + multed * cur, multed * cur);
                    }
                }
            }
            if (num == null || num.length === 0) return [];
            const result = [];
            helper(result, "", num, target, 0, 0, 0);
            return result;
        },
        "Proper 2-Coloring of a Graph": (data) => {
            const nodes = new Array(data[0]).fill(0).map(() => []);
            for (const e of data[1]) {
                nodes[e[0]].push(e[1]);
                nodes[e[1]].push(e[0]);
            }
            const solution = new Array(data[0]).fill(undefined);
            let oddCycleFound = false;
            const traverse = (index, color) => {
                if (oddCycleFound) return;
                if (solution[index] === color) return;
                if (solution[index] === (color ^ 1)) {
                    oddCycleFound = true;
                    return;
                }
                solution[index] = color;
                for (const n of nodes[index]) {
                    traverse(n, color ^ 1);
                }
            }
            while (!oddCycleFound && solution.some(e => e === undefined)) {
                traverse(solution.indexOf(undefined), 0);
            }
            if (oddCycleFound) return []; 
            return solution;
        },
        "Compression I: RLE Compression": (plain) => {
            let length = 0;
            let result = '';
            for (let i = 0; i < plain.length;) {
                let run_length = 1;
                while (i + run_length < plain.length && plain[i + run_length] === plain[i]) {
                    ++run_length;
                }
                i += run_length;

                while (run_length > 0) {
                    result += String(run_length > 9 ? 9 : run_length) + plain[i - 1];
                    run_length -= 9;
                    length += 2;
                }
            }
            return result;
        },
        "Compression II: LZ Decompression": (compr) => {
            // Porting dari script Python kita solve-lz-decomp.py
            let plain = "";
            for (let i = 0; i < compr.length;) {
                const length1 = parseInt(compr[i], 10);
                i++;
                if (length1 > 0) {
                    plain += compr.substring(i, i + length1);
                    i += length1;
                }
                if (i >= compr.length) break;
                const length2 = parseInt(compr[i], 10);
                i++;
                if (length2 > 0) {
                    const offset = parseInt(compr[i], 10);
                    i++;
                    for (let j = 0; j < length2; j++) {
                        plain += plain[plain.length - offset];
                    }
                }
            }
            return plain;
        },
        "Encryption I: Caesar Cipher": (data) => {
            const cipher = [...data[0]]
                .map((a) => (a === " " ? a : String.fromCharCode(((a.charCodeAt(0) - 65 - data[1] + 26) % 26) + 65)))
                .join("");
            return cipher;
        },
        "Encryption II: Vigenère Cipher": (data) => {
            const cipher = [...data[0]]
                .map((a, i) => {
                    return a === " "
                        ? a
                        : String.fromCharCode(((a.charCodeAt(0) - 2 * 65 + data[1].charCodeAt(i % data[1].length)) % 26) + 65);
                })
                .join("");
            return cipher;
        },
        "Largest Rectangle in a Matrix": (matrix) => {
            // Porting dari solve-largest-rect.py kita
            if (!matrix || !matrix[0]) return [];
            let rows = matrix.length;
            let cols = matrix[0].length;
            let max_area = 0;
            let best_corners = [];
            
            const prefix = Array.from({length: rows + 1}, () => new Array(cols + 1).fill(0));
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    prefix[r+1][c+1] = matrix[r][c] + prefix[r][c+1] + prefix[r+1][c] - prefix[r][c];
                }
            }
            
            function count_ones(r1, c1, r2, c2) {
                return prefix[r2+1][c2+1] - prefix[r1][c2+1] - prefix[r2+1][c1] + prefix[r1][c1];
            }

            for (let r1 = 0; r1 < rows; r1++) {
                for (let c1 = 0; c1 < cols; c1++) {
                    for (let r2 = r1; r2 < rows; r2++) {
                        for (let c2 = c1; c2 < cols; c2++) {
                            let area = (r2 - r1 + 1) * (c2 - c1 + 1);
                            if (area > max_area) {
                                if (count_ones(r1, c1, r2, c2) === 0) {
                                    max_area = area;
                                    best_corners = [[r1, c1], [r2, c2]];
                                }
                            }
                        }
                    }
                }
            }
            return best_corners;
        },
        "HammingCodes: Integer to Encoded Binary": (value) => {
            let binary = value.toString(2).split("");
            let enc = [0];
            let dataIdx = 0;
            for (let i = 1; dataIdx < binary.length; i++) {
                if ((i & (i - 1)) === 0) {
                    enc.push(0);
                } else {
                    enc.push(parseInt(binary[dataIdx]));
                    dataIdx++;
                }
            }
            for (let i = 1; i < enc.length; i++) {
                if ((i & (i - 1)) === 0) {
                    let parity = 0;
                    for (let j = i; j < enc.length; j++) {
                        if ((j & i) !== 0) {
                            parity ^= enc[j];
                        }
                    }
                    enc[i] = parity;
                }
            }
            let overallParity = 0;
            for (let i = 1; i < enc.length; i++) {
                overallParity ^= enc[i];
            }
            enc[0] = overallParity;
            return enc.join("");
        },
        "Compression III: LZ Compression": (plain) => {
            let cur_state = Array.from(Array(10), () => Array(10).fill(null));
            let new_state = Array.from(Array(10), () => Array(10));

            function set(state, i, j, str) {
                const current = state[i][j];
                if (current == null || str.length < current.length) {
                    state[i][j] = str;
                } else if (str.length === current.length && Math.random() < 0.5) {
                    state[i][j] = str;
                }
            }

            cur_state[0][1] = "";

            for (let i = 1; i < plain.length; ++i) {
                for (let row of new_state) row.fill(null);
                const c = plain[i];

                for (let len = 1; len <= 9; ++len) {
                    const string = cur_state[0][len];
                    if (string == null) continue;

                    if (len < 9) {
                        set(new_state, 0, len + 1, string);
                    } else {
                        set(new_state, 0, 1, string + "9" + plain.substring(i - 9, i) + "0");
                    }

                    for (let offset = 1; offset <= 9; ++offset) {
                        if (plain[i - offset] === c) {
                            set(new_state, offset, 1, string + len + plain.substring(i - len, i));
                        }
                    }
                }

                for (let offset = 1; offset <= 9; ++offset) {
                    for (let len = 1; len <= 9; ++len) {
                        const string = cur_state[offset][len];
                        if (string == null) continue;

                        if (plain[i - offset] === c) {
                            if (len < 9) {
                                set(new_state, offset, len + 1, string);
                            } else {
                                set(new_state, offset, 1, string + "9" + offset + "0");
                            }
                        }
                        set(new_state, 0, 1, string + len + offset);
                    }
                }

                let tmp = cur_state;
                cur_state = new_state;
                new_state = tmp;
            }

            let result = null;
            for (let len = 1; len <= 9; ++len) {
                let string = cur_state[0][len];
                if (string == null) continue;
                string += len + plain.substring(plain.length - len, plain.length);
                if (result == null || string.length < result.length) {
                    result = string;
                }
            }

            for (let offset = 1; offset <= 9; ++offset) {
                for (let len = 1; len <= 9; ++len) {
                    let string = cur_state[offset][len];
                    if (string == null) continue;
                    string += len + "" + offset;
                    if (result == null || string.length < result.length) {
                        result = string;
                    }
                }
            }

            return result ?? "";
        },
        "Square Root": (data) => {
            let n = BigInt(data);
            if (n < 0n) return "ERROR";
            if (n === 0n) return "0";
            if (n === 1n) return "1";

            let x0 = n / 2n;
            let x1 = (x0 + n / x0) / 2n;
            while (x1 < x0) {
                x0 = x1;
                x1 = (x0 + n / x0) / 2n;
            }
            
            let diff1 = n - (x0 * x0);
            let diff2 = ((x0 + 1n) * (x0 + 1n)) - n;
            if (diff2 < diff1) {
                x0 += 1n;
            }
            
            return x0.toString();
        },
        "HammingCodes: Encoded Binary to Integer": (data) => {
            let enc = data.split("").map(Number);
            let errorPosition = 0;
            
            // Kalkulasi posisi error (XOR dari semua index bernilai 1)
            for (let i = 1; i < enc.length; i++) {
                if (enc[i] === 1) {
                    errorPosition ^= i;
                }
            }
            
            // Jika ada error (posisi != 0), perbaiki bit tersebut
            if (errorPosition !== 0) {
                enc[errorPosition] = enc[errorPosition] === 0 ? 1 : 0;
            }
            
            // Ekstrak bit data murni (index yang bukan power of 2)
            let binaryStr = "";
            for (let i = 1; i < enc.length; i++) {
                if ((i & (i - 1)) !== 0) {
                    binaryStr += enc[i];
                }
            }
            
            
            // Konversi ke desimal
            return parseInt(binaryStr, 2);
        },
        "Total Number of Primes": (data) => {
            let start = Math.min(data[0], data[1]);
            let end = Math.max(data[0], data[1]);
            
            // Gunakan Uint8Array untuk efisiensi memori
            let isPrime = new Uint8Array(end + 1);
            isPrime.fill(1);
            isPrime[0] = 0;
            if (end >= 1) isPrime[1] = 0;
            
            for (let p = 2; p * p <= end; p++) {
                if (isPrime[p]) {
                    for (let i = p * p; i <= end; i += p) {
                        isPrime[i] = 0;
                    }
                }
            }
            
            let count = 0;
            for (let i = start; i <= end; i++) {
                if (isPrime[i]) count++;
            }
            
            return count;
        }
    };

    ns.tprint("🤖 [AutoCCT] Daemon solver kontrak diinisialisasi. Berjalan di background...");

    // Loop tanpa henti untuk terus memantau seluruh server
    while (true) {
        const servers = new Set(["home"]);
        const queue = ["home"];
        let solvedCount = 0;

        // BFS Scanner
        for (let server of queue) {
            let adjacent = ns.scan(server);
            for (let next of adjacent) {
                if (!servers.has(next)) {
                    servers.add(next);
                    queue.push(next);
                }
            }
        }

        // Crack .cct di tiap server
        for (let server of servers) {
            let files = ns.ls(server, ".cct");
            for (let file of files) {
                let type = ns.codingcontract.getContractType(file, server);
                let data = ns.codingcontract.getData(file, server);
                
                if (solvers[type]) {
                    ns.print(`Mencoba menyelesaikan: ${file} di ${server} (${type})`);
                    try {
                        let answer = solvers[type](data);
                        let reward = ns.codingcontract.attempt(answer, file, server);
                        
                        if (reward) {
                            ns.tprint(`✅ Sukses Hacking [${type}] di ${server}`);
                            ns.tprint(`   => Reward: ${reward}`);
                            solvedCount++;
                        } else {
                            // Cukup diprint di script log saja (bukan terminal) agar tidak nyepam jika benar-benar gagal
                            ns.print(`❌ GAGAL memecahkan [${type}] di ${server}. Kontrak meledak.`);
                        }
                    } catch (e) {
                        ns.print(`⚠️ Error eksekusi algoritma [${type}]: ${e}`);
                    }
                } else {
                    ns.print(`⚠️ Algoritma tidak tersedia untuk: "${type}" di ${server}`);
                }
            }
        }
        
        // Cek secara berkala setiap 2 menit (120 detik)
        await ns.sleep(120000); 
    }
}

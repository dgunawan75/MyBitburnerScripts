def addOperators(num, target):
    res = []
    
    def backtrack(i, path, value, last):
        if i == len(num):
            if value == target:
                res.append(path)
            return
            
        for j in range(i, len(num)):
            # Mencegah angka dengan leading zero (misal '05')
            if j > i and num[i] == '0':
                break
                
            curr_str = num[i:j+1]
            curr_num = int(curr_str)
            
            if i == 0:
                # Angka pertama, belum ada operator
                backtrack(j + 1, path + curr_str, curr_num, curr_num)
            else:
                # Operator '+'
                backtrack(j + 1, path + "+" + curr_str, value + curr_num, curr_num)
                # Operator '-'
                backtrack(j + 1, path + "-" + curr_str, value - curr_num, -curr_num)
                # Operator '*' (perhatikan prioritas matematika, kita harus mengembalikan nilai penambahan/pengurangan sebelumnya)
                backtrack(j + 1, path + "*" + curr_str, value - last + (last * curr_num), last * curr_num)

    backtrack(0, "", 0, 0)
    return res

if __name__ == "__main__":
    digits = "976859"
    target = -55
    result = addOperators(digits, target)
    
    # Cetak dalam format array string
    print(f'[{", ".join([repr(x) for x in result])}]')

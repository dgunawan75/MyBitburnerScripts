def removeInvalidParentheses(s):
    def is_valid(s):
        count = 0
        for char in s:
            if char == '(':
                count += 1
            elif char == ')':
                count -= 1
            if count < 0:
                return False
        return count == 0

    # Hitung jumlah kurung buka dan tutup yang harus dibuang
    left_removed = 0
    right_removed = 0
    for char in s:
        if char == '(':
            left_removed += 1
        elif char == ')':
            if left_removed > 0:
                left_removed -= 1
            else:
                right_removed += 1

    valid_expressions = set()

    def backtrack(index, current_string, left_count, right_count, left_rem, right_rem):
        if index == len(s):
            if left_rem == 0 and right_rem == 0 and is_valid(current_string):
                valid_expressions.add(current_string)
            return

        char = s[index]
        
        # Pilihan 1: Buang karakter saat ini jika itu adalah kurung yang bisa dibuang
        if char == '(' and left_rem > 0:
            backtrack(index + 1, current_string, left_count, right_count, left_rem - 1, right_rem)
        elif char == ')' and right_rem > 0:
            backtrack(index + 1, current_string, left_count, right_count, left_rem, right_rem - 1)
            
        # Pilihan 2: Simpan karakter saat ini
        if char != '(' and char != ')':
            # Jika itu huruf, kita harus selalu menyimpannya
            backtrack(index + 1, current_string + char, left_count, right_count, left_rem, right_rem)
        elif char == '(':
            backtrack(index + 1, current_string + char, left_count + 1, right_count, left_rem, right_rem)
        elif char == ')' and left_count > right_count:
            # Hanya simpan kurung tutup jika jumlahnya tidak melebihi kurung buka yang sudah disimpan
            backtrack(index + 1, current_string + char, left_count, right_count + 1, left_rem, right_rem)

    backtrack(0, "", 0, 0, left_removed, right_removed)

    if not valid_expressions:
        return [""]
    return list(valid_expressions)

if __name__ == "__main__":
    s = "())))a())a))a"
    result = removeInvalidParentheses(s)
    # Print menggunakan json.dumps agar selalu menggunakan kutip ganda (")
    import json
    print(json.dumps(result))

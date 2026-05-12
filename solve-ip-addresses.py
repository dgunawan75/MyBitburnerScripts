def generate_ip_addresses(s):
    res = []
    
    def backtrack(start_index, current_parts):
        # Jika sudah ada 4 bagian
        if len(current_parts) == 4:
            # Jika semua karakter sudah terpakai
            if start_index == len(s):
                res.append(".".join(current_parts))
            return
            
        # Coba ambil 1 sampai 3 karakter untuk bagian IP berikutnya
        for i in range(start_index, min(start_index + 3, len(s))):
            part = s[start_index:i+1]
            
            # Pengecekan aturan IP
            if len(part) > 1 and part[0] == '0':
                continue # Tidak boleh ada leading zero (misal '01')
            if int(part) > 255:
                continue # Maksimal 255
                
            current_parts.append(part)
            backtrack(i + 1, current_parts)
            current_parts.pop()

    backtrack(0, [])
    return res

if __name__ == "__main__":
    s = "52144224175"
    result = generate_ip_addresses(s)
    # Output sebagai array string seperti di game
    print(f'[{", ".join([repr(ip) for ip in result])}]')

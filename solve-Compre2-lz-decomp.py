def lz_decompression(encoded):
    i = 0
    out = ""
    chunk_type = 1
    
    while i < len(encoded):
        L = int(encoded[i])
        i += 1
        
        if L == 0:
            # Chunk panjang 0 artinya kita langsung berganti ke tipe chunk lainnya
            chunk_type = 3 - chunk_type
            continue
            
        if chunk_type == 1:
            # Tipe 1: Copy langsung sepanjang L karakter
            chars = encoded[i : i + L]
            out += chars
            i += L
        else:
            # Tipe 2: Copy dari karakter X posisi sebelumnya sebanyak L kali
            X = int(encoded[i])
            i += 1
            for _ in range(L):
                out += out[-X]
                
        # Selalu berganti tipe chunk setelah selesai (Tipe 1 -> 2, Tipe 2 -> 1)
        chunk_type = 3 - chunk_type
        
    return out

if __name__ == "__main__":
    encoded_string = "9ub46nPk6g376ZghYJJ3326Y971F2276YEOHM4447k64k6rX"
    decoded = lz_decompression(encoded_string)
    print(f"Decoded String: {decoded}")

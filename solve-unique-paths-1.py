import math

def unique_paths(m, n):
    # Rumusnya adalah kombinasi (m-1 + n-1) C (m-1)
    # Ini karena kita harus bergerak (m-1) langkah ke bawah dan (n-1) langkah ke kanan.
    # Total langkah selalu (m-1) + (n-1).
    return math.comb(m - 1 + n - 1, m - 1)

if __name__ == "__main__":
    m = 3
    n = 14
    result = unique_paths(m, n)
    print(f"Total Unique Paths: {result}")

def caesar_cipher_left_shift(text, shift):
    result = ""
    for char in text:
        if char.isalpha():
            # A = 65, Z = 90
            # Rumus left shift: (Posisi huruf - Shift) % 26
            shifted = (ord(char) - 65 - shift) % 26 + 65
            result += chr(shifted)
        else:
            result += char
    return result

if __name__ == "__main__":
    plaintext = "MOUSE LOGIN PASTE FLASH ARRAY"
    shift = 24
    result = caesar_cipher_left_shift(plaintext, shift)
    print(f"Ciphertext: {result}")

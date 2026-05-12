def rle_encode(data):
    """
    Encode string using Run-Length Encoding (RLE) with max run length 9.
    
    Args:
        data (str): Input string to encode
    
    Returns:
        str: RLE encoded string
    """
    if not data:
        return ""
    
    encoded = []
    count = 1
    current_char = data[0]
    
    for i in range(1, len(data)):
        if data[i] == current_char and count < 9:
            count += 1
        else:
            # Output current run
            encoded.append(f"{count}{current_char}")
            # Start new run
            current_char = data[i]
            count = 1
    
    # Don't forget the last run
    encoded.append(f"{count}{current_char}")
    
    return "".join(encoded)


def rle_decode(encoded_data):
    """
    Decode RLE encoded string back to original.
    
    Args:
        encoded_data (str): RLE encoded string
    
    Returns:
        str: Decoded original string
    """
    decoded = []
    i = 0
    
    while i < len(encoded_data):
        # Get the count (single digit)
        count = int(encoded_data[i])
        # Get the character
        char = encoded_data[i + 1]
        # Append char count times
        decoded.append(char * count)
        i += 2
    
    return "".join(decoded)


def main():
    """Test the RLE functions with the given example."""
    # Test with the provided example
    original = "dIIllHHqqz77777777kllllllllj000000000000PPPPPPPPPPPABBBBlllMMjjfffffffffffNNNddddddddd"
    
    print("Original string:")
    print(original)
    print(f"Length: {len(original)}")
    print()
    
    # Encode
    encoded = rle_encode(original)
    print("Encoded (RLE-1):")
    print(encoded)
    print(f"Length: {len(encoded)}")
    print()
    
    # Decode to verify
    decoded = rle_decode(encoded)
    print("Decoded string:")
    print(decoded)
    print(f"Length: {len(decoded)}")
    print()
    
    # Verify
    if decoded == original:
        print("✓ Encoding/decoding successful!")
    else:
        print("✗ Error: Decoded string doesn't match original")
    
    print("\n" + "="*50 + "\n")
    
    # Additional test cases
    test_cases = [
        "AAAAA",           # 5 A's -> 5A
        "AAAAAAAAAA",      # 10 A's -> 9A1A
        "ABC",             # 1A1B1C
        "111222333",       # 31 32 33
        "aaaaaaaabbb",     # 8a3b
        "xxxxxxxxxx",      # 10 x's -> 9x1x
        "a",               # 1a - single character
        "",                # Empty string
    ]
    
    for test in test_cases:
        enc = rle_encode(test)
        dec = rle_decode(enc)
        status = "✓" if dec == test else "✗"
        print(f"{status} Input: '{test}' -> Encoded: '{enc}' -> Decoded: '{dec}'")


if __name__ == "__main__":
    main()
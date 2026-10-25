const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generateReadablePassword(length = 8) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let value = "";
  for (const byte of bytes) value += ALPHABET[byte % ALPHABET.length]!;
  return value;
}

import { randomInt } from 'node:crypto';

export function generateTestPassword(length = 12): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*_-+='; // Restricted to common form-safe symbols
  const allChars = upper + lower + numbers + symbols;

  // Guarantee at least one character from each required set
  const required = [
    upper[randomInt(upper.length)],
    lower[randomInt(lower.length)],
    numbers[randomInt(numbers.length)],
    symbols[randomInt(symbols.length)],
  ];

  // Fill the rest of the password length
  const remainingLength = Math.max(0, length - required.length);
  const rest = Array.from({ length: remainingLength }, () => allChars[randomInt(allChars.length)]);

  // Shuffle the characters using Fisher-Yates so required types aren't always at the start
  const combined = [...required, ...rest];
  for (let i = combined.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }

  return combined.join('');
}

"use strict";
/**
 * Fractional Indexing implementation
 * Generates lexicographically orderable string keys between two arbitrary keys.
 * Base 62 character set: 0-9, A-Z, a-z
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateKeyBetween = generateKeyBetween;
const BASE_DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function generateKeyBetween(before, after) {
    if (!before && !after) {
        return 'U'; // middle key in base62
    }
    if (!before && after) {
        // Generate key strictly smaller than `after`
        return generateKeyBefore(after);
    }
    if (before && !after) {
        // Generate key strictly greater than `before`
        return generateKeyAfter(before);
    }
    if (before && after) {
        if (before >= after) {
            // Edge case fallback if out of order
            return before + 'V';
        }
        return generateMidpoint(before, after);
    }
    return 'U';
}
function generateKeyBefore(key) {
    const firstChar = key[0];
    const idx = BASE_DIGITS.indexOf(firstChar);
    if (idx > 0) {
        const prevChar = BASE_DIGITS[Math.floor(idx / 2)];
        return prevChar;
    }
    // If first char is '0', append or prepend
    return '0' + generateKeyBefore(key.slice(1) || 'U');
}
function generateKeyAfter(key) {
    const lastChar = key[key.length - 1];
    const idx = BASE_DIGITS.indexOf(lastChar);
    if (idx < BASE_DIGITS.length - 1) {
        const nextChar = BASE_DIGITS[idx + Math.ceil((BASE_DIGITS.length - 1 - idx) / 2)];
        return key.slice(0, -1) + nextChar;
    }
    return key + 'V';
}
function generateMidpoint(before, after) {
    let i = 0;
    let prefix = '';
    while (i < before.length || i < after.length) {
        const charBefore = before[i] || '0';
        const charAfter = after[i] || 'z';
        const indexBefore = BASE_DIGITS.indexOf(charBefore);
        const indexAfter = BASE_DIGITS.indexOf(charAfter);
        if (indexBefore === indexAfter) {
            prefix += charBefore;
            i++;
            continue;
        }
        if (indexAfter - indexBefore > 1) {
            const midIndex = Math.floor((indexBefore + indexAfter) / 2);
            return prefix + BASE_DIGITS[midIndex];
        }
        else {
            // Adjacent characters, e.g. 'A' and 'B'.
            prefix += charBefore;
            // We need to look deeper into `before` or append midpoint
            const remainingBefore = before.slice(i + 1);
            return prefix + generateKeyAfter(remainingBefore || '0');
        }
    }
    return before + 'V';
}

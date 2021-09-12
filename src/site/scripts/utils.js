/**
 * @param { number } a
 */
export function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

/**
 * @param { number } n 
 * @param { number } b0
 * @param { number } [b1]
 */
export function mod(n, b0, b1) {
  if (b1 == null) {
    return (n % b0 + b0) % b0
  } else {
    const range = b1 - b0
    return mod(n - b0, range) + b0
  }
}
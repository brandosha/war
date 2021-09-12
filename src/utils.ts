export function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

export function mod(n: number, b0: number, b1?: number) {
  if (b1 == null) {
    return (n % b0 + b0) % b0
  } else {
    const range = b1 - b0
    return mod(n - b0, range) + b0
  }
}
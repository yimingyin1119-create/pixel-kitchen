// Names match when they are equal after trimming and ignoring case ("鸡蛋 " = "鸡蛋", "Tofu" = "tofu").
export function sameName(a, b) {
  return String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
}

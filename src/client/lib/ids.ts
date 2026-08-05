export function freshId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `p-${Math.random().toString(36).slice(2, 10)}`;
}

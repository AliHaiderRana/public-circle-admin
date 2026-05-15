export function formatByteUnit(bytes: number): string {
  const units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let value = Math.max(0, Number(bytes) || 0);
  let index = 0;

  while (value >= 1000 && index < units.length - 1) {
    value /= 1000;
    index += 1;
  }

  return `${value.toFixed(2)} ${units[index]}`;
}

export function adjacentFile(
  files: string[],
  currentFile: string,
  direction: -1 | 1
): string | undefined {
  if (files.length === 0) return undefined;
  const currentIndex = files.indexOf(currentFile);
  if (currentIndex < 0) return direction === 1 ? files[0] : files.at(-1);
  return files[(currentIndex + direction + files.length) % files.length];
}
import { Range } from "vscode-languageserver";

export function flatMap<T, U>(f: (a: T) => U[], list: T[]): U[] {
  return list.reduce<U[]>((acc, item) => acc.concat(f(item)), []);
}

export function formatError(message: string, err: any): string {
  if (err instanceof Error) {
    let error = err;
    return `${message}: ${error.message}\n${error.stack}`;
  } else if (typeof err === "string") {
    return `${message}: ${err}`;
  } else if (err) {
    return `${message}: ${err.toString()}`;
  }
  return message;
}

export function debounce<T extends any[]>(
  f: ((...args: T) => void),
  delay: number,
) {
  let timeout: NodeJS.Timeout;

  return (...args: T) => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        f(...args);
      }, delay);
    } else {
      f(...args);
    }
  };
}

interface Options {
  /** looks like the character is not sent when asking for code action.. */
  ignoreCharacters: boolean;
}
export function rangeOverlaps(
  range1: Range,
  range2: Range,
  options: Options = { ignoreCharacters: false },
): boolean {
  const overlapsLines =
    (range1.start.line >= range2.start.line &&
      range1.end.line <= range2.end.line) ||
    (range1.start.line >= range2.start.line &&
      range1.start.line <= range2.end.line) ||
    (range1.end.line <= range2.end.line &&
      range1.end.line >= range2.start.line);

  if (options.ignoreCharacters) {
    return overlapsLines;
  }

  return (
    overlapsLines &&
    ((range1.start.character >= range2.start.character &&
      range1.end.character <= range2.end.character) ||
      (range1.start.character >= range2.start.character &&
        range1.start.character <= range2.end.character) ||
      (range1.end.character <= range2.end.character &&
        range1.end.character >= range2.start.character))
  );
}

import { Range } from "vscode-languageserver";
import { rangeOverlaps } from "./utils";

describe("Range overlaps", () => {
  test.each<any>([
    ["[(2,0) (2,0)]", "[(1,0) (4,0)]", true],
    ["[(2,0) (2,0)]", "[(3,0) (4,0)]", false],
    ["[(2,0) (2,0)]", "[(1,0) (1,0)]", false],
    ["[(2,0) (2,0)]", "[(1,0) (2,0)]", true],
    ["[(2,0) (2,0)]", "[(2,0) (3,0)]", true],
    ["[(3,0) (5,0)]", "[(2,0) (4,0)]", true],
    ["[(1,0) (3,0)]", "[(2,0) (4,0)]", true],
    ["[(2,15) (2,16)]", "[(2,10) (2,20)]", true],
    ["[(2,15) (2,21)]", "[(2,10) (2,20)]", true],
    ["[(2,5) (2,16)]", "[(2,10) (2,20)]", true],
    ["[(2,5) (2,8)]", "[(2,10) (2,20)]", false],
    ["[(2,21) (2,22)]", "[(2,10) (2,20)]", false],
  ])("overlaps(%s, %s) -> %p", (range1, range2, expected) => {
    // when
    const result = rangeOverlaps(toRange(range1), toRange(range2));

    // then
    expect(result).toBe(expected);
  });
});

function toRange(rangeStr: string): Range {
  const res = /\[\((\d+),(\d+)\) \((\d+),(\d+)\)\]/.exec(rangeStr);
  if (!res) {
    throw new Error(`${rangeStr} is not a range`);
  }
  return {
    start: { line: +res[1], character: +res[2] },
    end: { line: +res[3], character: +res[4] },
  };
}

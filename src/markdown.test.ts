import { toAnnotation } from "./markdown";

describe("Annotation markup", () => {
  test("Annotates markdown text", async () => {
    expect(
      toAnnotation("This is a document that supports **bold** text!"),
    ).toEqual([
      { text: "This is a document that supports " },
      { markup: "**" },
      { text: "bold" },
      { markup: "**" },
      { text: " text!" },
    ]);
  });
});

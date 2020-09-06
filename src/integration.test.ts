import { initLanguageTool, stopLanguageTool } from "./language_tool";
import { TextDocument } from "vscode-languageserver-textdocument";
import { getDiagnostics } from "./features";

jest.setTimeout(30000);

describe("Check plain text", () => {
  beforeAll(() => initLanguageTool());
  afterAll(() => stopLanguageTool());

  test("should diagnose one error", async () => {
    // given
    const text = "Hello world! How are you todday?\nIt make sense.";

    const document = TextDocument.create("file.md", "markdown", 1, text);

    // when
    const diagnostics = await getDiagnostics(document);

    // then
    expect(diagnostics).toEqual([
      expect.objectContaining({
        message: "Possible spelling mistake found",
        range: {
          start: { character: 25, line: 0 },
          end: { character: 31, line: 0 },
        },
      }),
      expect.objectContaining({
        message: 'Did you mean "makes"?',
        range: {
          start: { character: 3, line: 1 },
          end: { character: 7, line: 1 },
        },
      }),
    ]);
  });
});

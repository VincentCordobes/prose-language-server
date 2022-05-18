import { initLanguageTool, stopLanguageTool } from "./language_tool";
import { TextDocument } from "vscode-languageserver-textdocument";
import { getDiagnostics } from "./features";

jest.setTimeout(30000);

describe.only("Check text", () => {
  beforeAll(() => initLanguageTool());
  afterAll(() => stopLanguageTool());

  describe("Plain text", () => {
    test("should diagnose one error", async () => {
      // given
      const text = "Hello world! How are you todday?\nIt make sense.";
      const document = TextDocument.create("file.md", "markdown", 1, text);

      // when
      const diagnostics = await getDiagnostics(document);

      // then
      expect(diagnostics).toEqual([
        expect.objectContaining({
          message: "Possible spelling mistake found.",
          range: {
            start: { character: 25, line: 0 },
            end: { character: 31, line: 0 },
          },
        }),
        expect.objectContaining({
          message: "After ‘It’, use the third-person verb form “makes”.",
          range: {
            start: { character: 3, line: 1 },
            end: { character: 7, line: 1 },
          },
        }),
      ]);
    });
  });

  describe("Check markdown", () => {
    test("Handle bold and italic markup with no errors", async () => {
      // given
      const text = "Hello **world**, this is _good_!";
      const document = TextDocument.create("file.md", "markdown", 1, text);
      // when
      const diagnostics = await getDiagnostics(document);
      // then
      expect(diagnostics).toHaveLength(0);
    });

    test("Emphasis", async () => {
      // given
      const text = `Some _emphasis_ here!
How are you doiing?`;
      const document = TextDocument.create("file.md", "markdown", 1, text);
      // when
      const diagnostics = await getDiagnostics(document);
      // then
      expect(diagnostics[0].range).toEqual({
        start: {
          line: 1,
          character: 12,
        },
        end: {
          line: 1,
          character: 18,
        },
      });
    });

    test("Nested emphasis", async () => {
      // given
      const text = `_This is some **nested stuff here**.
How are you doiing?_`;
      const document = TextDocument.create("file.md", "markdown", 1, text);
      // when
      const diagnostics = await getDiagnostics(document);
      // then
      expect(diagnostics[0].range).toEqual({
        start: {
          line: 1,
          character: 12,
        },
        end: {
          line: 1,
          character: 18,
        },
      });
    });

    test("Link", async () => {
      // given
      const text = `Hello world, here are some [links](https://github.com/djsflkjf).
How are you doiing?`;
      const document = TextDocument.create("file.md", "markdown", 1, text);
      // when
      const diagnostics = await getDiagnostics(document);
      // then
      expect(diagnostics[0].range).toEqual({
        start: {
          line: 1,
          character: 12,
        },
        end: {
          line: 1,
          character: 18,
        },
      });
    });

    test("Link with nested markup", async () => {
      // given
      const text = `Hello world, here are some [links with some **bold that arre checked** in it](jfdslkjflds).`;
      const document = TextDocument.create("file.md", "markdown", 1, text);
      // when
      const diagnostics = await getDiagnostics(document);
      // then
      expect(diagnostics[0].range).toEqual({
        start: {
          line: 0,
          character: 56,
        },
        end: {
          line: 0,
          character: 60,
        },
      });
    });

    test("Code span should be ignored", async () => {
      // given
      const text = "This is good but `lfskdjf` is farrr better.";
      const document = TextDocument.create("file.md", "markdown", 1, text);
      // when
      const diagnostics = await getDiagnostics(document);
      // then
      expect(diagnostics[0].range).toEqual({
        start: {
          line: 0,
          character: 30,
        },
        end: {
          line: 0,
          character: 35,
        },
      });
    });

    test("Soft line break", async () => {
      // given
      const document = TextDocument.create(
        "file.md",
        "markdown",
        1,
        `Hi,
How are you doiing?`,
      );
      // when
      const diagnostics = await getDiagnostics(document);
      expect(diagnostics[0].range).toEqual({
        start: {
          line: 1,
          character: 12,
        },
        end: {
          line: 1,
          character: 18,
        },
      });
    });

    test("Paragraph with blank lines in between", async () => {
      // given
      const text = `Hi,

How are you doiing?`;
      const document = TextDocument.create("file.md", "markdown", 1, text);
      // when
      const diagnostics = await getDiagnostics(document);
      // then
      expect(diagnostics[0].range).toEqual({
        start: {
          line: 2,
          character: 12,
        },
        end: {
          line: 2,
          character: 18,
        },
      });
    });

    test("Paragraph when with blank lines before", async () => {
      // given
      const text = `

How are you doiing?`;
      const document = TextDocument.create("file.md", "markdown", 1, text);
      // when
      const diagnostics = await getDiagnostics(document);
      // then
      expect(diagnostics[0].range).toEqual({
        start: {
          line: 2,
          character: 12,
        },
        end: {
          line: 2,
          character: 18,
        },
      });
    });

    test("Codeblock", async () => {
      // given
      const text = `
This is a code block:
\`\`\`
sldkjflsdk
\`\`\`
How are you doiing?
  `;
      const document = TextDocument.create("file.md", "markdown", 1, text);

      // when
      const diagnostics = await getDiagnostics(document);

      // then
      expect(diagnostics[0].range).toEqual({
        start: {
          line: 5,
          character: 12,
        },
        end: {
          line: 5,
          character: 18,
        },
      });
    });

    test("Strikethrough", async () => {
      // given
      const text = "How are you ~~doing~~ doiing?";
      const document = TextDocument.create("file.md", "markdown", 1, text);

      // when
      const diagnostics = await getDiagnostics(document);

      // then
      expect(diagnostics[0].range).toEqual({
        start: {
          line: 0,
          character: 22,
        },
        end: {
          line: 0,
          character: 28,
        },
      });
    });

    test("Strikethrough with nested markup", async () => {
      // given
      const text =
        "Hello world, here are some ~~`strikethrough` with some **bold that arre checked** in it~~";
      const document = TextDocument.create("file.md", "markdown", 1, text);
      // when
      const diagnostics = await getDiagnostics(document);
      // then
      expect(diagnostics[0].range).toEqual({
        start: {
          line: 0,
          character: 67,
        },
        end: {
          line: 0,
          character: 71,
        },
      });
    });

    test("Tight list", async () => {
      // given
      const text = `
This is a list:
- how are you **doiing**?
- second item
  a little special

This is the end of this list.
How are you doiing?`;

      const document = TextDocument.create("file.md", "markdown", 1, text);
      // when
      const diagnostics = await getDiagnostics(document);
      // then
      expect(diagnostics[0].range).toEqual({
        start: {
          line: 2,
          character: 16,
        },
        end: {
          line: 2,
          character: 22,
        },
      });
      expect(diagnostics[1].range).toEqual({
        start: {
          line: 7,
          character: 12,
        },
        end: {
          line: 7,
          character: 18,
        },
      });
    });

    test("Loose list", async () => {
      // given
      const text = `
This is a list:
- how are you **doiing**?

- second item

This is the end of this list.
How are you doiing?`;

      const document = TextDocument.create("file.md", "markdown", 1, text);
      // when
      const diagnostics = await getDiagnostics(document);
      // then
      expect(diagnostics[0].range).toEqual({
        start: {
          line: 2,
          character: 16,
        },
        end: {
          line: 2,
          character: 22,
        },
      });
      expect(diagnostics[1].range).toEqual({
        start: {
          line: 7,
          character: 12,
        },
        end: {
          line: 7,
          character: 18,
        },
      });
    });

    test("Heading", async () => {
      // given
      const text = `
# This is a heading


## With a sub-heading
### How are you doiing ?

Here are some content.
How are you doiing?`;

      const document = TextDocument.create("file.md", "markdown", 1, text);
      // when
      const diagnostics = await getDiagnostics(document);
      // then
      expect(diagnostics[0].range).toEqual({
        start: {
          line: 5,
          character: 16,
        },
        end: {
          line: 5,
          character: 22,
        },
      });
      expect(diagnostics[1].range).toEqual({
        start: {
          line: 8,
          character: 12,
        },
        end: {
          line: 8,
          character: 18,
        },
      });
    });

    test("Email autolink", async () => {
      // given
      const text = `
This is a heading   
=================

How are you doiing?`;

      const document = TextDocument.create("file.md", "markdown", 1, text);
      // when
      const diagnostics = await getDiagnostics(document);
      // then
      expect(diagnostics[0].range).toEqual({
        start: {
          line: 4,
          character: 12,
        },
        end: {
          line: 4,
          character: 18,
        },
      });
    });

    test("Trailing whitespace", async () => {
      // given
      const text = `
# This is a heading   

How are you doiing?`;

      const document = TextDocument.create("file.md", "markdown", 1, text);
      // when
      const diagnostics = await getDiagnostics(document);
      // then
      expect(diagnostics[0].range).toEqual({
        start: {
          line: 3,
          character: 12,
        },
        end: {
          line: 3,
          character: 18,
        },
      });
    });

    test("Block quote", async () => {
      // given
      const text = `
> This is a block quote
> How are you doiing?

That's niice!`;

      const document = TextDocument.create("file.md", "markdown", 1, text);
      // when
      const diagnostics = await getDiagnostics(document);
      // then
      expect(diagnostics[0].range).toEqual({
        start: {
          line: 2,
          character: 14,
        },
        end: {
          line: 2,
          character: 20,
        },
      });
    });

    test("Uri autolink", async () => {
      // given
      const text = `
This is a link.
https://www.google.com/

How are you doiing?`;

      const document = TextDocument.create("file.md", "markdown", 1, text);
      // when
      const diagnostics = await getDiagnostics(document);
      // then
      expect(diagnostics[0].range).toEqual({
        start: {
          line: 4,
          character: 12,
        },
        end: {
          line: 4,
          character: 18,
        },
      });
    });

    test("Email autolink", async () => {
      // given
      const text = `
This is a link.
toto@gmail.com

How are you doiing?`;

      const document = TextDocument.create("file.md", "markdown", 1, text);
      // when
      const diagnostics = await getDiagnostics(document);
      // then
      expect(diagnostics[0].range).toEqual({
        start: {
          line: 4,
          character: 12,
        },
        end: {
          line: 4,
          character: 18,
        },
      });
    });
  });
});

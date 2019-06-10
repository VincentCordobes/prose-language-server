#!/usr/bin/env node

import {
  createConnection,
  TextDocuments,
  TextDocumentPositionParams,
  Hover,
  CompletionItem,
  StreamMessageReader,
  StreamMessageWriter,
  TextDocument,
  Diagnostic,
  CodeActionParams,
  DiagnosticRelatedInformation,
  CodeAction,
  CodeActionKind,
} from "vscode-languageserver";
import axios from "axios";

import { flatMap, formatError, debounce, rangeOverlaps } from "./utils";
import { LanguageToolResponse } from "src/language-tool-types";

const connection = createConnection(
  new StreamMessageReader(process.stdin),
  new StreamMessageWriter(process.stdout),
);

console.log = connection.console.log.bind(connection.console);
console.error = connection.console.error.bind(connection.console);

process.on("unhandledRejection", (e: any) => {
  connection.console.error(formatError(`Unhandled exception`, e));
});

const documents = new TextDocuments();

documents.listen(connection);

connection.onShutdown(() => {
  // clean some stuff
});

// const nls = spawn("languagetool-server");
//
// nls.stdout.setEncoding("utf-8");
// nls.stdout.on("data", data => {
//   console.log(data);
// });
//
// nls.stderr.setEncoding("utf-8");
// nls.stderr.on("data", data => {
//   console.log(data);
// });

// After the server has started the client sends an initialize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilities.
connection.onInitialize(() => {
  connection.console.log("Initialized server");
  return {
    capabilities: {
      textDocumentSync: documents.syncKind,
      completionProvider: {
        resolveProvider: true,
      },
      hoverProvider: true,
      codeActionProvider: true,
    },
  };
});

connection.onHover((pos: TextDocumentPositionParams): Hover => {
  connection.console.log(
    `Hovering over ${pos.position.line}:${pos.position.character}`,
  );

  return {
    contents: {
      kind: "markdown",
      value: [
        "# beautiful",
        "adjective ",
        "pleasing the senses or mind aesthetically",
      ].join("\n"),
    },
  };
});

documents.onDidChangeContent(async change => {
  debounce(validateTextDocument, 1000)(change.document);
});

connection.onCompletion((): CompletionItem[] => {
  return [{ label: "TOTO" }];
});

connection.onCompletionResolve((): Promise<CompletionItem> => {
  return Promise.resolve({
    label: "My prediction",
  });
});

connection.onCodeAction((params: CodeActionParams) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return;

  const { diagnostics } = params.context;

  const lineDiagnostics = diagnostics.filter(diagnostic =>
    rangeOverlaps(params.range, diagnostic.range, { ignoreCharacters: true }),
  );

  const quickfixes = flatMap(
    diagnostic =>
      (diagnostic.relatedInformation || []).map(info => ({
        value: info.message,
        range: diagnostic.range,
      })),
    lineDiagnostics,
  );

  const codeActions: CodeAction[] = quickfixes.map(({ value, range }) => ({
    title: value,
    kind: CodeActionKind.QuickFix,
    edit: {
      changes: {
        [document.uri]: [{ range, newText: value }],
      },
    },
  }));

  return codeActions;
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const { uri } = textDocument;
  const { data } = await axios.post<LanguageToolResponse>(
    "http://localhost:8081/v2/check",
    null,
    {
      params: {
        language: "en-US",
        // language: "fr",
        text: textDocument.getText(),
      },
    },
  );

  if (!data.matches) {
    return;
  }
  const diagnostics = data.matches.map(match => {
    const range = {
      start: textDocument.positionAt(match.offset),
      end: textDocument.positionAt(match.offset + match.length),
    };

    const relatedInformation = match.replacements
      ? match.replacements.map(({ value }) => {
          const informations: DiagnosticRelatedInformation = {
            message: value,
            location: {
              range,
              uri,
            },
          };
          return informations;
        })
      : [];

    const diagnotic: Diagnostic = {
      message: match.shortMessage || match.message,
      range,
      relatedInformation,
    };

    return diagnotic;
  });

  connection.sendDiagnostics({
    uri,
    diagnostics,
  });
}

connection.listen();

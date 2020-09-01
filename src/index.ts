#!/usr/bin/env node

import fetch from "node-fetch";
import {
  createConnection,
  TextDocuments,
  TextDocumentPositionParams,
  Hover,
  CompletionItem,
  StreamMessageReader,
  StreamMessageWriter,
  Diagnostic,
  CodeActionParams,
  DiagnosticRelatedInformation,
  CodeAction,
  CodeActionKind,
  ProposedFeatures,
  TextDocumentSyncKind,
  ServerCapabilities,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { formatError, debounce, rangeOverlaps } from "./utils";
import { LanguageToolResponse } from "./language_tool_types";
import { spawn } from "child_process";
import { URLSearchParams } from "url";

import {
  initLanguageTool,
  stopLanguageTool,
  LanguageToolError,
  languageToolCheck,
} from "./language_tool";

const connection = createConnection(ProposedFeatures.all);

console.log = connection.console.log.bind(connection.console);
console.error = connection.console.error.bind(connection.console);

process.on("exit", () => stopLanguageTool());
process.on("unhandledRejection", (e) => {
  connection.console.error(formatError(`Unhandled exception`, e));
});

const documents = new TextDocuments(TextDocument);

function handleLanguageToolNotFound(e: LanguageToolError) {
  if (e === LanguageToolError.LanguageToolNotFound) {
    connection.window.showWarningMessage(
      "LanguageTool not found. Please install it.",
    );
  }
  process.exit(1);
}

connection.onInitialize(async () => {
  connection.console.log("Initialized server");

  await initLanguageTool().catch(handleLanguageToolNotFound);

  const serverCapabilities: ServerCapabilities = {
    textDocumentSync: TextDocumentSyncKind.Incremental,
    completionProvider: {
      resolveProvider: true,
    },
    hoverProvider: true,
    codeActionProvider: true,
  };

  return {
    capabilities: serverCapabilities,
  };
});

function buildData(text: string) {
  return { annotation: [{ text: text }] };
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const { uri } = textDocument;

  console.log(`Validating ${uri}`);

  const response = await languageToolCheck(textDocument.getText());

  if (!response.matches) {
    return;
  }

  console.log(JSON.stringify(response, null, 5));

  const diagnostics = response.matches.map((match) => {
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

const validateTextDocumentd = debounce(validateTextDocument, 1000);

documents.onDidChangeContent(async (change) => {
  validateTextDocumentd(change.document);
});

connection.onHover(
  (pos: TextDocumentPositionParams): Hover => {
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
  },
);

connection.onCompletion((): CompletionItem[] => {
  return [{ label: "TOTO" }];
});

connection.onCompletionResolve(
  (): Promise<CompletionItem> => {
    return Promise.resolve({
      label: "My prediction",
    });
  },
);

connection.onCodeAction((params: CodeActionParams) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return;

  const { diagnostics } = params.context;

  const lineDiagnostics = diagnostics.filter((diagnostic) =>
    rangeOverlaps(params.range, diagnostic.range, { ignoreCharacters: true }),
  );

  const quickfixes = lineDiagnostics.flatMap((diagnostic) =>
    (diagnostic.relatedInformation || []).map((info) => ({
      value: info.message,
      range: diagnostic.range,
    })),
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

documents.listen(connection);
connection.listen();

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
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { flatMap, formatError, debounce, rangeOverlaps } from "./utils";
import { LanguageToolResponse } from "./language_tool_types";
import { spawn } from "child_process";
import { URLSearchParams } from "url";

const connection = createConnection(ProposedFeatures.all);

console.log = connection.console.log.bind(connection.console);
console.error = connection.console.error.bind(connection.console);

process.on("unhandledRejection", (e: any) => {
  connection.console.error(formatError(`Unhandled exception`, e));
});

const documents = new TextDocuments(TextDocument);
documents.listen(connection);

let languageToolReady = false;
let languageToolOutput = "";

const languageTool = spawn("languagetool-server");

languageTool.stdout.setEncoding("utf-8");
languageTool.stderr.setEncoding("utf-8");

languageTool.stdout.on("data", (data) => {
  console.log(data);

  if (!languageToolReady) {
    languageToolOutput += data;
    if (languageToolOutput.indexOf("Server started") !== -1) {
      console.log("LanguageTool ready!");
      languageToolReady = true;

      documents.all().forEach((document) => {
        console.log(`Validating ${document.uri}`);
        validateTextDocument(document);
      });
    }
  }
});

languageTool.stderr.on("data", (data) => {
  console.log(data);
});

languageTool.on("error", (err: any) => {
  console.log(err);
  if (err.errno === "ENOENT") {
    connection.window.showWarningMessage(
      "LanguageTool not found. Please install it.",
    );
  }
});

process.on("exit", () => languageTool.kill());

function buildData(text: string) {
  return { annotation: [{ text: text }] };
}

async function requestCheck(
  textDocument: TextDocument,
): Promise<LanguageToolResponse> {
  const params = new URLSearchParams();
  params.append("language", "auto");
  params.append("text", textDocument.getText());

  const response = await fetch("http://localhost:8081/v2/check", {
    method: "post",
    body: params,
  });

  if (!response.ok) {
    throw new Error(response.statusText);
  }

  return response.json();
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  if (!languageToolReady) {
    console.log("LanguageTool not ready yet => skipping");
    return;
  }

  const response = await requestCheck(textDocument);
  console.log("response = ", JSON.stringify(response, null, 5));

  const { uri } = textDocument;

  if (!response.matches) {
    return;
  }

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

// After the server has started the client sends an initialize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilities.
connection.onInitialize(() => {
  connection.console.log("Initialized server");
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true,
      },
      hoverProvider: true,
      codeActionProvider: true,
    },
  };
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

documents.onDidChangeContent(async (change) => {
  debounce(validateTextDocument, 1000)(change.document);
});

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

  const quickfixes = flatMap(
    (diagnostic) =>
      (diagnostic.relatedInformation || []).map((info) => ({
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

connection.listen();

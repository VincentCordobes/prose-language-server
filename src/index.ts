#!/usr/bin/env node

import {
  createConnection,
  TextDocuments,
  TextDocumentPositionParams,
  Hover,
  CompletionItem,
  CodeActionParams,
  CodeAction,
  CodeActionKind,
  ProposedFeatures,
  TextDocumentSyncKind,
  ServerCapabilities,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { formatError, debounce, rangeOverlaps } from "./utils";
import logger from "./logger";
import { initLanguageTool, LanguageToolError } from "./language_tool";
import { getDiagnostics } from "./server";

const connection = createConnection(ProposedFeatures.all);

logger.init(connection.console);

process.on("unhandledRejection", (e) => {
  logger.error(formatError(`Unhandled exception`, e));
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
  logger.info("Initialized server");

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

const validateTextDocument = debounce(
  async (textDocument: TextDocument): Promise<void> => {
    const { uri } = textDocument;

    logger.info(`Validating ${uri}`);

    const diagnostics = await getDiagnostics(textDocument);

    connection.sendDiagnostics({
      uri,
      diagnostics,
    });
  },
  1000,
);

documents.onDidChangeContent((change) => {
  validateTextDocument(change.document);
});

connection.onHover(
  (pos: TextDocumentPositionParams): Hover => {
    logger.info(`Hovering over ${pos.position.line}:${pos.position.character}`);

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

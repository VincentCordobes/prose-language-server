import {
  createConnection,
  TextDocuments,
  TextDocumentPositionParams,
  Hover,
  CompletionItem,
  CodeActionParams,
  ProposedFeatures,
  TextDocumentSyncKind,
  ServerCapabilities,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";

import { formatError, debounce } from "./utils/index.js";
import logger from "./logger.js";
import { initLanguageTool } from "./language_tool.js";
import { executeCommand, getCodeActions, getDiagnostics } from "./features.js";

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

logger.init(connection.console);

process.on("unhandledRejection", (e: any) => {
  logger.error(formatError(`Unhandled exception`, e));

  connection.window.showErrorMessage(e.message);
});

async function initialize() {
  logger.info("Initialized server");

  await initLanguageTool();

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
}

function _buildData(text: string) {
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

function handleHover(pos: TextDocumentPositionParams): Hover {
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
}

function handleCompletion(): CompletionItem[] {
  return [{ label: "TODO" }];
}

function resolveCompletion(): Promise<CompletionItem> {
  return Promise.resolve({
    label: "My prediction",
  });
}

function handleCodeAction(params: CodeActionParams) {
  const { diagnostics } = params.context;
  const document = documents.get(params.textDocument.uri);
  if (!document) return;

  return getCodeActions(document, diagnostics, params.range);
}

documents.onDidChangeContent((change) => {
  validateTextDocument(change.document);
});

export function listen(): void {
  connection.onInitialize(initialize);
  connection.onHover(handleHover);
  connection.onCodeAction(handleCodeAction);
  connection.onCompletion(handleCompletion);
  connection.onCompletionResolve(resolveCompletion);
  connection.onExecuteCommand(executeCommand);

  documents.listen(connection);
  connection.listen();
}

export default { listen };

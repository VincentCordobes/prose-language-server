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
  Diagnostic
} from "vscode-languageserver";
import axios from "axios";

import { formatError, debounce } from "./utils/runner";

const connection = createConnection(
  new StreamMessageReader(process.stdin),
  new StreamMessageWriter(process.stdout)
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
connection.onInitialize(async params => {
  connection.console.log("Initialized server");
  return {
    capabilities: {
      textDocumentSync: documents.syncKind,
      completionProvider: {
        resolveProvider: true
      },
      hoverProvider: true
    }
  };
});

connection.onHover((pos: TextDocumentPositionParams): Hover => {
  connection.console.log(
    `Hovering over ${pos.position.line}:${pos.position.character}`
  );

  return {
    contents: {
      kind: "markdown",
      value: [
        "# beautiful",
        "adjective ",
        "pleasing the senses or mind aesthetically"
      ].join("\n")
    }
  };
});

documents.onDidChangeContent(async change => {
  debounce(validateTextDocument, 1000)(change.document);
});

connection.onCompletion((pos: TextDocumentPositionParams): CompletionItem[] => {
  return [{ label: "TOTO" }];
});

connection.onCompletionResolve((item: CompletionItem): Promise<
  CompletionItem
> => {
  return Promise.resolve({
    label: "My prediction"
  });
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const { data } = await axios.post("http://localhost:8081/v2/check", null, {
    params: {
      // language: "en-US",
      language: "fr",
      text: textDocument.getText()
    }
  });

  if (!data.matches) {
    return;
  }
  const diagnostics = data.matches.map((match: any) => {
    const diagnotic: Diagnostic = {
      message: match.message,
      range: {
        start: textDocument.positionAt(match.offset),
        end: textDocument.positionAt(match.offset + match.length)
      }
    };
    return diagnotic;
  });

  connection.sendDiagnostics({
    uri: textDocument.uri,
    diagnostics
  });
}

connection.listen();

#!/usr/bin/env node

import {
  createConnection,
  TextDocuments,
  TextDocumentPositionParams,
  Hover,
  Definition,
  DocumentSymbolParams,
  SymbolInformation,
  DocumentHighlight,
  ReferenceParams,
  Location,
  CompletionItem,
  Range,
  StreamMessageReader,
  StreamMessageWriter
} from "vscode-languageserver";

import { formatError } from "./utils/runner";

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

documents.onDidClose(_ => {
  // clean some stuff
});
connection.onShutdown(() => {
  // clean some stuff
});

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
      hoverProvider: true,
      documentHighlightProvider: true,
      definitionProvider: true,
      documentSymbolProvider: true,
      referencesProvider: true
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
        "## This is a hover test",
        "with some very interesting definition here",
        "```javascript",
        "const a = 5",
        "```"
      ].join("\n")
    }
  };
});

connection.onDefinition((pos: TextDocumentPositionParams): Definition => {
  connection.console.log(
    `Asked for definition at ${pos.position.line}:${pos.position.character}`
  );
  // const word = this.getWordAtPoint(pos);
  return [];
});

connection.onDocumentSymbol(
  (params: DocumentSymbolParams): SymbolInformation[] => {
    return [
      {
        kind: 1,
        name: "documentsymbol",
        location: {
          range: aRange(),
          uri: params.textDocument.uri
        }
      }
    ];
  }
);

connection.onDocumentHighlight(
  (pos: TextDocumentPositionParams): DocumentHighlight[] => {
    return [{ range: aRange() }];
  }
);

connection.onReferences((params: ReferenceParams): Location[] => {
  return [{ uri: params.textDocument.uri, range: aRange() }];
});

connection.onCompletion((pos: TextDocumentPositionParams): CompletionItem[] => {
  console.log(
    `Asked for completions at ${pos.position.line}:${pos.position.character}`
  );
  return [
    {
      label: "TOTO"
    }
  ];
});

connection.onCompletionResolve((item: CompletionItem): Promise<
  CompletionItem
> => {
  return Promise.resolve({
    label: "My prediction"
  });
});

function aRange(): Range {
  return {
    start: {
      character: 0,
      line: 0
    },
    end: {
      character: 5,
      line: 0
    }
  };
}

connection.listen();

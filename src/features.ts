import {
  CodeAction,
  CodeActionKind,
  Command,
  Diagnostic,
  DiagnosticRelatedInformation,
  ExecuteCommandParams,
} from "vscode-languageserver";
import { Range, TextDocument } from "vscode-languageserver-textdocument";
import { addWord, languageToolCheck } from "./language_tool.js";
import logger from "./logger.js";
import { rangeOverlaps } from "./utils/index.js";

const ADD_COMMAND = "word.add";

export async function getDiagnostics(
  textDocument: TextDocument,
): Promise<Diagnostic[]> {
  const response = await languageToolCheck(textDocument.getText());

  if (!response.matches) {
    return [];
  }

  logger.info(JSON.stringify(response, null, 5));

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
              uri: textDocument.uri,
            },
          };
          return informations;
        })
      : [];

    const diagnotic: Diagnostic = {
      message: match.message || match.shortMessage,
      range,
      relatedInformation,
    };

    return diagnotic;
  });

  return diagnostics;
}

export function getCodeActions(
  document: TextDocument,
  diagnostics: Diagnostic[],
  range: Range,
) {
  const lineDiagnostics = diagnostics.filter((diagnostic) =>
    rangeOverlaps(range, diagnostic.range, { ignoreCharacters: true }),
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

  logger.log(JSON.stringify(range));
  const defaultCodeActions: CodeAction[] = lineDiagnostics
    .map((diagnostic) => document.getText(diagnostic.range))
    .filter((text) => !text.includes(" "))
    .map((word) => {
      const title = `Add ${word} to dictionnary`;
      return {
        title,
        kind: CodeActionKind.QuickFix,
        command: Command.create(title, ADD_COMMAND, word),
      };
    });

  return [...defaultCodeActions, ...codeActions];
}

export async function executeCommand(params: ExecuteCommandParams) {
  if (params.command === ADD_COMMAND) {
    const word: string = params.arguments && params.arguments[0];
    logger.info(JSON.stringify({ word }));
    if (word) {
      await addWord(word);
    }
  }
}

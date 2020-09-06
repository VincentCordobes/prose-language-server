import {
  CodeAction,
  CodeActionKind,
  Diagnostic,
  DiagnosticRelatedInformation,
} from "vscode-languageserver";
import { Range, TextDocument } from "vscode-languageserver-textdocument";
import { languageToolCheck } from "./language_tool";
import logger from "./logger";
import { rangeOverlaps } from "./utils";

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

  return codeActions;
}

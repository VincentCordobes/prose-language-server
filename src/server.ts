import {
  Diagnostic,
  DiagnosticRelatedInformation,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { languageToolCheck } from "./language_tool";
import logger from "./logger";

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

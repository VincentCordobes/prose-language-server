import Parser from "tree-sitter";
import Markdown from "tree-sitter-markdown";
import logger from "./logger";

const parser = new Parser();
parser.setLanguage(Markdown);

type Annotation =
  | { text: string }
  | {
      markup: string;
      interpretAs?: string;
    };

function buildAnnotation(node: Parser.SyntaxNode): Annotation[] {
  if (node.type === "document") {
    return node.children.flatMap(buildAnnotation);
  }

  let annotations: Annotation[] = [];

  const newlinesCount =
    node.startPosition.row -
    (node.previousSibling?.endPosition.row ||
      node.parent?.startPosition.row ||
      0);

  if (newlinesCount > 0) {
    annotations.push({ text: "\n".repeat(newlinesCount) });
  }

  switch (node.type) {
    case "link":
    case "paragraph": {
      annotations.push(...node.children.flatMap(buildAnnotation));
      break;
    }

    case "soft_line_break": {
      annotations.push({ text: "\n" });
      break;
    }

    case "strong_emphasis": {
      annotations.push({ markup: "**" });
      annotations.push(...node.children.flatMap(buildAnnotation));
      annotations.push({ markup: "**" });
      break;
    }

    case "emphasis": {
      annotations.push({ markup: "_" });
      annotations.push(...node.children.flatMap(buildAnnotation));
      annotations.push({ markup: "_" });
      break;
    }

    case "code_span":
    case "fenced_code_block": {
      annotations.push({ markup: node.text });
      break;
    }

    case "link_text": {
      annotations.push({ markup: "[" });
      annotations.push(...node.children.flatMap(buildAnnotation));
      annotations.push({ markup: "]" });
      break;
    }

    case "link_destination": {
      annotations.push({ markup: "(" + (node.text || "") + ")" });
      break;
    }

    case "text": {
      annotations.push({ text: node.text });
      break;
    }

    case "strikethrough": {
      annotations.push({ markup: "~~" });
      annotations.push(...node.children.flatMap(buildAnnotation));
      annotations.push({ markup: "~~" });
      break;
    }

    default:
      break;
  }
  return annotations;
}

export function toAnnotation(text: string): Annotation[] {
  const tree = parser.parse(text);

  return buildAnnotation(tree.rootNode);
}

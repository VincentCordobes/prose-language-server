import Parser from "tree-sitter";
import Markdown from "tree-sitter-markdown";
import logger from "./logger.js";

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
    case "tight_list":
    case "loose_list":
    case "list_item":
    case "task_list_item":
    case "atx_heading":
    case "heading_content":
    case "block_quote":
    case "paragraph": {
      annotations.push(...node.children.flatMap(buildAnnotation));
      break;
    }

    case "atx_h1_marker": {
      annotations.push({ markup: "#" });
      break;
    }
    case "atx_h2_marker": {
      annotations.push({ markup: "##" });
      break;
    }
    case "atx_h3_marker": {
      annotations.push({ markup: "###" });
      break;
    }
    case "atx_h4_marker": {
      annotations.push({ markup: "####" });
      break;
    }
    case "atx_h5_marker": {
      annotations.push({ markup: "#####" });
      break;
    }
    case "atx_h6_marker": {
      annotations.push({ markup: "######" });
      break;
    }

    // TODO: case "hard_line_break":
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
    case "thematic_break":
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

    case "setext_heading":
    case "email_autolink":
    case "uri_autolink":
    case "task_list_item_marker":
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

    case "list_marker": {
      annotations.push({ markup: `${node.text} `, interpretAs: "— " });
      break;
    }

    default:
      logger.warn(`Unandled node type "${node.type}"`);
      throw new Error(`Unandled node type "${node.type}"`);
  }
  return annotations;
}

export function toAnnotation(text: string): Annotation[] {
  // Replace trailing whitespaces and block quote markers with nbsp
  const cleanedText = text.replace(/( +$)|(^ +)|(^>)/gm, (match) =>
    " ".repeat(match.length),
  );

  const tree = parser.parse(cleanedText);

  return buildAnnotation(tree.rootNode);
}

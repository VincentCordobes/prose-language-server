export interface LanguageToolResponse {
  software: {
    name: "LanguageTool";
    version: string;
    buildDate: string; //"2019-03-26 11:37",
    apiVersion: number;
    premium: boolean;
    premiumHint: string;
    status: string;
  };
  warnings: {
    incompleteResults: boolean;
  };
  language: {
    name: string;
    code: LanguageCode;
    detectedLanguage: {
      name: string;
      code: LanguageCode;
      confidence: number; // 0.7122702
    };
  };
  matches: LanguageToolMatch[];
}

export type LanguageCode = "en-US" | "fr";

export interface LanguageToolMatch {
  message: string;
  shortMessage: string;
  replacements: Replacement[];
  offset: number;
  length: number;
  context: {
    text: string;
    offset: number;
    length: number;
  };
  sentence: string;
  type: {
    typeName: "Other";
  };
  rule: {
    id: string;
    description: string;
    issueType: "misspelling";
    category: {
      id: string;
      name: string;
    };
  };
  ignoreForIncompleteSentence: boolean;
  contextForSureMatch: 0;
}

export interface Replacement {
  value: string;
  shortDescription?: string;
}

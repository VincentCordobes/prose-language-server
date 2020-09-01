import {
  ChildProcess,
  ChildProcessWithoutNullStreams,
  spawn,
} from "child_process";
import fetch from "node-fetch";
import { URLSearchParams } from "url";
import { LanguageToolResponse } from "./language_tool_types";

let languageTool: ChildProcessWithoutNullStreams;
let languageToolReady = false;

export enum LanguageToolError {
  LanguageToolNotFound,
}

export function initLanguageTool(): Promise<ChildProcess> {
  let languageToolOutput = "";

  return new Promise((resolve, reject) => {
    if (languageTool) {
      resolve(languageTool);
    }

    languageTool = spawn("languagetool-server");

    languageTool.stdout.setEncoding("utf-8");
    languageTool.stderr.setEncoding("utf-8");

    languageTool.stderr.on("data", (data) => {
      console.log(data);
    });

    languageTool.on("error", (err: any) => {
      console.log(err);

      if (err.errno === "ENOENT") {
        reject(LanguageToolError.LanguageToolNotFound);
      }
    });

    languageTool.stdout.on("data", (data) => {
      if (languageToolReady) {
        return;
      }

      console.log(data);
      languageToolOutput += data;

      if (languageToolOutput.indexOf("Server started") !== -1) {
        console.log("LanguageTool ready!");

        languageToolReady = true;
        resolve(languageTool);
      }
    });
  });
}

export function stopLanguageTool() {
  if (languageTool) {
    languageTool.kill();
  }
}

export async function languageToolCheck(
  text: string,
): Promise<LanguageToolResponse> {
  const params = new URLSearchParams();
  params.append("language", "auto");
  params.append("text", text);

  const response = await fetch("http://localhost:8081/v2/check", {
    method: "post",
    body: params,
  });

  if (!response.ok) {
    throw new Error(response.statusText);
  }

  return response.json();
}

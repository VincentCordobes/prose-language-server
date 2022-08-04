import {
  ChildProcess,
  ChildProcessWithoutNullStreams,
  spawn,
} from "child_process";
import childProcess from "child_process";
import fetch from "isomorphic-unfetch";
import { URLSearchParams } from "url";
import util from "util";
import getPort from "get-port";
import { LanguageToolResponse } from "./language_tool_types.js";
import logger from "./logger.js";
import { toAnnotation } from "./markdown.js";

const exec = util.promisify(childProcess.exec);

const DISABLED_RULES = ["WHITESPACE_RULE", "EN_QUOTES"];

let languageTool: ChildProcessWithoutNullStreams;
let ready: boolean = false;
let url: string = "http://localhost";
let port: number;

async function getLanguageToolPID(): Promise<string> {
  const { stdout } = await exec("ps aux");
  const processes = stdout.split("\n");
  const process = processes.find((p) =>
    /org.languagetool.server.HTTPServer/.test(p),
  );

  if (!process) {
    throw new Error("LanguageTool not running");
  }

  const [_, pid] = process.split(" ").filter(Boolean);
  return pid;
}

async function findLanguageToolPort(): Promise<number> {
  const pid = await getLanguageToolPID();

  logger.info(`LanguageTool server found (pid: ${pid})`);

  const { stdout } = await exec(`lsof -Pan -p ${pid} -i`);

  const result = /TCP .*:(\d{4}\d?)/g.exec(stdout);

  if (!result) {
    throw new Error("Cant find LanguageTool port");
  }

  return Number(result[1]);
}

async function startLanguageTool(): Promise<ChildProcess> {
  let languageToolOutput = "";

  if (languageTool) {
    return languageTool;
  }

  port = await getPort();

  return new Promise((resolve, reject) => {
    languageTool = spawn("languagetool", ["--http", "--port", String(port)], {
      detached: true,
    });

    languageTool.stdout.setEncoding("utf-8");
    languageTool.stderr.setEncoding("utf-8");

    languageTool.stderr.on("data", (data) => {
      logger.error(data);
    });

    languageTool.on("error", (err: any) => {
      logger.error(err);

      if (err.code === "ENOENT") {
        reject(new Error("LanguageTool not found"));
      }
    });

    languageTool.stdout.on("data", (data) => {
      if (ready) {
        return;
      }

      logger.info(data);
      languageToolOutput += data;

      if (languageToolOutput.indexOf("Server started") !== -1) {
        logger.info("LanguageTool ready!");

        ready = true;
        resolve(languageTool);
      }
    });
  });
}

type languageToolCommand = "check" | "words/add";

async function request(
  endpoint: languageToolCommand,
  params: URLSearchParams,
): Promise<any> {
  const response = await fetch(`${url}:${port}/v2/${endpoint}`, {
    method: "post",
    body: params,
  });

  if (!response.ok) {
    throw new Error(response.statusText);
  }

  return response.json();
}

export async function languageToolCheck(
  text: string,
): Promise<LanguageToolResponse> {
  const data = JSON.stringify({ annotation: toAnnotation(text) });

  logger.info(data);

  const params = new URLSearchParams();
  params.append("language", "auto");
  params.append("data", data);
  params.append("disabledRules", DISABLED_RULES.join(","));

  return request("check", params);
}

export async function addWord(word: string): Promise<LanguageToolResponse> {
  const params = new URLSearchParams();
  params.append("word", word);
  params.append("username", "toto");
  params.append("apiKey", "toto");

  return request("words/add", params);
}

export async function getLanguageToolVersion(): Promise<string> {
  const response = await languageToolCheck("my text");
  return response.software.version;
}

export async function initLanguageTool() {
  try {
    port = await findLanguageToolPort();
    logger.info(`LanguageTool is already running on port ${port}`);
    ready = true;
  } catch (e) {
    logger.info("Starting a new instance of languageTool");
    await startLanguageTool();
  }
}

export function stopLanguageTool() {
  if (languageTool) {
    languageTool.kill();
  }
}

import {
  ChildProcess,
  ChildProcessWithoutNullStreams,
  spawn,
} from "child_process";
import childProcess from "child_process";
import fetch from "node-fetch";
import { URLSearchParams } from "url";
import util from "util";
import { LanguageToolResponse } from "./language_tool_types";
import logger from "./logger";

const exec = util.promisify(childProcess.exec);

let languageTool: ChildProcessWithoutNullStreams;
let ready: boolean = false;
let url: string = "http://localhost";
let port: number = 8081;

export enum LanguageToolError {
  LanguageToolNotFound,
}

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

  const result = /TCP 127\.0\.0\.1:(\d{4})/g.exec(stdout);

  if (!result) {
    throw new Error("Cant find LanguageTool port");
  }

  return Number(result[1]);
}

async function startLanguageTool(): Promise<ChildProcess> {
  let languageToolOutput = "";

  return new Promise((resolve, reject) => {
    if (languageTool) {
      resolve(languageTool);
    }

    languageTool = spawn("languagetool-server", {
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
        reject(LanguageToolError.LanguageToolNotFound);
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
        port = 8081;
        resolve(languageTool);
      }
    });
  });
}

export async function languageToolCheck(
  text: string,
): Promise<LanguageToolResponse> {
  const params = new URLSearchParams();
  params.append("language", "auto");
  params.append("text", text);

  const response = await fetch(`${url}:${port}/v2/check`, {
    method: "post",
    body: params,
  });

  if (!response.ok) {
    throw new Error(response.statusText);
  }

  return response.json();
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

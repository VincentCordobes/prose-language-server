interface Logger {
  error(message: string): void;
  warn(message: string): void;
  info(message: string): void;
  log(message: string): void;
}

let logger: Logger = console;

export function init(l: Logger) {
  logger = l;
}

export function info(value: string): string {
  if (process.env.NODE_ENV !== "test") {
    logger.info(value);
  }
  return value;
}

export function error(value: string): string {
  logger.error(value);
  return value;
}

export function warn(value: string): string {
  logger.warn(value);
  return value;
}

export function log(value: string): string {
  logger.log(value);
  return value;
}

export default {
  init,
  info,
  error,
  warn,
  log,
};

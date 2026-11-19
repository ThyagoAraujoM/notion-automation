import { env } from "@notion-automation/env";
import { Client, RequestTimeoutError } from "@notionhq/client";

/** Tempo máximo de espera por UMA chamada ao Notion (a requisição inteira pode levar minutos). */
export const NOTION_TIMEOUT_MS = 60_000;

export const notion = new Client({
  auth: env.NOTION_TOKEN,
  timeoutMs: NOTION_TIMEOUT_MS,
});

/** `true` se o erro é uma chamada ao Notion que estourou `NOTION_TIMEOUT_MS`. */
export const isNotionTimeout = (error: unknown) =>
  RequestTimeoutError.isRequestTimeoutError(error);

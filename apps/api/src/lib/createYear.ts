import { env } from "@notion-automation/env";
import { notion } from "./notion";

export async function createYear() {
  await notion.pages.create({
    parent: {
      database_id: env.YEAR_TOKEN,
    },
    properties: {
      Name: {
        title: [
          {
            text: {
              content: "2026",
            },
          },
        ],
      },
    },
  });
}

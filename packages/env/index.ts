import dist = require("@t3-oss/env-core");
import z = require("zod");

export const env = dist.createEnv({
  server: {
    PORT_BACKEND: z.coerce.number().default(4000),
    PORT_FRONTEND: z.coerce.number().default(3000),
    POSTGRES_USER: z.string(),
    POSTGRES_PASSWORD: z.string(),
    POSTGRES_DB: z.string(),
    POSTGRES_PORT: z.coerce.number().default(5432),
    NOTION_TOKEN: z.string(),
    YEAR_TOKEN: z.string(),
    QUARTERLY_TOKEN: z.string(),
    MONTHLY_TOKEN: z.string(),
    WEEKLY_TOKEN: z.string(),
    DAILY_TOKEN: z.string(),
  },
  runtimeEnv: {
    PORT_BACKEND: process.env.PORT_BACKEND,
    PORT_FRONTEND: process.env.PORT_FRONTEND,
    POSTGRES_USER: process.env.POSTGRES_USER,
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
    POSTGRES_DB: process.env.POSTGRES_DB,
    POSTGRES_PORT: process.env.POSTGRES_PORT,
    NOTION_TOKEN: process.env.NOTION_TOKEN,
    YEAR_TOKEN: process.env.YEAR_TOKEN,
    QUARTERLY_TOKEN: process.env.QUARTERLY_TOKEN,
    MONTHLY_TOKEN: process.env.MONTHLY_TOKEN,
    WEEKLY_TOKEN: process.env.WEEKLY_TOKEN,
    DAILY_TOKEN: process.env.DAILY_TOKEN,
  },
  emptyStringAsUndefined: true,
});

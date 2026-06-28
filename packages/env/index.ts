import dist = require("@t3-oss/env-core");
import z = require("zod");

export const env = dist.createEnv({
  server: {
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string(),
    NOTION_TOKEN: z.string(),
    YEAR_TOKEN: z.string(),
    QUARTERLY_TOKEN: z.string(),
    MONTHLY_TOKEN: z.string(),
    WEEKLY_TOKEN: z.string(),
    DAILY_TOKEN: z.string(),
  },
  runtimeEnv: {
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL,
    NOTION_TOKEN: process.env.NOTION_TOKEN,
    YEAR_TOKEN: process.env.YEAR_TOKEN,
    QUARTERLY_TOKEN: process.env.QUARTERLY_TOKEN,
    MONTHLY_TOKEN: process.env.MONTHLY_TOKEN,
    WEEKLY_TOKEN: process.env.WEEKLY_TOKEN,
    DAILY_TOKEN: process.env.DAILY_TOKEN,
  },
  emptyStringAsUndefined: true,
});

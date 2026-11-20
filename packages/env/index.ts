// @t3-oss/env-core é ESM-only e este pacote é CommonJS (consumido pela API com NodeNext):
// por isso `import = require` em vez de `import`.
/* eslint-disable @typescript-eslint/no-require-imports */
import dist = require("@t3-oss/env-core");
import z = require("zod");
/* eslint-enable @typescript-eslint/no-require-imports */

export const env = dist.createEnv({
  server: {
    PORT_BACKEND: z.coerce.number().default(4000),
    PORT_FRONTEND: z.coerce.number().default(3000),
    POSTGRES_USER: z.string(),
    POSTGRES_PASSWORD: z.string(),
    POSTGRES_DB: z.string(),
    POSTGRES_PORT: z.coerce.number().default(5432),
    NOTION_TOKEN: z.string(),
    YEAR_DATABASE_ID: z.string(),
    QUARTER_DATABASE_ID: z.string(),
    MONTH_DATABASE_ID: z.string(),
    WEEK_DATABASE_ID: z.string(),
    DAY_DATABASE_ID: z.string(),
  },
  runtimeEnv: {
    PORT_BACKEND: process.env.PORT_BACKEND,
    PORT_FRONTEND: process.env.PORT_FRONTEND,
    POSTGRES_USER: process.env.POSTGRES_USER,
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
    POSTGRES_DB: process.env.POSTGRES_DB,
    POSTGRES_PORT: process.env.POSTGRES_PORT,
    NOTION_TOKEN: process.env.NOTION_TOKEN,
    YEAR_DATABASE_ID: process.env.YEAR_DATABASE_ID,
    QUARTER_DATABASE_ID: process.env.QUARTER_DATABASE_ID,
    MONTH_DATABASE_ID: process.env.MONTH_DATABASE_ID,
    WEEK_DATABASE_ID: process.env.WEEK_DATABASE_ID,
    DAY_DATABASE_ID: process.env.DAY_DATABASE_ID,
  },
  emptyStringAsUndefined: true,
});

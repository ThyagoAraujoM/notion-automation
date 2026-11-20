import { Badge } from "@/components/ui/badge";

const stack = [
  "Turborepo + pnpm",
  "Fastify 5",
  "Zod 4",
  "@notionhq/client v5",
  "PostgreSQL 17",
  "Prisma 7",
  "Docker",
  "Next.js 16",
  "Tailwind CSS",
  "shadcn/ui",
  "Vitest",
  "Claude Code",
];

export function Stack() {
  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold tracking-tight">Stack</h2>
      <ul className="flex flex-wrap gap-2">
        {stack.map((item) => (
          <li key={item}>
            <Badge variant="outline">{item}</Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}

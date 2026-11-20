import { Badge } from "@/components/ui/badge";

const routes = [
  {
    method: "POST",
    path: "/years",
    body: "{ year?, startToday? }",
    text: "Cria o ano",
  },
  {
    method: "POST",
    path: "/years/:year/repair",
    body: "{ startToday? }",
    text: "Repara o ano",
  },
  {
    method: "DELETE",
    path: "/years/:year",
    body: "",
    text: "Apaga o ano",
  },
  {
    method: "GET",
    path: "/databases/:databaseId/schema",
    body: "",
    text: "Mostra a estrutura do database",
  },
];

export function Routes() {
  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold tracking-tight">Rotas da API</h2>
      <ul className="divide-y rounded-lg border">
        {routes.map((route) => (
          <li
            key={`${route.method} ${route.path}`}
            className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4"
          >
            <Badge variant="secondary" className="w-fit font-mono">
              {route.method}
            </Badge>
            <code className="font-mono text-sm break-all">{route.path}</code>
            <span className="text-muted-foreground text-sm sm:ml-auto sm:text-right">
              {route.text}
              {route.body && (
                <>
                  {" "}
                  <code className="font-mono">{route.body}</code>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-sm">
        A documentação Swagger fica em <code className="font-mono">/docs</code>{" "}
        na API (porta padrão 4000).
      </p>
    </section>
  );
}

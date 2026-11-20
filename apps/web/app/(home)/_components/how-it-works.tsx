const steps = [
  {
    title: "Calcula o calendário",
    text: "Define trimestres, meses, semanas e dias do ano.",
  },
  {
    title: "Valida os templates",
    text: "Confere os templates de cada database antes de criar qualquer coisa.",
  },
  {
    title: "Cria as páginas uma a uma",
    text: "Respeita o limite de requisições do Notion e liga cada página ao seu pai.",
  },
  {
    title: "Grava o log no Postgres",
    text: "Registra o que foi feito em cada operação.",
  },
];

export function HowItWorks() {
  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold tracking-tight">Como funciona</h2>
      <ol className="grid gap-4 sm:grid-cols-2">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-4 rounded-lg border p-4">
            <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
              {i + 1}
            </span>
            <div>
              <h3 className="font-medium">{step.title}</h3>
              <p className="text-muted-foreground text-sm">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

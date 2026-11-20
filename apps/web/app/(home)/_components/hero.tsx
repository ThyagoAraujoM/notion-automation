import { Badge } from "@/components/ui/badge";

const levels = ["Ano", "Trimestres", "Meses", "Semanas", "Dias"];

export function Hero() {
  return (
    <section className="flex flex-col items-start gap-6">
      <Badge variant="secondary">Projeto de aprendizado</Badge>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Notion Automation
      </h1>
      <p className="text-muted-foreground max-w-2xl text-lg">
        Uma API que gera no Notion a sua rotina de planejamento, do ano até cada
        dia. Cada nível fica em um database próprio, com as páginas ligadas por
        relações e criadas a partir dos templates de cada database, como{" "}
        <code className="font-mono text-sm">2026</code>,{" "}
        <code className="font-mono text-sm">T1</code>,{" "}
        <code className="font-mono text-sm">Janeiro</code>,{" "}
        <code className="font-mono text-sm">Semana 1</code> e{" "}
        <code className="font-mono text-sm">Segunda - Feira</code>.
      </p>
      <ol className="flex flex-wrap items-center gap-2 text-sm font-medium">
        {levels.map((level, i) => (
          <li key={level} className="flex items-center gap-2">
            <Badge variant="outline">{level}</Badge>
            {i < levels.length - 1 && (
              <span aria-hidden className="text-muted-foreground">
                →
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className="text-muted-foreground max-w-2xl text-sm">
        Este é o primeiro projeto desenvolvido com IA (Claude Code) como par de
        programação. Ele serve de base de boas práticas para os próximos:
        documentação para a IA, agentes, skills, hooks e testes.
      </p>
    </section>
  );
}

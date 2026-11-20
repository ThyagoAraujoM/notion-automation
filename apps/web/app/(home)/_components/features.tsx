import {
  CalendarPlus,
  DatabaseZap,
  FileCheck2,
  Lock,
  Trash2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: CalendarPlus,
    title: "Criar o ano",
    text: "Gera o ano inteiro ou só de hoje em diante, com a opção startToday.",
  },
  {
    icon: Wrench,
    title: "Reparar um ano",
    text: "Cria o que falta e religa páginas no pai errado. Pode rodar várias vezes sem duplicar nada.",
  },
  {
    icon: Trash2,
    title: "Apagar um ano",
    text: "Manda todas as páginas do ano para a lixeira do Notion.",
  },
  {
    icon: DatabaseZap,
    title: "Inspecionar um database",
    text: "Mostra a estrutura (schema) de qualquer database do Notion.",
  },
  {
    icon: Lock,
    title: "Trava por ano",
    text: "Evita operações simultâneas no mesmo ano e responde 409 se já houver uma em andamento.",
  },
  {
    icon: FileCheck2,
    title: "Validação de templates",
    text: "Confere os templates antes de criar qualquer página e responde 422 se algo estiver errado.",
  },
];

export function Features() {
  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold tracking-tight">Funcionalidades</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, text }) => (
          <Card key={title}>
            <CardHeader>
              <Icon className="text-muted-foreground size-5" aria-hidden />
              <CardTitle>{title}</CardTitle>
              <CardDescription>{text}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}

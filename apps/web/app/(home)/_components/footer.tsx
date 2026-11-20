import { Separator } from "@/components/ui/separator";

export function Footer() {
  return (
    <footer className="flex flex-col gap-4">
      <Separator />
      <p className="text-muted-foreground text-sm">
        Notion Automation, um projeto de aprendizado feito com Claude Code.
      </p>
    </footer>
  );
}

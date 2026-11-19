/**
 * Teste ponta a ponta no Notion REAL: createYear → repair → deleteYear num ano avulso.
 *
 *   pnpm --filter=@notion-automation/api test:e2e [-- --year=2090] [--keep]
 *
 * 1. createYear só de out a dez (3 meses → 1 trimestre);
 * 2. repair de set a dez: precisa criar Setembro (e o T3) e religar a semana que
 *    atravessa set/out;
 * 3. deleteYear apaga tudo e confirma que não sobrou nada.
 *
 * Chama os services direto (sem a API no ar e sem Postgres) e confere o resultado lendo
 * o Notion de volta. Seguro: aborta se o ano já existir e só apaga o que ele mesmo criou.
 */
import type { PageObjectResponse } from "@notionhq/client";
import {
  dateProp,
  findYearPageId,
  numberProp,
  relationIds,
  titleProp,
} from "@/integrations/notion/helpers";
import { createYear } from "@/services/create-year";
import { deleteYear } from "@/services/delete-year";
import { repairYear } from "@/services/repair-year";
import {
  collectYearHierarchy,
  type YearHierarchy,
} from "@/services/shared/year-hierarchy";
import { indexBy, normId } from "@/utils/notion-pages";
import { buildPlan, type YearPlan } from "@/utils/routine-calendar";

const log = console.log;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;
const fmt = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${s % 60}s`;
};

// ---------- argumentos ----------

const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const YEAR = Number(arg("year") ?? 2090);
const KEEP = process.argv.includes("--keep");

// ---------- leitura / formatação ----------

const num = (p: PageObjectResponse, prop: string) =>
  numberProp(p.properties, prop) ?? 0;
const name = (p: PageObjectResponse) => titleProp(p.properties, "Name");
const dateOf = (p: PageObjectResponse) => dateProp(p.properties, "Data") ?? "";
const label = (p: PageObjectResponse) => {
  const prop = p.properties["Data"];
  return prop?.type === "rich_text"
    ? prop.rich_text.map((t) => t.plain_text).join("")
    : "";
};
const isChildOf = (
  page: PageObjectResponse,
  property: string,
  parent: PageObjectResponse,
) =>
  relationIds(page.properties, property)
    .map(normId)
    .includes(normId(parent.id));

const counts = (h: YearHierarchy) =>
  `${plural(h.quarters.length, "trimestre", "trimestres")}, ${plural(h.months.length, "mês", "meses")}, ${plural(h.weeks.length, "semana", "semanas")}, ${plural(h.days.length, "dia", "dias")}`;

/** Imprime Trimestre → Mês → Semanas → Dias (opcionalmente só alguns meses). */
function printTree(h: YearHierarchy, onlyMonths?: number[]) {
  const byNumber =
    (prop: string) => (a: PageObjectResponse, b: PageObjectResponse) =>
      num(a, prop) - num(b, prop);

  for (const q of [...h.quarters].sort(byNumber("Número do Trimestre"))) {
    const months = h.months
      .filter((m) => isChildOf(m, "Trimestres", q))
      .filter((m) => !onlyMonths || onlyMonths.includes(num(m, "Nº do mês")))
      .sort(byNumber("Nº do mês"));
    if (months.length === 0) continue;

    log(`  ${name(q)}`);
    for (const m of months) {
      const weeks = h.weeks
        .filter((w) => isChildOf(w, "Meses", m))
        .sort(byNumber("Semana nº"));
      const days = weeks.flatMap((w) =>
        h.days.filter((d) => isChildOf(d, "Semana", w)),
      );
      log(
        `    ${name(m)} — ${plural(weeks.length, "semana", "semanas")}, ${plural(days.length, "dia", "dias")}`,
      );
      for (const w of weeks) {
        const wDays = h.days
          .filter((d) => isChildOf(d, "Semana", w))
          .sort((a, b) => dateOf(a).localeCompare(dateOf(b)));
        log(
          `      ${name(w)} (${label(w)}) — ${plural(wDays.length, "dia", "dias")}: ${wDays.map((d) => dateOf(d).slice(8)).join(" ")}`,
        );
      }
    }
  }
}

// ---------- verificação contra o plano ----------

/** Confere se o que está no Notion bate com o plano: nomes, números, pais e sem sobras. */
function checkAgainstPlan(
  h: YearHierarchy,
  plan: YearPlan,
  yearId: string,
): string[] {
  const problems: string[] = [];

  const index = (
    pages: PageObjectResponse[],
    key: (p: PageObjectResponse) => string | number | null,
    what: string,
  ) => {
    const map = indexBy(pages, key);
    if (map.size !== pages.length) {
      problems.push(
        `${what}: ${pages.length} páginas para ${map.size} chaves distintas (duplicadas ou sem chave)`,
      );
    }
    return map;
  };
  const exactParent = (
    page: PageObjectResponse,
    property: string,
    parentId: string,
    what: string,
  ) => {
    const ids = relationIds(page.properties, property).map(normId);
    if (ids.length !== 1 || ids[0] !== normId(parentId)) {
      problems.push(
        `${what}: ligação "${property}" errada (${ids.length} pais, esperado 1 = ${normId(parentId).slice(0, 8)}…)`,
      );
    }
  };

  const quarters = index(
    h.quarters,
    (p) => num(p, "Número do Trimestre"),
    "trimestres",
  );
  const months = index(h.months, (p) => num(p, "Nº do mês"), "meses");
  const weeks = index(h.weeks, (p) => num(p, "Semana nº"), "semanas");
  const days = index(h.days, dateOf, "dias");

  for (const q of plan.quarters) {
    const page = quarters.get(q.number);
    if (!page) problems.push(`trimestre ${q.name} não existe`);
    else {
      if (name(page) !== q.name)
        problems.push(`trimestre ${q.name}: nome "${name(page)}"`);
      exactParent(page, "Anos", yearId, `trimestre ${q.name}`);
    }
  }
  for (const m of plan.months) {
    const page = months.get(m.number);
    if (!page) {
      problems.push(`mês ${m.name} não existe`);
      continue;
    }
    if (name(page) !== m.name)
      problems.push(`mês ${m.name}: nome "${name(page)}"`);
    const parent = quarters.get(plan.quarters[m.quarterIndex]!.number);
    if (parent) exactParent(page, "Trimestres", parent.id, `mês ${m.name}`);
  }
  for (const w of plan.weeks) {
    const page = weeks.get(w.number);
    if (!page) {
      problems.push(`${w.name} não existe`);
      continue;
    }
    if (name(page) !== w.name) problems.push(`${w.name}: nome "${name(page)}"`);
    if (label(page) !== w.label)
      problems.push(
        `${w.name}: rótulo "${label(page)}" (esperado "${w.label}")`,
      );
    // monthIndex < 0: a semana começou num mês fora do plano → fica no 1º mês
    const parent = months.get(plan.months[Math.max(w.monthIndex, 0)]!.number);
    if (parent) exactParent(page, "Meses", parent.id, w.name);
  }
  for (const d of plan.days) {
    const page = days.get(d.date);
    if (!page) {
      problems.push(`dia ${d.date} não existe`);
      continue;
    }
    if (name(page) !== d.name)
      problems.push(`dia ${d.date}: nome "${name(page)}"`);
    if (num(page, "Dia Nº") !== d.weekdayNumber)
      problems.push(`dia ${d.date}: "Dia Nº" ${num(page, "Dia Nº")}`);
    const parent = weeks.get(plan.weeks[d.weekIndex]!.number);
    if (parent) exactParent(page, "Semana", parent.id, `dia ${d.date}`);
  }

  const extra = (found: number, expected: number, what: string) => {
    if (found !== expected)
      problems.push(`${what}: ${found} encontrados, ${expected} esperados`);
  };
  extra(h.quarters.length, plan.quarters.length, "trimestres");
  extra(h.months.length, plan.months.length, "meses");
  extra(h.weeks.length, plan.weeks.length, "semanas");
  extra(h.days.length, plan.days.length, "dias");

  return problems;
}

/** O Notion demora a refletir relações recém-criadas: tenta de novo antes de dar erro. */
async function verify(yearId: string, plan: YearPlan) {
  const ATTEMPTS = 6;
  for (let attempt = 1; ; attempt++) {
    const h = await collectYearHierarchy(yearId);
    const problems = checkAgainstPlan(h, plan, yearId);
    if (problems.length === 0 || attempt === ATTEMPTS) return { h, problems };
    log(
      `  … Notion ainda não refletiu tudo (tentativa ${attempt}/${ATTEMPTS}); aguardando 5s`,
    );
    await sleep(5000);
  }
}

/** O que falta no Notion para o ano ficar igual ao plano (diagnóstico antes do repair). */
function diagnose(h: YearHierarchy, plan: YearPlan) {
  const have = (
    pages: PageObjectResponse[],
    key: (p: PageObjectResponse) => string | number,
  ) => new Set(pages.map(key));
  const q = have(h.quarters, (p) => num(p, "Número do Trimestre"));
  const m = have(h.months, (p) => num(p, "Nº do mês"));
  const w = have(h.weeks, (p) => num(p, "Semana nº"));
  const d = have(h.days, dateOf);
  return {
    quarters: plan.quarters.filter((x) => !q.has(x.number)).map((x) => x.name),
    months: plan.months.filter((x) => !m.has(x.number)).map((x) => x.name),
    weeks: plan.weeks.filter((x) => !w.has(x.number)).map((x) => x.name),
    days: plan.days.filter((x) => !d.has(x.date)).map((x) => x.date),
  };
}

// ---------- execução ----------

type PhaseSummary = { phase: string; ok: boolean; took: number };
const summary: PhaseSummary[] = [];

async function phase(title: string, fn: () => Promise<string[]>) {
  log(`\n━━ ${title}`);
  const start = Date.now();
  let problems: string[];
  try {
    problems = await fn();
  } catch (error) {
    summary.push({ phase: title, ok: false, took: Date.now() - start });
    throw error;
  }
  const took = Date.now() - start;
  summary.push({ phase: title, ok: problems.length === 0, took });
  if (problems.length > 0) {
    problems.forEach((p) => log(`  ✖ ${p}`));
    throw new Error(`${title}: ${problems.length} problema(s) encontrado(s).`);
  }
  log(`  ✔ ok (${fmt(took)})`);
}

async function main() {
  const now = new Date().getFullYear();
  if (!Number.isInteger(YEAR) || YEAR < now + 10) {
    throw new Error(
      `Ano de teste inválido (${YEAR}). Use um ano bem no futuro (>= ${now + 10}) para nunca tocar em dados reais.`,
    );
  }

  const createFrom = `${YEAR}-10-01`;
  const repairFrom = `${YEAR}-09-01`;
  const createPlan = buildPlan(YEAR, createFrom);
  const repairPlan = buildPlan(YEAR, repairFrom);

  log(`Teste E2E da rotina — ano ${YEAR} (no Notion real)`);
  if (await findYearPageId(String(YEAR))) {
    throw new Error(
      `O ano ${YEAR} já existe no Notion. Abortando sem alterar nada (apague-o antes se for lixo de teste).`,
    );
  }

  let yearId: string | null = null;
  let deleted = false;

  try {
    // 1. createYear (out–dez)
    await phase(`1/3 createYear — de ${createFrom} (out–dez)`, async () => {
      const result = await createYear(YEAR, createFrom);
      yearId = result.yearPageId;
      log(
        `  criado: ${plural(result.created.quarters, "trimestre", "trimestres")}, ${plural(result.created.months, "mês", "meses")}, ${plural(result.created.weeks, "semana", "semanas")}, ${plural(result.created.days, "dia", "dias")}`,
      );
      const { h, problems } = await verify(yearId, createPlan);
      printTree(h);
      return problems;
    });

    // 2. repair (set–dez): falta Setembro (+ T3, suas semanas e dias)
    await phase(`2/3 repair — de ${repairFrom} (set–dez)`, async () => {
      const before = await collectYearHierarchy(yearId!);
      const missing = diagnose(before, repairPlan);
      log(
        `  diagnóstico: faltam ${plural(missing.quarters.length, "trimestre", "trimestres")} (${missing.quarters.join(", ") || "—"}), ${plural(missing.months.length, "mês", "meses")} (${missing.months.join(", ") || "—"}), ${plural(missing.weeks.length, "semana", "semanas")}, ${plural(missing.days.length, "dia", "dias")}`,
      );

      const result = await repairYear(YEAR, repairFrom);
      log(
        `  reparado: criou ${plural(result.created.quarters, "trimestre", "trimestres")}, ${plural(result.created.months, "mês", "meses")}, ${plural(result.created.weeks, "semana", "semanas")}, ${plural(result.created.days, "dia", "dias")}; religou ${result.relinked.months} meses, ${result.relinked.weeks} semanas, ${result.relinked.days} dias`,
      );

      const problems: string[] = [];
      const expectCreated = {
        quarters: missing.quarters.length,
        months: missing.months.length,
        weeks: missing.weeks.length,
        days: missing.days.length,
      };
      for (const k of Object.keys(
        expectCreated,
      ) as (keyof typeof expectCreated)[]) {
        if (result.created[k] !== expectCreated[k]) {
          problems.push(
            `repair criou ${result.created[k]} ${k}, esperado ${expectCreated[k]}`,
          );
        }
      }
      // A semana que atravessa set/out foi ligada a Outubro no createYear e deve ir para Setembro.
      const monthOf = (plan: YearPlan, monthIndex: number) =>
        plan.months[Math.max(monthIndex, 0)]!.number;
      const expectRelinkedWeeks = repairPlan.weeks.filter(
        (w) =>
          w.monthIndex >= 0 &&
          createPlan.weeks.some(
            (c) =>
              c.number === w.number &&
              monthOf(createPlan, c.monthIndex) !==
                monthOf(repairPlan, w.monthIndex),
          ),
      ).length;
      if (result.relinked.weeks !== expectRelinkedWeeks) {
        problems.push(
          `repair religou ${result.relinked.weeks} semanas, esperado ${expectRelinkedWeeks}`,
        );
      }
      if (result.relinked.months !== 0 || result.relinked.days !== 0) {
        problems.push(
          `repair religou ${result.relinked.months} meses e ${result.relinked.days} dias, esperado 0`,
        );
      }

      const verified = await verify(yearId!, repairPlan);
      log("  mês(es) criado(s) pelo repair:");
      printTree(
        verified.h,
        missing.months.map(
          (m) => repairPlan.months.find((x) => x.name === m)!.number,
        ),
      );
      return [...problems, ...verified.problems];
    });

    // 3. deleteYear
    await phase("3/3 deleteYear", async () => {
      const before = await collectYearHierarchy(yearId!);
      log(`  existe no ano ${YEAR}: ${counts(before)}`);
      const result = await deleteYear(YEAR);
      deleted = true;
      log(
        `  apagado (lixeira): 1 ano, ${plural(result.deleted.quarters, "trimestre", "trimestres")}, ${plural(result.deleted.months, "mês", "meses")}, ${plural(result.deleted.weeks, "semana", "semanas")}, ${plural(result.deleted.days, "dia", "dias")}`,
      );

      const problems: string[] = [];
      const pairs: [string, number, number][] = [
        ["trimestres", result.deleted.quarters, before.quarters.length],
        ["meses", result.deleted.months, before.months.length],
        ["semanas", result.deleted.weeks, before.weeks.length],
        ["dias", result.deleted.days, before.days.length],
      ];
      for (const [what, got, want] of pairs) {
        if (got !== want)
          problems.push(`delete apagou ${got} ${what}, existiam ${want}`);
      }
      if (await findYearPageId(String(YEAR)))
        problems.push("a página do ano ainda existe");
      const left = await collectYearHierarchy(yearId!);
      const total =
        left.quarters.length +
        left.months.length +
        left.weeks.length +
        left.days.length;
      if (total > 0) problems.push(`sobraram páginas: ${counts(left)}`);
      else log("  conferido: nada sobrou no Notion");
      return problems;
    });
  } finally {
    if (yearId && !deleted && !KEEP) {
      log("\n━━ Limpeza (o teste falhou no meio)");
      try {
        const r = await deleteYear(YEAR);
        log(`  apagado: ${JSON.stringify(r.deleted)}`);
      } catch (error) {
        log(
          `  ✖ não consegui limpar o ano ${YEAR}: ${(error as Error).message}. Apague-o à mão.`,
        );
      }
    } else if (yearId && !deleted && KEEP) {
      log(
        `\n(--keep) o ano ${YEAR} ficou no Notion; apague com DELETE /deleteYear?year=${YEAR}.`,
      );
    }
  }
}

main()
  .then(() => {
    log("\n━━ Resumo");
    summary.forEach((s) => log(`  ✔ ${s.phase} — ${fmt(s.took)}`));
    log("TESTE OK");
  })
  .catch((error) => {
    log("\n━━ Resumo");
    summary.forEach((s) =>
      log(`  ${s.ok ? "✔" : "✖"} ${s.phase} — ${fmt(s.took)}`),
    );
    console.error(`\nTESTE FALHOU: ${(error as Error).message}`);
    process.exitCode = 1;
  });

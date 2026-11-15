// Calendário puro (sem Notion): descreve quantos trimestres, meses, semanas e dias
// um ano tem e como eles se encaixam. Tudo em UTC para não sofrer com fuso/horário de verão.

export const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

const MONTH_ABBR = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

// Índice = Date#getUTCDay() (0 = domingo)
const WEEKDAY_NAMES = [
  "Domingo",
  "Segunda - Feira",
  "Terça - Feira",
  "Quarta - Feira",
  "Quinta - Feira",
  "Sexta - Feira",
  "Sábado",
] as const;

export type DayPlan = {
  /** "YYYY-MM-DD" */
  date: string;
  name: string;
  /** Dia da semana, Domingo = 1 ... Sábado = 7 (padrão já usado no database) */
  weekdayNumber: number;
  /** Índice (0-based) da semana em YearPlan.weeks */
  weekIndex: number;
};

export type WeekPlan = {
  name: string;
  /** Semana nº, crescente no ano (1..N) */
  number: number;
  /** Ex.: "24 Nov ➝ 30 Nov" (cortada nos limites do ano) */
  label: string;
  /** Índice (0-based) do mês (em YearPlan.months) do primeiro dia da semana */
  monthIndex: number;
};

export type MonthPlan = {
  name: string;
  /** 1..12 */
  number: number;
  quarterIndex: number;
};

export type QuarterPlan = {
  name: string;
  /** 1..4 */
  number: number;
};

export type YearPlan = {
  name: string;
  quarters: QuarterPlan[];
  months: MonthPlan[];
  weeks: WeekPlan[];
  days: DayPlan[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function toIso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatShort(d: Date) {
  return `${d.getUTCDate()} ${MONTH_ABBR[d.getUTCMonth()]}`;
}

/**
 * Mantém só o que falta a partir de `fromDate` ("YYYY-MM-DD"): dias >= fromDate,
 * as semanas que ainda têm algum desses dias (com a numeração original do ano e o
 * rótulo completo), e os meses/trimestres de `fromDate` em diante. Reindexa as referências.
 */
export function trimPlanFrom(plan: YearPlan, fromDate: string): YearPlan {
  const days = plan.days.filter((d) => d.date >= fromDate);
  const firstMonth = Number(fromDate.slice(5, 7)) - 1;

  const months = plan.months.filter((_, i) => i >= firstMonth);
  const firstQuarter = months[0]!.quarterIndex;
  const quarters = plan.quarters.slice(firstQuarter);

  const usedWeeks = [...new Set(days.map((d) => d.weekIndex))];
  const weeks = usedWeeks.map((i) => plan.weeks[i]!);

  return {
    name: plan.name,
    quarters,
    months: months.map((m) => ({
      ...m,
      quarterIndex: m.quarterIndex - firstQuarter,
    })),
    weeks: weeks.map((w) => ({
      ...w,
      // A semana pode ter começado no mês anterior, que não será criado: liga ao 1º mês criado
      monthIndex: Math.max(w.monthIndex - firstMonth, 0),
    })),
    days: days.map((d) => ({
      ...d,
      weekIndex: usedWeeks.indexOf(d.weekIndex),
    })),
  };
}

export function buildYearPlan(year: number): YearPlan {
  const quarters: QuarterPlan[] = [1, 2, 3, 4].map((n) => ({
    name: `T${n}`,
    number: n,
  }));

  const months: MonthPlan[] = MONTH_NAMES.map((name, i) => ({
    name,
    number: i + 1,
    quarterIndex: Math.floor(i / 3),
  }));

  const days: DayPlan[] = [];
  const weeks: WeekPlan[] = [];

  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year, 11, 31);

  // Semanas de segunda a domingo; a semana 1 é a que contém 1º de janeiro.
  // Dias fora do ano não são criados, então a primeira/última semana ficam "cortadas".
  let weekFirstDay: Date | null = null;
  let weekLastDay: Date | null = null;

  const closeWeek = () => {
    if (!weekFirstDay || !weekLastDay) return;
    const number = weeks.length + 1;
    weeks.push({
      name: `Semana ${number}`,
      number,
      label: `${formatShort(weekFirstDay)} ➝ ${formatShort(weekLastDay)}`,
      monthIndex: weekFirstDay.getUTCMonth(),
    });
  };

  for (let t = start; t <= end; t += DAY_MS) {
    const date = new Date(t);
    const weekday = date.getUTCDay();

    // Segunda-feira abre uma nova semana (exceto no primeiro dia do ano, que já abre a semana 1)
    if (weekday === 1 && weekFirstDay) {
      closeWeek();
      weekFirstDay = null;
    }
    weekFirstDay ??= date;
    weekLastDay = date;

    days.push({
      date: toIso(date),
      name: WEEKDAY_NAMES[weekday]!,
      weekdayNumber: weekday + 1,
      weekIndex: weeks.length, // semana ainda aberta = próximo índice
    });
  }
  closeWeek();

  return { name: String(year), quarters, months, weeks, days };
}

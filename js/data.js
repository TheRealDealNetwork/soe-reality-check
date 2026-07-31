/**
 * SOE Business Machine Reality Check — condensed practice instrument.
 * Live group diagnostic: short questions, Owner vs Manager charts.
 * Voice: ~5th grade. No em dashes. Answer from real life this week.
 */

export const HOST_KEY = "soe-host-2026";

export const ROLES = [
  { id: "owner", label: "Owner", group: "owner", blurb: "You own or co-own the company." },
  { id: "manager", label: "Manager", group: "manager", blurb: "You lead a seat or team in the company." },
];

/** Optional seat tags for managers (shown after role pick). */
export const MANAGER_SEATS = [
  { id: "general", label: "General Manager" },
  { id: "marketing", label: "Marketing" },
  { id: "appointments", label: "Appointment Center" },
  { id: "sales", label: "Sales" },
  { id: "production", label: "Production" },
  { id: "service", label: "Service" },
  { id: "office", label: "Office" },
  { id: "accounting", label: "Accounting" },
  { id: "recruiting", label: "Recruiting" },
  { id: "other", label: "Other / multiple" },
];

/**
 * Answer scale (matches SOE audit UX).
 * "not_sure" is excluded from averages.
 */
export const SCALE = [
  { id: "yes", label: "Yes", value: 2, short: "Yes" },
  { id: "sometimes", label: "Sometimes", value: 1, short: "Some" },
  { id: "not_yet", label: "Not yet / Not really", value: 0, short: "Not yet" },
  { id: "not_sure", label: "Not sure", value: null, short: "N/A" },
];

/** Condensed gears for live session (2 questions each). Score 0–100 per gear. */
export const GEARS = [
  {
    id: "leader",
    name: "Leadership",
    blurb: "The company will not get better than how you run your week.",
    questions: [
      { id: "l1", text: "Can you write down the income you want, the hours you want to work, and a real date for both?" },
      { id: "l2", text: "Does your team know what winning looks like for the company this year in one short sentence?" },
    ],
  },
  {
    id: "people",
    name: "People",
    blurb: "Wrong people and slow decisions cost more than most ads.",
    questions: [
      { id: "p1", text: "When forced, do you weight character at least as high as skill?" },
      { id: "p2", text: "When someone is clearly not working out, do you deal with it in weeks, not years?" },
    ],
  },
  {
    id: "marketing",
    name: "Leads",
    blurb: "No leads means no company. Bad tracking wastes money.",
    questions: [
      { id: "m1", text: "Can you tell which ads or sources actually create jobs?" },
      { id: "m2", text: "Do you track leads and booked jobs, not likes and views?" },
    ],
  },
  {
    id: "appointments",
    name: "Appointment Center",
    blurb: "Paid interest dies when no one calls back fast.",
    questions: [
      { id: "a1", text: "When a web lead comes in, does someone try them within minutes?" },
      { id: "a2", text: "Do inbound calls usually end in a booked appointment?" },
    ],
  },
  {
    id: "sales",
    name: "Sales",
    blurb: "Same leads can make very different money.",
    questions: [
      { id: "s1", text: "Do your sellers follow one clear process every time?" },
      { id: "s2", text: "Do unsold jobs get follow up on purpose, not only when someone remembers?" },
    ],
  },
  {
    id: "production",
    name: "Production",
    blurb: "Install day is when the customer decides if they will refer you.",
    questions: [
      { id: "pr1", text: "Does every job report in daily with photos and what is next?" },
      { id: "pr2", text: "When a customer complains, is it owned within a day with a real fix plan?" },
    ],
  },
  {
    id: "money",
    name: "Money",
    blurb: "Busy and broke is still broke.",
    questions: [
      { id: "c1", text: "Could you say about where cash stands this month without digging for an hour?" },
      { id: "c2", text: "Do you know how much you need to sell each month just to break even?" },
    ],
  },
  {
    id: "machine",
    name: "The Machine",
    blurb: "Heroes do not scale. Clear owners and clean handoffs do.",
    questions: [
      { id: "mc1", text: "Does every major area have a clear owner and one number that means they are winning?" },
      { id: "mc2", text: "Could the company run a full week without you deciding almost everything?" },
    ],
  },
];

export function allQuestions() {
  return GEARS.flatMap((g) =>
    g.questions.map((q) => ({ ...q, gearId: g.id, gearName: g.name }))
  );
}

/** Score one gear from answer map. Returns 0–100 or null if no scored answers. */
export function scoreGear(gear, answers) {
  let sum = 0;
  let n = 0;
  for (const q of gear.questions) {
    const v = answers[q.id];
    if (v === null || v === undefined) continue;
    sum += Number(v);
    n += 1;
  }
  if (n === 0) return null;
  return Math.round((sum / (n * 2)) * 100);
}

export function scoreAll(answers) {
  const byGear = {};
  let total = 0;
  let count = 0;
  for (const gear of GEARS) {
    const s = scoreGear(gear, answers);
    byGear[gear.id] = s;
    if (s !== null) {
      total += s;
      count += 1;
    }
  }
  return {
    byGear,
    overall: count ? Math.round(total / count) : null,
  };
}

export function bandLabel(score) {
  if (score === null || score === undefined) return "—";
  if (score >= 80) return "Strong";
  if (score >= 55) return "Mixed";
  if (score >= 30) return "Soft";
  return "Stuck";
}

export function demoSessionId() {
  return "TEST-001";
}

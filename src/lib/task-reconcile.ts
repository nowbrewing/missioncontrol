export function normalizeTaskTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function tasksSimilar(a: string, b: string): boolean {
  const na = normalizeTaskTitle(a);
  const nb = normalizeTaskTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 8 && nb.length >= 8 && (na.includes(nb) || nb.includes(na))) {
    return true;
  }

  const wordsA = new Set(na.split(" ").filter((w) => w.length > 2));
  const wordsB = new Set(nb.split(" ").filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return false;

  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  const minSize = Math.min(wordsA.size, wordsB.size);
  return overlap / minSize >= 0.6;
}

type OpenTask = {
  id: number;
  title: string;
  completed_at?: string | null;
};

export function reconcileIntakeTasks<T extends { title: string }>(
  newTasks: T[],
  promoteIds: number[],
  openTasks: OpenTask[]
): { tasks: T[]; promote_to_today: number[] } {
  const open = openTasks.filter((t) => !t.completed_at);
  const openById = new Map(open.map((t) => [t.id, t]));
  const promoteSet = new Set(
    promoteIds.filter((id) => openById.has(id))
  );

  const toCreate: T[] = [];

  for (const task of newTasks) {
    const match = open.find((t) => tasksSimilar(t.title, task.title));
    if (match) {
      promoteSet.add(match.id);
      continue;
    }

    const duplicatesPromote = [...promoteSet].some((id) => {
      const existing = openById.get(id);
      return existing && tasksSimilar(existing.title, task.title);
    });
    if (!duplicatesPromote) {
      toCreate.push(task);
    }
  }

  return {
    tasks: toCreate,
    promote_to_today: [...promoteSet],
  };
}

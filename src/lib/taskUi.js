// Чистая логика вкладки «Задачи» (без React/Supabase) — светофор срока и сводка.
// «Сегодня» всегда передаётся параметром (тестируемость, как в dashboardMetrics.js).

export const DUE_SOON_DAYS = 3; // порог «жёлтого» (≤ N дней до срока)

export const DUE_COLORS = {
  none: "#62646b",     // срока нет
  ok: "#6ee7a8",       // времени достаточно
  soon: "#e8c860",     // ≤ DUE_SOON_DAYS дней
  overdue: "#f8a3a3",  // просрочено
};

export const PRIORITY_ORDER = { "Высокий": 0, "Обычный": 1, "Низкий": 2 };

// dueDate/today — строки 'YYYY-MM-DD'. Возврат: { level, days } (days < 0 = просрочено).
export function dueState(dueDate, today, soonDays = DUE_SOON_DAYS) {
  if (!dueDate) return { level: "none", days: null };
  const d = Date.parse(dueDate + "T00:00:00Z");
  const t = Date.parse(today + "T00:00:00Z");
  if (Number.isNaN(d) || Number.isNaN(t)) return { level: "none", days: null };
  const days = Math.round((d - t) / 86400000);
  if (days < 0) return { level: "overdue", days };
  if (days <= soonDays) return { level: "soon", days };
  return { level: "ok", days };
}

// Человеческий хвост к дате: 'сегодня' / 'через 2 дн' / '−2 дн' (минус — U+2212, как в мокапе).
export function dueSuffix(days) {
  if (days == null) return "";
  if (days === 0) return "сегодня";
  if (days < 0) return `−${-days} дн`;
  return `через ${days} дн`;
}

export const TASK_QUEUE_FILTERS = [
  { id: "all", label: "Все" },
  { id: "attention", label: "Требуют внимания" },
  { id: "today", label: "На сегодня" },
  { id: "myAction", label: "Мой следующий шаг" },
];

export function taskCalendarDate(date = new Date()) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map(part => String(part).padStart(2, "0")).join("-");
}

export function isActiveTask(task) {
  return task.status !== "Готово" && task.status !== "Отменена";
}

export function taskNextStep(task) {
  if (task.status === "На проверке") {
    return { ownerId: task.authorId, ownerName: task.authorName || "Автор", label: "Принять результат" };
  }
  if (task.status !== "Новая" && task.status !== "В работе") return null;
  if (!task.assignedTo) {
    return { ownerId: task.authorId, ownerName: task.authorName || "Автор", label: "Назначить исполнителя" };
  }
  return { ownerId: task.assignedTo, ownerName: task.assigneeName || "Исполнитель",
    label: task.status === "Новая" ? "Взять в работу" : "Подготовить результат" };
}

export function matchesTaskQueue(task, filter, today, viewerId) {
  if (filter === "all") return true;
  if (!isActiveTask(task)) return false;
  if (filter === "today") return task.dueDate === today;
  if (filter === "myAction") return !!viewerId && taskNextStep(task)?.ownerId === viewerId;
  return filter === "attention" && (dueState(task.dueDate, today).level === "overdue" || !!task.hasOpenQuestion);
}

export function tasksAttention(tasks, today) {
  return tasks.filter(task => matchesTaskQueue(task, "attention", today)).length;
}

export function compareTaskDue(a, b) {
  if (a.dueDate === b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return a.dueDate.localeCompare(b.dueDate);
}

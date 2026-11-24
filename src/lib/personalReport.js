import Decimal from "decimal.js-light";

const money = value => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

export function personalReportRow(project, viewerId) {
  if (!viewerId) throw new Error("Для отчёта нужен авторизованный пользователь.");
  const { project_shares: shares, share_count: count } = project;
  if (!Array.isArray(shares) || !Array.isArray(count) || shares.length !== (count[0]?.count ?? 0)) {
    throw new Error("Не удалось получить все доли проекта.");
  }
  const contract = new Decimal(project.contract_sum ?? 0);
  const owned = project.owner_id === viewerId;
  const relevant = owned ? shares : shares.filter(share => share.participant_user_id === viewerId);
  const row = { id: project.id, name: project.name, client: project.client, stage: project.stage,
    deadline: project.deadline, executor: project.executor, type: project.type, notes: project.notes };
  if (!owned && !relevant.length) return { ...row, reason: "Доля не назначена" };
  const allocated = relevant.reduce((sum, share) => {
    const value = new Decimal(share.share_value);
    return sum.plus(share.share_kind === "percent" ? contract.times(value).div(100) : value);
  }, new Decimal(0));
  if (!contract.isPositive()) {
    const fixed = !owned && relevant.every(share => share.share_kind === "amount");
    return { ...row, amount: fixed ? money(allocated) : undefined, reason: "Нет суммы договора для расчёта" };
  }
  if (allocated.gt(contract)) return { ...row, reason: "Сумма долей превышает договор" };
  const amount = owned ? contract.minus(allocated) : allocated;
  if (project.paid_amount == null) return { ...row, amount: money(amount), reason: "Нет данных об оплате" };
  const received = amount.times(project.paid_amount).div(contract);
  // Остаток сверяется с двумя видимыми суммами, округлёнными до копеек.
  return { ...row, amount: money(amount), received: money(received),
    remaining: Math.max(0, money(new Decimal(money(amount)).minus(money(received)))) };
}

export async function loadPersonalReport(client, ids, viewerId) {
  const rows = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const { data, error } = await client.from("projects")
      .select("id,name,client,stage,deadline,type,executor,notes,owner_id,contract_sum,paid_amount,project_shares(participant_user_id,share_kind,share_value),share_count:project_shares(count)")
      .in("id", batch);
    if (error) throw error;
    if (data?.length !== batch.length) throw new Error("Список доступных проектов изменился. Откройте проекты заново.");
    for (const project of data) rows.set(project.id, personalReportRow(project, viewerId));
  }
  return ids.map(id => rows.get(id));
}

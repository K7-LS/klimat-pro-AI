import { describe, expect, it } from "vitest";
import { personalReportRow, loadPersonalReport } from "./personalReport.js";

const share = (user, kind, value) => ({ participant_user_id: user, share_kind: kind, share_value: value });
function project(shares = [], fields = {}) {
  return { id: "one", owner_id: "owner", contract_sum: 100000, paid_amount: 40000,
    project_shares: shares, share_count: [{ count: shares.length }], ...fields };
}
describe("персональный отчёт", () => {
  const split = project([share("engineer", "amount", 10000), share("engineer", "percent", 15)]);
  it("распределяет остаток владельцу и суммирует назначения исполнителя по ID", () => {
    expect(personalReportRow(split, "owner")).toMatchObject({ amount: 75000, received: 30000, remaining: 45000 });
    expect(personalReportRow(split, "engineer")).toMatchObject({ amount: 25000, received: 10000, remaining: 15000 });
    expect(personalReportRow(split, "other").amount).toBeUndefined();
  });
  it("округляет 10,075 до 10,08 и распределяет до округления", () => {
    const p = project([share("engineer", "percent", 1)], { contract_sum: 1007.5, paid_amount: 1007.5 });
    expect(personalReportRow(p, "engineer")).toMatchObject({ amount: 10.08, received: 10.08, remaining: 0 });
  });
  it("сохраняет известную фиксированную долю при пустом договоре", () => {
    const r = personalReportRow(project([share("engineer", "amount", 5000)], { contract_sum: null }), "engineer");
    expect(r.amount).toBe(5000);
    expect(r.received).toBeUndefined();
  });
  it("отличает ноль от неизвестной оплаты и переплаты", () => {
    expect(personalReportRow(project([], { paid_amount: 0 }), "owner").received).toBe(0);
    expect(personalReportRow(project([], { paid_amount: null }), "owner").received).toBeUndefined();
    expect(personalReportRow(project([], { paid_amount: 110000 }), "owner")).toMatchObject({received: 110000, remaining: 0});
  });
  it("блокирует неполную выборку долей и отмечает перераспределение", () => {
    expect(() => personalReportRow({ ...split, project_shares: [] }, "owner")).toThrow();
    expect(personalReportRow(project([share("engineer", "percent", 110)]), "owner").amount).toBeUndefined();
  });
  it("не выпускает отчёт при отказе сервера или недоступном объекте", async () => {
    const client = response => ({ from: () => ({ select: () => ({ in: () => response }) }) });
    await expect(loadPersonalReport(client({ error: new Error("offline") }), ["one"], "owner")).rejects.toThrow("offline");
    await expect(loadPersonalReport(client({ data: [] }), ["one"], "owner")).rejects.toThrow("доступных");
  });
});

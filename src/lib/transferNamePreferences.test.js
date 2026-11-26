import { describe, expect, it, vi } from "vitest";
import { cacheSelfTransferNames, fetchSelfTransferNames, readCachedSelfTransferNames, upsertSelfTransferNames } from "./transferNamePreferences.js";

describe("bank transfer name preferences", () => {
  it("loads the previous account cache and keeps an explicit empty selection", () => {
    const data = new Map([["kp-appearance:account", JSON.stringify({
      skinId: "marble", effectId: "tilt", selfTransferNames: [" Иван ", "Иван", "x", null],
    })]]);
    const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
    expect(readCachedSelfTransferNames(storage, "account")).toEqual(["Иван"]);
    expect(readCachedSelfTransferNames(storage, "someone-else")).toEqual([]);
    cacheSelfTransferNames(storage, "account", []);
    expect(readCachedSelfTransferNames(storage, "account")).toEqual([]);
    expect(JSON.parse(data.get("kp-appearance:account")).effectId).toBe("tilt");
  });

  it("reads just the name list and rejects a failed response", async () => {
    const maybeSingle = vi.fn().mockResolvedValueOnce({ data: { self_transfer_names: ["Имя"] } })
      .mockResolvedValueOnce({ error: new Error("network") });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const client = { from: vi.fn(() => ({ select })) };
    await expect(fetchSelfTransferNames(client, "account")).resolves.toEqual(["Имя"]);
    expect(select).toHaveBeenCalledWith("self_transfer_names");
    expect(eq).toHaveBeenCalledWith("user_id", "account");
    await expect(fetchSelfTransferNames(client, "account")).rejects.toThrow("network");
  });

  it("updates names without including card preferences", async () => {
    const select = vi.fn(() => ({ single: async () => ({ data: { self_transfer_names: ["Новое имя"] } }) }));
    const upsert = vi.fn(() => ({ select }));
    const client = { from: vi.fn(() => ({ upsert })) };
    await expect(upsertSelfTransferNames(client, "account", [" Новое имя ", "Новое имя"])).resolves.toEqual(["Новое имя"]);
    expect(upsert).toHaveBeenCalledWith({
      user_id: "account", self_transfer_names: ["Новое имя"], updated_at: expect.any(String),
    }, { onConflict: "user_id", defaultToNull: false });
    expect(select).toHaveBeenCalledWith("self_transfer_names");
  });
});

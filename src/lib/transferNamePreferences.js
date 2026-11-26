export function normalizeSelfTransferNames(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap(name =>
    typeof name === "string" && name.trim().length >= 2 ? [name.trim()] : []
  ))].slice(0, 12);
}

const cacheKey = userId => `kp-self-transfer-names:${userId}`;

export function readCachedSelfTransferNames(storage, userId) {
  const current = storage.getItem(cacheKey(userId));
  if (current !== null) return normalizeSelfTransferNames(JSON.parse(current));
  const legacy = JSON.parse(storage.getItem(`kp-appearance:${userId}`));
  return normalizeSelfTransferNames(legacy?.selfTransferNames ?? legacy?.self_transfer_names);
}

export function cacheSelfTransferNames(storage, userId, names) {
  storage.setItem(cacheKey(userId), JSON.stringify(names));
}

export async function fetchSelfTransferNames(client, userId) {
  const { data, error } = await client.from("user_appearance_preferences")
    .select("self_transfer_names")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return normalizeSelfTransferNames(data?.self_transfer_names);
}

export async function upsertSelfTransferNames(client, userId, names) {
  const { data, error } = await client.from("user_appearance_preferences")
    .upsert({
      user_id: userId,
      self_transfer_names: normalizeSelfTransferNames(names),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id", defaultToNull: false })
    .select("self_transfer_names")
    .single();
  if (error) throw error;
  return normalizeSelfTransferNames(data.self_transfer_names);
}

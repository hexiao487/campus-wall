/** 基于 app_config(key/value) 的小型键值存储，避免频繁建表 */
export async function readJson(supabase, key, fallback) {
  try {
    const { data } = await supabase.from('app_config').select('value').eq('key', key).maybeSingle();
    if (!data || data.value == null) return fallback;
    return JSON.parse(data.value);
  } catch {
    return fallback;
  }
}

export async function writeJson(supabase, key, value) {
  const { error } = await supabase
    .from('app_config')
    .upsert({ key, value: JSON.stringify(value) }, { onConflict: 'key' });
  if (error) throw new Error(error.message);
  return true;
}

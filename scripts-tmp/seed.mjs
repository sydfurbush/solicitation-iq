import { createClient } from '@supabase/supabase-js';
import { LENS_PRESETS } from '/dev-server/src/features/clients/lib/lensPresets.ts';

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const utilities = LENS_PRESETS.filter(p => p.family === 'utility');
console.log('Seeding', utilities.length, 'utility presets');

for (const p of utilities) {
  const { key, label, description, family, ...content } = p;
  const { data: existing } = await supa.from('lens_presets').select('id').eq('key', key).is('organization_id', null).maybeSingle();
  if (existing) { console.log('skip', key); continue; }
  const { data: preset, error: e1 } = await supa.from('lens_presets').insert({
    organization_id: null, key, label, description, family, is_builtin: true,
  }).select().single();
  if (e1) { console.error(key, e1); continue; }
  const { data: v, error: e2 } = await supa.from('lens_preset_versions').insert({
    preset_id: preset.id, version: 1, content, change_note: 'Initial seed',
  }).select().single();
  if (e2) { console.error(key, e2); continue; }
  await supa.from('lens_presets').update({ current_version_id: v.id }).eq('id', preset.id);
  console.log('seeded', key);
}

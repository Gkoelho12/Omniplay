/* OmniPlay · configuração
 * - SUPABASE_URL: derivado do teu projeto (phxzjlcqwbhmvpjodmjh).
 * - SUPABASE_ANON_KEY: Project Settings > API > "anon public". Esta chave é PÚBLICA por design
 *   (a segurança vem das regras RLS do supabase_schema.sql).
 * - NUNCA coloques aqui a password da base de dados nem a service_role key.
 */
window.OMNI_CONFIG = {
  SUPABASE_URL: 'https://phxzjlcqwbhmvpjodmjh.supabase.co',
  SUPABASE_ANON_KEY: '',          // <- cola aqui a anon key
  EMAIL_DOMAIN: 'omniplay.app'    // login = username@omniplay.app (por baixo)
};

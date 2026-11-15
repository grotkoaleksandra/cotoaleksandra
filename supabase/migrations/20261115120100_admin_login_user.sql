-- Applied once in the SQL editor (2026-11-15). Sign-ups are off, so Ola's
-- admin login has to exist before her first sign-in. No password: she signs in
-- with a code emailed to this address.
-- Pre-create Ola's admin login (passwordless: she signs in with an emailed code).
do $$
declare uid uuid := gen_random_uuid();
begin
  if not exists (select 1 from auth.users where lower(email) = 'cotoaleksandra@gmail.com') then
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      'cotoaleksandra@gmail.com', '', now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(),
      '', '', '', '', '', '', '', '');
    insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
    values (uid::text, uid, jsonb_build_object('sub', uid::text, 'email', 'cotoaleksandra@gmail.com', 'email_verified', true),
      'email', now(), now());
  end if;
end $$;

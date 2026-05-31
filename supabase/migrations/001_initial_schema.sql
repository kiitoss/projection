-- ============================================================
-- Projection — Schéma initial complet
-- À appliquer sur une base de données vide.
-- Après le premier login de l'owner, exécuter :
--   UPDATE user_settings SET authorized = true, role = 'admin'
--   WHERE user_id = (SELECT id FROM auth.users LIMIT 1);
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ============================================================
-- PROJECTS
-- ============================================================
create table projects (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  name                    text not null,
  short_description       text,
  show_short_desc_on_card boolean not null default true,
  long_description        text,
  key_points              text[] not null default '{}',
  show_key_points_on_card boolean not null default true,
  max_key_points_on_card  integer not null default 3,
  archived                boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ============================================================
-- TAGS
-- ============================================================
create table tags (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  name     text not null,
  color    text not null default '#6366f1',
  position integer not null default 0
);

create table project_tags (
  project_id uuid not null references projects(id) on delete cascade,
  tag_id     uuid not null references tags(id) on delete cascade,
  primary key (project_id, tag_id)
);

-- ============================================================
-- PROJECT LINKS
-- ============================================================
create table project_links (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  url        text not null,
  label      text,
  position   integer not null default 0
);

-- ============================================================
-- TABS
-- ============================================================
create type tab_type as enum ('infos', 'chaos', 'digest', 'widgets');

create table tabs (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  type       tab_type not null,
  title      text not null,
  position   integer not null default 0,
  config     jsonb not null default '{}'
);

-- ============================================================
-- TODOS
-- ============================================================
create table todos (
  id         uuid primary key default gen_random_uuid(),
  tab_id     uuid not null references tabs(id) on delete cascade,
  content    text not null,
  completed  boolean not null default false,
  urgent     boolean not null default false,
  position   integer not null default 0,
  parent_id  uuid references todos(id) on delete cascade,
  level      integer not null default 0 check (level between 0 and 4),
  created_at timestamptz not null default now()
);

-- ============================================================
-- CHAOS CONTENT
-- ============================================================
create table chaos_content (
  id         uuid primary key default gen_random_uuid(),
  tab_id     uuid not null unique references tabs(id) on delete cascade,
  content    text not null default '',
  updated_at timestamptz not null default now()
);

-- ============================================================
-- DIGEST GENERATED
-- ============================================================
create table digest_generated (
  id           uuid primary key default gen_random_uuid(),
  tab_id       uuid not null references tabs(id) on delete cascade,
  content      text not null,
  prompt_used  text not null,
  generated_at timestamptz not null default now()
);

-- ============================================================
-- WIDGETS
-- ============================================================
create table widgets (
  id                uuid primary key default gen_random_uuid(),
  tab_id            uuid not null references tabs(id) on delete cascade,
  title             text not null,
  prompt            text not null,
  content           text,
  position          integer not null default 0,
  last_generated_at timestamptz
);

-- ============================================================
-- USER SETTINGS
-- ============================================================
create table user_settings (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  gemini_api_key bytea,
  theme          text not null default 'system' check (theme in ('light', 'dark', 'system')),
  authorized     boolean not null default false,
  role           text not null default 'user' check (role in ('user', 'admin')),
  invited_by     uuid references auth.users(id) on delete set null
);

-- RPC : sauvegarder la clé Gemini chiffrée
-- pgcrypto est dans le schéma 'extensions' sur Supabase, d'où le search_path étendu
create or replace function save_gemini_key(key text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  passphrase text;
begin
  select decrypted_secret into passphrase
  from vault.decrypted_secrets
  where name = 'gemini_encryption_key';

  update user_settings
  set gemini_api_key = case
    when key is null or key = '' then null
    else pgp_sym_encrypt(key, passphrase)
  end
  where user_id = auth.uid();
end;
$$;

-- RPC : lire la clé Gemini déchiffrée
create or replace function get_gemini_key()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  passphrase text;
  result     text;
begin
  select decrypted_secret into passphrase
  from vault.decrypted_secrets
  where name = 'gemini_encryption_key';

  select case
    when gemini_api_key is null then null
    else pgp_sym_decrypt(gemini_api_key, passphrase)
  end into result
  from user_settings
  where user_id = auth.uid();

  return result;
end;
$$;

-- ============================================================
-- INVITE CODES
-- Les admins génèrent un code à 6 chiffres valable 30s.
-- Le premier user qui l'utilise est autorisé (parrain tracké).
-- ============================================================
create table invite_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text        not null,
  created_by  uuid        not null references auth.users(id) on delete cascade,
  expires_at  timestamptz not null,
  used_by     uuid        references auth.users(id) on delete set null,
  used_at     timestamptz,
  created_at  timestamptz default now()
);

-- ============================================================
-- AUTO-UPDATE updated_at
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at
  before update on projects
  for each row execute function update_updated_at();

create trigger chaos_content_updated_at
  before update on chaos_content
  for each row execute function update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table projects        enable row level security;
alter table tags            enable row level security;
alter table project_tags    enable row level security;
alter table project_links   enable row level security;
alter table tabs            enable row level security;
alter table todos           enable row level security;
alter table chaos_content   enable row level security;
alter table digest_generated enable row level security;
alter table widgets         enable row level security;
alter table user_settings   enable row level security;
alter table invite_codes    enable row level security;

-- Projets et données liées
create policy "users own their projects"
  on projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users own their tags"
  on tags for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users access their project_tags"
  on project_tags for all
  using (project_id in (select id from projects where user_id = auth.uid()));

create policy "users access their project_links"
  on project_links for all
  using (project_id in (select id from projects where user_id = auth.uid()));

create policy "users access their tabs"
  on tabs for all
  using (project_id in (select id from projects where user_id = auth.uid()));

create policy "users access their todos"
  on todos for all
  using (tab_id in (
    select t.id from tabs t
    join projects p on p.id = t.project_id
    where p.user_id = auth.uid()
  ));

create policy "users access their chaos_content"
  on chaos_content for all
  using (tab_id in (
    select t.id from tabs t
    join projects p on p.id = t.project_id
    where p.user_id = auth.uid()
  ));

create policy "users access their digest_generated"
  on digest_generated for all
  using (tab_id in (
    select t.id from tabs t
    join projects p on p.id = t.project_id
    where p.user_id = auth.uid()
  ));

create policy "users access their widgets"
  on widgets for all
  using (tab_id in (
    select t.id from tabs t
    join projects p on p.id = t.project_id
    where p.user_id = auth.uid()
  ));

create policy "users own their settings"
  on user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Codes d'invitation
create policy "admins read own, users read valid"
  on invite_codes for select to authenticated
  using (
    created_by = auth.uid()
    or (used_by is null and expires_at > now())
    or used_by = auth.uid()
  );

create policy "admins can insert codes"
  on invite_codes for insert to authenticated
  with check (
    created_by = auth.uid() and
    exists (select 1 from user_settings where user_id = auth.uid() and role = 'admin')
  );

create policy "admins can delete own codes"
  on invite_codes for delete to authenticated
  using (
    created_by = auth.uid() and
    exists (select 1 from user_settings where user_id = auth.uid() and role = 'admin')
  );

create policy "users can claim valid codes"
  on invite_codes for update to authenticated
  using (used_by is null and expires_at > now())
  with check (auth.uid() = used_by);

-- ============================================================
-- PERMISSIONS
-- ============================================================
grant select, insert, update, delete on public.invite_codes to authenticated;

-- ============================================================
-- TRIGGERS MÉTIER
-- ============================================================

-- Crée user_settings à la première connexion
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into user_settings (user_id, authorized, role)
  values (new.id, false, 'user')
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Autorise le user quand il réclame un code d'invitation
create or replace function handle_code_claimed()
returns trigger as $$
begin
  if new.used_by is not null and old.used_by is null then
    insert into user_settings (user_id, authorized, role, invited_by)
    values (new.used_by, true, 'user', new.created_by)
    on conflict (user_id) do update
      set authorized = true,
          invited_by = new.created_by;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_code_claimed
  after update of used_by on invite_codes
  for each row execute function handle_code_claimed();

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table projects;
alter publication supabase_realtime add table tabs;
alter publication supabase_realtime add table todos;
alter publication supabase_realtime add table chaos_content;
alter publication supabase_realtime add table widgets;

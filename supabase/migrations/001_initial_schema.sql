-- ============================================================
-- Projection — Initial Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension (usually already enabled)
create extension if not exists "uuid-ossp";

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
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name    text not null,
  color   text not null default '#6366f1'
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
create type tab_type as enum ('description', 'todo', 'chaos', 'digest', 'widgets');

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
  gemini_api_key text,
  theme          text not null default 'system' check (theme in ('light', 'dark', 'system'))
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
alter table projects enable row level security;
alter table tags enable row level security;
alter table project_tags enable row level security;
alter table project_links enable row level security;
alter table tabs enable row level security;
alter table todos enable row level security;
alter table chaos_content enable row level security;
alter table digest_generated enable row level security;
alter table widgets enable row level security;
alter table user_settings enable row level security;

-- Projects: direct user_id
create policy "users own their projects"
  on projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Tags
create policy "users own their tags"
  on tags for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Project tags (via project FK)
create policy "users access their project_tags"
  on project_tags for all
  using (project_id in (select id from projects where user_id = auth.uid()));

-- Project links
create policy "users access their project_links"
  on project_links for all
  using (project_id in (select id from projects where user_id = auth.uid()));

-- Tabs
create policy "users access their tabs"
  on tabs for all
  using (project_id in (select id from projects where user_id = auth.uid()));

-- Todos
create policy "users access their todos"
  on todos for all
  using (tab_id in (
    select t.id from tabs t
    join projects p on p.id = t.project_id
    where p.user_id = auth.uid()
  ));

-- Chaos content
create policy "users access their chaos_content"
  on chaos_content for all
  using (tab_id in (
    select t.id from tabs t
    join projects p on p.id = t.project_id
    where p.user_id = auth.uid()
  ));

-- Digest generated
create policy "users access their digest_generated"
  on digest_generated for all
  using (tab_id in (
    select t.id from tabs t
    join projects p on p.id = t.project_id
    where p.user_id = auth.uid()
  ));

-- Widgets
create policy "users access their widgets"
  on widgets for all
  using (tab_id in (
    select t.id from tabs t
    join projects p on p.id = t.project_id
    where p.user_id = auth.uid()
  ));

-- User settings
create policy "users own their settings"
  on user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- AUTO-CREATE user_settings on first login
-- ============================================================
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into user_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- REALTIME
-- Enable realtime for relevant tables in Supabase dashboard:
-- projects, tabs, todos, chaos_content, widgets
-- (or run: alter publication supabase_realtime add table ...)
-- ============================================================
alter publication supabase_realtime add table projects;
alter publication supabase_realtime add table tabs;
alter publication supabase_realtime add table todos;
alter publication supabase_realtime add table chaos_content;
alter publication supabase_realtime add table widgets;

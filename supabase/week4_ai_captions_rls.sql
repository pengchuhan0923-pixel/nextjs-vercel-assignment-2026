-- Week 4: AI generations, saved prompts, authenticated voting, and strict RLS.
-- Existing captions are preserved and marked as non-AI content by default.

alter table public.captions add column if not exists prompt text;
alter table public.captions add column if not exists model text;
alter table public.captions add column if not exists created_by uuid references auth.users(id);
alter table public.captions add column if not exists is_ai_generated boolean not null default false;

alter table public.study_resources enable row level security;
alter table public.profiles enable row level security;
alter table public.captions enable row level security;
alter table public.caption_votes enable row level security;

drop policy if exists "Public can read study resources" on public.study_resources;
drop policy if exists "Authenticated users can read study resources" on public.study_resources;
create policy "Authenticated users can read study resources"
on public.study_resources for select to authenticated
using (true);

drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);
create policy "Users can insert their own profile"
on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);
create policy "Users can update their own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Authenticated users can read AI captions" on public.captions;
drop policy if exists "Users can create their own AI captions" on public.captions;
create policy "Authenticated users can read AI captions"
on public.captions for select to authenticated
using (is_ai_generated = true);
create policy "Users can create their own AI captions"
on public.captions for insert to authenticated
with check (
  (select auth.uid()) = created_by
  and is_ai_generated = true
  and prompt is not null
  and model is not null
);

drop policy if exists "Authenticated users can read votes" on public.caption_votes;
drop policy if exists "Users can create their own votes" on public.caption_votes;
create policy "Authenticated users can read votes"
on public.caption_votes for select to authenticated
using (true);
create policy "Users can create their own votes"
on public.caption_votes for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.captions
    where captions.id = caption_votes.caption_id
      and captions.is_ai_generated = true
  )
);

-- Keep each vote immutable. Users can vote again; the feed treats the newest row as their latest vote.
-- No UPDATE or DELETE policies are granted.

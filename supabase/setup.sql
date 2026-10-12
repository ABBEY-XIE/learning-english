-- Roam v0.1 / 在 Supabase > SQL Editor 新建查询，完整执行一次。
-- 可重复执行；不删除任何已有录音或数据。只适用于你的新 Roam 项目。
begin;
create table if not exists public.study_cycles (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(name)<=120), created_at timestamptz not null default now(),
 completed_days jsonb not null default '[]'::jsonb, updated_at timestamptz not null default now()
);
create table if not exists public.practice_records (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 cycle_id uuid not null references public.study_cycles(id), session_id uuid not null,
 day integer not null check(day between 1 and 30), category text not null default '生活',
 prompt text not null check(char_length(prompt)<=1000), prompt_zh text not null default '', hint text not null default '', goal text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 duration real not null check(duration>=0 and duration<=125), mime text not null,
 audio_path text not null, parent_id uuid,
 transcript_original text not null default '', transcript text not null default '', transcript_reviewed boolean not null default false,
 recovered boolean not null default false, imported boolean not null default false,
 transcribe_model text, feedback jsonb, feedback_hash text, feedback_history jsonb not null default '[]'::jsonb,
 check (audio_path like user_id::text || '/%')
);
alter table public.practice_records add column if not exists recovered boolean not null default false;
alter table public.practice_records add column if not exists imported boolean not null default false;
create table if not exists public.weekly_reviews (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 cycle_id uuid not null references public.study_cycles(id), week integer not null check(week between 1 and 4),
 content jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now(),
 unique(user_id,cycle_id,week)
);
create index if not exists roam_records_user_created on public.practice_records(user_id,created_at desc);
create index if not exists roam_records_session on public.practice_records(user_id,session_id,created_at);
alter table public.study_cycles enable row level security;
alter table public.practice_records enable row level security;
alter table public.weekly_reviews enable row level security;
-- 撤销匿名访问；登录用户只能操作自己的行。
revoke all on public.study_cycles,public.practice_records,public.weekly_reviews from anon;
grant select,insert,update,delete on public.study_cycles,public.practice_records,public.weekly_reviews to authenticated;
drop policy if exists roam_cycles_own on public.study_cycles;
create policy roam_cycles_own on public.study_cycles for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists roam_records_own on public.practice_records;
create policy roam_records_own on public.practice_records for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id and exists(select 1 from public.study_cycles c where c.id=cycle_id and c.user_id=(select auth.uid())));
drop policy if exists roam_reviews_own on public.weekly_reviews;
create policy roam_reviews_own on public.weekly_reviews for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id and exists(select 1 from public.study_cycles c where c.id=cycle_id and c.user_id=(select auth.uid())));
-- 原始音频始终使用私有 bucket。绝不把 bucket 改为 Public。
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('speaking-audio','speaking-audio',false,8388608,array['audio/webm','audio/mp4','video/mp4','audio/mpeg','audio/wav','audio/x-wav','audio/ogg','video/webm'])
 on conflict(id) do update set public=false,file_size_limit=8388608,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists roam_audio_own on storage.objects;
create policy roam_audio_own on storage.objects for all to authenticated
 using (bucket_id='speaking-audio' and (storage.foldername(name))[1]=(select auth.uid())::text)
 with check (bucket_id='speaking-audio' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- 每个账号每天最多80次AI请求（UTC日界，失败也计入），存储在数据库而非进程内存。
create table if not exists public.ai_usage (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 record_id uuid not null, created_at timestamptz not null default now()
);
create index if not exists roam_usage_user_created on public.ai_usage(user_id,created_at);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon,authenticated;
grant select on public.ai_usage to authenticated;
drop policy if exists roam_usage_own on public.ai_usage;
create policy roam_usage_own on public.ai_usage for select to authenticated using ((select auth.uid())=user_id);
create or replace function public.claim_ai_request(p_record_id uuid)
 returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare current_user_id uuid:=auth.uid(); request_count integer;
begin
 if current_user_id is null then raise exception 'LOGIN_REQUIRED'; end if;
 if not exists(select 1 from public.practice_records where id=p_record_id and user_id=current_user_id) then raise exception 'RECORD_NOT_OWNED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(current_user_id::text,0));
 select count(*) into request_count from public.ai_usage
 where user_id=current_user_id and created_at >= (date_trunc('day',now() at time zone 'UTC') at time zone 'UTC');
 if request_count>=80 then raise exception 'DAILY_LIMIT'; end if;
 insert into public.ai_usage(user_id,record_id) values(current_user_id,p_record_id);
 return true;
end;
$$;
revoke all on function public.claim_ai_request(uuid) from public,anon;
grant execute on function public.claim_ai_request(uuid) to authenticated;
commit;

-- Файлы объекта доступны команде. Заказчику выдаются только отмеченные записи.
begin;

create or replace function public.can_use_project_files(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_approved() and exists (
    select 1 from public.projects p where p.id = p_project_id and (
      p.owner_id = auth.uid() or public.is_admin()
      or (public.is_employee() and p.visibility in ('team','marketplace')
          and public.is_project_member(p.id))
    )
  );
$$;
revoke all on function public.can_use_project_files(uuid) from public, anon;
grant execute on function public.can_use_project_files(uuid) to authenticated, service_role;

alter table public.project_files enable row level security;
drop policy if exists files_select on public.project_files;
create policy files_select on public.project_files for select to authenticated using (
  public.can_use_project_files(project_id)
  or (client_visible and public.is_approved() and public.is_project_client(project_id))
);
drop policy if exists files_insert on public.project_files;
create policy files_insert on public.project_files for insert to authenticated with check (
  owner_id = auth.uid() and public.can_use_project_files(project_id)
  and not client_visible
  and disk_path ~ ('^projects/' || project_id::text || '/[0-9a-f-]{36}__[^/\\]+$')
);
drop policy if exists files_update on public.project_files;
create policy files_update on public.project_files for update to authenticated
using (public.can_use_project_files(project_id) and (owner_id = auth.uid() or public.is_admin()))
with check (public.can_use_project_files(project_id) and (owner_id = auth.uid() or public.is_admin()));
drop policy if exists files_delete on public.project_files;
create policy files_delete on public.project_files for delete to authenticated using (
  public.can_use_project_files(project_id)
  and (owner_id = auth.uid() or public.is_project_owner(project_id) or public.is_admin())
);

-- Метаданные байтов закреплены за исходным объектом. Выдача меняется отдельным RPC.
revoke all on table public.project_files from public, anon, authenticated;
grant select, insert, delete on table public.project_files to authenticated;
grant update (is_public, public_url) on table public.project_files to authenticated;

create or replace function public.set_file_client_visible(p_file_id uuid, p_visible boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.project_files f set client_visible = p_visible
  where f.id = p_file_id and public.can_use_project_files(f.project_id)
    and (f.owner_id = auth.uid() or public.is_project_owner(f.project_id) or public.is_admin());
  if not found then raise exception 'file unavailable' using errcode = '42501'; end if;
end;
$$;

-- Сохраняем формат ответа для CRM и MCP.
create or replace function public.get_project_files(p_project_id uuid)
returns table(id uuid, project_id uuid, owner_id uuid, uploader_name text, filename text,
              disk_path text, file_size bigint, mime_type text, is_public boolean, public_url text,
              client_visible boolean, created_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select f.id, f.project_id, f.owner_id, coalesce(p.name, p.email, 'Пользователь'),
         f.filename, f.disk_path, f.file_size, f.mime_type, f.is_public, f.public_url,
         f.client_visible, f.created_at
  from public.project_files f left join public.profiles p on p.id = f.owner_id
  where f.project_id = p_project_id and public.can_use_project_files(p_project_id)
  order by f.created_at desc;
$$;

create or replace function public.get_client_project_files(p_project_id uuid)
returns table(id uuid, filename text, file_size bigint, mime_type text, uploader_name text, created_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select f.id, f.filename, f.file_size, f.mime_type, coalesce(p.name, p.email, 'Пользователь'), f.created_at
  from public.project_files f left join public.profiles p on p.id = f.owner_id
  where f.project_id = p_project_id and f.client_visible
    and public.is_approved() and public.is_project_client(p_project_id)
  order by f.created_at desc;
$$;

-- Прежние точки входа учитывают ту же RLS, что и действующий файловый адаптер.
alter function public.add_project_file(uuid,uuid,text,text,bigint,text,boolean,text) security invoker;
alter function public.delete_project_file_record(uuid) security invoker;
alter function public.get_project_storage_used(uuid) security invoker;

revoke all on function public.get_project_files(uuid), public.get_client_project_files(uuid),
  public.set_file_client_visible(uuid,boolean), public.add_project_file(uuid,uuid,text,text,bigint,text,boolean,text),
  public.delete_project_file_record(uuid), public.get_project_storage_used(uuid) from public, anon;
grant execute on function public.get_project_files(uuid), public.get_client_project_files(uuid),
  public.set_file_client_visible(uuid,boolean), public.add_project_file(uuid,uuid,text,text,bigint,text,boolean,text),
  public.delete_project_file_record(uuid), public.get_project_storage_used(uuid) to authenticated, service_role;
commit;

-- Genia Backlog Manager - read-only security/schema inventory
--
-- Run this entire statement in the Supabase SQL Editor while connected as the
-- project administrator. It returns one JSON document and never reads business
-- rows or changes database state.
--
-- Save the JSON result and provide it as input to the RBAC/RLS implementation.

with
public_relations as (
  select n.nspname as schema_name, c.relname as relation_name
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm', 'f')
),
explicit_platform_relations(schema_name, relation_name) as (
  values
    ('auth'::text, 'users'::text),
    ('storage'::text, 'buckets'::text),
    ('storage'::text, 'objects'::text)
),
target_relations as (
  select schema_name, relation_name from public_relations
  union
  select schema_name, relation_name from explicit_platform_relations
),
relations as (
  select
    n.nspname as schema_name,
    c.relname as relation_name,
    c.oid as relation_oid,
    case c.relkind
      when 'r' then 'table'
      when 'p' then 'partitioned_table'
      when 'v' then 'view'
      when 'm' then 'materialized_view'
      when 'f' then 'foreign_table'
      else c.relkind::text
    end as relation_type,
    pg_catalog.pg_get_userbyid(c.relowner) as owner,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced,
    c.relreplident as replica_identity,
    obj_description(c.oid, 'pg_class') as comment
  from target_relations target
  join pg_catalog.pg_namespace n on n.nspname = target.schema_name
  join pg_catalog.pg_class c
    on c.relnamespace = n.oid
   and c.relname = target.relation_name
),
relation_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', schema_name,
        'name', relation_name,
        'type', relation_type,
        'owner', owner,
        'rls_enabled', rls_enabled,
        'rls_forced', rls_forced,
        'replica_identity', replica_identity,
        'comment', comment
      ) order by schema_name, relation_name
    ),
    '[]'::jsonb
  ) as value
  from relations
),
column_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', r.schema_name,
        'table', r.relation_name,
        'position', a.attnum,
        'name', a.attname,
        'data_type', pg_catalog.format_type(a.atttypid, a.atttypmod),
        'not_null', a.attnotnull,
        'identity', nullif(a.attidentity, ''),
        'generated', nullif(a.attgenerated, ''),
        'default', pg_catalog.pg_get_expr(d.adbin, d.adrelid),
        'collation', case
          when a.attcollation = 0 then null
          else coll.collname
        end,
        'comment', pg_catalog.col_description(r.relation_oid, a.attnum)
      ) order by r.schema_name, r.relation_name, a.attnum
    ),
    '[]'::jsonb
  ) as value
  from relations r
  join pg_catalog.pg_attribute a
    on a.attrelid = r.relation_oid
   and a.attnum > 0
   and not a.attisdropped
  left join pg_catalog.pg_attrdef d
    on d.adrelid = a.attrelid
   and d.adnum = a.attnum
  left join pg_catalog.pg_collation coll on coll.oid = a.attcollation
),
constraint_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', r.schema_name,
        'table', r.relation_name,
        'name', con.conname,
        'type', case con.contype
          when 'p' then 'primary_key'
          when 'f' then 'foreign_key'
          when 'u' then 'unique'
          when 'c' then 'check'
          when 'x' then 'exclusion'
          else con.contype::text
        end,
        'definition', pg_catalog.pg_get_constraintdef(con.oid, true),
        'validated', con.convalidated,
        'deferrable', con.condeferrable,
        'initially_deferred', con.condeferred,
        'referenced_schema', ref_ns.nspname,
        'referenced_table', ref_cls.relname
      ) order by r.schema_name, r.relation_name, con.conname
    ),
    '[]'::jsonb
  ) as value
  from relations r
  join pg_catalog.pg_constraint con on con.conrelid = r.relation_oid
  left join pg_catalog.pg_class ref_cls on ref_cls.oid = con.confrelid
  left join pg_catalog.pg_namespace ref_ns on ref_ns.oid = ref_cls.relnamespace
),
index_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', r.schema_name,
        'table', r.relation_name,
        'name', idx.relname,
        'unique', i.indisunique,
        'primary', i.indisprimary,
        'valid', i.indisvalid,
        'ready', i.indisready,
        'definition', pg_catalog.pg_get_indexdef(i.indexrelid)
      ) order by r.schema_name, r.relation_name, idx.relname
    ),
    '[]'::jsonb
  ) as value
  from relations r
  join pg_catalog.pg_index i on i.indrelid = r.relation_oid
  join pg_catalog.pg_class idx on idx.oid = i.indexrelid
),
policy_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', r.schema_name,
        'table', r.relation_name,
        'name', p.polname,
        'command', case p.polcmd
          when 'r' then 'select'
          when 'a' then 'insert'
          when 'w' then 'update'
          when 'd' then 'delete'
          when '*' then 'all'
          else p.polcmd::text
        end,
        'permissive', p.polpermissive,
        'roles', coalesce((
          select jsonb_agg(coalesce(role.rolname, 'public') order by coalesce(role.rolname, 'public'))
          from unnest(p.polroles) role_oid
          left join pg_catalog.pg_roles role on role.oid = role_oid
        ), '[]'::jsonb),
        'using', pg_catalog.pg_get_expr(p.polqual, p.polrelid),
        'with_check', pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid)
      ) order by r.schema_name, r.relation_name, p.polname
    ),
    '[]'::jsonb
  ) as value
  from relations r
  join pg_catalog.pg_policy p on p.polrelid = r.relation_oid
),
trigger_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', r.schema_name,
        'table', r.relation_name,
        'name', t.tgname,
        'enabled', t.tgenabled,
        'definition', pg_catalog.pg_get_triggerdef(t.oid, true),
        'function_schema', fn_ns.nspname,
        'function_name', fn.proname
      ) order by r.schema_name, r.relation_name, t.tgname
    ),
    '[]'::jsonb
  ) as value
  from relations r
  join pg_catalog.pg_trigger t
    on t.tgrelid = r.relation_oid
   and not t.tgisinternal
  join pg_catalog.pg_proc fn on fn.oid = t.tgfoid
  join pg_catalog.pg_namespace fn_ns on fn_ns.oid = fn.pronamespace
),
table_grant_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', r.schema_name,
        'table', r.relation_name,
        'grantor', pg_catalog.pg_get_userbyid(grant_item.grantor),
        'grantee', case
          when grant_item.grantee = 0 then 'PUBLIC'
          else pg_catalog.pg_get_userbyid(grant_item.grantee)
        end,
        'privilege', grant_item.privilege_type,
        'grantable', grant_item.is_grantable
      ) order by r.schema_name, r.relation_name, grant_item.grantee, grant_item.privilege_type
    ),
    '[]'::jsonb
  ) as value
  from relations r
  join pg_catalog.pg_class c on c.oid = r.relation_oid
  cross join lateral pg_catalog.aclexplode(
    coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))
  ) grant_item
),
schema_grant_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', n.nspname,
        'grantor', pg_catalog.pg_get_userbyid(grant_item.grantor),
        'grantee', case
          when grant_item.grantee = 0 then 'PUBLIC'
          else pg_catalog.pg_get_userbyid(grant_item.grantee)
        end,
        'privilege', grant_item.privilege_type,
        'grantable', grant_item.is_grantable
      ) order by n.nspname, grant_item.grantee, grant_item.privilege_type
    ),
    '[]'::jsonb
  ) as value
  from pg_catalog.pg_namespace n
  cross join lateral pg_catalog.aclexplode(
    coalesce(n.nspacl, pg_catalog.acldefault('n', n.nspowner))
  ) grant_item
  where n.nspname in ('public', 'auth', 'storage')
),
column_grant_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', r.schema_name,
        'table', r.relation_name,
        'column', a.attname,
        'grantor', pg_catalog.pg_get_userbyid(grant_item.grantor),
        'grantee', case
          when grant_item.grantee = 0 then 'PUBLIC'
          else pg_catalog.pg_get_userbyid(grant_item.grantee)
        end,
        'privilege', grant_item.privilege_type,
        'grantable', grant_item.is_grantable
      ) order by r.schema_name, r.relation_name, a.attname, grant_item.grantee, grant_item.privilege_type
    ),
    '[]'::jsonb
  ) as value
  from relations r
  join pg_catalog.pg_attribute a
    on a.attrelid = r.relation_oid
   and a.attnum > 0
   and not a.attisdropped
   and a.attacl is not null
  cross join lateral pg_catalog.aclexplode(a.attacl) grant_item
),
function_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', n.nspname,
        'name', p.proname,
        'identity_arguments', pg_catalog.pg_get_function_identity_arguments(p.oid),
        'result', pg_catalog.pg_get_function_result(p.oid),
        'owner', pg_catalog.pg_get_userbyid(p.proowner),
        'security_definer', p.prosecdef,
        'volatility', case p.provolatile
          when 'i' then 'immutable'
          when 's' then 'stable'
          when 'v' then 'volatile'
          else p.provolatile::text
        end,
        'parallel', p.proparallel,
        'configuration', to_jsonb(p.proconfig),
        'definition', pg_catalog.pg_get_functiondef(p.oid)
      ) order by n.nspname, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid)
    ),
    '[]'::jsonb
  ) as value
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind in ('f', 'p')
),
function_grant_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', n.nspname,
        'name', p.proname,
        'identity_arguments', pg_catalog.pg_get_function_identity_arguments(p.oid),
        'grantor', pg_catalog.pg_get_userbyid(grant_item.grantor),
        'grantee', case
          when grant_item.grantee = 0 then 'PUBLIC'
          else pg_catalog.pg_get_userbyid(grant_item.grantee)
        end,
        'privilege', grant_item.privilege_type,
        'grantable', grant_item.is_grantable
      ) order by n.nspname, p.proname,
        pg_catalog.pg_get_function_identity_arguments(p.oid),
        grant_item.grantee,
        grant_item.privilege_type
    ),
    '[]'::jsonb
  ) as value
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  cross join lateral pg_catalog.aclexplode(
    coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
  ) grant_item
  where n.nspname = 'public'
    and p.prokind in ('f', 'p')
),
view_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', r.schema_name,
        'name', r.relation_name,
        'type', r.relation_type,
        'definition', pg_catalog.pg_get_viewdef(r.relation_oid, true)
      ) order by r.schema_name, r.relation_name
    ),
    '[]'::jsonb
  ) as value
  from relations r
  where r.relation_type in ('view', 'materialized_view')
),
publication_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'publication', pub.pubname,
        'schema', r.schema_name,
        'table', r.relation_name
      ) order by pub.pubname, r.schema_name, r.relation_name
    ),
    '[]'::jsonb
  ) as value
  from relations r
  join pg_catalog.pg_publication_rel pr on pr.prrelid = r.relation_oid
  join pg_catalog.pg_publication pub on pub.oid = pr.prpubid
),
enum_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schema', n.nspname,
        'name', t.typname,
        'values', (
          select jsonb_agg(e.enumlabel order by e.enumsortorder)
          from pg_catalog.pg_enum e
          where e.enumtypid = t.oid
        )
      ) order by n.nspname, t.typname
    ),
    '[]'::jsonb
  ) as value
  from pg_catalog.pg_type t
  join pg_catalog.pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
    and t.typtype = 'e'
),
extension_json as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', e.extname,
        'version', e.extversion,
        'schema', n.nspname
      ) order by e.extname
    ),
    '[]'::jsonb
  ) as value
  from pg_catalog.pg_extension e
  join pg_catalog.pg_namespace n on n.oid = e.extnamespace
)
select jsonb_pretty(
  jsonb_build_object(
    'generated_at', clock_timestamp(),
    'database', current_database(),
    'database_user', current_user,
    'postgres_version', current_setting('server_version'),
    'relations', relation_json.value,
    'columns', column_json.value,
    'constraints', constraint_json.value,
    'indexes', index_json.value,
    'rls_policies', policy_json.value,
    'triggers', trigger_json.value,
    'table_grants', table_grant_json.value,
    'schema_grants', schema_grant_json.value,
    'column_grants', column_grant_json.value,
    'public_functions', function_json.value,
    'function_grants', function_grant_json.value,
    'views', view_json.value,
    'publications', publication_json.value,
    'enums', enum_json.value,
    'extensions', extension_json.value
  )
) as security_inventory
from relation_json
cross join column_json
cross join constraint_json
cross join index_json
cross join policy_json
cross join trigger_json
cross join table_grant_json
cross join schema_grant_json
cross join column_grant_json
cross join function_json
cross join function_grant_json
cross join view_json
cross join publication_json
cross join enum_json
cross join extension_json;

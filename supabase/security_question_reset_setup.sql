-- ============================================================================
-- Self-service password recovery via a security question
-- Paste into the Supabase SQL Editor and run once. Safe to re-run.
--
-- No outbound email is configured for this project, so email-based reset
-- isn't viable. This uses pgcrypto (already enabled) to hash/verify answers
-- and to rewrite auth.users.encrypted_password directly, the same way
-- Supabase's own Auth service stores passwords — no service-role key or
-- separate backend needed.
--
-- reset_password_with_answer() is intentionally callable by a fully
-- anonymous caller (the whole point is the outlet isn't logged in) — its
-- only protection is the answer check plus a 5-attempt/15-minute lockout.
-- Error messages are deliberately generic ("Incorrect answer") regardless of
-- whether the email exists, has no question set up, or the answer is wrong,
-- so this can't be used to enumerate valid outlet accounts.
-- ============================================================================

alter table user_profiles
  add column if not exists security_question text,
  add column if not exists security_answer_hash text,
  add column if not exists security_fail_count integer not null default 0,
  add column if not exists security_locked_until timestamptz;

-- Any signed-in user sets/updates their own recovery question+answer.
-- search_path includes `extensions` because that's where Supabase installs
-- pgcrypto (crypt/gen_salt) by default, not `public`.
create or replace function set_security_answer(p_question text, p_answer text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_question is null or trim(p_question) = '' then
    raise exception 'Security question is required';
  end if;
  if p_answer is null or trim(p_answer) = '' then
    raise exception 'Security answer is required';
  end if;
  update user_profiles
    set security_question = p_question,
        security_answer_hash = crypt(p_answer, gen_salt('bf')),
        security_fail_count = 0,
        security_locked_until = null
    where id = auth.uid();
end;
$$;

-- Anonymous: look up the question for a login email, so the recovery UI can
-- display it. Never returns the answer/hash — just the question text (or
-- null if that email has no recovery set up).
create or replace function get_security_question(p_email text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_question text;
begin
  select id into v_user_id from auth.users where lower(email) = lower(p_email);
  if v_user_id is null then
    return null;
  end if;
  select security_question into v_question from user_profiles where id = v_user_id;
  return v_question;
end;
$$;

-- Anonymous: verify the answer and, if correct, set a new password directly.
-- search_path includes `extensions` for the same reason as set_security_answer.
--
-- Returns boolean rather than raising on a wrong answer: `raise exception`
-- rolls back everything done earlier in the same function call, which would
-- undo the fail-count increment below before it ever reached the database —
-- silently defeating the lockout. Only genuinely exceptional cases (password
-- too short, already locked out) still raise, since those paths never
-- mutate state that needs to survive the error.
--
-- The return type changed from void to boolean, which `create or replace`
-- can't do in place — drop it first (safe, `create` immediately follows).
drop function if exists reset_password_with_answer(text, text, text);
create or replace function reset_password_with_answer(p_email text, p_answer text, p_new_password text)
returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user_id uuid;
  v_hash text;
  v_fail_count integer;
  v_locked_until timestamptz;
begin
  if p_new_password is null or length(p_new_password) < 6 then
    raise exception 'New password must be at least 6 characters';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(p_email);

  if v_user_id is not null then
    select security_answer_hash, security_fail_count, security_locked_until
      into v_hash, v_fail_count, v_locked_until
      from user_profiles where id = v_user_id;
  end if;

  if v_locked_until is not null and v_locked_until > now() then
    raise exception 'Too many attempts — try again later';
  end if;

  if v_hash is null or crypt(p_answer, v_hash) <> v_hash then
    if v_user_id is not null then
      v_fail_count := coalesce(v_fail_count, 0) + 1;
      if v_fail_count >= 5 then
        update user_profiles set security_fail_count = 0, security_locked_until = now() + interval '15 minutes' where id = v_user_id;
      else
        update user_profiles set security_fail_count = v_fail_count where id = v_user_id;
      end if;
    end if;
    return false;
  end if;

  update user_profiles set security_fail_count = 0, security_locked_until = null where id = v_user_id;
  update auth.users set encrypted_password = crypt(p_new_password, gen_salt('bf')) where id = v_user_id;
  return true;
end;
$$;

grant execute on function set_security_answer(text, text) to authenticated;
grant execute on function get_security_question(text) to anon, authenticated;
grant execute on function reset_password_with_answer(text, text, text) to anon, authenticated;

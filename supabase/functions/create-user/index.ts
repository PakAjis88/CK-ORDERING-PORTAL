// Edge Function: create-user
// Lets a logged-in operator/admin add a new outlet login or staff login.
// Does what scripts/private/provision_users.mjs does, but server-side, so the
// service-role key never reaches the browser.
//
// Deploy (Supabase Dashboard -> Edge Functions -> Deploy a new function ->
// "Via Editor"): name it exactly `create-user`, paste this whole file, Deploy.
// Leave "Verify JWT" ON. Redeploy by pasting again whenever this file changes
// (pushing to GitHub does NOT update it).
//
// Request body (JSON):
//   { kind: 'outlet', email, password, outletCode, outletName }
//   { kind: 'staff',  email, password, fullName, role: 'operator' | 'halal' }

import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const fail = (message: string, status = 400) => reply(status, { error: message })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return fail('Method not allowed', 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // 1. Who is calling? Must be a real logged-in user...
  const authHeader = req.headers.get('Authorization') ?? ''
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: { user }, error: userErr } = await caller.auth.getUser()
  if (userErr || !user) return fail('Not signed in', 401)

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  // 2. ...and must be an operator or admin (halal/outlet accounts are refused).
  const { data: me } = await admin.from('user_profiles').select('role').eq('id', user.id).maybeSingle()
  if (!me || !['operator', 'admin'].includes(me.role)) return fail('Only operators can add users', 403)

  // 3. Validate input.
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return fail('Invalid request') }

  const kind = body.kind
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Enter a valid email address')
  if (password.length < 6) return fail('Password must be at least 6 characters')
  if (password.length > 72) return fail('Password must be 72 characters or fewer')

  let role: string
  let fullName: string
  let outletCode = ''
  let outletName = ''

  if (kind === 'outlet') {
    role = 'outlet'
    outletCode = String(body.outletCode ?? '').trim().toUpperCase()
    outletName = String(body.outletName ?? '').trim()
    if (!/^[A-Z0-9-]{2,20}$/.test(outletCode)) return fail('Outlet code must be 2-20 letters/numbers, e.g. MBG035')
    if (!outletName) return fail('Enter the outlet name')
    fullName = outletName
  } else if (kind === 'staff') {
    role = String(body.role ?? '')
    if (!['operator', 'halal'].includes(role)) return fail('Role must be operator or halal')
    fullName = String(body.fullName ?? '').trim()
    if (!fullName) return fail('Enter the person\'s name')
  } else {
    return fail('Invalid request')
  }

  // 4. Create. Anything created is undone if a later step fails.
  let outletId: string | null = null
  let outletCreated = false

  if (kind === 'outlet') {
    const { data: existing } = await admin.from('outlets').select('id').eq('code', outletCode).maybeSingle()
    if (existing) return fail(`Outlet code ${outletCode} already exists`)
    const { data: outlet, error: outletErr } = await admin
      .from('outlets').insert({ code: outletCode, name: outletName }).select('id').single()
    if (outletErr) return fail('Could not create the outlet', 500)
    outletId = outlet.id
    outletCreated = true
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (createErr || !created.user) {
    if (outletCreated) await admin.from('outlets').delete().eq('id', outletId!)
    const taken = createErr?.code === 'email_exists' || /already|registered/i.test(createErr?.message ?? '')
    return taken ? fail('That email already has a login') : fail('Could not create the login', 500)
  }

  const { error: profileErr } = await admin.from('user_profiles').insert({
    id: created.user.id, role, outlet_id: outletId, full_name: fullName,
  })
  if (profileErr) {
    await admin.auth.admin.deleteUser(created.user.id)
    if (outletCreated) await admin.from('outlets').delete().eq('id', outletId!)
    return fail('Could not finish setting up the user', 500)
  }

  return reply(200, { ok: true, email, role, outlet: kind === 'outlet' ? { code: outletCode, name: outletName } : null })
})

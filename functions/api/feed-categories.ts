import { createClient } from '@supabase/supabase-js'

async function getUser(request: Request, supabase: any) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error) return null
  return user
}

export const onRequestGet = async (context: any) => {
  const { request, env } = context

  const supabase = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  )

  const user = await getUser(request, supabase)
  if (!user) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('feeds')
    .select('id, category')
    .eq('user_id', user.id)

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, data: { categories: data || [] } })
}
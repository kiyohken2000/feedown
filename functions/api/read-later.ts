import { createClient } from '@supabase/supabase-js'

async function getUser(request: Request, supabase: any) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error) return null
  return user
}

// GET /api/read-later - Read Later一覧取得
export async function onRequestGet(context: any): Promise<Response> {
  const { env, request } = context
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const user = await getUser(request, supabase)
  if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('read_later')
    .select('*')
    .eq('user_id', user.id)
    .order('saved_at', { ascending: false })

  if (error) return Response.json({ success: false, error: error.message }, { status: 500 })
  return Response.json({ success: true, data: { articles: data || [] } })
}

// POST /api/read-later - Read Laterに追加
export async function onRequestPost(context: any): Promise<Response> {
  const { env, request } = context
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const user = await getUser(request, supabase)
  if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { articleId, title, url, description, feedTitle, imageUrl } = body

  if (!articleId || !title || !url) {
    return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 })
  }

  const { error } = await supabase
    .from('read_later')
    .upsert({
      id: `${user.id}-${articleId}`,
      user_id: user.id,
      article_id: articleId,
      title,
      url,
      description: description || null,
      feed_title: feedTitle || null,
      image_url: imageUrl || null,
    })

  if (error) return Response.json({ success: false, error: error.message }, { status: 500 })
  return Response.json({ success: true })
}

// DELETE /api/read-later?articleId=xxx - Read Laterから削除
export async function onRequestDelete(context: any): Promise<Response> {
  const { env, request } = context
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const user = await getUser(request, supabase)
  if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const articleId = url.searchParams.get('articleId')
  if (!articleId) return Response.json({ success: false, error: 'Missing articleId' }, { status: 400 })

  const { error } = await supabase
    .from('read_later')
    .delete()
    .eq('user_id', user.id)
    .eq('article_id', articleId)

  if (error) return Response.json({ success: false, error: error.message }, { status: 500 })
  return Response.json({ success: true })
}

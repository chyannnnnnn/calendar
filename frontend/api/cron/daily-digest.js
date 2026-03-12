// api/cron/daily-digest.js
// Vercel Cron Job — runs daily at 00:00 UTC (8am Malaysia time)
// Vercel calls this endpoint automatically on schedule.
// It forwards the request to the Supabase Edge Function.

export default async function handler(req, res) {
  // Vercel cron jobs send a GET request — only allow from Vercel cron
  // The Authorization header check prevents abuse if someone finds the URL
  const authHeader = req.headers['authorization']
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabaseUrl  = process.env.VITE_SUPABASE_URL
  const supabaseKey  = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing Supabase env vars' })
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/daily-digest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({}),
    })

    const data = await response.json()
    console.log('Daily digest result:', data)
    return res.status(200).json(data)
  } catch (err) {
    console.error('Daily digest failed:', err)
    return res.status(500).json({ error: err.message })
  }
}
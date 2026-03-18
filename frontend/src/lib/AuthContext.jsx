import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { clearPartnerEvents, clearLocalDB, pullEvents } from '../lib/sync'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session,   setSession]   = useState(undefined)  // undefined = loading
  const [profile,   setProfile]   = useState(null)
  const [partner,   setPartner]   = useState(null)
  const [partnershipId, setPartnershipId] = useState(null)

  // ── Session listener ──────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
      else { setProfile(null); setPartner(null) }
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Load profile + partner ────────────────────────────────
  async function loadProfile(userId) {
    // 1. Load own profile from profiles table
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (myProfile) {
      setProfile({
        id:        userId,
        name:      myProfile.display_name || myProfile.id,
        email:     myProfile.email || '',
        avatarUrl: myProfile.extras?.avatarUrl || null,
      })
    } else {
      // Fallback to auth metadata if profile row not ready yet
      const { data: { user } } = await supabase.auth.getUser()
      setProfile({ id: userId, name: user.user_metadata?.display_name || user.email, email: user.email, avatarUrl: null })
    }

    // 2. Check for a partnership — fetch ALL rows for this user (should be 0 or 1)
    // Using limit(1) instead of maybeSingle() so multiple corrupt rows don't silently return null
    const { data: partnershipRows } = await supabase
      .from('partnerships')
      .select('*')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(1)

    const partnership = partnershipRows?.[0] || null

    if (partnership) {
      setPartnershipId(partnership.id)
      const partnerId = partnership.user_a === userId
        ? partnership.user_b
        : partnership.user_a

      // 3. Fetch partner's real display name from profiles table
      const { data: partnerProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', partnerId)
        .single()

      setPartner({
        id:        partnerId,
        name:      partnerProfile?.display_name || 'Partner',
        avatarUrl: partnerProfile?.extras?.avatarUrl || null,
      })
    } else {
      setPartner(null)
      setPartnershipId(null)
    }
  }

  // ── Auth actions ──────────────────────────────────────────
  async function signUp(email, password, displayName) {
    return supabase.auth.signUp({
      email, password,
      options: { data: { display_name: displayName } }
    })
  }

  async function signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password })
  }

  async function signOut() {
    await clearLocalDB()
    return supabase.auth.signOut()
  }

  // ── Email-based linking ───────────────────────────────────
  // Look up partner by email and create a partnership directly.
  // Both users must be signed up already.
  async function linkWithPartner(partnerEmail) {
    const myId = session.user.id

    // 1. Find partner's profile by email
    const { data: found, error } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('email', partnerEmail)
      .maybeSingle()

    if (error || !found) throw new Error('No account found with that email. Make sure your partner has signed up first.')
    if (found.id === myId) throw new Error("That's your own email!")

    // 2. Check YOU are not already in ANY partnership (either column)
    const { data: myRows } = await supabase
      .from('partnerships')
      .select('id')
      .or(`user_a.eq.${myId},user_b.eq.${myId}`)
      .limit(5)  // get up to 5 so we detect corrupt duplicate rows too

    if (myRows && myRows.length > 0) throw new Error('You are already linked with a partner. Unlink first.')

    // 3. Check the PARTNER is not already in ANY partnership (either column)
    const { data: theirRows } = await supabase
      .from('partnerships')
      .select('id')
      .or(`user_a.eq.${found.id},user_b.eq.${found.id}`)
      .limit(5)

    if (theirRows && theirRows.length > 0) throw new Error(`${found.display_name || 'That person'} is already linked with someone else.`)

    // 4. Insert — DB trigger will also enforce one-per-user as a safety net
    const { error: insertError } = await supabase
      .from('partnerships')
      .insert({ user_a: myId, user_b: found.id })

    if (insertError) {
      // Trigger raised exception or race condition
      if (insertError.code === 'P0001' || insertError.message?.includes('already in a partnership')) {
        throw new Error('Could not link — one of you is already connected with someone else.')
      }
      if (insertError.code === '23505') {
        throw new Error('Could not link — one of you is already connected with someone else.')
      }
      throw new Error('Failed to link. Please try again.')
    }

    await loadProfile(myId)
  }

  async function unlinkPartner() {
    if (!partnershipId) return
    const partnerIdToWipe = partner?.id

    // Delete the partnership row — cascades to stickers automatically
    await supabase.from('partnerships').delete().eq('id', partnershipId)

    // Also try deleting by user membership in case partnershipId is stale
    const myId = session?.user?.id
    if (myId) {
      await supabase.from('partnerships').delete().or(`user_a.eq.${myId},user_b.eq.${myId}`)
    }

    // Wipe partner events from local IndexedDB immediately
    if (partnerIdToWipe) await clearPartnerEvents(partnerIdToWipe)
    // Pull fresh events from Supabase — RLS now won't return ex-partner's events
    try { await pullEvents() } catch {}

    setPartner(null)
    setPartnershipId(null)

    // Reload profile to get clean state from Supabase
    if (myId) await loadProfile(myId)
  }

  const value = {
    session,
    user:    profile,
    partner,
    partnershipId,
    isLoading: session === undefined,
    isLinked:  !!partner,
    signUp, signIn, signOut,
    linkWithPartner, unlinkPartner,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { clearPartnerEvents, clearLocalDB } from '../lib/sync'

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
      setProfile({ id: userId, name: myProfile.display_name || myProfile.id })
    } else {
      // Fallback to auth metadata if profile row not ready yet
      const { data: { user } } = await supabase.auth.getUser()
      setProfile({ id: userId, name: user.user_metadata?.display_name || user.email })
    }

    // 2. Check for a partnership
    const { data: partnership } = await supabase
      .from('partnerships')
      .select('*')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .maybeSingle()

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
        id: partnerId,
        name: partnerProfile?.display_name || 'Partner',
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

    // 1. Find partner's profile by email via the profiles table
    //    We match on display_name as fallback, but primarily use auth lookup
    //    via a Supabase RPC (we call a simple search on profiles joined to auth)
    const { data: found, error } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('email', partnerEmail)
      .maybeSingle()

    // profiles table may not have email — search via auth users view instead
    // We use a workaround: store email in profiles on signup
    if (error || !found) throw new Error('No account found with that email. Make sure your partner has signed up first.')
    if (found.id === myId) throw new Error("That's your own email!")

    // 2. Check not already linked
    const { data: existing } = await supabase
      .from('partnerships')
      .select('id')
      .or(`user_a.eq.${myId},user_b.eq.${myId}`)
      .maybeSingle()

    if (existing) throw new Error('You are already linked with a partner.')

    // 3. Create partnership
    const { error: insertError } = await supabase
      .from('partnerships')
      .insert({ user_a: myId, user_b: found.id })

    if (insertError) throw new Error('Failed to link. Please try again.')

    await loadProfile(myId)
  }

  async function unlinkPartner() {
    if (!partnershipId) return
    await supabase.from('partnerships').delete().eq('id', partnershipId)
    // Immediately wipe partner's events from local Dexie DB
    if (partner?.id) await clearPartnerEvents(partner.id)
    setPartner(null)
    setPartnershipId(null)
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
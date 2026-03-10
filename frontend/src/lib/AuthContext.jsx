import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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
    // Supabase user metadata holds display_name set at signup
    const { data: { user } } = await supabase.auth.getUser()
    setProfile({ id: user.id, name: user.user_metadata?.display_name || user.email })

    // Check for a partnership
    const { data: partnerships } = await supabase
      .from('partnerships')
      .select('*')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .maybeSingle()

    if (partnerships) {
      setPartnershipId(partnerships.id)
      const partnerId = partnerships.user_a === userId
        ? partnerships.user_b
        : partnerships.user_a

      // Get partner metadata via a simple profile lookup
      // (We store display_name in user_metadata; expose it via a profiles view or edge function in production)
      setPartner({ id: partnerId, name: 'Partner' })
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
    return supabase.auth.signOut()
  }

  // ── Invite link ───────────────────────────────────────────
  async function createInviteLink() {
    const code = Math.random().toString(36).slice(2, 9).toUpperCase()
    const { error } = await supabase.from('invite_links').insert({
      creator_id: session.user.id,
      code,
    })
    if (error) throw error
    return `${window.location.origin}/join/${code}`
  }

  async function acceptInvite(code) {
    const { data: invite, error } = await supabase
      .from('invite_links')
      .select('*')
      .eq('code', code)
      .is('accepted_by', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error || !invite) throw new Error('Invite not found or expired')
    if (invite.creator_id === session.user.id) throw new Error("You can't accept your own invite")

    // Create partnership
    await supabase.from('partnerships').insert({
      user_a: invite.creator_id,
      user_b: session.user.id,
    })

    // Mark invite as accepted
    await supabase.from('invite_links').update({
      accepted_by: session.user.id,
      accepted_at: new Date().toISOString(),
    }).eq('id', invite.id)

    await loadProfile(session.user.id)
  }

  const value = {
    session,
    user:    profile,
    partner,
    partnershipId,
    isLoading: session === undefined,
    isLinked:  !!partner,
    signUp, signIn, signOut,
    createInviteLink, acceptInvite,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
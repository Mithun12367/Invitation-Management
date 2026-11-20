
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';

import type { Session, User } from '@supabase/supabase-js';
import { Navigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

export type AdminRole = 'admin' | 'organizer' | 'scanner';

export interface AdminProfile {
  user_id: string;
  full_name: string | null;
  role: AdminRole;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: AdminProfile | null;
  loading: boolean;
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let requestId = 0;

    const syncSession = async (newSession: Session | null) => {
      const currentRequest = ++requestId;

      setSession(newSession);
      setUser(newSession?.user ?? null);
      setProfile(null);
      setProfileError(null);
      setLoading(true);

      if (!newSession) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('admins')
          .select('user_id, full_name, role')
          .eq('user_id', newSession.user.id)
          .maybeSingle();

        if (error) throw error;

        if (!active || currentRequest !== requestId) return;

        setProfile(data as AdminProfile | null);
      } catch (error) {
        if (!active || currentRequest !== requestId) return;

        console.error('Admin profile verification failed:', error);

        setProfileError(
          error instanceof Error
            ? error.message
            : 'Could not verify administrator permissions.'
        );
      } finally {
        if (active && currentRequest === requestId) {
          setLoading(false);
        }
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      void syncSession(newSession);
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;

      if (error) {
        setProfileError(error.message);
        setLoading(false);
        return;
      }

      void syncSession(data.session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
    },
    []
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        profileError,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}

export function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, profile, loading, profileError } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
          <p className="mt-3 text-sm text-gray-500">
            Verifying administrator access...
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/admin/login" replace />;
  }

  if (profileError || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h2 className="text-xl font-semibold text-red-600">
            Access Denied
          </h2>

          <p className="mt-3 text-gray-600">
            Your account does not have a verified administrator profile.
            Please contact the system administrator.
          </p>

          {profileError && (
            <p className="mt-3 break-words text-sm text-red-500">
              {profileError}
            </p>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

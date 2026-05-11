"use client";

import {
  auth
} from "@/lib/firebase";

import {
  onAuthStateChanged,
  User
} from "firebase/auth";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode
} from "react";

type AuthContextType = {
  user: User | null;
  loading: boolean;
};

const AuthContext =
  createContext<AuthContextType>({
    user: null,
    loading: true
  });

export const useAuth = () =>
  useContext(AuthContext);

export default function AuthProvider({
  children
}: {
  children: ReactNode;
}) {

  const [user, setUser] =
    useState<User | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {

    const unsubscribe =
      onAuthStateChanged(
        auth,
        (firebaseUser) => {

          setUser(firebaseUser);

          setLoading(false);
        }
      );

    return () => unsubscribe();

  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
import { useState, useEffect, useCallback } from "react";
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  User
} from "firebase/auth";
import { auth } from "./firebase";

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          id: firebaseUser.uid,
          email: firebaseUser.email,
          firstName: firebaseUser.displayName?.split(" ")[0] || "User",
          lastName: firebaseUser.displayName?.split(" ").slice(1).join(" ") || null,
          profileImageUrl: firebaseUser.photoURL,
        });
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email: string, pass: string) => {
    console.log("Attempting login for:", email);
    try {
      const result = await signInWithEmailAndPassword(auth, email, pass);
      console.log("Login successful:", result.user.uid);
      return result;
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  }, []);

  const signup = useCallback(async (email: string, pass: string) => {
    console.log("Attempting signup for:", email);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      console.log("Signup successful:", result.user.uid);
      return result;
    } catch (error) {
      console.error("Signup failed:", error);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    return signOut(auth);
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    signup,
    logout,
  };
}

export interface AuthUser {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
}
export declare function useAuth(): {
    user: AuthUser | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, pass: string) => Promise<import("firebase/auth").UserCredential>;
    signup: (email: string, pass: string) => Promise<import("firebase/auth").UserCredential>;
    logout: () => Promise<void>;
};

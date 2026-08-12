import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  User,
} from '../types/auth';
import {
  saveToken,
  getToken,
  saveUser,
  getUser,
  clearAuthStorage,
} from '../utils/authStorage';
import {
  loginUserApi,
  registerUserApi,
  getCurrentUserApi,
} from '../services/authService';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<User>;
  register: (payload: RegisterRequest) => Promise<User>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  /**
   * Session restoration on application launch.
   * Reads stored token and validates it against GET /api/auth/me.
   */
  const restoreSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const storedToken = await getToken();
      if (!storedToken) {
        setUser(null);
        setTokenState(null);
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      // Token exists, validate against server
      const meResponse = await getCurrentUserApi();
      if (meResponse && meResponse.success && meResponse.data?.user) {
        const freshUser = meResponse.data.user;
        await saveUser(freshUser);
        setUser(freshUser);
        setTokenState(storedToken);
        setIsAuthenticated(true);
      } else {
        // Token invalid, clear local auth
        await clearAuthStorage();
        setUser(null);
        setTokenState(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.log('Session restoration failed or token expired:', error);
      await clearAuthStorage();
      setUser(null);
      setTokenState(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  /**
   * Login handler
   */
  const login = async (credentials: LoginRequest): Promise<User> => {
    const response: AuthResponse = await loginUserApi(credentials);
    const { user: authUser, token: authToken } = response.data;

    await saveToken(authToken);
    await saveUser(authUser);

    setUser(authUser);
    setTokenState(authToken);
    setIsAuthenticated(true);

    return authUser;
  };

  /**
   * Registration handler
   */
  const register = async (payload: RegisterRequest): Promise<User> => {
    const response: AuthResponse = await registerUserApi(payload);
    const { user: authUser, token: authToken } = response.data;

    await saveToken(authToken);
    await saveUser(authUser);

    setUser(authUser);
    setTokenState(authToken);
    setIsAuthenticated(true);

    return authUser;
  };

  /**
   * Logout handler
   */
  const logout = async (): Promise<void> => {
    await clearAuthStorage();
    setUser(null);
    setTokenState(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
        restoreSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Custom hook to consume AuthContext cleanly across screens
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

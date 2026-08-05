import React, {useEffect, useState} from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import LoginScreen from './src/features/auth/LoginScreen';
import RegisterScreen from './src/features/auth/RegisterScreen';
import MainTabs from './src/navigation/MainTabs';
import {getMe, logout as logoutApi} from './src/services/authApi';
import {
  clearSession,
  loadSession,
  setSession,
  type AuthSession,
} from './src/services/session';
import {colors} from './src/theme/tokens';

type AuthGate = 'login' | 'register';

export default function App() {
  const [auth, setAuth] = useState<AuthSession | null>(null);
  const [gate, setGate] = useState<AuthGate>('login');
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const saved = loadSession();
      if (!saved) {
        if (!cancelled) {
          setBooting(false);
        }
        return;
      }

      try {
        // 用 /me 校验本地 token 是否仍有效
        const user = await getMe(saved.access_token);
        if (cancelled) {
          return;
        }
        const next = {...saved, user};
        setSession(next);
        setAuth(next);
      } catch {
        clearSession();
        if (!cancelled) {
          setAuth(null);
        }
      } finally {
        if (!cancelled) {
          setBooting(false);
        }
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleLogin(session: AuthSession) {
    setSession(session);
    setAuth(session);
  }

  async function handleLogout() {
    const token = auth?.access_token;
    clearSession();
    setAuth(null);
    setGate('login');
    if (token && !token.startsWith('demo-')) {
      try {
        await logoutApi(token);
      } catch {
        // 本地已退出即可
      }
    }
  }

  if (booting) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!auth) {
    if (gate === 'register') {
      return (
        <RegisterScreen
          onRegister={handleLogin}
          onBackToLogin={() => setGate('login')}
        />
      );
    }
    return (
      <LoginScreen
        onLogin={handleLogin}
        onGoRegister={() => setGate('register')}
      />
    );
  }

  return <MainTabs phone={auth.user.phone} onLogout={handleLogout} />;
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundWarm,
  },
});

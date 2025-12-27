# Idynic Mobile App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a React Native + Expo mobile app with full feature parity to the idynic web app, starting with iOS.

**Status:** In Progress

**Architecture:** Monorepo with shared TypeScript packages for types, schemas, and API client. Expo Router for file-based navigation. NativeWind for Tailwind-style styling. Supabase for auth and data.

**Tech Stack:** Expo SDK 52, Expo Router, NativeWind v4, React Query, Supabase JS, expo-secure-store

## Progress (Last reviewed: 2025-12-26)

| Task | Status | Notes |
|------|--------|-------|
| Task 1: Initialize pnpm workspaces | ✅ Complete | Monorepo structure in place |
| Task 2: Move web app to apps/web | ✅ Complete | Web app at `apps/web/` |
| Task 3: Create shared package | ✅ Complete | `packages/shared/` with types |
| Task 4: Create shared API client | ✅ Complete | `packages/shared/src/api/` |
| Task 5: Create Expo app | ✅ Complete | `apps/mobile/` created |
| Task 6: Set up NativeWind | ✅ Complete | Tailwind styling working |
| Task 7: Set up Supabase client | ✅ Complete | `apps/mobile/lib/supabase.ts` |
| Task 8: Set up navigation structure | ✅ Complete | Expo Router with auth flow |
| Task 9: Build Profile screen | ✅ Complete | Profile with identity reflection |
| Task 10: Build Opportunities list | ✅ Complete | List + detail screens |
| Task 11: Build Opportunity detail | ✅ Complete | Requirements rendering |
| Task 12: Build Settings screen | ✅ Complete | Sign out + legal links |
| Task 13: Implement OAuth login | ✅ Complete | Email/password + Google OAuth |
| Task 14: iOS CI/CD pipeline | ✅ Complete | Fastlane + TestFlight working |

### Additional Features Implemented (not in original plan)
- Identity graph visualization (mobile version)
- Profile logo integration
- Resume/story upload screens
- Background job processing via Inngest
- Email confirmation flow

### Remaining Work
- Android build and distribution (see `2025-12-23-android-launch-plan.md`)
- Push notifications
- Additional profile editing features

---

## Phase 1: Monorepo Setup

### Task 1: Initialize pnpm workspaces

**Files:**
- Create: `pnpm-workspace.yaml`
- Modify: `package.json` (root)

**Step 1: Create workspace configuration**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'chrome-extension'
```

**Step 2: Update root package.json**

Add to `package.json`:

```json
{
  "name": "idynic-monorepo",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter web dev",
    "dev:mobile": "pnpm --filter mobile start",
    "build": "pnpm --filter web build",
    "lint": "pnpm --filter web lint",
    "test": "pnpm --filter web test",
    "test:run": "pnpm --filter web test:run"
  }
}
```

**Step 3: Verify workspace setup**

Run: `pnpm install`
Expected: Installs dependencies, recognizes workspace structure

**Step 4: Commit**

```bash
git add pnpm-workspace.yaml package.json
git commit -m "chore: initialize pnpm workspaces for monorepo"
```

---

### Task 2: Move web app to apps/web

**Files:**
- Create: `apps/web/` directory
- Move: All Next.js files to `apps/web/`
- Modify: `apps/web/package.json`

**Step 1: Create apps directory and move files**

```bash
mkdir -p apps/web
```

**Step 2: Move Next.js app files**

Move these to `apps/web/`:
- `src/`
- `public/`
- `next.config.mjs`
- `next-env.d.ts`
- `postcss.config.mjs`
- `tailwind.config.ts`
- `tsconfig.json`
- `vitest.config.ts`
- `vitest.setup.ts`
- `.eslintrc.json`
- `components.json`

```bash
mv src public next.config.mjs next-env.d.ts postcss.config.mjs tailwind.config.ts tsconfig.json vitest.config.ts vitest.setup.ts .eslintrc.json components.json apps/web/
```

**Step 3: Create apps/web/package.json**

```json
{
  "name": "web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  },
  "dependencies": {
    "@phosphor-icons/react": "^2.1.10",
    "@radix-ui/react-accordion": "^1.2.12",
    "@radix-ui/react-alert-dialog": "^1.1.15",
    "@radix-ui/react-collapsible": "^1.1.12",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-label": "^2.1.8",
    "@radix-ui/react-popover": "^1.1.15",
    "@radix-ui/react-progress": "^1.1.8",
    "@radix-ui/react-select": "^2.2.6",
    "@radix-ui/react-slot": "^1.2.4",
    "@radix-ui/react-tabs": "^1.1.13",
    "@radix-ui/react-toast": "^1.2.15",
    "@radix-ui/react-tooltip": "^1.2.8",
    "@react-pdf/renderer": "^4.3.1",
    "@supabase/auth-ui-react": "^0.4.7",
    "@supabase/auth-ui-shared": "^0.1.8",
    "@supabase/ssr": "^0.8.0",
    "@supabase/supabase-js": "^2.88.0",
    "@tanstack/react-query": "^5.90.12",
    "@idynic/shared": "workspace:*",
    "cheerio": "^1.1.2",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "d3": "^7.9.0",
    "date-fns": "^4.1.0",
    "lucide-react": "^0.561.0",
    "next": "14.2.35",
    "next-themes": "^0.4.6",
    "openai": "^6.14.0",
    "react": "^18",
    "react-dom": "^18",
    "react-pdf": "^10.2.0",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.4.0",
    "tailwindcss-animate": "^1.0.7",
    "umap-js": "^1.4.0",
    "unpdf": "^1.4.0",
    "zod": "^4.2.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.1",
    "@testing-library/user-event": "^14.6.1",
    "@types/d3": "^7.4.3",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "@vitejs/plugin-react": "^5.1.2",
    "@vitest/coverage-v8": "^4.0.16",
    "@vitest/ui": "^4.0.16",
    "eslint": "^8",
    "eslint-config-next": "14.2.32",
    "jsdom": "^27.3.0",
    "postcss": "^8",
    "tailwindcss": "^3.4.1",
    "typescript": "^5",
    "vitest": "^4.0.16",
    "vitest-mock-extended": "^3.1.0"
  }
}
```

**Step 4: Update path references in moved configs**

Update `apps/web/vitest.config.ts` - no changes needed if paths are relative.

Update `apps/web/tsconfig.json` to reference shared package:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@idynic/shared": ["../../packages/shared/src"],
      "@idynic/shared/*": ["../../packages/shared/src/*"]
    }
  }
}
```

**Step 5: Test web app still works**

```bash
cd apps/web && pnpm install && pnpm dev
```
Expected: Next.js dev server starts on localhost:3000

**Step 6: Run tests**

```bash
pnpm test:run
```
Expected: All existing tests pass

**Step 7: Commit**

```bash
git add -A
git commit -m "refactor: move web app to apps/web for monorepo"
```

---

### Task 3: Create shared package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types/database.ts`

**Step 1: Create package structure**

```bash
mkdir -p packages/shared/src/types
```

**Step 2: Create packages/shared/package.json**

```json
{
  "name": "@idynic/shared",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./types": "./src/types/index.ts",
    "./api": "./src/api/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^4.2.1"
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

**Step 3: Create packages/shared/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Copy database types**

Copy `apps/web/src/lib/supabase/types.ts` to `packages/shared/src/types/database.ts`

```bash
cp apps/web/src/lib/supabase/types.ts packages/shared/src/types/database.ts
```

**Step 5: Create type exports**

Create `packages/shared/src/types/index.ts`:

```typescript
export * from './database';
```

**Step 6: Create main index**

Create `packages/shared/src/index.ts`:

```typescript
export * from './types';
```

**Step 7: Install and verify**

```bash
pnpm install
```

**Step 8: Commit**

```bash
git add packages/shared
git commit -m "feat: create shared package with database types"
```

---

### Task 4: Create shared API client

**Files:**
- Create: `packages/shared/src/api/client.ts`
- Create: `packages/shared/src/api/index.ts`

**Step 1: Create API client**

Create `packages/shared/src/api/client.ts`:

```typescript
export interface ApiClientConfig {
  baseUrl: string;
  getAuthToken: () => Promise<string | null>;
}

export function createApiClient(config: ApiClientConfig) {
  const { baseUrl, getAuthToken } = config;

  async function fetchWithAuth(path: string, options: RequestInit = {}) {
    const token = await getAuthToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  return {
    profile: {
      get: () => fetchWithAuth('/api/v1/profile'),
      update: (data: unknown) => fetchWithAuth('/api/v1/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    },

    opportunities: {
      list: () => fetchWithAuth('/api/v1/opportunities'),
      get: (id: string) => fetchWithAuth(`/api/v1/opportunities/${id}`),
      match: (id: string) => fetchWithAuth(`/api/v1/opportunities/${id}/match`, {
        method: 'POST',
      }),
      tailor: (id: string) => fetchWithAuth(`/api/v1/opportunities/${id}/tailor`, {
        method: 'POST',
      }),
    },

    sharedLinks: {
      list: () => fetchWithAuth('/api/shared-links'),
      create: (data: unknown) => fetchWithAuth('/api/shared-links', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
      delete: (id: string) => fetchWithAuth(`/api/shared-links/${id}`, {
        method: 'DELETE',
      }),
    },

    claims: {
      list: () => fetchWithAuth('/api/v1/claims'),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
```

**Step 2: Create API index**

Create `packages/shared/src/api/index.ts`:

```typescript
export { createApiClient, type ApiClient, type ApiClientConfig } from './client';
```

**Step 3: Update main index**

Update `packages/shared/src/index.ts`:

```typescript
export * from './types';
export * from './api';
```

**Step 4: Commit**

```bash
git add packages/shared/src/api
git commit -m "feat: add shared API client"
```

---

## Phase 2: Expo App Setup

### Task 5: Create Expo app

**Files:**
- Create: `apps/mobile/` (Expo project)

**Step 1: Create Expo app with router template**

```bash
cd apps
npx create-expo-app@latest mobile --template tabs
cd ..
```

**Step 2: Clean up default template files**

Remove example screens - we'll create our own navigation structure.

**Step 3: Update apps/mobile/package.json name**

```json
{
  "name": "mobile",
  ...
}
```

**Step 4: Add workspace dependency**

Add to `apps/mobile/package.json` dependencies:

```json
{
  "dependencies": {
    "@idynic/shared": "workspace:*"
  }
}
```

**Step 5: Install dependencies**

```bash
pnpm install
```

**Step 6: Test Expo app runs**

```bash
cd apps/mobile && npx expo start
```
Expected: Expo dev server starts, can open in iOS Simulator

**Step 7: Commit**

```bash
git add apps/mobile
git commit -m "feat: create Expo mobile app scaffold"
```

---

### Task 6: Set up NativeWind

**Files:**
- Modify: `apps/mobile/package.json`
- Create: `apps/mobile/tailwind.config.js`
- Create: `apps/mobile/global.css`
- Modify: `apps/mobile/babel.config.js`
- Modify: `apps/mobile/metro.config.js`

**Step 1: Install NativeWind dependencies**

```bash
cd apps/mobile
pnpm add nativewind tailwindcss
pnpm add -D prettier-plugin-tailwindcss
```

**Step 2: Create tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Match web app colors
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        teal: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
      },
    },
  },
  plugins: [],
};
```

**Step 3: Create global.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 4: Update babel.config.js**

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
```

**Step 5: Update metro.config.js**

```javascript
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
```

**Step 6: Import global.css in app/_layout.tsx**

Add at top of file:

```typescript
import '../global.css';
```

**Step 7: Test NativeWind works**

Create a test component with Tailwind classes:

```tsx
<Text className="text-teal-500 text-xl font-bold">Hello NativeWind</Text>
```

Run: `npx expo start`
Expected: Text appears teal colored

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: configure NativeWind for Tailwind styling"
```

---

### Task 7: Set up Supabase client for mobile

**Files:**
- Modify: `apps/mobile/package.json`
- Create: `apps/mobile/lib/supabase.ts`
- Create: `apps/mobile/lib/auth-context.tsx`

**Step 1: Install Supabase dependencies**

```bash
cd apps/mobile
pnpm add @supabase/supabase-js expo-secure-store
```

**Step 2: Create Supabase client**

Create `apps/mobile/lib/supabase.ts`:

```typescript
import 'react-native-url-polyfill/dist/polyfill';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Database } from '@idynic/shared/types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

**Step 3: Install URL polyfill**

```bash
pnpm add react-native-url-polyfill
```

**Step 4: Create auth context**

Create `apps/mobile/lib/auth-context.tsx`:

```typescript
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

**Step 5: Create .env file**

Create `apps/mobile/.env`:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
EXPO_PUBLIC_API_URL=https://your-api-url.com
```

**Step 6: Add .env to .gitignore**

```bash
echo "apps/mobile/.env" >> .gitignore
```

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: set up Supabase client with secure storage"
```

---

### Task 8: Set up navigation structure

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/(auth)/login.tsx`
- Create: `apps/mobile/app/(app)/_layout.tsx`
- Create: `apps/mobile/app/(app)/index.tsx`
- Create: `apps/mobile/app/(app)/profile/index.tsx`
- Create: `apps/mobile/app/(app)/opportunities/index.tsx`
- Create: `apps/mobile/app/(app)/settings/index.tsx`

**Step 1: Update root layout**

Update `apps/mobile/app/_layout.tsx`:

```tsx
import '../global.css';
import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../lib/auth-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [session, loading, segments]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="auto" />
        <RootLayoutNav />
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

**Step 2: Install React Query**

```bash
cd apps/mobile
pnpm add @tanstack/react-query
```

**Step 3: Create login screen**

Create `apps/mobile/app/(auth)/login.tsx`:

```tsx
import { View, Text, Pressable } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
  const handleGoogleLogin = async () => {
    // TODO: Implement OAuth with expo-auth-session
  };

  const handleMagicLink = async () => {
    // TODO: Implement magic link
  };

  return (
    <View className="flex-1 bg-slate-900 justify-center items-center px-6">
      <Text className="text-3xl font-bold text-white mb-2">idynic</Text>
      <Text className="text-slate-400 mb-8">Your smart career companion</Text>

      <Pressable
        onPress={handleGoogleLogin}
        className="bg-white w-full py-4 rounded-lg mb-4"
      >
        <Text className="text-slate-900 text-center font-semibold">
          Continue with Google
        </Text>
      </Pressable>

      <Pressable
        onPress={handleMagicLink}
        className="bg-teal-600 w-full py-4 rounded-lg"
      >
        <Text className="text-white text-center font-semibold">
          Continue with Email
        </Text>
      </Pressable>
    </View>
  );
}
```

**Step 4: Create app tabs layout**

Create `apps/mobile/app/(app)/_layout.tsx`:

```tsx
import { Tabs } from 'expo-router';
import { Home, User, Briefcase, Settings } from 'lucide-react-native';

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#0f172a',
          borderTopColor: '#1e293b',
        },
        tabBarActiveTintColor: '#14b8a6',
        tabBarInactiveTintColor: '#64748b',
        headerStyle: {
          backgroundColor: '#0f172a',
        },
        headerTintColor: '#fff',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="opportunities"
        options={{
          title: 'Opportunities',
          tabBarIcon: ({ color, size }) => <Briefcase color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
```

**Step 5: Install lucide-react-native**

```bash
pnpm add lucide-react-native react-native-svg
```

**Step 6: Create placeholder screens**

Create `apps/mobile/app/(app)/index.tsx`:

```tsx
import { View, Text } from 'react-native';

export default function HomeScreen() {
  return (
    <View className="flex-1 bg-slate-900 p-4">
      <Text className="text-2xl font-bold text-white">Welcome back</Text>
      <Text className="text-slate-400 mt-2">Your career dashboard</Text>
    </View>
  );
}
```

Create `apps/mobile/app/(app)/profile/index.tsx`:

```tsx
import { View, Text } from 'react-native';

export default function ProfileScreen() {
  return (
    <View className="flex-1 bg-slate-900 p-4">
      <Text className="text-2xl font-bold text-white">Profile</Text>
    </View>
  );
}
```

Create `apps/mobile/app/(app)/opportunities/index.tsx`:

```tsx
import { View, Text } from 'react-native';

export default function OpportunitiesScreen() {
  return (
    <View className="flex-1 bg-slate-900 p-4">
      <Text className="text-2xl font-bold text-white">Opportunities</Text>
    </View>
  );
}
```

Create `apps/mobile/app/(app)/settings/index.tsx`:

```tsx
import { View, Text, Pressable } from 'react-native';
import { useAuth } from '../../../lib/auth-context';

export default function SettingsScreen() {
  const { signOut, user } = useAuth();

  return (
    <View className="flex-1 bg-slate-900 p-4">
      <Text className="text-2xl font-bold text-white mb-4">Settings</Text>

      <Text className="text-slate-400 mb-6">{user?.email}</Text>

      <Pressable
        onPress={signOut}
        className="bg-red-600 py-3 px-4 rounded-lg"
      >
        <Text className="text-white text-center font-semibold">Sign Out</Text>
      </Pressable>
    </View>
  );
}
```

**Step 7: Test navigation**

Run: `npx expo start`
Expected: Tab navigation works, auth redirect works

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: set up Expo Router navigation with auth flow"
```

---

## Phase 3: Core Screens (Continue in subsequent tasks)

### Task 9: Build Profile screen with data fetching

**Files:**
- Create: `apps/mobile/hooks/use-profile.ts`
- Modify: `apps/mobile/app/(app)/profile/index.tsx`

**Step 1: Create API client instance**

Create `apps/mobile/lib/api.ts`:

```typescript
import { createApiClient } from '@idynic/shared/api';
import { supabase } from './supabase';

const apiUrl = process.env.EXPO_PUBLIC_API_URL!;

export const api = createApiClient({
  baseUrl: apiUrl,
  getAuthToken: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  },
});
```

**Step 2: Create profile hook**

Create `apps/mobile/hooks/use-profile.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: api.profile.get,
  });
}
```

**Step 3: Update Profile screen**

Update `apps/mobile/app/(app)/profile/index.tsx`:

```tsx
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useProfile } from '../../../hooks/use-profile';

export default function ProfileScreen() {
  const { data: profile, isLoading, error } = useProfile();

  if (isLoading) {
    return (
      <View className="flex-1 bg-slate-900 justify-center items-center">
        <ActivityIndicator color="#14b8a6" size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-slate-900 p-4">
        <Text className="text-red-500">Failed to load profile</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-900 p-4">
      <Text className="text-2xl font-bold text-white">
        {profile?.full_name || 'Your Profile'}
      </Text>

      {profile?.headline && (
        <Text className="text-teal-400 mt-1">{profile.headline}</Text>
      )}

      {profile?.summary && (
        <View className="mt-6">
          <Text className="text-slate-400 text-sm uppercase mb-2">Summary</Text>
          <Text className="text-white">{profile.summary}</Text>
        </View>
      )}
    </ScrollView>
  );
}
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add profile screen with API data fetching"
```

---

### Task 10: Build Opportunities list screen

_(Similar pattern - create hook, build list UI with FlatList)_

### Task 11: Build Opportunity detail screen

_(Create [id].tsx dynamic route)_

### Task 12: Build Settings screen with API keys

_(Similar to web settings)_

### Task 13: Implement OAuth login

_(Using expo-auth-session)_

### Task 14: Implement push notifications

_(Using expo-notifications, create user_devices table)_

---

## Summary

This plan covers:
1. **Phase 1:** Monorepo setup with shared packages
2. **Phase 2:** Expo app scaffold with NativeWind, Supabase, and navigation
3. **Phase 3:** Core screens with data fetching

Each task is broken into 2-5 minute steps with exact file paths and complete code.

---

**Next steps after Phase 3:**
- Identity graph visualization (react-native-svg + d3)
- Shared links management
- Push notification Edge Function
- EAS Build configuration
- App Store submission preparation

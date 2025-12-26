import { Tabs } from 'expo-router';
import { User, Briefcase, Settings } from 'lucide-react-native';
import { View, ActivityIndicator } from 'react-native';
import { Logo } from '../../components/logo';
import { useBetaAccess } from '../../lib/use-beta-access';
import { BetaGate } from '../../components/beta-gate';

export default function AppLayout() {
  const { hasAccess, loading, refetch } = useBetaAccess();

  if (loading) {
    return (
      <View className="flex-1 bg-slate-900 justify-center items-center">
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  if (!hasAccess) {
    return <BetaGate onAccessGranted={refetch} />;
  }

  return (
    <Tabs
      screenOptions={{
        sceneStyle: { backgroundColor: '#0f172a' },
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
          title: 'Identity',
          tabBarIcon: ({ color, size }) => <Logo size={size} color={color} />,
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
      <Tabs.Screen
        name="opportunities/[id]"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="shared-links"
        options={{
          href: null,
          title: 'Shared Links',
          headerShown: true,
        }}
      />
      <Tabs.Screen
        name="upload-resume"
        options={{
          href: null,
          title: 'Upload Resume',
          headerShown: true,
        }}
      />
      <Tabs.Screen
        name="add-story"
        options={{
          href: null,
          title: 'Add Story',
          headerShown: true,
        }}
      />
      <Tabs.Screen
        name="add-opportunity"
        options={{
          href: null,
          title: 'Add Opportunity',
          headerShown: true,
        }}
      />
    </Tabs>
  );
}

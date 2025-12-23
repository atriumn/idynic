import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, ChevronRight, LogOut } from 'lucide-react-native';
import { useAuth } from '../../lib/auth-context';
import { useSharedLinks } from '../../hooks/use-shared-links';

function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-6">
      <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
        {title}
      </Text>
      <View className="bg-slate-800 rounded-xl overflow-hidden">
        {children}
      </View>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  badge,
  onPress,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string | number;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3.5 active:bg-slate-700 border-b border-slate-700/50 last:border-b-0"
    >
      <View className="mr-3">{icon}</View>
      <Text className={`flex-1 font-medium ${destructive ? 'text-red-400' : 'text-white'}`}>
        {label}
      </Text>
      {badge !== undefined && (
        <View className="bg-teal-600 px-2 py-0.5 rounded-full mr-2">
          <Text className="text-white text-xs font-bold">{badge}</Text>
        </View>
      )}
      {!destructive && <ChevronRight color="#64748b" size={18} />}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { signOut, user } = useAuth();
  const router = useRouter();
  const { data: sharedLinks } = useSharedLinks();

  const activeLinksCount = sharedLinks?.filter(
    (link) => !link.revokedAt && new Date(link.expiresAt) > new Date()
  ).length || 0;

  return (
    <SafeAreaView className="flex-1 bg-slate-900" edges={['top', 'bottom']}>
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <View className="py-4 mb-2">
          <Text className="text-2xl font-bold text-white mb-1">Settings</Text>
          <Text className="text-slate-400">{user?.email}</Text>
        </View>

        {/* Sharing Section */}
        <MenuSection title="Sharing">
          <MenuItem
            icon={<Link color="#14b8a6" size={20} />}
            label="Shared Links"
            badge={activeLinksCount > 0 ? activeLinksCount : undefined}
            onPress={() => router.push('/shared-links')}
          />
        </MenuSection>

        {/* Account Section */}
        <MenuSection title="Account">
          <MenuItem
            icon={<LogOut color="#f87171" size={20} />}
            label="Sign Out"
            onPress={signOut}
            destructive
          />
        </MenuSection>
      </ScrollView>
    </SafeAreaView>
  );
}

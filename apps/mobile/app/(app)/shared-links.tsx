import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import {
  Link,
  Copy,
  Check,
  Eye,
  XCircle,
  Building2,
  Clock,
  Trash2,
} from 'lucide-react-native';
import {
  useSharedLinks,
  useRevokeSharedLink,
  useDeleteSharedLink,
  SharedLink,
} from '../../hooks/use-shared-links';

function getStatus(link: SharedLink): 'active' | 'expired' | 'revoked' {
  if (link.revokedAt) return 'revoked';
  if (new Date(link.expiresAt) < new Date()) return 'expired';
  return 'active';
}

function getStatusColor(status: 'active' | 'expired' | 'revoked') {
  switch (status) {
    case 'active':
      return { bg: 'bg-green-900/50', text: 'text-green-300' };
    case 'expired':
      return { bg: 'bg-amber-900/50', text: 'text-amber-300' };
    case 'revoked':
      return { bg: 'bg-red-900/50', text: 'text-red-300' };
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function SharedLinkCard({ link }: { link: SharedLink }) {
  const [copied, setCopied] = useState(false);
  const revokeLink = useRevokeSharedLink();
  const deleteLink = useDeleteSharedLink();

  const status = getStatus(link);
  const statusColor = getStatusColor(status);
  const url = `https://idynic.com/shared/${link.token}`;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = () => {
    Alert.alert(
      'Revoke Link',
      'This will immediately disable the shared link. The link can be recreated later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: () => revokeLink.mutate(link.id),
        },
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Link',
      'This will permanently delete the shared link and all view history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteLink.mutate(link.id),
        },
      ]
    );
  };

  return (
    <View className="bg-slate-800 rounded-xl p-4 mb-3">
      {/* Header */}
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 mr-3">
          <Text className="text-white font-semibold text-base" numberOfLines={1}>
            {link.opportunity.title || 'Untitled Opportunity'}
          </Text>
          <View className="flex-row items-center gap-1 mt-1">
            <Building2 color="#64748b" size={14} />
            <Text className="text-slate-400 text-sm">
              {link.opportunity.company || 'Company'}
            </Text>
          </View>
        </View>
        <View className={`px-2.5 py-1 rounded-lg ${statusColor.bg}`}>
          <Text className={`text-xs font-bold uppercase ${statusColor.text}`}>
            {status}
          </Text>
        </View>
      </View>

      {/* Stats Row */}
      <View className="flex-row items-center gap-4 mb-3">
        <View className="flex-row items-center gap-1.5">
          <Eye color="#94a3b8" size={14} />
          <Text className="text-slate-400 text-sm">
            {link.viewCount} {link.viewCount === 1 ? 'view' : 'views'}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <Clock color="#94a3b8" size={14} />
          <Text className="text-slate-400 text-sm">
            {status === 'expired'
              ? `Expired ${formatDate(link.expiresAt)}`
              : `Expires ${formatDate(link.expiresAt)}`}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View className="flex-row gap-2">
        {status === 'active' && (
          <>
            <Pressable
              onPress={handleCopy}
              className="flex-1 bg-teal-600 py-2.5 rounded-lg flex-row items-center justify-center active:bg-teal-700"
            >
              {copied ? (
                <>
                  <Check color="white" size={16} />
                  <Text className="text-white font-semibold ml-1.5">Copied!</Text>
                </>
              ) : (
                <>
                  <Copy color="white" size={16} />
                  <Text className="text-white font-semibold ml-1.5">Copy Link</Text>
                </>
              )}
            </Pressable>
            <Pressable
              onPress={handleRevoke}
              disabled={revokeLink.isPending}
              className="bg-slate-700 py-2.5 px-4 rounded-lg flex-row items-center justify-center active:bg-slate-600"
            >
              {revokeLink.isPending ? (
                <ActivityIndicator color="#94a3b8" size="small" />
              ) : (
                <XCircle color="#f87171" size={18} />
              )}
            </Pressable>
          </>
        )}
        {(status === 'expired' || status === 'revoked') && (
          <Pressable
            onPress={handleDelete}
            disabled={deleteLink.isPending}
            className="flex-1 bg-slate-700 py-2.5 rounded-lg flex-row items-center justify-center active:bg-slate-600"
          >
            {deleteLink.isPending ? (
              <ActivityIndicator color="#94a3b8" size="small" />
            ) : (
              <>
                <Trash2 color="#f87171" size={16} />
                <Text className="text-red-400 font-semibold ml-1.5">Delete</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function SharedLinksScreen() {
  const { data: links, isLoading, error, refetch, isRefetching } = useSharedLinks();

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-900 justify-center items-center" edges={['top', 'bottom']}>
        <ActivityIndicator color="#14b8a6" size="large" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-slate-900 p-4" edges={['top', 'bottom']}>
        <View className="flex-1 justify-center items-center">
          <Text className="text-red-500 mb-2">Failed to load shared links</Text>
          <Text className="text-slate-400 text-sm text-center">
            {error.message}
          </Text>
          <Pressable
            onPress={() => refetch()}
            className="mt-4 bg-slate-700 px-4 py-2 rounded-lg"
          >
            <Text className="text-white">Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const activeLinks = links?.filter((l) => getStatus(l) === 'active') || [];
  const inactiveLinks = links?.filter((l) => getStatus(l) !== 'active') || [];

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#0f172a' }} edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#ffffff"
          />
        }
      >
        {/* Header */}
        <View className="py-4">
          <Text className="text-2xl font-bold text-white mb-1">Shared Links</Text>
          <Text className="text-slate-400">
            Manage links to your tailored profiles
          </Text>
        </View>

        {links?.length === 0 ? (
          <View className="bg-slate-800/50 rounded-xl p-8 items-center mt-4">
            <View className="h-16 w-16 rounded-full bg-slate-700 items-center justify-center mb-4">
              <Link color="#64748b" size={28} />
            </View>
            <Text className="text-lg font-bold text-white mb-2 text-center">
              No Shared Links Yet
            </Text>
            <Text className="text-slate-400 text-center text-sm">
              Share a tailored profile from an opportunity to create your first link.
            </Text>
          </View>
        ) : (
          <>
            {/* Active Links */}
            {activeLinks.length > 0 && (
              <View className="mb-6">
                <Text className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Active ({activeLinks.length})
                </Text>
                {activeLinks.map((link) => (
                  <SharedLinkCard key={link.id} link={link} />
                ))}
              </View>
            )}

            {/* Inactive Links */}
            {inactiveLinks.length > 0 && (
              <View>
                <Text className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Expired / Revoked ({inactiveLinks.length})
                </Text>
                {inactiveLinks.map((link) => (
                  <SharedLinkCard key={link.id} link={link} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

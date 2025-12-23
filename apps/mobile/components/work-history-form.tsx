import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import { WorkHistoryData } from '../hooks/use-profile-mutations';

interface WorkHistoryFormProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: WorkHistoryData) => Promise<void>;
  initialData?: Partial<WorkHistoryData>;
  title?: string;
  isVenture?: boolean;
}

export function WorkHistoryForm({
  visible,
  onClose,
  onSubmit,
  initialData,
  title = 'Add Experience',
  isVenture = false,
}: WorkHistoryFormProps) {
  const [company, setCompany] = useState(initialData?.company || '');
  const [jobTitle, setJobTitle] = useState(initialData?.title || '');
  const [startDate, setStartDate] = useState(initialData?.start_date || '');
  const [endDate, setEndDate] = useState(initialData?.end_date || '');
  const [location, setLocation] = useState(initialData?.location || '');
  const [summary, setSummary] = useState(initialData?.summary || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when initialData changes (fixes "wrong item" bug)
  useEffect(() => {
    setCompany(initialData?.company || '');
    setJobTitle(initialData?.title || '');
    setStartDate(initialData?.start_date || '');
    setEndDate(initialData?.end_date || '');
    setLocation(initialData?.location || '');
    setSummary(initialData?.summary || '');
    setError(null);
  }, [initialData]);

  const handleSubmit = async () => {
    if (!company.trim() || !jobTitle.trim()) {
      setError('Company and title are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmit({
        company: company.trim(),
        title: jobTitle.trim(),
        start_date: startDate.trim() || null,
        end_date: endDate.trim() || null,
        location: location.trim() || null,
        summary: summary.trim() || null,
        entry_type: isVenture ? 'venture' : 'work',
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCompany(initialData?.company || '');
    setJobTitle(initialData?.title || '');
    setStartDate(initialData?.start_date || '');
    setEndDate(initialData?.end_date || '');
    setLocation(initialData?.location || '');
    setSummary(initialData?.summary || '');
    setError(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-slate-900 rounded-t-3xl max-h-[90%]">
            {/* Header */}
            <View className="flex-row items-center justify-between p-4 border-b border-slate-800">
              <Text className="text-lg font-bold text-white">{title}</Text>
              <Pressable onPress={handleClose} className="p-2">
                <X color="#94a3b8" size={24} />
              </Pressable>
            </View>

            <ScrollView className="p-4" keyboardShouldPersistTaps="handled">
              {error && (
                <View className="bg-red-900/50 p-3 rounded-lg mb-4">
                  <Text className="text-red-300">{error}</Text>
                </View>
              )}

              <View className="mb-4">
                <Text className="text-sm font-medium text-slate-400 mb-2">
                  {isVenture ? 'Venture Name' : 'Company'} *
                </Text>
                <TextInput
                  value={company}
                  onChangeText={setCompany}
                  placeholder={isVenture ? 'Your Startup Inc.' : 'Company name'}
                  placeholderTextColor="#64748b"
                  className="bg-slate-800 text-white p-3 rounded-lg"
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-slate-400 mb-2">
                  {isVenture ? 'Role' : 'Job Title'} *
                </Text>
                <TextInput
                  value={jobTitle}
                  onChangeText={setJobTitle}
                  placeholder={isVenture ? 'Founder & CEO' : 'Software Engineer'}
                  placeholderTextColor="#64748b"
                  className="bg-slate-800 text-white p-3 rounded-lg"
                />
              </View>

              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-sm font-medium text-slate-400 mb-2">Start Date</Text>
                  <TextInput
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="2020-01"
                    placeholderTextColor="#64748b"
                    className="bg-slate-800 text-white p-3 rounded-lg"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-slate-400 mb-2">End Date</Text>
                  <TextInput
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="Present"
                    placeholderTextColor="#64748b"
                    className="bg-slate-800 text-white p-3 rounded-lg"
                  />
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-slate-400 mb-2">Location</Text>
                <TextInput
                  value={location}
                  onChangeText={setLocation}
                  placeholder="San Francisco, CA"
                  placeholderTextColor="#64748b"
                  className="bg-slate-800 text-white p-3 rounded-lg"
                />
              </View>

              <View className="mb-6">
                <Text className="text-sm font-medium text-slate-400 mb-2">Summary</Text>
                <TextInput
                  value={summary}
                  onChangeText={setSummary}
                  placeholder="Brief description of your role and accomplishments..."
                  placeholderTextColor="#64748b"
                  multiline
                  numberOfLines={4}
                  className="bg-slate-800 text-white p-3 rounded-lg min-h-[100px]"
                  textAlignVertical="top"
                />
              </View>

              {/* Buttons */}
              <View className="flex-row gap-3 mb-8">
                <Pressable
                  onPress={handleClose}
                  className="flex-1 py-3 rounded-xl border border-slate-700"
                >
                  <Text className="text-center text-slate-400 font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSubmit}
                  disabled={loading}
                  className={`flex-1 py-3 rounded-xl ${loading ? 'bg-teal-800' : 'bg-teal-600'}`}
                >
                  {loading ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text className="text-center text-white font-semibold">Save</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

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

interface EducationFormProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: { text: string; context?: { institution?: string; degree?: string } }) => Promise<void>;
  initialData?: { text: string; context?: unknown };
  title?: string;
}

export function EducationForm({
  visible,
  onClose,
  onSubmit,
  initialData,
  title = 'Add Education',
}: EducationFormProps) {
  const initialContext = initialData?.context as { institution?: string; degree?: string } | undefined;

  const [text, setText] = useState(initialData?.text || '');
  const [institution, setInstitution] = useState(initialContext?.institution || '');
  const [degree, setDegree] = useState(initialContext?.degree || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when initialData changes (fixes "wrong item" bug)
  useEffect(() => {
    const context = initialData?.context as { institution?: string; degree?: string } | undefined;
    setText(initialData?.text || '');
    setInstitution(context?.institution || '');
    setDegree(context?.degree || '');
    setError(null);
  }, [initialData]);

  const handleSubmit = async () => {
    if (!text.trim()) {
      setError('Education description is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmit({
        text: text.trim(),
        context: {
          institution: institution.trim() || undefined,
          degree: degree.trim() || undefined,
        },
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setText(initialData?.text || '');
    setInstitution(initialContext?.institution || '');
    setDegree(initialContext?.degree || '');
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
                <Text className="text-sm font-medium text-slate-400 mb-2">Description *</Text>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="B.S. in Computer Science, Stanford University, 2018"
                  placeholderTextColor="#64748b"
                  multiline
                  numberOfLines={3}
                  className="bg-slate-800 text-white p-3 rounded-lg min-h-[80px]"
                  textAlignVertical="top"
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-slate-400 mb-2">Institution</Text>
                <TextInput
                  value={institution}
                  onChangeText={setInstitution}
                  placeholder="Stanford University"
                  placeholderTextColor="#64748b"
                  className="bg-slate-800 text-white p-3 rounded-lg"
                />
              </View>

              <View className="mb-6">
                <Text className="text-sm font-medium text-slate-400 mb-2">Degree</Text>
                <TextInput
                  value={degree}
                  onChangeText={setDegree}
                  placeholder="B.S. in Computer Science"
                  placeholderTextColor="#64748b"
                  className="bg-slate-800 text-white p-3 rounded-lg"
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

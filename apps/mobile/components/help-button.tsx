import { useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { HelpCircle, X } from 'lucide-react-native';
import { CONTEXTUAL_HELP, type ContextualHelpKey } from '@idynic/shared';

interface HelpButtonProps {
  helpKey: ContextualHelpKey;
  size?: number;
  color?: string;
}

export function HelpButton({ helpKey, size = 16, color = '#64748b' }: HelpButtonProps) {
  const [visible, setVisible] = useState(false);
  const help = CONTEXTUAL_HELP[helpKey];

  if (!help) return null;

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        hitSlop={8}
        accessibilityLabel={`Help: ${help.title}`}
        accessibilityRole="button"
      >
        <HelpCircle color={color} size={size} />
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable
          className="flex-1 bg-black/60 justify-center items-center px-6"
          onPress={() => setVisible(false)}
        >
          <Pressable
            className="bg-slate-800 rounded-xl p-5 w-full max-w-sm border border-slate-700"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-start justify-between mb-3">
              <View className="flex-row items-center gap-2 flex-1">
                <HelpCircle color="#14b8a6" size={20} />
                <Text className="text-white font-semibold text-base">{help.title}</Text>
              </View>
              <Pressable onPress={() => setVisible(false)} hitSlop={8}>
                <X color="#64748b" size={20} />
              </Pressable>
            </View>
            <Text className="text-slate-400 text-sm leading-relaxed">{help.content}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

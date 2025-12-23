import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react-native';
import { useProfile } from '../../hooks/use-profile';
import {
  useUpdateContact,
  useAddWorkHistory,
  useUpdateWorkHistory,
  useDeleteWorkHistory,
  useAddEducation,
  useUpdateEducation,
  useDeleteEducation,
  useAddSkill,
  useDeleteSkill,
  useAddVenture,
  WorkHistoryData,
} from '../../hooks/use-profile-mutations';
import { WorkHistoryForm } from '../../components/work-history-form';
import { EducationForm } from '../../components/education-form';

const INITIAL_SKILLS_COUNT = 10;

// Contact Edit Form
function ContactEditForm({
  contact,
  onSave,
  onCancel,
  isSaving,
}: {
  contact: {
    name: string | null;
    email: string | null;
    phone: string | null;
    location: string | null;
    linkedin: string | null;
    github: string | null;
    website: string | null;
  };
  onSave: (data: Record<string, string>) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(contact.name || '');
  const [email, setEmail] = useState(contact.email || '');
  const [phone, setPhone] = useState(contact.phone || '');
  const [location, setLocation] = useState(contact.location || '');
  const [linkedin, setLinkedin] = useState(contact.linkedin || '');
  const [github, setGithub] = useState(contact.github || '');
  const [website, setWebsite] = useState(contact.website || '');

  return (
    <View className="bg-slate-800 rounded-xl p-4 mb-6">
      <View className="mb-3">
        <Text className="text-xs font-medium text-slate-500 mb-1">Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your Name"
          placeholderTextColor="#64748b"
          className="bg-slate-700 text-white p-2 rounded-lg"
        />
      </View>
      <View className="mb-3">
        <Text className="text-xs font-medium text-slate-500 mb-1">Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="email@example.com"
          placeholderTextColor="#64748b"
          keyboardType="email-address"
          autoCapitalize="none"
          className="bg-slate-700 text-white p-2 rounded-lg"
        />
      </View>
      <View className="mb-3">
        <Text className="text-xs font-medium text-slate-500 mb-1">Phone</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="+1 555-123-4567"
          placeholderTextColor="#64748b"
          keyboardType="phone-pad"
          className="bg-slate-700 text-white p-2 rounded-lg"
        />
      </View>
      <View className="mb-3">
        <Text className="text-xs font-medium text-slate-500 mb-1">Location</Text>
        <TextInput
          value={location}
          onChangeText={setLocation}
          placeholder="San Francisco, CA"
          placeholderTextColor="#64748b"
          className="bg-slate-700 text-white p-2 rounded-lg"
        />
      </View>
      <View className="mb-3">
        <Text className="text-xs font-medium text-slate-500 mb-1">LinkedIn</Text>
        <TextInput
          value={linkedin}
          onChangeText={setLinkedin}
          placeholder="https://linkedin.com/in/yourname"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          className="bg-slate-700 text-white p-2 rounded-lg"
        />
      </View>
      <View className="mb-3">
        <Text className="text-xs font-medium text-slate-500 mb-1">GitHub</Text>
        <TextInput
          value={github}
          onChangeText={setGithub}
          placeholder="https://github.com/yourname"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          className="bg-slate-700 text-white p-2 rounded-lg"
        />
      </View>
      <View className="mb-4">
        <Text className="text-xs font-medium text-slate-500 mb-1">Website</Text>
        <TextInput
          value={website}
          onChangeText={setWebsite}
          placeholder="https://yoursite.com"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          className="bg-slate-700 text-white p-2 rounded-lg"
        />
      </View>
      <View className="flex-row gap-2">
        <Pressable onPress={onCancel} className="flex-1 py-2 rounded-lg border border-slate-600">
          <Text className="text-center text-slate-400">Cancel</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            onSave({ name, email, phone, location, linkedin, github, website })
          }
          disabled={isSaving}
          className={`flex-1 py-2 rounded-lg ${isSaving ? 'bg-teal-800' : 'bg-teal-600'}`}
        >
          {isSaving ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text className="text-center text-white font-semibold">Save</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// Add Skill Input
function AddSkillInput({ onAdd }: { onAdd: (label: string) => void }) {
  const [text, setText] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  if (!isAdding) {
    return (
      <Pressable
        onPress={() => setIsAdding(true)}
        className="flex-row items-center gap-1 bg-slate-700 px-3 py-1.5 rounded-full"
      >
        <Plus color="#14b8a6" size={14} />
        <Text className="text-teal-400 text-sm">Add Skill</Text>
      </Pressable>
    );
  }

  return (
    <View className="flex-row items-center gap-2 bg-slate-700 px-2 py-1 rounded-lg">
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="New skill"
        placeholderTextColor="#64748b"
        autoFocus
        className="flex-1 text-white p-1"
        onSubmitEditing={() => {
          if (text.trim()) {
            onAdd(text.trim());
            setText('');
            setIsAdding(false);
          }
        }}
      />
      <Pressable
        onPress={() => {
          if (text.trim()) {
            onAdd(text.trim());
            setText('');
            setIsAdding(false);
          }
        }}
      >
        <Check color="#14b8a6" size={20} />
      </Pressable>
      <Pressable
        onPress={() => {
          setText('');
          setIsAdding(false);
        }}
      >
        <X color="#64748b" size={20} />
      </Pressable>
    </View>
  );
}

export default function ProfileScreen() {
  const { data: profile, isLoading, error, refetch, isRefetching } = useProfile();
  const [showAllSkills, setShowAllSkills] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [workHistoryModal, setWorkHistoryModal] = useState<{
    visible: boolean;
    data?: WorkHistoryData & { id?: string };
    isVenture?: boolean;
  }>({ visible: false });
  const [educationModal, setEducationModal] = useState<{
    visible: boolean;
    data?: { id?: string; text: string; context?: unknown };
  }>({ visible: false });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Mutations
  const updateContact = useUpdateContact();
  const addWorkHistory = useAddWorkHistory();
  const updateWorkHistory = useUpdateWorkHistory();
  const deleteWorkHistory = useDeleteWorkHistory();
  const addEducation = useAddEducation();
  const updateEducation = useUpdateEducation();
  const deleteEducation = useDeleteEducation();
  const addSkill = useAddSkill();
  const deleteSkill = useDeleteSkill();
  const addVenture = useAddVenture();

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-900 justify-center items-center" edges={['bottom']}>
        <ActivityIndicator color="#14b8a6" size="large" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-slate-900 p-4" edges={['bottom']}>
        <Text className="text-red-500">Failed to load profile</Text>
        <Text className="text-slate-400 mt-2 text-sm">{error.message}</Text>
      </SafeAreaView>
    );
  }

  const displayedSkills = showAllSkills
    ? profile?.skills
    : profile?.skills?.slice(0, INITIAL_SKILLS_COUNT);
  const hasMoreSkills = (profile?.skills?.length || 0) > INITIAL_SKILLS_COUNT;

  const handleSaveContact = async (data: Record<string, string>) => {
    try {
      await updateContact.mutateAsync(data);
      setEditingContact(false);
    } catch (err) {
      Alert.alert('Error', 'Failed to save contact info');
    }
  };

  const handleDeleteWorkHistory = (id: string, title: string) => {
    Alert.alert('Delete Experience', `Are you sure you want to delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteWorkHistory.mutate(id),
      },
    ]);
  };

  const handleDeleteEducation = (id: string, text: string) => {
    Alert.alert('Delete Education', `Are you sure you want to delete this education entry?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteEducation.mutate(id),
      },
    ]);
  };

  const handleDeleteSkill = (id: string, label: string) => {
    Alert.alert('Delete Skill', `Remove "${label}" from your skills?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteSkill.mutate(id),
      },
    ]);
  };

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: '#0f172a' }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={onRefresh}
          tintColor="#ffffff"
        />
      }
    >
      <View className="p-4">
        {/* Contact Info */}
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-2xl font-bold text-white">
            {profile?.contact?.name || 'Your Profile'}
          </Text>
          {!editingContact && (
            <Pressable onPress={() => setEditingContact(true)} className="p-2">
              <Pencil color="#14b8a6" size={20} />
            </Pressable>
          )}
        </View>

        {editingContact ? (
          <ContactEditForm
            contact={profile?.contact || {
              name: null,
              email: null,
              phone: null,
              location: null,
              linkedin: null,
              github: null,
              website: null,
            }}
            onSave={handleSaveContact}
            onCancel={() => setEditingContact(false)}
            isSaving={updateContact.isPending}
          />
        ) : (
          <View className="mb-6">
            {profile?.contact?.location && (
              <Text className="text-slate-400 mt-1">{profile.contact.location}</Text>
            )}
            {profile?.contact?.email && (
              <Text className="text-teal-400 mt-1">{profile.contact.email}</Text>
            )}
          </View>
        )}

        {/* Work History */}
        <View className="mt-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-slate-400 text-sm uppercase">Experience</Text>
            <Pressable
              onPress={() => setWorkHistoryModal({ visible: true })}
              className="flex-row items-center gap-1"
            >
              <Plus color="#14b8a6" size={16} />
              <Text className="text-teal-400 text-sm">Add</Text>
            </Pressable>
          </View>
          {profile?.workHistory && profile.workHistory.length > 0 ? (
            profile.workHistory.map((job) => (
              <View key={job.id} className="mb-4 bg-slate-800 p-4 rounded-lg">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className="text-white font-semibold">{job.title}</Text>
                    <Text className="text-teal-400">{job.company}</Text>
                    {job.location && (
                      <Text className="text-slate-400 text-sm">{job.location}</Text>
                    )}
                  </View>
                  <View className="flex-row items-center">
                    <Pressable
                      onPress={() =>
                        setWorkHistoryModal({
                          visible: true,
                          data: { ...job, id: job.id },
                        })
                      }
                      className="p-2"
                    >
                      <Pencil color="#64748b" size={18} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteWorkHistory(job.id, job.title)}
                      className="p-2 ml-2"
                    >
                      <Trash2 color="#ef4444" size={18} />
                    </Pressable>
                  </View>
                </View>
                {job.summary && (
                  <Text className="text-slate-300 mt-2 text-sm">{job.summary}</Text>
                )}
              </View>
            ))
          ) : (
            <Text className="text-slate-500 italic">No experience added yet</Text>
          )}
        </View>

        {/* Ventures */}
        {profile?.ventures && profile.ventures.length > 0 && (
          <View className="mt-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-slate-400 text-sm uppercase">Ventures</Text>
              <Pressable
                onPress={() => setWorkHistoryModal({ visible: true, isVenture: true })}
                className="flex-row items-center gap-1"
              >
                <Plus color="#14b8a6" size={16} />
                <Text className="text-teal-400 text-sm">Add</Text>
              </Pressable>
            </View>
            {profile.ventures.map((venture) => (
              <View key={venture.id} className="mb-4 bg-slate-800 p-4 rounded-lg">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className="text-white font-semibold">{venture.title}</Text>
                    <Text className="text-teal-400">{venture.company}</Text>
                  </View>
                  <View className="flex-row items-center">
                    <Pressable
                      onPress={() =>
                        setWorkHistoryModal({
                          visible: true,
                          data: { ...venture, id: venture.id },
                          isVenture: true,
                        })
                      }
                      className="p-2"
                    >
                      <Pencil color="#64748b" size={18} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteWorkHistory(venture.id, venture.title)}
                      className="p-2 ml-2"
                    >
                      <Trash2 color="#ef4444" size={18} />
                    </Pressable>
                  </View>
                </View>
                {venture.summary && (
                  <Text className="text-slate-300 mt-2 text-sm">{venture.summary}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Education */}
        <View className="mt-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-slate-400 text-sm uppercase">Education</Text>
            <Pressable
              onPress={() => setEducationModal({ visible: true })}
              className="flex-row items-center gap-1"
            >
              <Plus color="#14b8a6" size={16} />
              <Text className="text-teal-400 text-sm">Add</Text>
            </Pressable>
          </View>
          {profile?.education && profile.education.length > 0 ? (
            profile.education.map((edu) => {
              const contextStr = typeof edu.context === 'string' ? edu.context : null;
              return (
                <View key={edu.id} className="mb-4 bg-slate-800 p-4 rounded-lg">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1">
                      <Text className="text-white">{edu.text}</Text>
                      {contextStr && (
                        <Text className="text-slate-400 text-sm mt-1">{contextStr}</Text>
                      )}
                    </View>
                    <View className="flex-row items-center">
                      <Pressable
                        onPress={() =>
                          setEducationModal({
                            visible: true,
                            data: { id: edu.id, text: edu.text, context: edu.context },
                          })
                        }
                        className="p-2"
                      >
                        <Pencil color="#64748b" size={18} />
                      </Pressable>
                      <Pressable
                        onPress={() => handleDeleteEducation(edu.id, edu.text)}
                        className="p-2 ml-2"
                      >
                        <Trash2 color="#ef4444" size={18} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <Text className="text-slate-500 italic">No education added yet</Text>
          )}
        </View>

        {/* Skills */}
        <View className="mt-6 mb-8">
          <Text className="text-slate-400 text-sm uppercase mb-3">
            Skills ({profile?.skills?.length || 0})
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {displayedSkills?.map((skill) => (
              <View
                key={skill.id}
                className="flex-row items-center bg-teal-900/50 px-3 py-1 rounded-full"
              >
                <Text className="text-teal-300 text-sm mr-1">{skill.label}</Text>
                <Pressable onPress={() => handleDeleteSkill(skill.id, skill.label)}>
                  <X color="#5eead4" size={14} />
                </Pressable>
              </View>
            ))}
            <AddSkillInput onAdd={(label) => addSkill.mutate(label)} />
          </View>
          {hasMoreSkills && (
            <Pressable onPress={() => setShowAllSkills(!showAllSkills)} className="mt-3">
              <Text className="text-teal-400 text-sm">
                {showAllSkills
                  ? 'Show less'
                  : `Show ${(profile?.skills?.length || 0) - INITIAL_SKILLS_COUNT} more`}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Work History Modal */}
      <WorkHistoryForm
        visible={workHistoryModal.visible}
        onClose={() => setWorkHistoryModal({ visible: false })}
        onSubmit={async (data) => {
          if (workHistoryModal.data?.id) {
            await updateWorkHistory.mutateAsync({
              id: workHistoryModal.data.id,
              data,
            });
          } else if (workHistoryModal.isVenture) {
            await addVenture.mutateAsync(data);
          } else {
            await addWorkHistory.mutateAsync(data);
          }
        }}
        initialData={workHistoryModal.data}
        title={
          workHistoryModal.data?.id
            ? workHistoryModal.isVenture
              ? 'Edit Venture'
              : 'Edit Experience'
            : workHistoryModal.isVenture
              ? 'Add Venture'
              : 'Add Experience'
        }
        isVenture={workHistoryModal.isVenture}
      />

      {/* Education Modal */}
      <EducationForm
        visible={educationModal.visible}
        onClose={() => setEducationModal({ visible: false })}
        onSubmit={async (data) => {
          if (educationModal.data?.id) {
            await updateEducation.mutateAsync({
              id: educationModal.data.id,
              data,
            });
          } else {
            await addEducation.mutateAsync(data);
          }
        }}
        initialData={educationModal.data}
        title={educationModal.data?.id ? 'Edit Education' : 'Add Education'}
      />
    </ScrollView>
  );
}

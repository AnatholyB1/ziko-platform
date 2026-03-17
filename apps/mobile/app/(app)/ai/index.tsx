import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAIStore } from '../../../src/stores/aiStore';

function MessageBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === 'user';
  return (
    <View style={{ paddingVertical: 4, paddingHorizontal: 16, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
      <View
        style={{
          maxWidth: '85%',
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: isUser ? 18 : 18,
          borderBottomRightRadius: isUser ? 4 : 18,
          borderBottomLeftRadius: isUser ? 18 : 4,
          backgroundColor: isUser ? '#6C63FF' : '#1A1A24',
          borderWidth: isUser ? 0 : 1,
          borderColor: '#2E2E40',
        }}
      >
        <Text style={{ color: '#F0F0F5', fontSize: 15, lineHeight: 22 }}>{content}</Text>
      </View>
    </View>
  );
}

export default function AIScreen() {
  const messages = useAIStore((s) => s.messages);
  const isStreaming = useAIStore((s) => s.isStreaming);
  const streamingContent = useAIStore((s) => s.streamingContent);
  const sendMessage = useAIStore((s) => s.sendMessage);
  const createConversation = useAIStore((s) => s.createConversation);
  const [input, setInput] = useState('');
  const flatlistRef = useRef<FlatList>(null);

  useEffect(() => {
    createConversation().catch(() => {});
  }, []);

  useEffect(() => {
    if (messages.length > 0 || isStreaming) {
      setTimeout(() => flatlistRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length, isStreaming]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    try {
      await sendMessage(text);
    } catch {
      // Error handled in store
    }
  };

  const suggestions = [
    'How should I structure my training?',
    'What should I eat before working out?',
    'How do I improve my squat form?',
    'Give me a weekly meal plan',
  ];

  const displayMessages = [
    ...messages,
    ...(isStreaming && streamingContent ? [{ id: 'streaming', role: 'assistant', content: streamingContent, conversation_id: '', created_at: '' }] : []),
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0F14' }}>
      <View style={{ paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#2E2E40' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#6C63FF', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="sparkles" size={16} color="#fff" />
          </View>
          <View>
            <Text style={{ color: '#F0F0F5', fontWeight: '700', fontSize: 16 }}>Ziko AI Coach</Text>
            <Text style={{ color: isStreaming ? '#4CAF50' : '#8888A8', fontSize: 11 }}>
              {isStreaming ? '● Thinking…' : '● Online'}
            </Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <FlatList
          ref={flatlistRef}
          data={displayMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble role={item.role} content={item.content} />}
          contentContainerStyle={{ paddingVertical: 16 }}
          ListEmptyComponent={
            <View style={{ padding: 24 }}>
              <Text style={{ color: '#F0F0F5', fontWeight: '700', fontSize: 18, textAlign: 'center', marginBottom: 8 }}>
                Hi! I'm your AI fitness coach 💪
              </Text>
              <Text style={{ color: '#8888A8', textAlign: 'center', marginBottom: 28 }}>
                Ask me anything about training, nutrition, recovery, or your goals.
              </Text>
              <Text style={{ color: '#8888A8', fontSize: 13, marginBottom: 12 }}>Try these:</Text>
              {suggestions.map((s) => (
                <TouchableOpacity key={s} onPress={() => setInput(s)}
                  style={{ backgroundColor: '#1A1A24', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#2E2E40' }}>
                  <Text style={{ color: '#F0F0F5', fontSize: 14 }}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          }
        />

        {/* Input */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: '#2E2E40', backgroundColor: '#0F0F14' }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask your coach…"
            placeholderTextColor="#8888A8"
            multiline
            maxLength={1000}
            style={{
              flex: 1,
              backgroundColor: '#1A1A24',
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 10,
              color: '#F0F0F5',
              fontSize: 15,
              borderWidth: 1,
              borderColor: '#2E2E40',
              maxHeight: 100,
            }}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!input.trim() || isStreaming}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: input.trim() && !isStreaming ? '#6C63FF' : '#2E2E40',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isStreaming
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={18} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

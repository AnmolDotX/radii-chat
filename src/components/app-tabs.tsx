import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { useOrbitorTheme } from '@/theme';

export default function AppTabs() {
  const theme = useOrbitorTheme();
  const insets = useSafeAreaInsets();

  // Generous clearance ensures tab bar sits cleanly above physical Android 3-button/gesture bar
  const bottomInset = Math.max(insets.bottom, 16) + (Platform.OS === 'android' ? 14 : 8);
  const barHeight = 56 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: barHeight,
          paddingBottom: bottomInset,
          paddingTop: 8,
          elevation: 12,
        },
        tabBarItemStyle: {
          overflow: 'hidden',
          borderRadius: 16,
          marginHorizontal: 4,
          paddingVertical: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        tabBarActiveTintColor: theme.accentCyan,
        tabBarInactiveTintColor: theme.textTertiary,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Radar',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="radio-outline" size={size || 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Mesh Chats',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses-outline" size={size || 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="fling"
        options={{
          title: 'File Fling',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="swap-vertical-outline" size={size || 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size || 22} color={color} />
          ),
        }}
      />
      {/* Hide internal sub-route chat/[id] completely from the bottom tab bar */}
      <Tabs.Screen
        name="chat/[id]"
        options={{
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}

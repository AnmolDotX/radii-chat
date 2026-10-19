import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import PagerView from 'react-native-pager-view';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrbitorTheme, Radius } from '@/theme';

import RadarScreen from '@/screens/RadarScreen';
import ChatsScreen from '@/screens/ChatsScreen';
import SettingsScreen from '@/screens/SettingsScreen';

const TABS = [
  { id: 0, title: 'Radar', icon: 'radio-outline', activeIcon: 'radio' },
  { id: 1, title: 'Mesh Chats', icon: 'chatbubble-ellipses-outline', activeIcon: 'chatbubble-ellipses' },
  { id: 2, title: 'Settings', icon: 'settings-outline', activeIcon: 'settings' },
] as const;

export default function PagerAppShell() {
  const theme = useOrbitorTheme();
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<PagerView>(null);
  const [activePageIndex, setActivePageIndex] = useState(0);

  // Height and clearance: generous padding ensures no collision with physical Android navigation buttons
  const bottomInset = Math.max(insets.bottom, 14) + (Platform.OS === 'android' ? 12 : 6);
  const barHeight = 58 + bottomInset;

  const handleSelectTab = (index: number) => {
    setActivePageIndex(index);
    pagerRef.current?.setPage(index);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* 60fps/120fps Native Hardware Pager View */}
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        overdrag={true}
        onPageSelected={(e) => {
          setActivePageIndex(e.nativeEvent.position);
        }}>
        <View key="0" style={styles.page}>
          <RadarScreen />
        </View>
        <View key="1" style={styles.page}>
          <ChatsScreen onNavigateToRadar={() => handleSelectTab(0)} />
        </View>
        <View key="2" style={styles.page}>
          <SettingsScreen />
        </View>
      </PagerView>

      {/* Floating Bottom Navigation Bar */}
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: theme.surface,
            height: barHeight,
            paddingBottom: bottomInset,
          },
        ]}>
        {TABS.map((tab) => {
          const isActive = activePageIndex === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => handleSelectTab(tab.id)}
              android_ripple={{
                color: theme.accentCyanMuted,
                borderless: true,
                radius: 28,
              }}
              style={({ pressed }) => [
                styles.tabItem,
                {
                  opacity: pressed ? 0.75 : 1,
                },
              ]}>
              <View
                style={[
                  styles.iconContainer,
                  isActive && { backgroundColor: theme.accentCyanMuted },
                ]}>
                <Ionicons
                  name={(isActive ? tab.activeIcon : tab.icon) as any}
                  size={21}
                  color={isActive ? theme.accentCyan : theme.textTertiary}
                />
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive ? theme.accentCyan : theme.textTertiary,
                    fontWeight: isActive ? '600' : '500',
                  },
                ]}>
                {tab.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 0,
    paddingTop: 6,
    elevation: 1,
    shadowColor: Platform.select({ android: 'rgba(0, 0, 0, 0.05)', default: '#000' }),
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    gap: 3,
  },
  iconContainer: {
    width: 58,
    height: 32,
    borderRadius: Radius.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: Platform.select({ ios: 'system-ui', android: 'sans-serif-medium' }),
    letterSpacing: -0.1,
    includeFontPadding: false,
  },
});


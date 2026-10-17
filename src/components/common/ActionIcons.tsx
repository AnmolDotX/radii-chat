import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

interface IconProps {
  color?: string;
  size?: number;
}

/**
 * Teardrop Chat Bubble Icon (Matching PiChatTeardropFill from user's screenshot)
 */
export const ChatTeardropIcon: React.FC<IconProps> = ({
  color = '#00E5FF',
  size = 20,
}) => {
  return (
    <Ionicons
      name="chatbubble"
      size={size}
      color={color}
    />
  );
};

/**
 * File Transfer / Fling Dual-Arrow Icon (Matching TbArrowAutofitHeightFilled from user's screenshot)
 */
export const FileFlingIcon: React.FC<IconProps> = ({
  color = '#00E5FF',
  size = 20,
}) => {
  return (
    <MaterialCommunityIcons
      name="swap-vertical-bold"
      size={size}
      color={color}
    />
  );
};

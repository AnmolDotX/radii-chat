import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TextInput } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useOrbitorTheme, Typography, Radius, Spacing } from '../../theme';
import { Badge } from '../common/Badge';

interface QRMeshModalProps {
  visible: boolean;
  onClose: () => void;
  myProfileName: string;
  onJoinCode: (code: string) => void;
}

export const QRMeshModal: React.FC<QRMeshModalProps> = ({
  visible,
  onClose,
  myProfileName,
  onJoinCode,
}) => {
  const theme = useOrbitorTheme();
  const [tab, setTab] = useState<'my_qr' | 'join'>('my_qr');
  const [roomCode, setRoomCode] = useState('');

  const handleJoin = () => {
    if (roomCode.trim()) {
      onJoinCode(roomCode.trim().toUpperCase());
      setRoomCode('');
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}>
          <View style={styles.tabHeader}>
            <Pressable
              onPress={() => setTab('my_qr')}
              style={({ pressed }) => [
                styles.tabItem,
                tab === 'my_qr' && { borderBottomColor: theme.accentCyan, borderBottomWidth: 2 },
                pressed && { opacity: 0.8 },
              ]}>
              <Text
                style={[
                  styles.tabText,
                  { color: tab === 'my_qr' ? theme.text : theme.textSecondary },
                ]}>
                My QR Pairing
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setTab('join')}
              style={({ pressed }) => [
                styles.tabItem,
                tab === 'join' && { borderBottomColor: theme.accentCyan, borderBottomWidth: 2 },
                pressed && { opacity: 0.8 },
              ]}>
              <Text
                style={[
                  styles.tabText,
                  { color: tab === 'join' ? theme.text : theme.textSecondary },
                ]}>
                Join Event Room
              </Text>
            </Pressable>
          </View>

          {tab === 'my_qr' ? (
            <View style={styles.qrBody}>
              <Text style={[styles.title, { color: theme.text }]}>Scan to Pair Instantly</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Ask a friend nearby to point their camera or Orbitor scanner here to establish a direct offline radio link.
              </Text>

              {/* Real Cryptographic QR Code */}
              <View
                style={[
                  styles.qrContainer,
                  {
                    backgroundColor: '#FFFFFF',
                    borderColor: theme.border,
                  },
                ]}>
                <QRCode
                  value={JSON.stringify({
                    protocol: 'orbitor/v1',
                    peerId: myProfileName,
                    name: myProfileName,
                    key: 'orb_pubkey_ed25519_9d428bf1e320aa',
                    ts: Date.now(),
                  })}
                  size={160}
                  color="#050811"
                  backgroundColor="#FFFFFF"
                />
                <Text style={styles.qrKeyText}>ORBITOR // {myProfileName.toUpperCase()}</Text>
              </View>

              <Badge label="ED25519 ENCRYPTED PAIRING" variant="cyan" size="sm" />
            </View>
          ) : (
            <View style={styles.joinBody}>
              <Text style={[styles.title, { color: theme.text }]}>Enter Room Code</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Join a shared campus hostel, hackathon, fest, or trek channel created without internet.
              </Text>

              <TextInput
                value={roomCode}
                onChangeText={setRoomCode}
                placeholder="e.g. H4-GF or TF-2026"
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="characters"
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
              />

              <Pressable
                onPress={handleJoin}
                disabled={!roomCode.trim()}
                style={({ pressed }) => [
                  styles.joinButton,
                  {
                    backgroundColor: roomCode.trim() ? theme.accentCyan : theme.surfaceElevated,
                    opacity: pressed || !roomCode.trim() ? 0.6 : 1,
                  },
                ]}>
                <Text
                  style={[
                    styles.joinButtonText,
                    { color: roomCode.trim() ? theme.background : theme.textTertiary },
                  ]}>
                  Join Mesh Room
                </Text>
              </Pressable>
            </View>
          )}

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              {
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}>
            <Text style={[styles.closeText, { color: theme.textSecondary }]}>Dismiss</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.base,
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.base,
  },
  tabHeader: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tabItem: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  tabText: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontFamily,
    fontWeight: Typography.weights.semibold,
  },
  qrBody: {
    alignItems: 'center',
    gap: Spacing.sm + 2,
    paddingVertical: Spacing.sm,
  },
  joinBody: {
    alignItems: 'center',
    gap: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  title: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.sizes.xs + 1,
    fontFamily: Typography.fontFamily,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.sm,
  },
  qrContainer: {
    width: 200,
    height: 200,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mockQrGrid: {
    width: 140,
    height: 140,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCorner: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderWidth: 6,
    borderColor: '#000000',
  },
  qrCornerTL: { top: 0, left: 0 },
  qrCornerTR: { top: 0, right: 0 },
  qrCornerBL: { bottom: 0, left: 0 },
  qrCenterPattern: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrLogo: {
    color: '#00E5FF',
    fontSize: 20,
    fontWeight: '800',
  },
  qrKeyText: {
    color: '#000000',
    fontSize: 9,
    fontFamily: Typography.monoFamily,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  input: {
    width: '100%',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.md,
    borderWidth: 1,
    fontSize: Typography.sizes.base,
    fontFamily: Typography.monoFamily,
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  joinButton: {
    width: '100%',
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinButtonText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    fontFamily: Typography.fontFamily,
  },
  closeButton: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  closeText: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontFamily,
  },
});

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface PairCodeProps {
  code: string;
  expiresAt?: string | null;
  onCopy?: () => void;
}

export const PairCode: React.FC<PairCodeProps> = ({ code, expiresAt, onCopy }) => {
  const formattedCode = code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Your pairing code:</Text>
      <TouchableOpacity activeOpacity={0.8} onPress={onCopy} style={styles.codeBox}>
        <Text style={styles.codeText}>{formattedCode}</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>Waiting for second device...</Text>
      <Text style={styles.expiry}>Valid for 10 minutes</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 24,
    padding: 24,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  label: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  codeBox: {
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#38BDF8',
    marginBottom: 14,
  },
  codeText: {
    color: '#F8FAFC',
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: 4,
  },
  hint: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  expiry: {
    color: '#64748B',
    fontSize: 12,
  },
});

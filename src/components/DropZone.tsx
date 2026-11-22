// Pe telefon nu există drag and drop: zona e doar un container (varianta reală e în DropZone.web.tsx).
import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

interface Props {
  onFiles: (files: any[]) => void;
  label: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function DropZone({ style, children }: Props) {
  return <View style={[styles.root, style]}>{children}</View>;
}

const styles = StyleSheet.create({ root: { flex: 1 } });

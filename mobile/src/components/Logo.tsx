import React from 'react';
import { Image, StyleSheet, ViewStyle } from 'react-native';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
}

const SIZES = {
  small: { width: 80, height: 32 },
  medium: { width: 120, height: 48 },
  large: { width: 160, height: 64 },
};

export default function Logo({ size = 'medium', style }: LogoProps) {
  const dimensions = SIZES[size];
  return (
    <Image
      source={require('../../assets/icon.png')}
      style={[styles.logo, dimensions, style]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  logo: {},
});

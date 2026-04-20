import React from 'react';
import { Image, ViewStyle } from 'react-native';
import { styles } from './styles';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
}

const SIZES = {
  small: { width: 112, height: 36 },
  medium: { width: 152, height: 48 },
  large: { width: 192, height: 60 },
};

export default function Logo({ size = 'medium', style }: LogoProps) {
  const dimensions = SIZES[size];
  return (
    <Image
      source={require('../../../assets/logo.png')}
      style={[styles.logo, dimensions, style]}
      resizeMode="contain"
    />
  );
}

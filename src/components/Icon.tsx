import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type Props = {
  name: IconName;
  size?: number;
  color?: string;
};

export function Icon({ name, size = 20, color }: Props) {
  return (
    <MaterialCommunityIcons
      accessible={false}
      color={color}
      name={name}
      size={size}
    />
  );
}

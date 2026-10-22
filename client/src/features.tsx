import type { ReactNode } from 'react';
import { Icon } from './components/Icon';

/**
 * Top-level navigation. Each feature (routines today; more later) adds its
 * entries here and its routes in App.tsx.
 */
export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

export const navItems: NavItem[] = [
  { to: '/', label: 'Today', icon: <Icon name="sun" />, end: true },
  { to: '/routines', label: 'Routines', icon: <Icon name="repeat" /> },
  { to: '/settings', label: 'Settings', icon: <Icon name="settings" /> },
];

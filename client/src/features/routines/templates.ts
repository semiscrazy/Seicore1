import type { RoutineDraft } from './types';

let n = 0;
export const key = () => `k${++n}`;

const steps = (...labels: string[]) => labels.map((label) => ({ key: key(), label }));

export function blankDraft(): RoutineDraft {
  return {
    name: '',
    description: '',
    icon: '✅',
    color: '#4f46e5',
    frequency: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5],
    timesPerPeriod: 3,
    sessions: [{ key: key(), label: '', time: '', steps: [] }],
  };
}

/** Starting points offered when creating a routine. */
export const templates: { title: string; draft: () => RoutineDraft }[] = [
  {
    title: 'Daily walk',
    draft: () => ({ ...blankDraft(), name: 'Walk 7 km', icon: '🚶', color: '#16a34a', description: 'About 1h 15m at a brisk pace.', sessions: [{ key: key(), label: '', time: '18:00', steps: [] }] }),
  },
  {
    title: 'Face care AM / PM',
    draft: () => ({
      ...blankDraft(),
      name: 'Face care',
      icon: '🧴',
      color: '#db2777',
      sessions: [
        { key: key(), label: 'Morning', time: '07:30', steps: steps('Gentle cleanser', 'Vitamin C serum', 'Moisturizer', 'Sunscreen SPF 50') },
        { key: key(), label: 'Evening', time: '22:00', steps: steps('Cleansing oil', 'Retinol', 'Night cream', 'Eye cream') },
      ],
    }),
  },
  {
    title: 'Workout 3× a week',
    draft: () => ({ ...blankDraft(), name: 'Workout', icon: '🏋️', color: '#ea580c', frequency: 'weekly', timesPerPeriod: 3, sessions: [{ key: key(), label: '', time: '', steps: steps('Warm-up', 'Strength', 'Stretch') }] }),
  },
  {
    title: 'Weekly review',
    draft: () => ({
      ...blankDraft(),
      name: 'Weekly review',
      icon: '🗂️',
      color: '#0891b2',
      frequency: 'days',
      daysOfWeek: [0],
      sessions: [{ key: key(), label: '', time: '19:00', steps: steps('Clear inbox', 'Review calendar', 'Plan next week') }],
    }),
  },
];

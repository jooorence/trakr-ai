export type NavItem = {
  to: string
  label: string
  defaultColor: string
  activeColor: string
  activeBg: string
  weight?: number
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        to: '/dashboard',
        label: 'Dashboard',
        defaultColor: '#7a8aff',
        activeColor: '#aabbff',
        activeBg: '#12142a',
        weight: 400,
      },
    ],
  },
  {
    label: 'Meals',
    items: [
      {
        to: '/food-log',
        label: 'Food Log',
        defaultColor: '#a06030',
        activeColor: '#f5a623',
        activeBg: '#2d1a00',
      },
      {
        to: '/meal-plans',
        label: 'Meal Plans',
        defaultColor: '#3a8a5a',
        activeColor: '#4caf7d',
        activeBg: '#0d2a1a',
      },
    ],
  },
  {
    label: 'Training',
    items: [
      {
        to: '/training',
        label: 'Training Split',
        defaultColor: '#c06060',
        activeColor: '#e08080',
        activeBg: '#2a1212',
      },
    ],
  },
  {
    label: 'Wellness',
    items: [
      {
        to: '/routines',
        label: 'Routines',
        defaultColor: '#1a9aaa',
        activeColor: '#30c8d8',
        activeBg: '#091e22',
      },
    ],
  },
  {
    label: 'Reference',
    items: [
      {
        to: '/rules',
        label: 'Rules',
        defaultColor: '#555555',
        activeColor: '#aaaaaa',
        activeBg: '#1e1e1e',
      },
      {
        to: '/longevity',
        label: 'Longevity',
        defaultColor: '#7050a0',
        activeColor: '#a07dd9',
        activeBg: '#1a0d2d',
      },
      {
        to: '/creed',
        label: 'Creed',
        defaultColor: '#8a7020',
        activeColor: '#c8a840',
        activeBg: '#2a2000',
      },
      {
        to: '/insights',
        label: 'Insights',
        defaultColor: '#2a6aaa',
        activeColor: '#5aabff',
        activeBg: '#0a1a2d',
      },
    ],
  },
  {
    label: 'TRAKR AI',
    items: [
      {
        to: '/coach',
        label: 'CoachGPT',
        defaultColor: '#2aaa99',
        activeColor: '#40ccbb',
        activeBg: '#080f0e',
        weight: 700,
      },
    ],
  },
]

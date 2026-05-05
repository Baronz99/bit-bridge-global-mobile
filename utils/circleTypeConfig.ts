export type CircleTypeKey =
  | 'sports_circle'
  | 'savings_circle'
  | 'family_circle'
  | 'estate_circle'
  | 'association_treasury'
  | 'workplace_circle'
  | 'event_circle'
  | 'religious_circle'
  | 'alumni_circle'
  | 'general_circle'

export type CircleTypeConfig = {
  key: CircleTypeKey
  label: string
  shortLabel: string
  subtitle: string
  createTitle: string
  createDescription: string
  dueLabel: string
  contributionLabel: string
  payoutLabel: string
  activityLabel: string
  activityHelper: string
  timelineLabel: string
  emptyActivityLabel: string
  starterTemplates: Array<{
    name: string
    contribution_frequency: 'one_time' | 'weekly' | 'monthly' | 'quarterly'
  }>
}

const LEGACY_ALIASES: Record<string, CircleTypeKey> = {
  contribution_group: 'general_circle',
  sports_team: 'sports_circle',
  student_group: 'general_circle',
  event_committee: 'event_circle',
  meeting_group: 'workplace_circle',
  family_pool: 'family_circle',
  creator_community: 'general_circle',
  association_treasury: 'association_treasury',
}

export const CIRCLE_TYPE_CONFIG: Record<CircleTypeKey, CircleTypeConfig> = {
  sports_circle: {
    key: 'sports_circle',
    label: 'Clubs & Teams',
    shortLabel: 'Clubs & Teams',
    subtitle: 'Run monthly dues, fines, and jersey funds with clear shared accountability.',
    createTitle: 'Set up a clubs and teams circle',
    createDescription: 'Run your group finances properly with monthly dues, fines, jersey funds, and member payment visibility.',
    dueLabel: 'Monthly dues',
    contributionLabel: 'Match fees',
    payoutLabel: 'Team payouts',
    activityLabel: 'Team funds',
    activityHelper: 'Collect dues, track payments, and stay accountable across fees, fines, and team funds.',
    timelineLabel: 'Shared record of dues, match fees, fines, and tagged team funds.',
    emptyActivityLabel: 'No team funds yet.',
    starterTemplates: [
      { name: 'Jersey fund', contribution_frequency: 'one_time' },
      { name: 'Pitch fees', contribution_frequency: 'monthly' },
      { name: 'Team fines', contribution_frequency: 'monthly' },
    ],
  },
  savings_circle: {
    key: 'savings_circle',
    label: 'Cooperatives',
    shortLabel: 'Cooperatives',
    subtitle: 'Track recurring savings contributions now and prepare for lending pools later.',
    createTitle: 'Set up a cooperative circle',
    createDescription: 'Run cooperative contributions properly with recurring savings collection, visibility, and shared reporting.',
    dueLabel: 'Savings contributions',
    contributionLabel: 'Contributions',
    payoutLabel: 'Member payouts',
    activityLabel: 'Savings goals',
    activityHelper: 'Track recurring savings contributions now and prepare for structured cooperative operations later.',
    timelineLabel: 'Shared record of contributions, payouts, and tagged savings goals.',
    emptyActivityLabel: 'No savings goals yet.',
    starterTemplates: [
      { name: 'Recurring savings contribution', contribution_frequency: 'monthly' },
      { name: 'Capital top-up', contribution_frequency: 'one_time' },
      { name: 'Missed payment recovery', contribution_frequency: 'one_time' },
    ],
  },
  family_circle: {
    key: 'family_circle',
    label: 'Families',
    shortLabel: 'Families',
    subtitle: 'Coordinate support pools, event contributions, and shared family obligations properly.',
    createTitle: 'Set up a family circle',
    createDescription: 'Keep support contributions, emergency help, and shared obligations in one controlled circle.',
    dueLabel: 'Family contributions',
    contributionLabel: 'Support',
    payoutLabel: 'Family payouts',
    activityLabel: 'Support goals',
    activityHelper: 'Collect support contributions, track shared obligations, and keep family finance operations clear.',
    timelineLabel: 'Shared record of support contributions, payouts, and tagged family goals.',
    emptyActivityLabel: 'No support goals yet.',
    starterTemplates: [
      { name: 'Support pool', contribution_frequency: 'monthly' },
      { name: 'Event contribution', contribution_frequency: 'one_time' },
      { name: 'Emergency support', contribution_frequency: 'one_time' },
      { name: 'Family project', contribution_frequency: 'quarterly' },
    ],
  },
  estate_circle: {
    key: 'estate_circle',
    label: 'Estates & Communities',
    shortLabel: 'Estates & Communities',
    subtitle: 'Collect levies, utilities, and maintenance funds in one operating circle.',
    createTitle: 'Set up an estate and community circle',
    createDescription: 'Run estate finances properly with levies, utilities, maintenance funds, and treasurer controls.',
    dueLabel: 'Service charges',
    contributionLabel: 'Resident levies',
    payoutLabel: 'Estate disbursements',
    activityLabel: 'Estate operations',
    activityHelper: 'Collect levies, track utilities, and manage maintenance funds with clear records.',
    timelineLabel: 'Shared record of service charges, disbursements, and tagged estate operations.',
    emptyActivityLabel: 'No estate operations yet.',
    starterTemplates: [
      { name: 'Security levy', contribution_frequency: 'monthly' },
      { name: 'Utilities collection', contribution_frequency: 'monthly' },
      { name: 'Maintenance fund', contribution_frequency: 'one_time' },
    ],
  },
  association_treasury: {
    key: 'association_treasury',
    label: 'Associations',
    shortLabel: 'Associations',
    subtitle: 'Collect membership dues, event collections, and community contributions with operational control.',
    createTitle: 'Set up an association circle',
    createDescription: 'Run your group finances properly with dues, collections, and treasury visibility from one controlled circle.',
    dueLabel: 'Membership dues',
    contributionLabel: 'Collections',
    payoutLabel: 'Association disbursements',
    activityLabel: 'Treasury items',
    activityHelper: 'Collect dues, track payments, and keep members accountable.',
    timelineLabel: 'Shared record of dues, collections, disbursements, and tagged treasury items.',
    emptyActivityLabel: 'No treasury items yet.',
    starterTemplates: [
      { name: 'Membership dues', contribution_frequency: 'monthly' },
      { name: 'Event collection', contribution_frequency: 'one_time' },
      { name: 'Special levy', contribution_frequency: 'one_time' },
    ],
  },
  workplace_circle: {
    key: 'workplace_circle',
    label: 'Workplace Circle',
    shortLabel: 'Workplace',
    subtitle: 'Coordinate team welfare, office pools, and shared work contributions.',
    createTitle: 'Create a workplace circle',
    createDescription: 'Use one treasury for team welfare, gifts, and office contribution pools.',
    dueLabel: 'Team dues',
    contributionLabel: 'Team contributions',
    payoutLabel: 'Team disbursements',
    activityLabel: 'Workplace funds',
    activityHelper: 'Track welfare, celebrations, and shared work-related goals.',
    timelineLabel: 'Shared feed of team contributions, disbursements, and tagged workplace funds.',
    emptyActivityLabel: 'No workplace funds yet.',
    starterTemplates: [
      { name: 'Welfare fund', contribution_frequency: 'monthly' },
      { name: 'Team celebration', contribution_frequency: 'one_time' },
      { name: 'Gift pool', contribution_frequency: 'one_time' },
    ],
  },
  event_circle: {
    key: 'event_circle',
    label: 'Event Circle',
    shortLabel: 'Event',
    subtitle: 'Track budgets, vendor payouts, and contribution targets for events.',
    createTitle: 'Create an event circle',
    createDescription: 'Manage venue, catering, decor, and event contributions from one circle.',
    dueLabel: 'Event contributions',
    contributionLabel: 'Budget contributions',
    payoutLabel: 'Vendor payouts',
    activityLabel: 'Budget items',
    activityHelper: 'Break event budgets into visible, trackable contribution buckets.',
    timelineLabel: 'Shared feed of event contributions, payouts, and tagged budget items.',
    emptyActivityLabel: 'No budget items yet.',
    starterTemplates: [
      { name: 'Venue budget', contribution_frequency: 'one_time' },
      { name: 'Catering budget', contribution_frequency: 'one_time' },
      { name: 'Decor budget', contribution_frequency: 'one_time' },
    ],
  },
  religious_circle: {
    key: 'religious_circle',
    label: 'Religious Circle',
    shortLabel: 'Religious',
    subtitle: 'Coordinate welfare, projects, and recurring giving with shared visibility.',
    createTitle: 'Create a religious circle',
    createDescription: 'Track welfare support, building projects, and recurring contributions together.',
    dueLabel: 'Recurring contributions',
    contributionLabel: 'Giving',
    payoutLabel: 'Project payouts',
    activityLabel: 'Projects',
    activityHelper: 'Track welfare support, building projects, and shared obligations.',
    timelineLabel: 'Shared feed of giving, payouts, and tagged community projects.',
    emptyActivityLabel: 'No projects yet.',
    starterTemplates: [
      { name: 'Welfare support', contribution_frequency: 'monthly' },
      { name: 'Building project', contribution_frequency: 'one_time' },
      { name: 'Community outreach', contribution_frequency: 'monthly' },
    ],
  },
  alumni_circle: {
    key: 'alumni_circle',
    label: 'Alumni Circle',
    shortLabel: 'Alumni',
    subtitle: 'Manage class dues, reunion funds, and alumni support initiatives together.',
    createTitle: 'Create an alumni circle',
    createDescription: 'Keep dues, reunion budgets, and support targets visible to all members.',
    dueLabel: 'Alumni dues',
    contributionLabel: 'Class contributions',
    payoutLabel: 'Association payouts',
    activityLabel: 'Funds',
    activityHelper: 'Track reunion budgets, scholarship support, and alumni projects.',
    timelineLabel: 'Shared feed of alumni contributions, payouts, and tagged funds.',
    emptyActivityLabel: 'No funds yet.',
    starterTemplates: [
      { name: 'Reunion fund', contribution_frequency: 'monthly' },
      { name: 'Scholarship support', contribution_frequency: 'one_time' },
      { name: 'Class dues', contribution_frequency: 'monthly' },
    ],
  },
  general_circle: {
    key: 'general_circle',
    label: 'General Circle',
    shortLabel: 'General',
    subtitle: 'Flexible shared finance for communities, projects, and everyday group needs.',
    createTitle: 'Create a general circle',
    createDescription: 'Start with a flexible shared treasury and adapt it as your group grows.',
    dueLabel: 'Monthly dues',
    contributionLabel: 'Contributions',
    payoutLabel: 'Payouts',
    activityLabel: 'Goals',
    activityHelper: 'Create shared goals and track progress together.',
    timelineLabel: 'Shared feed of contributions, payouts, and tagged goals.',
    emptyActivityLabel: 'No goals yet.',
    starterTemplates: [
      { name: 'Monthly dues', contribution_frequency: 'monthly' },
      { name: 'Emergency support', contribution_frequency: 'one_time' },
      { name: 'Community project', contribution_frequency: 'one_time' },
    ],
  },
}

export const LAUNCH_CIRCLE_TYPES: CircleTypeKey[] = [
  'sports_circle',
  'estate_circle',
  'savings_circle',
  'family_circle',
  'association_treasury',
]

export const normalizeCircleType = (value: unknown): CircleTypeKey => {
  const raw = String(value || '').trim()
  if ((raw as CircleTypeKey) in CIRCLE_TYPE_CONFIG) return raw as CircleTypeKey
  return LEGACY_ALIASES[raw] || 'general_circle'
}

export const getCircleTypeConfig = (value: unknown): CircleTypeConfig =>
  CIRCLE_TYPE_CONFIG[normalizeCircleType(value)]

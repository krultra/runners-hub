// Shared list of admin sections for use in both AdminPage and AppHeader
export const adminSections = [
  { key: 'invitations', label: 'Invitations' },
  { key: 'registrations', label: 'Registrations' },
  { key: 'templates', label: 'Email Templates' },
  { key: 'codelists', label: 'Code Lists' },
  { key: 'editions', label: 'Event Editions' },
  { key: 'actions', label: 'Action Requests' },
  { key: 'tasks', label: 'Admin Tasks' },
  { key: 'schedules', label: 'Function Schedules' },
] as const;

export type AdminSectionKey = typeof adminSections[number]['key'];

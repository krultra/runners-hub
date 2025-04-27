import React, { useState } from 'react';
import { Drawer, List, ListItem, ListItemText, Box, Toolbar, useTheme } from '@mui/material';
import { Link } from 'react-router-dom';
import InvitationsPanel from '../components/admin/InvitationsPanel';
import RegistrationsPanel from '../components/admin/RegistrationsPanel';
import TemplatesPanel from '../components/admin/TemplatesPanel';
import StatusesPanel from '../components/admin/StatusesPanel';

const sections = [
  { key: 'invitations', label: 'Invitations' },
  { key: 'registrations', label: 'Registrations' },
  { key: 'templates', label: 'Email Templates' },
  { key: 'statuses', label: 'Statuses' },
] as const;
type SectionKey = typeof sections[number]['key'];

const AdminPage: React.FC = () => {
  const [active, setActive] = useState<SectionKey>('invitations');
  const theme = useTheme();

  return (
    <Box sx={{ display: 'flex' }}>
      <Drawer
        variant="permanent"
        anchor="left"
        sx={{
          width: 240,
          flexShrink: 0,
          zIndex: theme.zIndex.appBar - 1
        }}
        PaperProps={{ sx: { top: '64px', height: 'calc(100% - 64px)' } }}
      >
        <Toolbar />
        <List>
          {sections.map((section) => (
            <ListItem
              button
              key={section.key}
              selected={active === section.key}
              onClick={() => setActive(section.key)}
            >
              <ListItemText primary={section.label} />
            </ListItem>
          ))}
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        {active === 'invitations' && <InvitationsPanel />}
        {active === 'registrations' && <RegistrationsPanel />}
        {active === 'templates' && <TemplatesPanel />}
        {active === 'statuses' && <StatusesPanel />}
      </Box>
    </Box>
  );
};

export default AdminPage;

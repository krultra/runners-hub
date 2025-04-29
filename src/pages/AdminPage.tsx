import React, { useState, useEffect } from 'react';
import { Drawer, List, ListItem, ListItemText, Box, Toolbar, useTheme } from '@mui/material';
import { Link } from 'react-router-dom';
import InvitationsPanel from '../components/admin/InvitationsPanel';
import RegistrationsPanel from '../components/admin/RegistrationsPanel';
import TemplatesPanel from '../components/admin/TemplatesPanel';
import StatusesPanel from '../components/admin/StatusesPanel';
import ActionRequestsPanel from '../components/admin/ActionRequestsPanel';

const sections = [
  { key: 'invitations', label: 'Invitations' },
  { key: 'registrations', label: 'Registrations' },
  { key: 'templates', label: 'Email Templates' },
  { key: 'statuses', label: 'Statuses' },
  { key: 'actions', label: 'Action Requests' },
] as const;
type SectionKey = typeof sections[number]['key'];

const AdminPage: React.FC = () => {
  const [active, setActive] = useState<SectionKey>('invitations');
  const theme = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(true);
  const drawerWidth = 240;

  useEffect(() => {
    const handler = () => setDrawerOpen(o => !o);
    window.addEventListener('toggleAdminDrawer', handler);
    return () => window.removeEventListener('toggleAdminDrawer', handler);
  }, []);

  return (
    <Box sx={{ display: 'flex' }}>
      <Drawer
        variant="persistent"
        open={drawerOpen}
        anchor="left"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          zIndex: theme.zIndex.appBar - 1,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            top: '64px',
            height: 'calc(100% - 64px)',
          },
        }}
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

      <Box component="main"
           sx={{
             flexGrow: 1,
             p: 3,
             ml: drawerOpen ? `${drawerWidth}px` : 0,
             transition: theme.transitions.create('margin', {
               easing: theme.transitions.easing.sharp,
               duration: theme.transitions.duration.leavingScreen,
             }),
           }}>
        <Toolbar />
        {active === 'invitations' && <InvitationsPanel />}
        {active === 'registrations' && <RegistrationsPanel />}
        {active === 'templates' && <TemplatesPanel />}
        {active === 'statuses' && <StatusesPanel />}
        {active === 'actions' && <ActionRequestsPanel />}
      </Box>
    </Box>
  );
};

export default AdminPage;

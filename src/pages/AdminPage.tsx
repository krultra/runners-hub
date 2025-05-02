import React, { useState, useEffect } from 'react';
import { Drawer, List, ListItem, ListItemText, Box, Toolbar, useTheme, useMediaQuery } from '@mui/material';
import { Link } from 'react-router-dom';
import InvitationsPanel from '../components/admin/InvitationsPanel';
import RegistrationsPanel from '../components/admin/RegistrationsPanel';
import TemplatesPanel from '../components/admin/TemplatesPanel';
import StatusesPanel from '../components/admin/StatusesPanel';
import ActionRequestsPanel from '../components/admin/ActionRequestsPanel';
import SchedulesPanel from '../components/admin/SchedulesPanel';
import AdminTasksPanel from '../components/admin/AdminTasksPanel';

const sections = [
  { key: 'invitations', label: 'Invitations' },
  { key: 'registrations', label: 'Registrations' },
  { key: 'templates', label: 'Email Templates' },
  { key: 'statuses', label: 'Statuses' },
  { key: 'actions', label: 'Action Requests' },
  { key: 'tasks', label: 'Admin Tasks' },
  { key: 'schedules', label: 'Function Schedules' },
] as const;
type SectionKey = typeof sections[number]['key'];

const AdminPage: React.FC = () => {
  const [active, setActive] = useState<SectionKey>('invitations');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [drawerOpen, setDrawerOpen] = useState(true);
  const drawerWidth = 180; // width for drawer

  useEffect(() => {
    const handler = () => setDrawerOpen(o => !o);
    window.addEventListener('toggleAdminDrawer', handler);
    return () => window.removeEventListener('toggleAdminDrawer', handler);
  }, []);

  return (
    <Box sx={{ display: 'flex' }}>
      {/* Desktop persistent drawer */}
      {!isMobile && drawerOpen && (
        <Drawer
          variant="persistent"
          open
          anchor="left"
          sx={{
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
      )}
      {/* Mobile temporary drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: drawerWidth } }}
        >
          <Toolbar />
          <List>
            {sections.map((section) => (
              <ListItem
                button
                key={section.key}
                selected={active === section.key}
                onClick={() => { setActive(section.key); setDrawerOpen(false); }}
              >
                <ListItemText primary={section.label} />
              </ListItem>
            ))}
          </List>
        </Drawer>
      )}

      <Box component="main" sx={{
        flexGrow: 1,
        pt: 3,
        pr: 3,
        pb: 3,
        pl: 1,
        ml: !isMobile
          ? (drawerOpen
              ? `${drawerWidth}px`
              : 1)
          : 0
      }}>
        <Toolbar />
        {active === 'invitations' && <InvitationsPanel />}
        {active === 'registrations' && <RegistrationsPanel />}
        {active === 'templates' && <TemplatesPanel />}
        {active === 'statuses' && <StatusesPanel />}
        {active === 'actions' && <ActionRequestsPanel />}
        {active === 'tasks' && <AdminTasksPanel />}
        {active === 'schedules' && <SchedulesPanel />}
      </Box>
    </Box>
  );
};

export default AdminPage;

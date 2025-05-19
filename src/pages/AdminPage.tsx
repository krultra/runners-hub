import React, { useState, useEffect } from 'react';
import { 
  Drawer, 
  List, 
  ListItem, 
  ListItemText, 
  Box, 
  Toolbar, 
  useTheme, 
  useMediaQuery,
} from '@mui/material';
import { useEventEdition } from '../contexts/EventEditionContext';
import { Link } from 'react-router-dom';
import InvitationsPanel from '../components/admin/InvitationsPanel';
import RegistrationsPanel from '../components/admin/RegistrationsPanel';
import TemplatesPanel from '../components/admin/TemplatesPanel';
import EventEditionsPanel from '../components/admin/EventEditionsPanel';
import CodeListPanel from '../components/admin/CodeListPanel';
import ActionRequestsPanel from '../components/admin/ActionRequestsPanel';
import SchedulesPanel from '../components/admin/SchedulesPanel';
import AdminTasksPanel from '../components/admin/AdminTasksPanel';
import EventEditionSelector from '../components/EventEditionSelector';

import { adminSections, AdminSectionKey } from '../constants/adminSections';
type SectionKey = AdminSectionKey;


const AdminPage: React.FC = () => {
  useEventEdition();
  const [active, setActive] = useState<SectionKey>('invitations');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  // Define drawer width and make it initially closed for all devices
  const drawerWidth = 180; // Width for drawer
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Listen for admin section changes from AppHeader
  useEffect(() => {
    const sectionHandler = (e: CustomEvent<string>) => {
      setActive(e.detail as SectionKey);
    };
    window.addEventListener('setAdminSection', sectionHandler as EventListener);
    return () => window.removeEventListener('setAdminSection', sectionHandler as EventListener);
  }, []);

  return (
    <Box sx={{ display: 'flex' }}>
      <Drawer
        variant="temporary"
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            backgroundColor: theme.palette.background.paper,
            position: 'fixed',
            // Use theme's toolbar height to position below the AppBar
            top: (theme) => `${theme.mixins.toolbar.minHeight}px`,
            height: (theme) => `calc(100% - ${theme.mixins.toolbar.minHeight}px)`,
            zIndex: (theme) => theme.zIndex.appBar - 1, // Make sure drawer is below AppBar
          },
        }}
      >
        <Toolbar />
        <List>
          {adminSections.map((section) => (
            <ListItem
              button
              key={section.key}
              selected={active === section.key}
              onClick={() => setActive(section.key)}
            >
              <ListItemText primary={section.label} />
            </ListItem>
          ))}
          <ListItem
            component={Link}
            to="/admin/import-malvikingen"
            onClick={() => isMobile && setDrawerOpen(false)}
            sx={{ color: 'inherit', textDecoration: 'none' }}
          >
            <ListItemText primary="Import Malvikingen" />
          </ListItem>
        </List>
      </Drawer>

      <Box 
        component="main"
        sx={{
          flexGrow: 1,
          p: 2,
          pt: 1, // Minimal top padding
          width: '100%', // Full width since drawer is now overlaid instead of pushed
          // Removed left margin and left offset since drawer is now on the right side
        }}
      >
        {/* More compact layout structure */}
        <EventEditionSelector />
        <Box sx={{ mt: 1, px: 0.5 }}>
            {active === 'invitations' && <InvitationsPanel />}
            {active === 'registrations' && <RegistrationsPanel />}
            {active === 'templates' && <TemplatesPanel />}
            {active === 'codelists' && <CodeListPanel />}
            {active === 'editions' && <EventEditionsPanel />}
            {active === 'actions' && <ActionRequestsPanel />}
            {active === 'tasks' && <AdminTasksPanel />}
            {active === 'schedules' && <SchedulesPanel />}
          </Box>
      </Box>
    </Box>
  );
};

export default AdminPage;

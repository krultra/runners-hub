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
  Typography
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

const sections = [
  { key: 'invitations', label: 'Invitations' },
  { key: 'registrations', label: 'Registrations' },
  { key: 'templates', label: 'Email Templates' },
  { key: 'codelists', label: 'Code Lists' },
  { key: 'editions', label: 'Event Editions' },
  { key: 'actions', label: 'Action Requests' },
  { key: 'tasks', label: 'Admin Tasks' },
  { key: 'schedules', label: 'Function Schedules' },
] as const;
type SectionKey = typeof sections[number]['key'];


const AdminPage: React.FC = () => {
  const { event } = useEventEdition();
  const [active, setActive] = useState<SectionKey>('invitations');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [drawerOpen, setDrawerOpen] = useState(!isMobile);
  // Define drawer width and margin settings
  const drawerWidth = 180; // Width for drawer
  const desiredMargin = 20; // Amount of margin we want to have
  const contentLeftOffset = desiredMargin - drawerWidth; // Calculate the required offset (typically negative)

  useEffect(() => {
    const handler = () => setDrawerOpen(o => !o);
    window.addEventListener('toggleAdminDrawer', handler);
    return () => window.removeEventListener('toggleAdminDrawer', handler);
  }, []);

  return (
    <Box sx={{ display: 'flex' }}>
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={!isMobile || drawerOpen}
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
          p: 0,
          pt: 0.5, // Keep minimal top padding
          pr: 1, // Keep right padding
          // Ensure content is flush with drawer by removing left margin and adding it to the width calculation
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          marginLeft: { sm: `${drawerWidth}px` }, // Use marginLeft instead of ml for more precise control
          // Add responsive positioning - offset only on desktop, normal padding on mobile
          position: 'relative',
          // Only apply the negative offset on non-mobile screens
          left: { xs: 0, sm: `${contentLeftOffset}px` },
          // Add appropriate padding for mobile view
          pl: { xs: 2, sm: 0 }
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

import { createTheme } from '@mui/material/styles';
import { PaletteMode } from '@mui/material';

// Create a theme based on mode
export const createRunnersHubTheme = (mode: PaletteMode) => createTheme({
  palette: {
    mode,

    primary: mode === 'dark'
      ? { main: '#FFFFFF', light: '#EEEEEE', dark: '#CCCCCC', contrastText: '#000000' }
      : { main: '#000000', light: '#222222', dark: '#000000', contrastText: '#FFFFFF' },
    secondary: {
      main: '#888888', // Neutral grey
      light: '#CCCCCC',
      dark: '#555555',
      contrastText: '#FFFFFF',
    },
    background: mode === 'dark' ? {
      default: '#181a1b',
      paper: '#222222',
    } : {
      default: '#F5F5F5',
      paper: '#FFFFFF',
    },
    text: mode === 'dark' ? {
      primary: '#FFFFFF',
      secondary: '#CCCCCC',
      disabled: '#888888',
    } : {
      primary: '#111111',
      secondary: '#555555',
      disabled: '#AAAAAA',
    },
    divider: '#E0E0E0',
    error: {
      main: '#D32F2F',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: '#FFC107',
      contrastText: '#000000',
    },
    info: {
      main: '#0288D1',
      contrastText: '#FFFFFF',
    },
    success: {
      main: '#388E3C',
      contrastText: '#FFFFFF',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
      fontSize: '2.5rem',
    },
    h2: {
      fontWeight: 600,
      fontSize: '2rem',
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.75rem',
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.5rem',
    },
    h5: {
      fontWeight: 500,
      fontSize: '1.25rem',
    },
    h6: {
      fontWeight: 500,
      fontSize: '1rem',
    },
    button: {
      textTransform: 'none', // Avoid all-caps buttons
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
        },
        contained: {
          boxShadow: 'none',
          border: '2px solid',
          borderColor: 'unset',
          '&:hover': {
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.2)',
            backgroundColor: '#292929',
          },
          '@media (prefers-color-scheme: dark)': {
            borderColor: '#fff',
            '&:hover': {
              backgroundColor: 'rgba(255,255,255,0.08)',
            },
          },
        },
        outlined: {
          border: '2px solid',
          borderColor: 'unset',
          '@media (prefers-color-scheme: dark)': {
            borderColor: '#fff',
          },
        },
        text: {
          '@media (prefers-color-scheme: dark)': {
            color: '#FFFFFF',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.05)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          marginBottom: 16,
        },
      },
    },
    MuiRadio: {
      styleOverrides: {
        root: ({ theme }) => ({
          color: theme.palette.mode === 'dark' ? theme.palette.grey[400] : undefined,
          '&.Mui-checked': {
            color: theme.palette.primary.main,
          },
        }),
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: ({ theme }) => ({
          color: theme.palette.mode === 'dark' ? theme.palette.grey[400] : undefined,
          '&.Mui-checked': {
            color: theme.palette.primary.main,
          },
        }),
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: ({ theme }) => ({
          borderColor: theme.palette.mode === 'dark' ? theme.palette.grey[500] : undefined,
        }),
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          '@media (prefers-color-scheme: dark)': {
            color: '#FFFFFF',
          },
        },
      },
    },
  },
});

// No default export. Use createRunnersHubTheme(mode) to get the theme.

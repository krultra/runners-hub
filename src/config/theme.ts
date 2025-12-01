import { createTheme } from '@mui/material/styles';
import { PaletteMode } from '@mui/material';

const lightPalette = {
  backgroundDefault: '#FFFFFF',
  backgroundPaper: '#F3F4F6',
  primaryMain: '#41719C',
  primaryLight: '#4E82B4',
  primaryDark: '#355A7B',
};

const darkPalette = {
  backgroundDefault: '#030712', // Tailwind gray-950, matches KrUltra
  backgroundPaper: '#111827',   // Tailwind gray-900, matches KrUltra
  primaryMain: '#69A9E1',
  primaryLight: '#8BC2F0',
  primaryDark: '#41719C',
};

const getPaletteTokens = (mode: PaletteMode) => (mode === 'dark' ? darkPalette : lightPalette);

// Create a theme based on mode
export const createRunnersHubTheme = (mode: PaletteMode) => createTheme({
  palette: {
    mode,

    primary: mode === 'dark'
      ? {
        main: darkPalette.primaryMain,
        light: darkPalette.primaryLight,
        dark: darkPalette.primaryDark,
        contrastText: '#0B1220',
      }
      : {
        main: lightPalette.primaryMain,
        light: lightPalette.primaryLight,
        dark: lightPalette.primaryDark,
        contrastText: '#FFFFFF',
      },
    secondary: {
      main: '#888888', // Neutral grey
      light: '#CCCCCC',
      dark: '#555555',
      contrastText: '#FFFFFF',
    },
    background: mode === 'dark' ? {
      default: darkPalette.backgroundDefault,
      paper: darkPalette.backgroundPaper,
    } : {
      default: lightPalette.backgroundDefault,
      paper: lightPalette.backgroundPaper,
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
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: mode === 'dark'
            ? darkPalette.backgroundDefault
            : lightPalette.backgroundDefault,
        },
        '#root': {
          backgroundColor: mode === 'dark'
            ? darkPalette.backgroundDefault
            : lightPalette.backgroundDefault,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
        },
        contained: ({ theme }) => ({
          boxShadow: 'none',
          border: '2px solid',
          borderColor: theme.palette.mode === 'dark' ? '#fff' : theme.palette.grey[400],
          '&:hover': {
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.15)',
            // Subtle darken in light mode, subtle lighten in dark mode
            filter: theme.palette.mode === 'dark' 
              ? 'brightness(1.15)' 
              : 'brightness(0.9)',
          },
        }),
        outlined: ({ theme }) => ({
          border: '2px solid',
          borderColor: theme.palette.mode === 'dark' ? '#fff' : theme.palette.grey[600],
        }),
        text: ({ theme }) => ({
          color: theme.palette.mode === 'dark' ? '#FFFFFF' : theme.palette.text.primary,
        }),
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
        root: ({ theme }) => ({
          color: theme.palette.mode === 'dark' ? '#FFFFFF' : theme.palette.primary.main,
        }),
      },
    },
  },
});

// No default export. Use createRunnersHubTheme(mode) to get the theme.

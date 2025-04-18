import React from 'react';
import { Snackbar, Alert, AlertColor } from '@mui/material';

interface RegistrationSnackbarProps {
  open: boolean;
  message: string;
  severity?: AlertColor; // 'success' | 'info' | 'warning' | 'error'
  onClose: () => void;
}

const RegistrationSnackbar: React.FC<RegistrationSnackbarProps> = ({ 
  open, 
  message, 
  severity = 'error', // Default to error if not specified
  onClose 
}) => {
  // Enhanced styling for all message types
  const getAlertStyle = () => {
    const baseStyle = { 
      width: '100%',
      color: '#ffffff', // White text for all
      fontWeight: 'bold', // Bold text for all
      fontSize: '1.05rem', // Slightly larger font for all
      '& .MuiAlert-icon': {
        color: '#ffffff', // White icon for all
        opacity: 1
      }
    };
    
    // Different background colors based on severity
    switch (severity) {
      case 'success':
        return { ...baseStyle, backgroundColor: '#2e7d32' }; // Darker green
      case 'error':
        return { ...baseStyle, backgroundColor: '#d32f2f' }; // Darker red
      case 'warning':
        return { ...baseStyle, backgroundColor: '#ed6c02' }; // Darker orange
      case 'info':
        return { ...baseStyle, backgroundColor: '#0288d1' }; // Darker blue
      default:
        return baseStyle;
    }
  };

  return (
    <Snackbar 
      open={open} 
      autoHideDuration={6000} 
      onClose={onClose} 
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert 
        onClose={onClose} 
        severity={severity} 
        variant="filled"
        sx={getAlertStyle()}
      >
        {message}
      </Alert>
    </Snackbar>
  );
};

export default RegistrationSnackbar;

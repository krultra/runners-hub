import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export interface StatusIndicatorProps {
  status: string;
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  confirmed: {
    color: '#2e7d32', // green
    icon: <CheckCircleIcon sx={{ color: '#2e7d32', mr: 1 }} />, // green check
    label: 'Confirmed',
  },
  pending: {
    color: '#000000', // black text for best contrast
    icon: <WarningAmberIcon sx={{ color: '#FFC107', mr: 1 }} />, // original yellow icon
    label: 'Pending',
  },
  canceled: {
    color: '#D32F2F', // red
    icon: <ErrorIcon sx={{ color: '#D32F2F', mr: 1 }} />, // red error
    label: 'Canceled',
  },
  withdrawn: {
    color: '#D32F2F', // red
    icon: <ErrorIcon sx={{ color: '#D32F2F', mr: 1 }} />,
    label: 'Withdrawn',
  },
  error: {
    color: '#D32F2F', // red
    icon: <ErrorIcon sx={{ color: '#D32F2F', mr: 1 }} />,
    label: 'Error',
  },
};


export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status }) => {
  const theme = useTheme();
  const normalizedStatus = status?.toLowerCase();
  const config = statusConfig[normalizedStatus] || {
    color: '#757575',
    icon: <WarningAmberIcon sx={{ color: '#757575', mr: 1 }} />,
    label: status,
  };
  const isConfirmed = normalizedStatus === 'confirmed';
  return (
    <Box display="flex" alignItems="center">
      {config.icon}
      <Typography
        variant="body2"
        fontWeight={isConfirmed ? 600 : 400}
        sx={{ color: isConfirmed ? config.color : theme.palette.text.primary }}
      >
        {config.label}
      </Typography>
    </Box>
  );
};

export default StatusIndicator;

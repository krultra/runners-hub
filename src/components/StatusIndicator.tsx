import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export interface StatusIndicatorProps {
  status: string;
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  confirmed: {
    color: '#2e7d32', // green
    icon: <CheckCircle size={20} color="#2e7d32" style={{ marginRight: 8 }} />,
    label: 'Confirmed',
  },
  pending: {
    color: '#000000', // black text for best contrast
    icon: <AlertTriangle size={20} color="#FFC107" style={{ marginRight: 8 }} />,
    label: 'Pending',
  },
  canceled: {
    color: '#D32F2F', // red
    icon: <XCircle size={20} color="#D32F2F" style={{ marginRight: 8 }} />,
    label: 'Canceled',
  },
  withdrawn: {
    color: '#D32F2F', // red
    icon: <XCircle size={20} color="#D32F2F" style={{ marginRight: 8 }} />,
    label: 'Withdrawn',
  },
  error: {
    color: '#D32F2F', // red
    icon: <XCircle size={20} color="#D32F2F" style={{ marginRight: 8 }} />,
    label: 'Error',
  },
};


export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status }) => {
  const theme = useTheme();
  const normalizedStatus = status?.toLowerCase();
  const config = statusConfig[normalizedStatus] || {
    color: '#757575',
    icon: <AlertTriangle size={20} color="#757575" style={{ marginRight: 8 }} />,
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

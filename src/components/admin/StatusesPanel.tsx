import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, List, ListItem, IconButton, CircularProgress } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { listRegistrationStatuses, addRegistrationStatus, deleteRegistrationStatus, RegistrationStatus } from '../../services/statusService';

const StatusesPanel: React.FC = () => {
  const [statuses, setStatuses] = useState<RegistrationStatus[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const data = await listRegistrationStatuses();
      setStatuses(data);
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleAdd = async () => {
    if (!newLabel) return;
    await addRegistrationStatus(newLabel);
    setNewLabel('');
    const data = await listRegistrationStatuses();
    setStatuses(data);
  };

  const handleDelete = async (id: string) => {
    await deleteRegistrationStatus(id);
    setStatuses(prev => prev.filter(s => s.id !== id));
  };

  return (
    <Box>
      <Typography variant="h5">Statuses</Typography>
      <Box display="flex" gap={2} alignItems="center" mt={2}>
        <TextField label="New Status" value={newLabel} size="small" onChange={e => setNewLabel(e.target.value)} />
        <Button variant="contained" onClick={handleAdd} disabled={!newLabel}>Add</Button>
      </Box>
      {loading ? <CircularProgress sx={{ mt: 2 }} /> : (
        <List sx={{ mt: 2 }}>
          {statuses.map(s => (
            <ListItem key={s.id} secondaryAction={<IconButton edge="end" onClick={() => handleDelete(s.id)}><DeleteIcon /></IconButton>}>
              {s.label}
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default StatusesPanel;

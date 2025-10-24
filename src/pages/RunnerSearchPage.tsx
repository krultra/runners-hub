import React, { useState, useEffect, useRef } from 'react';
import {
  Container,
  Typography,
  TextField,
  Box,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  CircularProgress,
  Alert,
  InputAdornment,
  Chip,
  Stack
} from '@mui/material';
import { Search, Person } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';

interface RunnerSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  personId?: number;
  email?: string;
}

const RunnerSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState<RunnerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchText.trim().length >= 2) {
        performSearch(searchText.trim());
      } else if (searchText.trim().length === 0) {
        setResults([]);
        setHasSearched(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchText]);

  const performSearch = async (search: string) => {
    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const usersRef = collection(db, 'users');
      
      // Search by first name or last name
      // Firestore doesn't support full-text search, so we'll use prefix matching
      const searchLower = search.toLowerCase();
      
      // Query users with personId (indicates they've competed in KUTC)
      const q = query(
        usersRef,
        where('personId', '!=', null),
        orderBy('personId'),
        limit(50)
      );
      
      const snapshot = await getDocs(q);
      
      // Client-side filtering for name matching
      const allUsers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as RunnerSearchResult));
      
      const filtered = allUsers.filter(user => {
        const firstName = (user.firstName || '').toLowerCase();
        const lastName = (user.lastName || '').toLowerCase();
        const fullName = `${firstName} ${lastName}`;
        
        return firstName.includes(searchLower) || 
               lastName.includes(searchLower) ||
               fullName.includes(searchLower);
      });
      
      // Sort by last name, then first name
      filtered.sort((a, b) => {
        const lastNameCompare = (a.lastName || '').localeCompare(b.lastName || '');
        if (lastNameCompare !== 0) return lastNameCompare;
        return (a.firstName || '').localeCompare(b.firstName || '');
      });
      
      setResults(filtered);
    } catch (err: any) {
      console.error('Search failed:', err);
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRunnerClick = (userId: string) => {
    navigate(`/runners/${userId}`);
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" gutterBottom>
          Runner Search
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Search for runners who have competed in KUTC events
        </Typography>
      </Box>

      {/* Search Bar */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <TextField
          fullWidth
          id="runner-search"
          name="runnerSearch"
          label="Search by name"
          variant="outlined"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Enter first name, last name, or both..."
          inputRef={searchInputRef}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
            endAdornment: loading ? (
              <InputAdornment position="end">
                <CircularProgress size={24} />
              </InputAdornment>
            ) : null
          }}
          helperText="Start typing to search (minimum 2 characters)"
        />
      </Paper>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      {/* Results */}
      {hasSearched && !loading && (
        <Paper sx={{ p: 2 }}>
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">
              Search Results
            </Typography>
            <Chip 
              label={`${results.length} ${results.length === 1 ? 'runner' : 'runners'} found`} 
              color={results.length > 0 ? 'primary' : 'default'}
              size="small"
            />
          </Box>

          {results.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Person sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                No runners found matching "{searchText}"
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Try a different name or check your spelling
              </Typography>
            </Box>
          ) : (
            <List>
              {results.map((runner, index) => (
                <ListItem 
                  key={runner.id} 
                  disablePadding
                  divider={index < results.length - 1}
                >
                  <ListItemButton onClick={() => handleRunnerClick(runner.id)}>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Person color="action" />
                          <Typography variant="body1">
                            {runner.firstName} {runner.lastName}
                          </Typography>
                        </Stack>
                      }
                      secondary={
                        runner.personId ? `Runner ID: ${runner.personId}` : 'KUTC Participant'
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      )}

      {/* Initial State */}
      {!hasSearched && !loading && (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Search sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Start searching for runners
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enter a name in the search box above to find runners
          </Typography>
        </Paper>
      )}
    </Container>
  );
};

export default RunnerSearchPage;

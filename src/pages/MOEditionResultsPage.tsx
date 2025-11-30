import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Chip,
  Stack,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Tooltip
} from '@mui/material';
import { Download, ArrowLeft, Info } from 'lucide-react';
import { findEditionWithNeighbors, getEditionResults, MOEditionResultsOptions, MOResultClass, MOResultEntry } from '../services/moResultsService';
import { formatDateNb, nbClassLabel, nbGenderLabel } from '../utils/localeNb';

const ALL_CLASS_FILTER = 'all';
const ALL_GENDER_FILTER = 'all';
type DefinedRanking = NonNullable<MOEditionResultsOptions['ranking']>;

const classOptions: { value: MOResultClass | typeof ALL_CLASS_FILTER; label: string }[] = [
  { value: ALL_CLASS_FILTER, label: 'Alle klasser' },
  { value: 'konkurranse', label: 'Konkurranse' },
  { value: 'trim_tidtaking', label: 'Trim med tidtaking' },
  { value: 'turklasse', label: 'Turklasse' }
];

const genderOptions: { value: string; label: string }[] = [
  { value: ALL_GENDER_FILTER, label: 'Alle' },
  { value: 'Male', label: 'Menn' },
  { value: 'Female', label: 'Kvinner' }
];

const rankingOptions: { value: DefinedRanking; label: string }[] = [
  { value: 'time', label: 'Løpstid' },
  { value: 'adjusted', label: 'Justert tid' }
];

const MOEditionResultsPage: React.FC = () => {
  const { editionId } = useParams<{ editionId: string }>();
  const navigate = useNavigate();
  const [results, setResults] = useState<MOResultEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<MOEditionResultsOptions>({ classFilter: ALL_CLASS_FILTER, genderFilter: ALL_GENDER_FILTER, ranking: 'time' });
  const [editionMeta, setEditionMeta] = useState<{ edition?: number; startTime?: Date | null; isoDate?: string } | null>(null);
  const [neighbors, setNeighbors] = useState<{ previousId?: string; previousLabel?: string; nextId?: string; nextLabel?: string }>({});

  const classFilterValue = options.classFilter ?? ALL_CLASS_FILTER;
  const isNonCompetitiveSelection = classFilterValue === 'trim_tidtaking' || classFilterValue === 'turklasse';
  const isAlleMotAlleSelected =
    classFilterValue === 'konkurranse' &&
    (options.genderFilter ?? ALL_GENDER_FILTER) === ALL_GENDER_FILTER &&
    (options.ranking ?? 'time') === 'adjusted';

  useEffect(() => {
    if (!editionId) return;

    const fetchEditionMeta = async () => {
      try {
        const { current, previous, next } = await findEditionWithNeighbors(editionId);
        if (current) {
          setEditionMeta({ edition: current.edition, startTime: current.startTime, isoDate: current.isoDate });
        } else {
          setEditionMeta(null);
        }
        setNeighbors({
          previousId: previous?.id,
          previousLabel: previous ? `MO ${previous.edition}` : undefined,
          nextId: next?.id,
          nextLabel: next ? `MO ${next.edition}` : undefined
        });
      } catch (err) {
        console.error('[MO Results] Failed to load edition metadata', err);
      }
    };

    fetchEditionMeta();
  }, [editionId]);

  useEffect(() => {
    if (!editionId) return;

    const fetchResults = async () => {
      try {
        setLoading(true);
        const list = await getEditionResults(editionId, options);
        setResults(list);
        setError(null);
      } catch (err) {
        console.error('[MO Results] Failed to load edition results', err);
        setError('Kunne ikke hente resultater. Prøv igjen senere.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [editionId, options]);

  const handleChange = <T extends keyof MOEditionResultsOptions>(key: T, value: MOEditionResultsOptions[T]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const handleClassFilterChange = (value: MOEditionResultsOptions['classFilter']) => {
    setOptions((prev) => {
      if (value === 'trim_tidtaking' || value === 'turklasse') {
        return { ...prev, classFilter: value, genderFilter: ALL_GENDER_FILTER, ranking: 'time' };
      }
      return { ...prev, classFilter: value };
    });
  };

  const editionTitle = useMemo(() => {
    if (!editionId) return 'Resultater';
    if (editionMeta?.edition) {
      return `Resultater ${editionMeta.edition}`;
    }
    return `Resultater ${editionId}`;
  }, [editionId, editionMeta]);

  const handleDownloadCsv = () => {
    if (results.length === 0) {
      return;
    }
    const header = [
      'Plass',
      'Navn',
      'Klasse',
      'Kjønn',
      'Tid',
      'Alders-/kjønnsjustert tid',
      'Status',
      'Klubb',
      'Alder',
      'UID'
    ];
    const rows = results.map((entry) => [
      options.ranking === 'adjusted' ? entry.rankAdjusted ?? '' : entry.rankTime ?? '',
      entry.fullName,
      nbClassLabel(entry.class),
      entry.gender ? nbGenderLabel(entry.gender) : '',
      entry.timeDisplay ?? '',
      entry.adjustedDisplay ?? '',
      entry.status ?? '',
      Array.isArray(entry.representing) ? entry.representing.join('; ') : entry.representing ?? '',
      entry.age ?? '',
      entry.userId ?? ''
    ]);
    const content = [header, ...rows].map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${editionId}-results.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
        <Button startIcon={<ArrowLeft />} onClick={() => navigate('/mo/results')}>
          Back to Overview
        </Button>
        <Box sx={{ flex: '1 1 auto' }} />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            disabled={!neighbors.previousId}
            onClick={() => neighbors.previousId && navigate(`/mo/results/${neighbors.previousId}`)}
          >
            ← {neighbors.previousLabel ?? 'Ingen tidligere'}
          </Button>
          <Button
            variant="outlined"
            disabled={!neighbors.nextId}
            onClick={() => neighbors.nextId && navigate(`/mo/results/${neighbors.nextId}`)}
          >
            {neighbors.nextLabel ?? 'Ingen nyere'} →
          </Button>
        </Box>
      </Box>

      <Stack direction="row" spacing={1} alignItems="center" mb={3} flexWrap="wrap">
        <Typography variant="h3" component="h1">
          {editionTitle}
        </Typography>
        {editionMeta?.startTime ? <Chip label={formatDateNb(editionMeta.startTime)} /> : null}
      </Stack>

      <Box display="flex" flexWrap="wrap" gap={2} mb={3} alignItems="center">
        <FormControl sx={{ minWidth: 200 }} size="small">
          <InputLabel id="class-filter-label">Klasse</InputLabel>
          <Select
            labelId="class-filter-label"
            label="Klasse"
            value={classFilterValue}
            onChange={(event) => handleClassFilterChange(event.target.value as MOEditionResultsOptions['classFilter'])}
          >
            {classOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 200 }} size="small">
          <InputLabel id="gender-filter-label">Kjønn</InputLabel>
          <Select
            labelId="gender-filter-label"
            label="Kjønn"
            disabled={isNonCompetitiveSelection}
            value={options.genderFilter ?? ALL_GENDER_FILTER}
            onChange={(event) => handleChange('genderFilter', event.target.value as MOEditionResultsOptions['genderFilter'])}
          >
            {genderOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <ToggleButtonGroup
          exclusive
          value={options.ranking ?? 'time'}
          disabled={isNonCompetitiveSelection}
          onChange={(_, value: DefinedRanking | null) => {
            if (value) {
              handleChange('ranking', value);
            }
          }}
          size="small"
          color="primary"
        >
          {rankingOptions.map((option) => (
            <ToggleButton key={option.value} value={option.value}>
              {option.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Tooltip title="Justert tid bruker Alle-mot-alle-poeng basert på alder og kjønn." placement="bottom">
          <Info size={18} />
        </Tooltip>

        <Button
          variant={isAlleMotAlleSelected ? 'contained' : 'outlined'}
          color={isAlleMotAlleSelected ? 'primary' : 'inherit'}
          onClick={() =>
            setOptions({ classFilter: 'konkurranse', genderFilter: ALL_GENDER_FILTER, ranking: 'adjusted' })
          }
        >
          Alle-mot-alle
        </Button>

        <Button variant="outlined" startIcon={<Download />} onClick={handleDownloadCsv} disabled={results.length === 0}>
          Last ned CSV
        </Button>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : results.length === 0 ? (
        <Alert severity="info">Ingen resultater for valgt filtrering.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{options.ranking === 'adjusted' ? 'Plass (justert)' : 'Plass'}</TableCell>
                <TableCell>Navn</TableCell>
                <TableCell>Klasse</TableCell>
                <TableCell>Kjønn</TableCell>
                <TableCell>Tid</TableCell>
                <TableCell>Justert tid</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Klubb/representasjon</TableCell>
                <TableCell>Alder</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((entry) => (
                <TableRow
                  key={entry.id}
                  hover
                  sx={{ cursor: entry.userId ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (entry.userId) {
                      navigate(`/runners/${entry.userId}`);
                    }
                  }}
                >
                  <TableCell>
                    {options.ranking === 'adjusted'
                      ? entry.rankAdjusted ?? entry.rankTime ?? ''
                      : entry.rankTime ?? entry.rankAdjusted ?? ''}
                  </TableCell>
                  <TableCell>{entry.fullName || 'Ukjent'}</TableCell>
                  <TableCell>{nbClassLabel(entry.class)}</TableCell>
                  <TableCell>{entry.gender ? nbGenderLabel(entry.gender) : ''}</TableCell>
                  <TableCell>{entry.timeDisplay ?? ''}</TableCell>
                  <TableCell>{entry.adjustedDisplay ?? ''}</TableCell>
                  <TableCell>{entry.status ?? ''}</TableCell>
                  <TableCell>
                    {Array.isArray(entry.representing)
                      ? entry.representing.join(', ')
                      : entry.representing ?? ''}
                  </TableCell>
                  <TableCell>{entry.age ?? ''}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );
};

export default MOEditionResultsPage;

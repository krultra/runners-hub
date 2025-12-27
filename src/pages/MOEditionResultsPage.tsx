import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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

const ALL_CLASS_FILTER = 'all';
const ALL_GENDER_FILTER = 'all';
type DefinedRanking = NonNullable<MOEditionResultsOptions['ranking']>;

const MOEditionResultsPage: React.FC = () => {
  const { editionId } = useParams<{ editionId: string }>();
  const navigate = useNavigate();
  const { i18n, t } = useTranslation();
  const [results, setResults] = useState<MOResultEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<MOEditionResultsOptions>({ classFilter: ALL_CLASS_FILTER, genderFilter: ALL_GENDER_FILTER, ranking: 'time' });
  const [editionMeta, setEditionMeta] = useState<{ edition?: number; startTime?: Date | null; isoDate?: string } | null>(null);
  const [neighbors, setNeighbors] = useState<{ previousId?: string; previousLabel?: string; nextId?: string; nextLabel?: string }>({});

  const uiLocale = useMemo(() => {
    if (i18n.language?.toLowerCase().startsWith('no')) {
      return 'nb-NO';
    }
    return 'en-GB';
  }, [i18n.language]);

  const formatDate = (value: Date | string | number | null | undefined): string => {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(uiLocale, {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    }).format(d);
  };

  const classLabel = (value: string | null | undefined): string => {
    if (!value) return '';
    const v = String(value).toLowerCase();
    if (v === 'konkurranse') return t('mo.editionResults.classLabels.competition');
    if (v === 'trim_tidtaking' || v === 'trim' || v === 'timed') return t('mo.editionResults.classLabels.timedRecreation');
    if (v === 'turklasse' || v === 'hike') return t('mo.editionResults.classLabels.hiking');
    return value;
  };

  const genderLabel = (value: string | null | undefined): string => {
    if (!value) return '';
    const g = String(value).toLowerCase();
    if (g === 'male' || g === 'm' || g === 'menn') return t('mo.editionResults.genderLabels.men');
    if (g === 'female' || g === 'f' || g === 'kvinner') return t('mo.editionResults.genderLabels.women');
    return '';
  };

  const classOptions = useMemo(
    ():
      {
        value: MOResultClass | typeof ALL_CLASS_FILTER;
        label: string;
      }[] => [
      { value: ALL_CLASS_FILTER, label: t('mo.editionResults.filters.allClasses') },
      { value: 'konkurranse', label: t('mo.editionResults.classLabels.competition') },
      { value: 'trim_tidtaking', label: t('mo.editionResults.classLabels.timedRecreation') },
      { value: 'turklasse', label: t('mo.editionResults.classLabels.hiking') }
    ],
    [t]
  );

  const genderOptions = useMemo(
    ():
      {
        value: string;
        label: string;
      }[] => [
      { value: ALL_GENDER_FILTER, label: t('mo.editionResults.filters.allGenders') },
      { value: 'Male', label: t('mo.editionResults.genderLabels.men') },
      { value: 'Female', label: t('mo.editionResults.genderLabels.women') }
    ],
    [t]
  );

  const rankingOptions = useMemo(
    ():
      {
        value: DefinedRanking;
        label: string;
      }[] => [
      { value: 'time', label: t('mo.editionResults.ranking.time') },
      { value: 'adjusted', label: t('mo.editionResults.ranking.adjusted') }
    ],
    [t]
  );

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
          previousLabel: previous ? t('mo.editionResults.editionLabel', { edition: previous.edition }) : undefined,
          nextId: next?.id,
          nextLabel: next ? t('mo.editionResults.editionLabel', { edition: next.edition }) : undefined
        });
      } catch (err) {
        console.error('[MO Results] Failed to load edition metadata', err);
      }
    };

    fetchEditionMeta();
  }, [editionId, t]);

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
        setError(t('mo.editionResults.loadFailed'));
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [editionId, options, t]);

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
    const fallback = editionMeta?.edition ?? editionId;
    if (!fallback) {
      return t('mo.editionResults.title');
    }
    return t('mo.editionResults.titleWithEdition', { edition: fallback });
  }, [editionId, editionMeta?.edition, t]);

  const handleDownloadCsv = () => {
    if (results.length === 0) {
      return;
    }
    const header = [
      t('mo.editionResults.csv.rank'),
      t('mo.editionResults.csv.name'),
      t('mo.editionResults.csv.class'),
      t('mo.editionResults.csv.gender'),
      t('mo.editionResults.csv.time'),
      t('mo.editionResults.csv.adjustedTime'),
      t('mo.editionResults.csv.status'),
      t('mo.editionResults.csv.club'),
      t('mo.editionResults.csv.age'),
      t('mo.editionResults.csv.userId')
    ];
    const rows = results.map((entry) => [
      options.ranking === 'adjusted' ? entry.rankAdjusted ?? '' : entry.rankTime ?? '',
      entry.fullName,
      classLabel(entry.class),
      entry.gender ? genderLabel(entry.gender) : '',
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
          {t('mo.backToOverview')}
        </Button>
        <Box sx={{ flex: '1 1 auto' }} />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            disabled={!neighbors.previousId}
            onClick={() => neighbors.previousId && navigate(`/mo/results/${neighbors.previousId}`)}
          >
            ← {neighbors.previousLabel ?? t('mo.editionResults.noPrevious')}
          </Button>
          <Button
            variant="outlined"
            disabled={!neighbors.nextId}
            onClick={() => neighbors.nextId && navigate(`/mo/results/${neighbors.nextId}`)}
          >
            {neighbors.nextLabel ?? t('mo.editionResults.noNext')} →
          </Button>
        </Box>
      </Box>

      <Stack direction="row" spacing={1} alignItems="center" mb={3} flexWrap="wrap">
        <Typography variant="h3" component="h1">
          {editionTitle}
        </Typography>
        {editionMeta?.startTime ? <Chip label={formatDate(editionMeta.startTime)} /> : null}
      </Stack>

      <Box display="flex" flexWrap="wrap" gap={2} mb={3} alignItems="center">
        <FormControl sx={{ minWidth: 200 }} size="small">
          <InputLabel id="class-filter-label">{t('mo.editionResults.filters.class')}</InputLabel>
          <Select
            labelId="class-filter-label"
            label={t('mo.editionResults.filters.class')}
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
          <InputLabel id="gender-filter-label">{t('mo.editionResults.filters.gender')}</InputLabel>
          <Select
            labelId="gender-filter-label"
            label={t('mo.editionResults.filters.gender')}
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

        <Tooltip title={t('mo.editionResults.adjustedRankingHelp')} placement="bottom">
          <Info size={18} />
        </Tooltip>

        <Button
          variant={isAlleMotAlleSelected ? 'contained' : 'outlined'}
          color={isAlleMotAlleSelected ? 'primary' : 'inherit'}
          onClick={() =>
            setOptions({ classFilter: 'konkurranse', genderFilter: ALL_GENDER_FILTER, ranking: 'adjusted' })
          }
        >
          {t('mo.editionResults.allVsAll')}
        </Button>

        <Button variant="outlined" startIcon={<Download />} onClick={handleDownloadCsv} disabled={results.length === 0}>
          {t('mo.editionResults.downloadCsv')}
        </Button>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : results.length === 0 ? (
        <Alert severity="info">{t('mo.editionResults.noResultsForFilter')}</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  {options.ranking === 'adjusted'
                    ? t('mo.editionResults.table.rankAdjusted')
                    : t('mo.editionResults.table.rank')}
                </TableCell>
                <TableCell>{t('mo.editionResults.table.name')}</TableCell>
                <TableCell>{t('mo.editionResults.table.class')}</TableCell>
                <TableCell>{t('mo.editionResults.table.gender')}</TableCell>
                <TableCell>{t('mo.editionResults.table.time')}</TableCell>
                <TableCell>{t('mo.editionResults.table.adjustedTime')}</TableCell>
                <TableCell>{t('mo.editionResults.table.status')}</TableCell>
                <TableCell>{t('mo.editionResults.table.representing')}</TableCell>
                <TableCell>{t('mo.editionResults.table.age')}</TableCell>
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
                  <TableCell>{entry.fullName || t('mo.editionResults.unknownRunner')}</TableCell>
                  <TableCell>{classLabel(entry.class)}</TableCell>
                  <TableCell>{entry.gender ? genderLabel(entry.gender) : ''}</TableCell>
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

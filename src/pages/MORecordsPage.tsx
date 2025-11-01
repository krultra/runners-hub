import React, { useEffect, useMemo, useState } from 'react';
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Paper,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Stack
} from '@mui/material';
import { EmojiEvents, Timer, ArrowBack, MilitaryTech, Leaderboard, Groups } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getRecords, MORecordsResult } from '../services/moResultsService';

const MORecordsPage: React.FC = () => {
  const navigate = useNavigate();
  type YearlyClassStat = {
    editionId: string;
    editionYear: number | null;
    competitionFinished: number;
    competitionDnf: number;
    competitionDns: number;
    trimCount: number;
    turCount: number;
    volunteerCount: number;
    total: number;
  };
  type RecordsWithStats = MORecordsResult & { yearlyClassStats?: YearlyClassStat[] };

  const [records, setRecords] = useState<MORecordsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const yearlyStats = useMemo(() => {
    const stats = (records as RecordsWithStats | null)?.yearlyClassStats;
    return Array.isArray(stats) ? stats : [];
  }, [records]);

  const yearlyTotals = useMemo(() => {
    if (yearlyStats.length === 0) {
      return null;
    }

    return yearlyStats.reduce<
      Omit<YearlyClassStat, 'editionId' | 'editionYear'>
    >(
      (acc, year) => {
        acc.competitionFinished += year.competitionFinished;
        acc.competitionDnf += year.competitionDnf;
        acc.competitionDns += year.competitionDns;
        acc.trimCount += year.trimCount;
        acc.turCount += year.turCount;
        acc.volunteerCount += year.volunteerCount;
        acc.total += year.total;
        return acc;
      },
      {
        competitionFinished: 0,
        competitionDnf: 0,
        competitionDns: 0,
        trimCount: 0,
        turCount: 0,
        volunteerCount: 0,
        total: 0
      }
    );
  }, [yearlyStats]);

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        setLoading(true);
        const data = await getRecords();
        setRecords(data);
      } catch (err) {
        console.error('[MO Records] Failed to load records', err);
        setError('Klarte ikke å hente rekorddata.');
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, []);

  const renderFastestTable = (
    title: string,
    rows: ReturnType<typeof getRecords> extends Promise<infer R>
      ? R extends MORecordsResult
        ? MORecordsResult['fastestMen']
        : never
      : never,
    opts?: { showAdjusted?: boolean }
  ) => {
    if (!rows || rows.length === 0) {
      return <Alert severity="info">Ingen rekorder registrert.</Alert>;
    }

    const getMedalIcon = (index: number) => {
      const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
      if (index >= 3) {
        return null;
      }
      return <MilitaryTech sx={{ fontSize: 22, color: colors[index], mr: 1 }} />;
    };

    return (
      <Paper elevation={2} sx={{ p: 3 }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          {title}
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>#</strong></TableCell>
                <TableCell><strong>Løper</strong></TableCell>
                <TableCell align="center"><strong>Tid</strong></TableCell>
                {opts?.showAdjusted && (
                  <TableCell align="center"><strong>Justert tid</strong></TableCell>
                )}
                {opts?.showAdjusted && (
                  <TableCell align="center"><strong>Alder</strong></TableCell>
                )}
                <TableCell align="center"><strong>År</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={`${row.runnerKey}-${row.editionId}`}>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      {getMedalIcon(index)}
                      <Typography variant="body2">{index + 1}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {row.userId ? (
                      <Button
                        variant="text"
                        size="small"
                        onClick={() => navigate(`/runners/${row.userId}`)}
                        sx={{ textTransform: 'none', fontWeight: 600, p: 0, minWidth: 0 }}
                      >
                        {row.fullName}
                      </Button>
                    ) : (
                      <Typography variant="body2" fontWeight={600}>
                        {row.fullName}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Chip label={row.timeDisplay} color="primary" size="small" />
                  </TableCell>
                  {opts?.showAdjusted && (
                    <TableCell align="center">
                      <Chip label={row.adjustedDisplay ?? '—'} color="primary" size="small" />
                    </TableCell>
                  )}
                  {opts?.showAdjusted && (
                    <TableCell align="center">{typeof row.age === 'number' ? row.age : '—'}</TableCell>
                  )}
                  <TableCell align="center">{row.editionYear ?? row.editionId.replace('mo-', '')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    );
  };

  const renderParticipationTable = (
    title: string,
    rows: ReturnType<typeof getRecords> extends Promise<infer R>
      ? R extends MORecordsResult
        ? MORecordsResult['topParticipationCompetition']
        : never
      : never,
    valueKey: 'totalCompetition' | 'totalOverall'
  ) => {
    if (!rows || rows.length === 0) {
      return <Alert severity="info">Ingen data tilgjengelig.</Alert>;
    }

    return (
      <Paper elevation={2} sx={{ p: 3 }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          {title}
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>#</strong></TableCell>
                <TableCell><strong>År</strong></TableCell>
                <TableCell align="center"><strong>Deltakere</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.editionId}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{row.editionYear ?? row.editionId.replace('mo-', '')}</TableCell>
                  <TableCell align="center">{row[valueKey]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    );
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !records) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">{error ?? 'Ingen rekorddata tilgjengelig.'}</Alert>
      </Container>
    );
  }

  const appearanceCutoff = records.mostAppearances[0]?.appearances ?? 0;
  const appearanceTitle = appearanceCutoff
    ? `Flest deltagelser – ${appearanceCutoff} ganger`
    : 'Flest deltagelser';

  const runnerUpGroups = records.mostAppearances.filter(
    (item) => item.appearances < appearanceCutoff
  );
  const runnerUpCutoff = runnerUpGroups[0]?.appearances ?? 0;
  const runnerUpTitle = runnerUpCutoff
    ? `Rett bak – ${runnerUpCutoff} ganger`
    : null;

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/mo/results')}>
          Tilbake til oversikt
        </Button>
        <Box sx={{ flex: '1 1 auto' }} />
        <Button
          variant="outlined"
          startIcon={<Leaderboard />}
          onClick={() => navigate('/mo/all-time')}
        >
          Adelskalender
        </Button>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
          <EmojiEvents sx={{ fontSize: 40, mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
          Rekorder – Malvikingen Opp
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Konkurranseklassens raskeste tider, justerte resultater og mest trofaste deltagere.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          {renderFastestTable('Raskeste menn (topp 5)', records.fastestMen)}
        </Grid>
        <Grid item xs={12} md={6}>
          {renderFastestTable('Raskeste kvinner (topp 5)', records.fastestWomen)}
        </Grid>
        <Grid item xs={12}>
          {renderFastestTable('Raskeste justerte tider (AGG – topp 10)', records.fastestAGG, {
            showAdjusted: true
          })}
        </Grid>
      </Grid>

      <Box sx={{ mt: 6 }}>
        <Typography variant="h4" component="h2" gutterBottom fontWeight="bold">
          <Groups sx={{ fontSize: 32, mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
          Mest trofaste deltagere
        </Typography>

        {records.mostAppearances.length > 0 ? (
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              {appearanceTitle}
            </Typography>
            <Grid container spacing={2}>
              {records.mostAppearances
                .filter((item) => item.appearances === appearanceCutoff)
                .map((item) => (
                  <Grid item xs={12} sm={6} md={4} key={item.runnerKey}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6" fontWeight="bold">
                          {item.fullName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Deltatt {item.appearances} ganger
                        </Typography>
                        {item.firstYear && item.lastYear && (
                          <Typography variant="caption" color="text.secondary">
                            Første år: {item.firstYear} · Siste år: {item.lastYear}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
            </Grid>

            {runnerUpTitle && (
              <Box sx={{ mt: 4 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  {runnerUpTitle}
                </Typography>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  {runnerUpGroups
                    .filter((item) => item.appearances === runnerUpCutoff)
                    .map((item) => (
                      <Grid item xs={12} sm={6} md={4} key={`${item.runnerKey}-runnerup`}>
                        <Card variant="outlined">
                          <CardContent>
                            {item.userId ? (
                              <Button
                                variant="text"
                                size="small"
                                onClick={() => navigate(`/runners/${item.userId}`)}
                                sx={{ textTransform: 'none', fontWeight: 600, p: 0, minWidth: 0 }}
                              >
                                {item.fullName}
                              </Button>
                            ) : (
                              <Typography variant="body2" fontWeight={600}>
                                {item.fullName}
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary">
                              {item.appearances} deltagelser
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                </Grid>
              </Box>
            )}
          </Paper>
        ) : (
          <Alert severity="info">Ingen deltagelsesdata tilgjengelig.</Alert>
        )}
      </Box>

      <Box sx={{ mt: 6 }}>
        <Typography variant="h4" component="h2" gutterBottom fontWeight="bold">
          <Timer sx={{ fontSize: 32, mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
          År med flest deltagere
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            {renderParticipationTable(
              'Konkurranse – flest deltagere',
              records.topParticipationCompetition,
              'totalCompetition'
            )}
          </Grid>
          <Grid item xs={12} md={6}>
            {renderParticipationTable(
              'Totalt – flest deltagere',
              records.topParticipationOverall,
              'totalOverall'
            )}
          </Grid>
        </Grid>
      </Box>

      {yearlyStats.length > 0 && (
        <Box sx={{ mt: 6 }}>
          <Typography variant="h4" component="h2" gutterBottom fontWeight="bold">
            Årsstatistikk
          </Typography>
          <Paper elevation={2} sx={{ p: 3 }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>År</strong></TableCell>
                    <TableCell align="right"><strong>Konk. fullført</strong></TableCell>
                    <TableCell align="right"><strong>DNF</strong></TableCell>
                    <TableCell align="right"><strong>DNS</strong></TableCell>
                    <TableCell align="right"><strong>Trim</strong></TableCell>
                    <TableCell align="right"><strong>Tur</strong></TableCell>
                    <TableCell align="right"><strong>Funk.</strong></TableCell>
                    <TableCell align="right"><strong>Total</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {yearlyStats.map((year: YearlyClassStat) => (
                    <TableRow key={year.editionId}>
                      <TableCell>{year.editionYear ?? year.editionId.replace('mo-', '')}</TableCell>
                      <TableCell align="right">{year.competitionFinished}</TableCell>
                      <TableCell align="right">{year.competitionDnf}</TableCell>
                      <TableCell align="right">{year.competitionDns}</TableCell>
                      <TableCell align="right">{year.trimCount}</TableCell>
                      <TableCell align="right">{year.turCount}</TableCell>
                      <TableCell align="right">{year.volunteerCount}</TableCell>
                      <TableCell align="right">{year.total}</TableCell>
                    </TableRow>
                  ))}
                  {yearlyTotals && (
                    <TableRow sx={{ fontWeight: 700 }}>
                      <TableCell><strong>Totalt</strong></TableCell>
                      <TableCell align="right"><strong>{yearlyTotals.competitionFinished}</strong></TableCell>
                      <TableCell align="right"><strong>{yearlyTotals.competitionDnf}</strong></TableCell>
                      <TableCell align="right"><strong>{yearlyTotals.competitionDns}</strong></TableCell>
                      <TableCell align="right"><strong>{yearlyTotals.trimCount}</strong></TableCell>
                      <TableCell align="right"><strong>{yearlyTotals.turCount}</strong></TableCell>
                      <TableCell align="right"><strong>{yearlyTotals.volunteerCount}</strong></TableCell>
                      <TableCell align="right"><strong>{yearlyTotals.total}</strong></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

      <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
        DNF- og DNS-oppføringer er utelatt fra alle totaler.
      </Typography>
    </Container>
  );
};

export default MORecordsPage;

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
import { Trophy, Timer, ArrowLeft, Medal, BarChart3, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getRecords, MORecordsResult } from '../services/moResultsService';

const MORecordsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
        setError(t('mo.records.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [t]);

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
      return <Alert severity="info">{t('mo.records.noRecordsRegistered')}</Alert>;
    }

    const getMedalIcon = (index: number) => {
      const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
      if (index >= 3) {
        return null;
      }
      return <Medal size={22} color={colors[index]} style={{ marginRight: 8 }} />;
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
                <TableCell><strong>{t('mo.records.tables.runner')}</strong></TableCell>
                <TableCell align="center"><strong>{t('mo.records.tables.time')}</strong></TableCell>
                {opts?.showAdjusted && (
                  <TableCell align="center"><strong>{t('mo.records.tables.adjustedTime')}</strong></TableCell>
                )}
                {opts?.showAdjusted && (
                  <TableCell align="center"><strong>{t('mo.records.tables.age')}</strong></TableCell>
                )}
                <TableCell align="center"><strong>{t('mo.records.yearly.year')}</strong></TableCell>
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
      return <Alert severity="info">{t('mo.records.noDataAvailable')}</Alert>;
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
                <TableCell><strong>{t('mo.records.yearly.year')}</strong></TableCell>
                <TableCell align="center"><strong>{t('mo.records.tables.participants')}</strong></TableCell>
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
        <Alert severity="error">{error ?? t('mo.records.noDataAvailable')}</Alert>
      </Container>
    );
  }

  const appearanceCutoff = records.mostAppearances[0]?.appearances ?? 0;
  const appearanceTitle = appearanceCutoff
    ? t('mo.records.mostAppearancesWithCount', { count: appearanceCutoff })
    : t('mo.records.mostAppearances');

  const runnerUpUsers = records.mostAppearances.filter(
    (item) => item.appearances < appearanceCutoff
  );
  const runnerUpCutoff = runnerUpUsers[0]?.appearances ?? 0;
  const runnerUpTitle = runnerUpCutoff
    ? t('mo.records.runnerUpWithCount', { count: runnerUpCutoff })
    : null;

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
        <Button startIcon={<ArrowLeft />} onClick={() => navigate('/mo/results')}>
          {t('mo.backToOverview')}
        </Button>
        <Box sx={{ flex: '1 1 auto' }} />
        <Button
          variant="outlined"
          startIcon={<BarChart3 />}
          onClick={() => navigate('/mo/all-time')}
        >
          {t('mo.allTimeLeaderboard')}
        </Button>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
          <Trophy size={40} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          {t('mo.records.title')}
        </Typography>
        <Typography variant="h6" color="text.secondary">
          {t('mo.records.subtitle')}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          {renderFastestTable(t('mo.records.fastestMenTitle'), records.fastestMen)}
        </Grid>
        <Grid item xs={12} md={6}>
          {renderFastestTable(t('mo.records.fastestWomenTitle'), records.fastestWomen)}
        </Grid>
        <Grid item xs={12}>
          {renderFastestTable(t('mo.records.fastestAggTitle'), records.fastestAGG, {
            showAdjusted: true
          })}
        </Grid>
      </Grid>

      <Box sx={{ mt: 6 }}>
        <Typography variant="h4" component="h2" gutterBottom fontWeight="bold">
          <Users size={32} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          {t('mo.records.mostLoyalParticipants')}
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
                          {t('mo.records.participatedCount', { count: item.appearances })}
                        </Typography>
                        {item.firstYear && item.lastYear && (
                          <Typography variant="caption" color="text.secondary">
                            {t('mo.records.firstYearLastYear', { first: item.firstYear, last: item.lastYear })}
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
                  {runnerUpUsers
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
                              {t('mo.records.participatedCount', { count: item.appearances })}
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
          <Alert severity="info">{t('mo.records.noDataAvailable')}</Alert>
        )}
      </Box>

      <Box sx={{ mt: 6 }}>
        <Typography variant="h4" component="h2" gutterBottom fontWeight="bold">
          <Timer size={32} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          {t('mo.records.yearsWithMostParticipants')}
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            {renderParticipationTable(
              t('mo.records.mostParticipantsCompetition'),
              records.topParticipationCompetition,
              'totalCompetition'
            )}
          </Grid>
          <Grid item xs={12} md={6}>
            {renderParticipationTable(
              t('mo.records.mostParticipantsTotal'),
              records.topParticipationOverall,
              'totalOverall'
            )}
          </Grid>
        </Grid>
      </Box>

      {yearlyStats.length > 0 && (
        <Box sx={{ mt: 6 }}>
          <Typography variant="h4" component="h2" gutterBottom fontWeight="bold">
            {t('mo.records.yearlyStats')}
          </Typography>
          <Paper elevation={2} sx={{ p: 3 }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>{t('mo.records.yearly.year')}</strong></TableCell>
                    <TableCell align="right"><strong>{t('mo.records.yearly.competitionFinished')}</strong></TableCell>
                    <TableCell align="right"><strong>{t('mo.records.yearly.dnf')}</strong></TableCell>
                    <TableCell align="right"><strong>{t('mo.records.yearly.dns')}</strong></TableCell>
                    <TableCell align="right"><strong>{t('mo.records.yearly.trim')}</strong></TableCell>
                    <TableCell align="right"><strong>{t('mo.records.yearly.hike')}</strong></TableCell>
                    <TableCell align="right"><strong>{t('mo.records.yearly.volunteer')}</strong></TableCell>
                    <TableCell align="right"><strong>{t('mo.records.yearly.total')}</strong></TableCell>
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
                      <TableCell><strong>{t('mo.records.yearly.totalsRow')}</strong></TableCell>
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
        {t('mo.records.dnfDnsExcluded')}
      </Typography>
    </Container>
  );
};

export default MORecordsPage;

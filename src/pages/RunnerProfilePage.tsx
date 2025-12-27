import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Container,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { ChevronRight, CalendarCheck, ChevronDown, Info } from 'lucide-react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { isAdminUser } from '../utils/adminUtils';
import { useTranslation } from 'react-i18next';
import {
  getRunnerProfile,
  getPublicUpcomingRegistrations,
  RunnerParticipation,
  RunnerProfile,
  RunnerProfileEditableDetails,
  RunnerUpcomingRegistration,
  RunnerKutcParticipationData,
  getRunnerKutcParticipationData,
  updateRunnerProfileDetails
} from '../services/runnerProfileService';
import { getRunnerMoResults, MOResultEntry, getEditionResults } from '../services/moResultsService';
import { useEventEdition } from '../contexts/EventEditionContext';

const formatTimeDisplay = (display: string | null | undefined, seconds: number | null | undefined): string => {
  if (display && display.trim().length > 0) {
    return display;
  }
  if (!seconds || seconds <= 0) {
    return '—';
  }
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts = [hrs, mins, secs]
    .map((value) => value.toString().padStart(2, '0'))
    .join(':');
  return parts;
};

type TranslateFn = (key: string, options?: any) => string;

const formatDateTimeDisplay = (value: Date | null | undefined, t: TranslateFn): string => {
  if (!value) {
    return t('common.dateTba');
  }
  return value.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const parseYearFromEditionId = (editionId: string): number | null => {
  if (!editionId) return null;
  const m = String(editionId).match(/(\d{4})$/);
  if (!m) return null;
  const y = Number(m[1]);
  return Number.isFinite(y) ? y : null;
};

const formatRank = (value: number | null | undefined): string => {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return `#${value}`;
};

const formatLoops = (loops: number | undefined): string => {
  if (!loops || loops <= 0) {
    return '—';
  }
  return loops.toString();
};

const formatMoClass = (value: string | undefined | null, t: TranslateFn): string => {
  if (!value) return '—';
  const v = String(value).toLowerCase();
  if (v === 'konkurranse') return t('runners.profile.mo.class.competition');
  if (v === 'trim_tidtaking') return t('runners.profile.mo.class.trimTimed');
  if (v === 'turklasse') return t('runners.profile.mo.class.hike');
  return value;
};

const isCompetitionClass = (value: string | undefined | null): boolean => {
  if (!value) return false;
  return String(value).toLowerCase() === 'konkurranse';
};

const formatMoStatus = (value: string | undefined | null, t: TranslateFn): string => {
  const v = (value ?? '').toString().trim().toUpperCase();
  if (v === 'DNS') return t('runners.profile.mo.status.dns');
  if (v === 'DNF') return t('runners.profile.mo.status.dnf');
  return t('runners.profile.mo.status.finished');
};

const isCountedMoClass = (value: string | undefined | null): boolean => {
  if (!value) return false;
  const v = String(value).toLowerCase();
  return v === 'konkurranse' || v === 'trim_tidtaking' || v === 'turklasse';
};

const normalizeNameKey = (value: string | undefined | null): string | null => {
  if (!value) return null;
  const key = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  return key || null;
};

const formatYears = (years: number[]): string => {
  if (!years || years.length === 0) {
    return '—';
  }
  return years.join(', ');
};

const RunnerProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { setEvent } = useEventEdition();
  const { t } = useTranslation();
  const debugTag = '[RunnerProfilePage]';
  const [profile, setProfile] = useState<RunnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [privateProfileLoaded, setPrivateProfileLoaded] = useState(false);
  const [publicUpcomingLoaded, setPublicUpcomingLoaded] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authPersonId, setAuthPersonId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [editableDetails, setEditableDetails] = useState<RunnerProfileEditableDetails | null>(null);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsSuccess, setDetailsSuccess] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [kutcExpanded, setKutcExpanded] = useState(false);
  const [kutcLoading, setKutcLoading] = useState(false);
  const [kutcError, setKutcError] = useState<string | null>(null);
  const [kutcData, setKutcData] = useState<RunnerKutcParticipationData | null>(null);

  const [moExpanded, setMoExpanded] = useState(false);
  const [moLoaded, setMoLoaded] = useState(false);
  const [moResults, setMoResults] = useState<MOResultEntry[]>([]);
  const [moLoading, setMoLoading] = useState<boolean>(true);
  const [moSummary, setMoSummary] = useState<{
    appearances: number;
    years: number[];
    bestTimeDisplay: string | null;
    bestGenderRank: number | null;
    bestAdjustedDisplay: string | null;
    bestAggRank: number | null;
  } | null>(null);
  const [moRankCache, setMoRankCache] = useState<Record<string, {
    adjustedByUser: Record<string, number>;
    adjustedByName: Record<string, number>;
    byGenderUser: Record<string, Record<string, number>>;
    byGenderName: Record<string, Record<string, number>>;
  }>>({});

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getRunnerProfile(userId, {
          includeParticipations: false,
          includeUpcomingRegistrations: false,
          includePrivateDetails: false
        });
        if (!isMounted) return;
        // Redirect to canonical route id (prefer personId) to avoid exposing email-style legacy ids.
        if (userId !== data.routeId) {
          navigate(`/runners/${data.routeId}` as any, { replace: true } as any);
          return;
        }
        setProfile(data);
        setPrivateProfileLoaded(false);
        setPublicUpcomingLoaded(false);
        setKutcData(null);
        setKutcError(null);
        setKutcExpanded(false);
        setMoExpanded(false);
        setMoLoaded(false);
        setMoResults([]);
        setMoSummary(null);
        setMoRankCache({});
        console.log(debugTag, 'Loaded profile', {
          userId,
          profileUserId: data.userId,
          hasPersonId: Boolean(data.personId)
        });
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || t('runners.profile.loadFailed'));
          console.warn(debugTag, 'Failed to load profile', { userId, error: err });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          console.log(debugTag, 'Profile load complete', { userId });
        }
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  useEffect(() => {
    let isMounted = true;
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!isMounted) {
        return;
      }
      const nextAuthUserId = user?.uid ?? null;
      const nextAuthEmail = user?.email ?? null;
      setAuthUserId(nextAuthUserId);
      setAuthEmail(nextAuthEmail);
      setAuthPersonId(null);
      if (user?.email) {
        isAdminUser(user.email)
          .then((flag) => {
            if (isMounted) {
              setIsAdmin(Boolean(flag));
              setAuthLoading(false);
              console.log(debugTag, 'Auth resolved', {
                authUid: nextAuthUserId,
                authEmail: user.email,
                isAdmin: Boolean(flag)
              });
            }
          })
          .catch(() => {
            if (isMounted) {
              setIsAdmin(false);
              setAuthLoading(false);
              console.warn(debugTag, 'Admin check failed', {
                authUid: nextAuthUserId,
                authEmail: user.email
              });
            }
          });
      } else {
        setIsAdmin(false);
        setAuthLoading(false);
        console.log(debugTag, 'Auth state without email', { authUid: nextAuthUserId });
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authUserId) {
      setAuthPersonId(null);
      return;
    }

    let cancelled = false;
    const resolve = async () => {
      try {
        const authProfile = await getRunnerProfile(authUserId, {
          includeParticipations: false,
          includeUpcomingRegistrations: false,
          includePrivateDetails: false
        });
        if (!cancelled) {
          setAuthPersonId(authProfile.personId ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setAuthPersonId(null);
        }
      }
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [authUserId]);

  useEffect(() => {
    if (!moExpanded || !profile?.userId) return;
    if (moLoaded) {
      return;
    }
    let isMounted = true;
    setMoLoading(true);
    getRunnerMoResults(profile.userId)
      .then((entries) => {
        if (isMounted) setMoResults(entries);
      })
      .catch(() => {
        if (isMounted) setMoResults([]);
      })
      .finally(() => {
        if (isMounted) {
          setMoLoaded(true);
          setMoLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [profile?.userId, moExpanded, moLoaded]);

  // Build per-edition rank caches for competition entries (time by gender, adjusted overall), by userId and by normalized name
  useEffect(() => {
    if (!moExpanded) {
      return;
    }
    let cancelled = false;
    const buildCache = async () => {
      const editions = Array.from(new Set(
        moResults
          .filter((e) => isCompetitionClass(e.class) && e.editionId)
          .map((e) => e.editionId as string)
      ));
      if (editions.length === 0) {
        if (!cancelled) setMoRankCache({});
        return;
      }

      const nextCache: Record<string, {
        adjustedByUser: Record<string, number>;
        adjustedByName: Record<string, number>;
        byGenderUser: Record<string, Record<string, number>>;
        byGenderName: Record<string, Record<string, number>>;
      }> = {};

      for (const editionId of editions) {
        const entriesThisEdition = moResults.filter((e) => e.editionId === editionId && isCompetitionClass(e.class));
        const genders = Array.from(new Set(entriesThisEdition.map((e) => (e.gender ?? '').toString()).filter(Boolean)));
        const byGenderUser: Record<string, Record<string, number>> = {};
        const byGenderName: Record<string, Record<string, number>> = {};

        // Gender rank (time)
        await Promise.all(
          genders.map(async (g) => {
            try {
              const list = await getEditionResults(editionId, { classFilter: 'konkurranse', genderFilter: g as any, ranking: 'time' });
              const mapUser: Record<string, number> = {};
              const mapName: Record<string, number> = {};
              list.forEach((it) => {
                const r = typeof it.rankTime === 'number' && Number.isFinite(it.rankTime) ? (it.rankTime as number) : null;
                if (r != null) {
                  if (it.userId) {
                    mapUser[it.userId] = r;
                  }
                  const nk = normalizeNameKey(it.fullName);
                  if (nk) {
                    if (!(nk in mapName) || r < mapName[nk]) {
                      mapName[nk] = r;
                    }
                  }
                }
              });
              byGenderUser[g] = mapUser;
              byGenderName[g] = mapName;
            } catch (err) {
              byGenderUser[g] = {};
              byGenderName[g] = {};
            }
          })
        );

        // Adjusted rank (AGG overall)
        let adjustedByUser: Record<string, number> = {};
        let adjustedByName: Record<string, number> = {};
        try {
          const listAdj = await getEditionResults(editionId, { classFilter: 'konkurranse', ranking: 'adjusted' });
          const mapUser: Record<string, number> = {};
          const mapName: Record<string, number> = {};
          listAdj.forEach((it) => {
            const r = typeof it.rankAdjusted === 'number' && Number.isFinite(it.rankAdjusted) ? (it.rankAdjusted as number) : null;
            if (r != null) {
              if (it.userId) {
                mapUser[it.userId] = r;
              }
              const nk = normalizeNameKey(it.fullName);
              if (nk) {
                if (!(nk in mapName) || r < mapName[nk]) {
                  mapName[nk] = r;
                }
              }
            }
          });
          adjustedByUser = mapUser;
          adjustedByName = mapName;
        } catch (err) {
          adjustedByUser = {};
          adjustedByName = {};
        }

        nextCache[editionId] = { adjustedByUser, adjustedByName, byGenderUser, byGenderName };
      }

      if (!cancelled) setMoRankCache(nextCache);
    };
    buildCache();
    return () => { cancelled = true; };
  }, [moResults, moExpanded]);

  useEffect(() => {
    if (!moExpanded) {
      return;
    }
    let cancelled = false;
    const compute = async () => {
      if (!profile?.userId) {
        setMoSummary(null);
        return;
      }
      const comp = moResults.filter((e) => isCompetitionClass(e.class));
      const countedAll = moResults.filter((e) => isCountedMoClass(e.class));
      const notDnsAll = countedAll.filter((e) => (e.status ?? '').toString().toUpperCase() !== 'DNS');
      const yearsSet = new Set<number>();
      notDnsAll.forEach((e) => {
        if (typeof e.editionYear === 'number' && Number.isFinite(e.editionYear)) {
          yearsSet.add(e.editionYear);
        } else if (e.editionId) {
          const m = String(e.editionId).match(/(\d{4})$/);
          if (m) yearsSet.add(Number(m[1]));
        }
      });

      const appearances = yearsSet.size;
      const years = Array.from(yearsSet).sort((a, b) => a - b);

      let bestTimeDisplay: string | null = null;
      let bestGenderRank: number | null = null;
      let bestAdjustedDisplay: string | null = null;
      let bestAggRank: number | null = null;

      // Best unadjusted time (competition only)
      const timed = comp
        .filter((e) => (e.timeSeconds ?? null) != null && (e.timeSeconds as number) > 0)
        .slice()
        .sort((a, b) => (a.timeSeconds ?? Number.POSITIVE_INFINITY) - (b.timeSeconds ?? Number.POSITIVE_INFINITY));
      if (timed.length > 0) {
        const best = timed[0];
        bestTimeDisplay = formatTimeDisplay(best.timeDisplay ?? null, best.timeSeconds ?? null);
        // Try to compute gender rank for that edition
        try {
          const gender = (best.gender ?? null) as any;
          if (gender && best.editionId) {
            const editionEntries = await getEditionResults(best.editionId, {
              classFilter: 'konkurranse',
              genderFilter: gender,
              ranking: 'time'
            });
            const match = editionEntries.find((it) => it.userId && it.userId === profile.userId);
            bestGenderRank = match?.rankTime ?? null;
            if (bestGenderRank == null) {
              // fallback to first index + 1 when name matches closely
              const alt = editionEntries.find((it) => (it.fullName || '').toLowerCase() === (best.fullName || '').toLowerCase());
              bestGenderRank = alt ? alt.rankTime ?? null : null;
            }
          } else {
            bestGenderRank = best.rankTime ?? null;
          }
        } catch {
          bestGenderRank = best.rankTime ?? null;
        }
      }

      // Best adjusted time (competition only)
      const adjusted = comp
        .filter((e) => (e.adjustedSeconds ?? null) != null && (e.adjustedSeconds as number) > 0)
        .slice()
        .sort((a, b) => (a.adjustedSeconds ?? Number.POSITIVE_INFINITY) - (b.adjustedSeconds ?? Number.POSITIVE_INFINITY));
      if (adjusted.length > 0) {
        const bestAdj = adjusted[0];
        bestAdjustedDisplay = formatTimeDisplay(bestAdj.adjustedDisplay ?? null, bestAdj.adjustedSeconds ?? null);
        try {
          if (bestAdj.editionId) {
            const editionEntriesAgg = await getEditionResults(bestAdj.editionId, {
              classFilter: 'konkurranse',
              ranking: 'adjusted'
            });
            const match = editionEntriesAgg.find((it) => it.userId && it.userId === profile.userId);
            bestAggRank = match?.rankAdjusted ?? null;
            if (bestAggRank == null) {
              const alt = editionEntriesAgg.find((it) => (it.fullName || '').toLowerCase() === (bestAdj.fullName || '').toLowerCase());
              bestAggRank = alt ? alt.rankAdjusted ?? null : null;
            }
          } else {
            bestAggRank = bestAdj.rankAdjusted ?? null;
          }
        } catch {
          bestAggRank = bestAdj.rankAdjusted ?? null;
        }
      }

      if (!cancelled) {
        setMoSummary({ appearances, years, bestTimeDisplay, bestGenderRank, bestAdjustedDisplay, bestAggRank });
      }
    };
    compute();
    return () => { cancelled = true; };
  }, [moResults, profile?.userId, moExpanded]);

  useEffect(() => {
    if (!kutcExpanded || !profile?.userId || !profile?.personId) {
      return;
    }
    if (kutcData) {
      return;
    }

    let isMounted = true;
    setKutcLoading(true);
    setKutcError(null);
    getRunnerKutcParticipationData(profile.userId, profile.personId)
      .then((data) => {
        if (isMounted) setKutcData(data);
      })
      .catch((err: any) => {
        if (isMounted) {
          setKutcData(null);
          setKutcError(err?.message || 'Failed to load participation history');
        }
      })
      .finally(() => {
        if (isMounted) setKutcLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [kutcExpanded, profile?.userId, profile?.personId, kutcData]);

  useEffect(() => {
    if (!profile) {
      setEditableDetails(null);
      return;
    }

    const sanitizedCode = (profile.phoneCountryCode ?? '').replace(/^\+/, '').replace(/\D/g, '');
    const sanitizedPhone = (profile.phone ?? '').replace(/\D/g, '');

    console.log(debugTag, 'Preparing editable details from profile', {
      profileUserId: profile.userId,
      profileFirstName: profile.firstName,
      profileLastName: profile.lastName,
      sanitizedCode,
      sanitizedPhone
    });

    setEditableDetails({
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
      phoneCountryCode: sanitizedCode,
      phone: sanitizedPhone
    });
    setDetailsError(null);
  }, [profile]);

  const stats = useMemo(() => {
    if (!profile) {
      return null;
    }
    return {
      name: `${profile.firstName} ${profile.lastName}`.trim(),
      appearances: '—',
      years: '—',
      totalLoops: '—',
      best: '—'
    };
  }, [profile]);

  const kutcStats = useMemo(() => {
    if (!kutcData) {
      return null;
    }
    return {
      appearances: t('runners.profile.kutc.appearancesCount', { count: kutcData.totalAppearances }),
      years: formatYears(kutcData.appearanceYears),
      totalLoops: t('runners.profile.kutc.loopsCount', { count: kutcData.totalLoops }),
      best: kutcData.bestPerformance
        ? t('runners.profile.kutc.bestPerformance', {
            loops: kutcData.bestPerformance.loops,
            time: formatTimeDisplay(kutcData.bestPerformance.totalTimeDisplay, kutcData.bestPerformance.totalTimeSeconds),
            year: kutcData.bestPerformance.year
          })
        : '—'
    };
  }, [kutcData, t]);

  const personIdMatches = Boolean(
    profile?.personId != null && authPersonId != null && profile.personId === authPersonId
  );

  const isOwnProfile = Boolean(profile) && !authLoading && Boolean(authUserId) && (
    authUserId === profile?.userId ||
    authUserId === profile?.userDocId ||
    personIdMatches
  );

  const canEdit = isOwnProfile;

  useEffect(() => {
    if (!profile || authLoading || !authUserId) {
      return;
    }
    if (isOwnProfile) {
      return;
    }
    if (publicUpcomingLoaded) {
      return;
    }

    if (profile.personId == null) {
      setProfile((prev) => (prev ? { ...prev, upcomingRegistrations: [] } : prev));
      setPublicUpcomingLoaded(true);
      return;
    }

    let cancelled = false;
    const loadPublicUpcoming = async () => {
      try {
        const regs = await getPublicUpcomingRegistrations(profile.personId as number);
        if (!cancelled) {
          setProfile((prev) => (prev ? { ...prev, upcomingRegistrations: regs } : prev));
          setPublicUpcomingLoaded(true);
        }
      } catch (err) {
        if (!cancelled) {
          setProfile((prev) => (prev ? { ...prev, upcomingRegistrations: [] } : prev));
          setPublicUpcomingLoaded(true);
        }
      }
    };

    loadPublicUpcoming();
    return () => {
      cancelled = true;
    };
  }, [authLoading, authUserId, isOwnProfile, profile, publicUpcomingLoaded]);

  useEffect(() => {
    if (!profile || authLoading || !isOwnProfile || privateProfileLoaded) {
      return;
    }

    let cancelled = false;
    const loadPrivate = async () => {
      try {
        const data = await getRunnerProfile(authUserId!, {
          includeParticipations: false,
          includeUpcomingRegistrations: true,
          includePrivateDetails: true
        });
        if (cancelled) {
          return;
        }
        setProfile(data);
        setPrivateProfileLoaded(true);
      } catch (err) {
        if (!cancelled) {
          console.warn(debugTag, 'Failed to load private profile details', err);
        }
      }
    };

    loadPrivate();
    return () => {
      cancelled = true;
    };
  }, [authLoading, authUserId, debugTag, isOwnProfile, privateProfileLoaded, profile]);

  const hasMoAppearances = useMemo(
    () => moResults.some((e) => isCountedMoClass(e.class)),
    [moResults]
  );

  useEffect(() => {
    console.log(debugTag, 'Authorization state changed', {
      authLoading,
      authUserId,
      authEmail,
      profileUserId: profile?.userId,
      profileEmail: profile?.email,
      profilePersonId: profile?.personId,
      authPersonId,
      isAdmin,
      isOwnProfile,
      canEdit
    });
  }, [authLoading, authUserId, authEmail, profile, isAdmin, personIdMatches, authPersonId, isOwnProfile, canEdit]);

  useEffect(() => {
    console.log(debugTag, 'Render personal details toggle', {
      detailsExpanded
    });
  }, [detailsExpanded]);

  const hasDetailsChanged = useMemo(() => {
    if (!profile || !editableDetails) {
      return false;
    }
    const sanitizedProfileCode = (profile.phoneCountryCode ?? '').replace(/^\+/, '').replace(/\D/g, '');
    const sanitizedProfilePhone = (profile.phone ?? '').replace(/\D/g, '');
    return (
      editableDetails.firstName !== (profile.firstName ?? '') ||
      editableDetails.lastName !== (profile.lastName ?? '') ||
      (editableDetails.phoneCountryCode ?? '') !== sanitizedProfileCode ||
      (editableDetails.phone ?? '') !== sanitizedProfilePhone
    );
  }, [profile, editableDetails]);

  const handleDetailChange = (field: keyof RunnerProfileEditableDetails) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    let value = event.target.value;
    if (field === 'phoneCountryCode') {
      value = value.replace(/\D/g, '').slice(0, 4);
    } else if (field === 'phone') {
      value = value.replace(/\D/g, '').slice(0, 15);
    }

    setEditableDetails((prev) => (prev ? { ...prev, [field]: value } : prev));
    setDetailsSuccess(false);
    setDetailsError(null);
    console.log(debugTag, 'Detail field change', { field, value });
  };

  const handleCancelDetails = () => {
    if (!profile) {
      return;
    }
    const sanitizedCode = (profile.phoneCountryCode ?? '').replace(/^\+/, '').replace(/\D/g, '');
    const sanitizedPhone = (profile.phone ?? '').replace(/\D/g, '');

    setEditableDetails({
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
      phoneCountryCode: sanitizedCode,
      phone: sanitizedPhone
    });
    setDetailsSuccess(false);
    setDetailsError(null);
    console.log(debugTag, 'Reverted edits from profile snapshot');
  };

  const handleSaveDetails = async () => {
    if (!profile || !editableDetails || !hasDetailsChanged) {
      console.log(debugTag, 'Save skipped', {
        hasProfile: Boolean(profile),
        hasEditableDetails: Boolean(editableDetails),
        hasDetailsChanged
      });
      return;
    }

    setDetailsSaving(true);
    setDetailsError(null);
    try {
      const sanitizedCode = (editableDetails.phoneCountryCode ?? '').replace(/\D/g, '');
      const sanitizedPhone = (editableDetails.phone ?? '').replace(/\D/g, '');
      const storedCode = sanitizedCode ? `+${sanitizedCode}` : '';

      await updateRunnerProfileDetails(profile.userDocId, {
        firstName: editableDetails.firstName,
        lastName: editableDetails.lastName,
        phoneCountryCode: storedCode,
        phone: sanitizedPhone
      });

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              firstName: editableDetails.firstName,
              lastName: editableDetails.lastName,
              phoneCountryCode: storedCode,
              phone: sanitizedPhone
            }
          : prev
      );
      setDetailsSuccess(true);
      console.log(debugTag, 'Saved personal details', {
        userId: profile.userId,
        storedCode,
        sanitizedPhone
      });
    } catch (err: any) {
      setDetailsError(err?.message || t('runners.profile.detailsUpdateFailed'));
      console.error(debugTag, 'Failed saving personal details', {
        userId: profile.userId,
        error: err
      });
    } finally {
      setDetailsSaving(false);
    }
  };

  const renderParticipations = (participations: RunnerParticipation[]) => {
    if (participations.length === 0) {
      return null;
    }

    return (
      <TableContainer
        component={Paper}
        sx={{
          border: '1px solid',
          borderColor: 'primary.light',
          boxShadow: '0 6px 18px rgba(25, 118, 210, 0.16)',
          backgroundColor: 'rgba(25, 118, 210, 0.08)',
          borderWidth: 2,
          borderRadius: 2
        }}
      >
        <Table
          sx={{
            '& .MuiTableHead-root': {
              backgroundColor: 'rgba(25, 118, 210, 0.18)',
              '& .MuiTableCell-root': {
                color: 'primary.contrastText',
                backgroundColor: 'rgba(25, 118, 210, 0.35)',
                borderColor: 'rgba(25, 118, 210, 0.2)'
              }
            },
            '& .MuiTableBody-root .MuiTableRow-root': {
              backgroundColor: 'rgba(25, 118, 210, 0.08)',
              '&:nth-of-type(even)': {
                backgroundColor: 'rgba(25, 118, 210, 0.12)'
              },
              '&:hover': {
                backgroundColor: 'rgba(25, 118, 210, 0.18)'
              }
            },
            '& .MuiTableCell-root': {
              borderColor: 'rgba(25, 118, 210, 0.25)'
            }
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell>{t('runners.profile.kutc.table.edition')}</TableCell>
              <TableCell>{t('runners.profile.kutc.table.race')}</TableCell>
              <TableCell align="right">{t('runners.profile.kutc.table.raceRank')}</TableCell>
              <TableCell align="right">{t('runners.profile.kutc.table.raceTime')}</TableCell>
              <TableCell align="right">{t('runners.profile.kutc.table.totalRank')}</TableCell>
              <TableCell align="right">{t('runners.profile.kutc.table.totalLoops')}</TableCell>
              <TableCell align="right">{t('runners.profile.kutc.table.totalTime')}</TableCell>
              <TableCell>{t('runners.profile.kutc.table.status')}</TableCell>
              <TableCell align="right">{t('runners.profile.kutc.table.analysis')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {participations.map((participation) => {
              const editionLabel = `KUTC ${participation.year}`;
              const raceTime = formatTimeDisplay(participation.raceTimeDisplay, participation.raceTimeSeconds);
              const totalTime = formatTimeDisplay(participation.totalTimeDisplay, participation.totalTimeSeconds);
              const loops = formatLoops(participation.loopsCompleted);
              const distanceKey = participation.distanceKey || 'total';
              return (
                <TableRow key={participation.editionId}>
                  <TableCell>
                    <Button
                      variant="outlined"
                      size="small"
                      color="primary"
                      endIcon={<ChevronRight fontSize="small" />}
                      onClick={() => navigate(`/kutc/results/${participation.editionId}?distance=total`)}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 600,
                        borderColor: 'primary.main',
                        color: 'primary.dark',
                        '&:hover': {
                          borderColor: 'primary.dark',
                          backgroundColor: 'rgba(25, 118, 210, 0.12)'
                        }
                      }}
                    >
                      {editionLabel}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outlined"
                      size="small"
                      color="primary"
                      endIcon={<ChevronRight fontSize="small" />}
                      onClick={() => {
                        const key = distanceKey || 'total';
                        navigate(`/kutc/results/${participation.editionId}?distance=${encodeURIComponent(key)}`);
                      }}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 500,
                        borderColor: 'primary.main',
                        color: 'primary.dark',
                        '&:hover': {
                          borderColor: 'primary.dark',
                          backgroundColor: 'rgba(25, 118, 210, 0.12)'
                        }
                      }}
                    >
                      {participation.raceName}
                    </Button>
                  </TableCell>
                  <TableCell align="right">{formatRank(participation.raceRank)}</TableCell>
                  <TableCell align="right">{raceTime}</TableCell>
                  <TableCell align="right">{formatRank(participation.totalRank)}</TableCell>
                  <TableCell align="right">{loops}</TableCell>
                  <TableCell align="right">{totalTime}</TableCell>
                  <TableCell>{participation.status || '—'}</TableCell>
                  <TableCell align="right">
                    {participation.hasCheckpointData ? (
                      <Button
                        component={RouterLink}
                        to={`/runners/${profile?.routeId}/kutc/${participation.editionId}`}
                        size="small"
                        variant="outlined"
                        color="primary"
                        sx={{
                          textTransform: 'none',
                          borderColor: 'primary.main',
                          color: 'primary.dark',
                          '&:hover': {
                            borderColor: 'primary.dark',
                            backgroundColor: 'rgba(25, 118, 210, 0.12)'
                          }
                        }}
                      >
                        {t('common.view')}
                      </Button>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        {t('runners.profile.kutc.table.na')}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderMoParticipation = (entries: MOResultEntry[]) => {
    if (moLoading) {
      return (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <CircularProgress size={24} />
        </Box>
      );
    }
    const entriesToShow = entries.filter((e) => isCountedMoClass(e.class));
    if (!entriesToShow.length) {
      return null;
    }

    const headerGender = entriesToShow.find((e) => isCompetitionClass(e.class) && e.gender)?.gender;
    const genderHeaderLabel = headerGender === 'Male'
      ? t('runners.profile.gender.men')
      : headerGender === 'Female'
        ? t('runners.profile.gender.women')
        : t('runners.profile.gender.gender');

    return (
      <TableContainer
        component={Paper}
        sx={{
          border: '1px solid',
          borderColor: 'success.light',
          boxShadow: '0 6px 18px rgba(46, 125, 50, 0.16)',
          backgroundColor: 'rgba(46, 125, 50, 0.08)',
          borderWidth: 2,
          borderRadius: 2
        }}
      >
        <Table
          sx={{
            '& .MuiTableHead-root': {
              backgroundColor: 'rgba(46, 125, 50, 0.18)',
              '& .MuiTableCell-root': {
                color: 'common.white',
                backgroundColor: 'rgba(46, 125, 50, 0.35)',
                borderColor: 'rgba(46, 125, 50, 0.2)'
              }
            },
            '& .MuiTableBody-root .MuiTableRow-root': {
              backgroundColor: 'rgba(46, 125, 50, 0.08)',
              '&:nth-of-type(even)': {
                backgroundColor: 'rgba(46, 125, 50, 0.12)'
              },
              '&:hover': {
                backgroundColor: 'rgba(46, 125, 50, 0.18)'
              }
            },
            '& .MuiTableCell-root': {
              borderColor: 'rgba(46, 125, 50, 0.25)'
            }
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell>{t('runners.profile.mo.table.edition')}</TableCell>
              <TableCell>{t('runners.profile.mo.table.class')}</TableCell>
              <TableCell align="right">{t('runners.profile.mo.table.rankGender', { gender: genderHeaderLabel })}</TableCell>
              <TableCell align="right">{t('runners.profile.mo.table.time')}</TableCell>
              <TableCell align="right">
                <Tooltip
                  title={t('runners.profile.mo.table.aggTooltip')}
                  arrow
                  enterTouchDelay={0}
                  leaveTouchDelay={3000}
                >
                  <Button variant="text" size="small" sx={{ p: 0, minWidth: 0, textTransform: 'none', fontWeight: 600, color: 'text.primary' }}>
                    {t('runners.profile.mo.table.rankAgg')}
                  </Button>
                </Tooltip>
              </TableCell>
              <TableCell align="right">{t('runners.profile.mo.table.adjusted')}</TableCell>
              <TableCell>{t('runners.profile.mo.table.status')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {entriesToShow
              .slice()
              .sort((a, b) => {
                const ya = a.editionYear ?? 0;
                const yb = b.editionYear ?? 0;
                return yb - ya;
              })
              .map((entry) => {
                const editionLabel = entry.editionYear ? `MO ${entry.editionYear}` : entry.editionId;
                const time = formatTimeDisplay(entry.timeDisplay ?? null, entry.timeSeconds ?? null);
                const adjusted = formatTimeDisplay(entry.adjustedDisplay ?? null, entry.adjustedSeconds ?? null);
                const isComp = isCompetitionClass(entry.class);
                const genderKey = (entry.gender ?? '').toString();
                const cache = entry.editionId ? moRankCache[entry.editionId] : undefined;
                const nameKey = normalizeNameKey(entry.fullName ?? '') as string | null;
                const rowGenderRank = isComp && genderKey
                  ? (
                      (entry.userId && cache?.byGenderUser?.[genderKey]?.[entry.userId]) ||
                      (nameKey && cache?.byGenderName?.[genderKey]?.[nameKey]) ||
                      (entry.rankTime ?? null)
                    )
                  : null;
                const rowAggRank = isComp
                  ? (
                      (entry.userId && cache?.adjustedByUser?.[entry.userId]) ||
                      (nameKey && cache?.adjustedByName?.[nameKey]) ||
                      (entry.rankAdjusted ?? null)
                    )
                  : null;
                return (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Button
                        variant="contained"
                        size="small"
                        color="success"
                        endIcon={<ChevronRight fontSize="small" />}
                        onClick={() => navigate(`/mo/results/${entry.editionId}`)}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 600,
                          borderColor: 'success.dark',
                          color: 'common.white',
                          backgroundColor: 'rgba(46, 125, 50, 0.18)',
                          '&:hover': {
                            borderColor: 'success.dark',
                            backgroundColor: 'rgba(46, 125, 50, 0.28)'
                          }
                        }}
                      >
                        {editionLabel}
                      </Button>
                    </TableCell>
                    <TableCell>{formatMoClass(entry.class, t)}</TableCell>
                    <TableCell align="right">{formatRank(rowGenderRank as any)}</TableCell>
                    <TableCell align="right">{time}</TableCell>
                    <TableCell align="right">{formatRank(rowAggRank as any)}</TableCell>
                    <TableCell align="right">{adjusted}</TableCell>
                    <TableCell>{formatMoStatus(entry.status, t)}</TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderUpcomingRegistrations = (registrations: RunnerUpcomingRegistration[]) => {
    if (!registrations.length) {
      return (
        <Typography variant="body2" color="text.secondary">
          {t('runners.profile.upcoming.none')}
        </Typography>
      );
    }

    return (
      <List disablePadding>
        {registrations.map((registration, index) => {
          const isLast = index === registrations.length - 1;
          const typeLabel = registration.registrationType === 'kutc'
            ? 'KUTC'
            : registration.registrationType === 'mo'
              ? 'MO'
              : t('editions.event');
          const statusLabel = registration.status ? registration.status : null;
          const editionYear = parseYearFromEditionId(registration.editionId);
          const hasYearInName = editionYear
            ? String(registration.eventName || '').includes(String(editionYear))
            : false;
          const displayName = editionYear && !hasYearInName
            ? `${registration.eventName} (${editionYear})`
            : registration.eventName;
          const distanceLabel = registration.raceDistanceLabel || registration.raceDistance || null;
          const updatedAtLabel = registration.updatedAt ? formatDateTimeDisplay(registration.updatedAt, t) : null;

          return (
            <ListItem
              key={registration.registrationId}
              alignItems="flex-start"
              disableGutters
              divider={!isLast}
              sx={{ py: 1.5 }}
              secondaryAction={isOwnProfile ? (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={async () => {
                    await setEvent(registration.editionId);
                    navigate('/register');
                  }}
                  sx={{ textTransform: 'none' }}
                >
                  {t('runners.profile.upcoming.reviewRegistration')}
                </Button>
              ) : null}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <CalendarCheck size={20} />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {displayName}
                    </Typography>
                    <Chip size="small" label={typeLabel} color={typeLabel === 'MO' ? 'success' : 'primary'} variant="outlined" />
                    {distanceLabel && (
                      <Chip size="small" label={distanceLabel} variant="outlined" />
                    )}
                    {statusLabel && (
                      <Chip size="small" label={statusLabel} color={statusLabel === 'confirmed' ? 'success' : 'warning'} variant="outlined" />
                    )}
                  </Stack>
                }
                secondary={
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ mt: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('runners.profile.upcoming.starts', { date: formatDateTimeDisplay(registration.startTime, t) })}
                    </Typography>
                    {typeof registration.registrationNumber === 'number' && (
                      <Typography variant="body2" color="text.secondary">
                        {t('runners.profile.upcoming.registrationNumber', { number: registration.registrationNumber })}
                      </Typography>
                    )}
                    {updatedAtLabel && (
                      <Typography variant="body2" color="text.secondary">
                        {t('runners.profile.upcoming.lastUpdated', { date: updatedAtLabel })}
                      </Typography>
                    )}
                  </Stack>
                }
              />
            </ListItem>
          );
        })}
      </List>
    );
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 6, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!profile || !stats) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Alert severity="info">{t('runners.profile.notFound')}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" gutterBottom>
          {stats.name}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('runners.profile.pageSubtitle')}
        </Typography>
      </Box>

      {!authLoading && !isOwnProfile && (
        <Alert severity="info" sx={{ mb: 4 }}>
          {t('runners.profile.publicProfileNotice')}
        </Alert>
      )}

      {canEdit && (
        <Paper sx={{ mb: 4 }}>
          <Button
            fullWidth
            onClick={() => setDetailsExpanded((prev) => !prev)}
            sx={{
              justifyContent: 'space-between',
              px: 3,
              py: 2,
              textTransform: 'none',
              color: 'text.primary',
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }}
            endIcon={<ChevronDown size={20} style={{ transform: detailsExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />}
          >
            <Typography variant="h5" component="span">
              {t('runners.profile.personalDetails.title')}
            </Typography>
            <Typography variant="body2" component="span" color="text.secondary">
              {detailsExpanded ? t('runners.profile.personalDetails.hide') : t('runners.profile.personalDetails.show')}
            </Typography>
          </Button>
          <Collapse in={detailsExpanded} timeout="auto" unmountOnExit>
            <Divider />
            <Box sx={{ px: 3, py: 3 }}>
              {detailsSuccess && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {t('runners.profile.personalDetails.saved')}
                </Alert>
              )}
              {detailsError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {detailsError}
                </Alert>
              )}
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label={t('runners.profile.personalDetails.firstName')}
                    fullWidth
                    value={editableDetails?.firstName ?? ''}
                    onChange={handleDetailChange('firstName')}
                    disabled={detailsSaving}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label={t('runners.profile.personalDetails.lastName')}
                    fullWidth
                    value={editableDetails?.lastName ?? ''}
                    onChange={handleDetailChange('lastName')}
                    disabled={detailsSaving}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label={t('runners.profile.personalDetails.phoneCountryCode')}
                    fullWidth
                    value={editableDetails?.phoneCountryCode ?? ''}
                    onChange={handleDetailChange('phoneCountryCode')}
                    disabled={detailsSaving}
                    placeholder="47"
                    InputProps={{
                      startAdornment: <InputAdornment position="start">+</InputAdornment>,
                      inputMode: 'numeric'
                    }}
                    inputProps={{ pattern: '[0-9]*', maxLength: 4 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label={t('runners.profile.personalDetails.phoneNumber')}
                    fullWidth
                    value={editableDetails?.phone ?? ''}
                    onChange={handleDetailChange('phone')}
                    disabled={detailsSaving}
                    placeholder={t('runners.profile.personalDetails.phonePlaceholder')}
                    InputProps={{ inputMode: 'numeric' }}
                    inputProps={{ pattern: '[0-9]*', maxLength: 15 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label={t('runners.profile.personalDetails.email')}
                    fullWidth
                    value={profile.email}
                    disabled
                    helperText={t('runners.profile.personalDetails.emailHelper')}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <Tooltip title={t('runners.profile.personalDetails.emailTooltip')}>
                            <Info size={16} />
                          </Tooltip>
                        </InputAdornment>
                      )
                    }}
                  />
                </Grid>
              </Grid>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
                <Button
                  variant="text"
                  onClick={handleCancelDetails}
                  disabled={detailsSaving || !hasDetailsChanged}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSaveDetails}
                  disabled={detailsSaving || !hasDetailsChanged}
                >
                  {detailsSaving ? t('runners.profile.personalDetails.saving') : t('runners.profile.personalDetails.saveChanges')}
                </Button>
              </Box>
            </Box>
          </Collapse>
        </Paper>
      )}

      {!authLoading && Boolean(authUserId) ? (
        <Paper sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            {t('runners.profile.upcoming.title')}
          </Typography>
          {isOwnProfile
            ? (privateProfileLoaded
                ? renderUpcomingRegistrations(profile.upcomingRegistrations)
                : <Typography variant="body2" color="text.secondary">{t('common.loading')}</Typography>)
            : (publicUpcomingLoaded
                ? renderUpcomingRegistrations(profile.upcomingRegistrations)
                : <Typography variant="body2" color="text.secondary">{t('common.loading')}</Typography>)}
        </Paper>
      ) : null}

      <Paper sx={{ mb: 4 }}>
        <Button
          fullWidth
          onClick={() => setKutcExpanded((prev) => !prev)}
          sx={{
            justifyContent: 'space-between',
            px: 3,
            py: 2,
            textTransform: 'none',
            color: 'text.primary',
            '&:hover': {
              backgroundColor: 'action.hover'
            }
          }}
          endIcon={<ChevronDown size={20} style={{ transform: kutcExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />}
        >
          <Typography variant="h5" component="span">
            {t('runners.profile.kutc.historyTitle', { event: t('kutc.title') })}
          </Typography>
          <Typography variant="body2" component="span" color="text.secondary">
            {kutcExpanded ? t('runners.profile.kutc.hideHistory') : t('runners.profile.kutc.showHistory')}
          </Typography>
        </Button>
        <Collapse in={kutcExpanded} timeout="auto">
          <Divider />
          <Box sx={{ px: 3, py: 3 }}>
            {kutcLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            )}
            {kutcError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {kutcError}
              </Alert>
            )}
            {!kutcLoading && !kutcError && kutcData && (
              <>
                <Paper
                  sx={{
                    p: 3,
                    mb: 4,
                    border: '2px solid',
                    borderColor: 'primary.main',
                    backgroundColor: 'rgba(25, 118, 210, 0.05)',
                    boxShadow: '0 6px 18px rgba(25, 118, 210, 0.12)'
                  }}
                >
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                      <Stack spacing={1}>
                        <Typography variant="overline" color="text.secondary">
                          {t('runners.profile.kutc.stats.totalAppearances')}
                        </Typography>
                        <Typography variant="h5">{kutcStats?.appearances ?? '—'}</Typography>
                        <Chip label={t('runners.profile.kutc.stats.years', { years: kutcStats?.years ?? '—' })} size="small" />
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Stack spacing={1}>
                        <Typography variant="overline" color="text.secondary">
                          {t('runners.profile.kutc.stats.totalLoops')}
                        </Typography>
                        <Typography variant="h5">{kutcStats?.totalLoops ?? '—'}</Typography>
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Stack spacing={1}>
                        <Typography variant="overline" color="text.secondary">
                          {t('runners.profile.kutc.stats.bestPerformance')}
                        </Typography>
                        <Typography variant="h6">{kutcStats?.best ?? '—'}</Typography>
                      </Stack>
                    </Grid>
                  </Grid>
                </Paper>
                {kutcData.participations.length > 0 && (
                  <Box>
                    {renderParticipations(kutcData.participations)}
                  </Box>
                )}
              </>
            )}
          </Box>
        </Collapse>
      </Paper>

      <Paper sx={{ mb: 2 }}>
        <Button
          fullWidth
          onClick={() => {
            setMoExpanded((prev) => !prev);
          }}
          sx={{
            justifyContent: 'space-between',
            px: 3,
            py: 2,
            textTransform: 'none',
            color: 'text.primary',
            '&:hover': {
              backgroundColor: 'action.hover'
            }
          }}
          endIcon={<ChevronDown size={20} style={{ transform: moExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />}
        >
          <Typography variant="h5" component="span">
            {t('runners.profile.mo.historyTitle', { event: t('mo.title') })}
          </Typography>
          <Typography variant="body2" component="span" color="text.secondary">
            {moExpanded ? t('runners.profile.mo.hideHistory') : t('runners.profile.mo.showHistory')}
          </Typography>
        </Button>
        <Collapse in={moExpanded} timeout="auto">
          <Divider />
          <Box sx={{ px: 3, py: 3 }}>
            {moLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            )}
            {!moLoading && (
              <>
                <Paper
                  sx={{
                    p: 3,
                    mb: 2,
                    border: '2px solid',
                    borderColor: 'success.main',
                    backgroundColor: 'rgba(46, 125, 50, 0.05)',
                    boxShadow: '0 6px 18px rgba(46, 125, 50, 0.12)'
                  }}
                >
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                      <Stack spacing={1}>
                        <Typography variant="overline" color="text.secondary">
                          {t('runners.profile.mo.stats.totalAppearances')}
                        </Typography>
                        <Typography variant="h5">{t('runners.profile.mo.appearancesCount', { count: moSummary?.appearances ?? 0 })}</Typography>
                        <Chip label={t('runners.profile.mo.stats.years', { years: formatYears(moSummary?.years ?? []) })} size="small" />
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Stack spacing={1}>
                        <Typography variant="overline" color="text.secondary">
                          {t('runners.profile.mo.stats.bestTimeGender')}
                        </Typography>
                        <Typography variant="h6">{moSummary?.bestTimeDisplay ?? '—'} {moSummary?.bestGenderRank ? `• #${moSummary.bestGenderRank}` : ''}</Typography>
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Stack spacing={1}>
                        <Typography variant="overline" color="text.secondary">
                          {t('runners.profile.mo.stats.bestAdjustedAgg')}
                        </Typography>
                        <Typography variant="h6">{moSummary?.bestAdjustedDisplay ?? '—'} {moSummary?.bestAggRank ? `• #${moSummary.bestAggRank}` : ''}</Typography>
                      </Stack>
                    </Grid>
                  </Grid>
                </Paper>
                {hasMoAppearances && (
                  <Box>
                    {renderMoParticipation(moResults)}
                  </Box>
                )}
              </>
            )}
          </Box>
        </Collapse>
      </Paper>
    </Container>
  );
};

export default RunnerProfilePage;

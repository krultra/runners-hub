import React from 'react';
import { useParams, Navigate } from 'react-router-dom';

const KUTCResultsYearRedirect: React.FC = () => {
  const { year } = useParams<{ year: string }>();
  const target = year ? `/kutc/results/kutc-${year}` : '/kutc/results';
  return <Navigate to={target} replace />;
};

export default KUTCResultsYearRedirect;

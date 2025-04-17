import React from 'react';
import { Stepper, Step, StepLabel } from '@mui/material';

interface RegistrationStepperProps {
  steps: string[];
  activeStep: number;
  onStepClick?: (step: number) => void;
}

const RegistrationStepper: React.FC<RegistrationStepperProps> = ({ steps, activeStep, onStepClick }) => (
  <Stepper activeStep={activeStep} sx={{ pt: 3, pb: 5 }}>
    {steps.map((label, idx) => (
      <Step key={label}>
        <StepLabel
          onClick={onStepClick ? () => onStepClick(idx) : undefined}
          style={onStepClick ? { cursor: 'pointer' } : {}}
        >
          {label}
        </StepLabel>
      </Step>
    ))}
  </Stepper>
);

export default RegistrationStepper;

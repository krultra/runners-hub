// KUTC 2025 Race Details
export const RACE_DETAILS = {
  name: "Kruke's Ultra-Trail Challenge (KUTC) 2025",
  date: new Date('2025-10-11T10:00:00'), // October 11, 2025, 10:00 AM
  registrationDeadline: new Date('2025-10-10T10:00:00'), // October 10, 2025, 10:00 AM
  maxParticipants: 30,
  loopDistance: 6.7, // kilometers per loop
  fees: {
    participation: 50, // NOK
    baseCamp: 50, // NOK
    deposit: 200, // NOK (refundable if participant shows up)
    total: 300 // NOK
  },
  paymentMethods: [
    {
      name: 'Vipps',
      description: 'Available in Norway, Sweden, Denmark and Finland',
      isPreferred: true
    },
    {
      name: 'International Bank Transfer',
      description: 'Available for participants from all countries',
      isPreferred: false
    },
    {
      name: 'PayPal',
      description: 'Available as a last resort',
      isPreferred: false
    }
  ]
};

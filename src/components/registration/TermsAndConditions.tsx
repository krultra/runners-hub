import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Divider,
  Box
} from '@mui/material';

interface TermsAndConditionsProps {
  open: boolean;
  onClose: () => void;
}

const TermsAndConditions: React.FC<TermsAndConditionsProps> = ({ open, onClose }) => {
  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      scroll="paper"
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Typography variant="h5" component="div">
          Terms and Conditions
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body1" paragraph>
          By completing and committing this registration form I confirm that I have read and consent to the following:
        </Typography>
        
        <Divider sx={{ my: 2 }} />
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="body1" paragraph>
            Participation in Kruke's Ultra-Trail Challenge / KUTC ('the event', 'the race', 'the competition') will be fully at my own risk.
          </Typography>
          
          <Typography variant="body1" paragraph>
            Upon registration, I understand that the race is self-supported and provides no professional medical personnel or assistance before, during or after the event. If a situation should arise that requires medical attention, I will depend on the general rescue and medical care system available to the public. I also understand that all race officials and participants, including me, will be expected to provide help to the best of their abilities in case of an emergency situation during the race.
          </Typography>
          
          <Typography variant="body1" paragraph>
            KrUltra ('the organizer') collects and stores registration information and results from the race for history and communication.
          </Typography>
          
          <Typography variant="body1" paragraph>
            The organizer's communication with me shall mainly be by email, and only as needed to complete the registration process and to give me relevant information in connection to the event. There shall be no future advertisements or other promotions from the race organizer or the race organizer's partners unless I actively agree to this.
          </Typography>
          
          <Typography variant="body1" paragraph>
            By registering I agree that photos and videos taken in connection with the event may be used by the organizer, the organizer's partners and media actors.
          </Typography>
          
          <Typography variant="body1" paragraph>
            By participating in the event, I agree that results can be published and shared. This includes (but is not limited to) international results providers like ITRA and DUV, national media like Kondis, langrenn.com etc., and via the organizer's own digital channels. Personal information given in this registration form, like date of birth, nationality and club association, may be shared and published as part of the results services.
          </Typography>
          
          <Typography variant="body1" paragraph>
            As required by The General Data Protection Regulation (EU) 2016/679 (GDPR), the organizer is required to collect, use and store personal data only as strictly required for the purpose of organizing the event. Unless actively permitted by me, personal data about me and my participation shall be deleted by the organizer when they are no longer required for the purpose of organizing the event. However, I understand and agree that historic results will be kept indefinitely, unless I actively demand their deletion.
          </Typography>
          
          <Typography variant="body1" paragraph>
            I acknowledge that my registration is not valid until I have completed the payment obligations connected to my registration and that the organizer may cancel my registration if I fail to complete the required payments without unnecessary delay within a reasonable time.
          </Typography>
          
          <Typography variant="body1" paragraph>
            I understand and accept that my registration is binding once submitted and cannot be canceled by me. The registration fee is non-refundable regardless of my ability to participate in the event.
          </Typography>
          
          <Typography variant="body1" paragraph>
            I understand that if my registration is submitted after the maximum participant limit has been reached, my registration may be invalidated or placed on a waiting list at the organizer's discretion, even if the system initially accepted it.
          </Typography>
          
          <Typography variant="body1" paragraph>
            I accept that the organizer has full rights, without any further reason or explanation, to cancel the competition or my registration. Such cancellations shall be followed by a payback of any service fee and deposits that have been made by me, with the exception of the participation fee. I accept that transaction fees are always non-refundable.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TermsAndConditions;

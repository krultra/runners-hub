import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress
} from '@mui/material';

// Simple markdown to HTML converter for basic formatting
const simpleMarkdownToHtml = (markdown: string): string => {
  return markdown
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr />')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // List items
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Wrap consecutive list items in ul
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // Paragraphs (double newlines)
    .replace(/\n\n/g, '</p><p>')
    // Single newlines within paragraphs
    .replace(/\n/g, '<br />')
    // Wrap in paragraph
    .replace(/^/, '<p>')
    .replace(/$/, '</p>')
    // Clean up empty paragraphs
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<h[123]>)/g, '$1')
    .replace(/(<\/h[123]>)<\/p>/g, '$1')
    .replace(/<p>(<hr \/>)<\/p>/g, '$1')
    .replace(/<p>(<ul>)/g, '$1')
    .replace(/(<\/ul>)<\/p>/g, '$1');
};

interface TermsAndConditionsProps {
  open: boolean;
  onClose: () => void;
  eventId: string; // e.g., 'kutc', 'mo'
}

const TermsAndConditions: React.FC<TermsAndConditionsProps> = ({ open, onClose, eventId }) => {
  const { t, i18n } = useTranslation();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get locale code (en or no)
  const locale = i18n.language?.startsWith('no') || i18n.language?.startsWith('nb') ? 'no' : 'en';

  useEffect(() => {
    if (!open) return;

    const loadTerms = async () => {
      setLoading(true);
      setError(null);

      // Try event-specific file first, then fall back to default
      const filesToTry = [
        `/terms/${eventId}.${locale}.md`,
        `/terms/${eventId}.en.md`, // Fallback to English for this event
        `/terms/default.${locale}.md`,
        `/terms/default.en.md`,
      ];

      for (const file of filesToTry) {
        try {
          const response = await fetch(file);
          if (response.ok) {
            const text = await response.text();
            // Verify we got markdown, not the SPA fallback HTML
            if (!text.trim().startsWith('<!DOCTYPE') && !text.trim().startsWith('<html')) {
              setContent(text);
              setLoading(false);
              return;
            }
          }
        } catch {
          // Continue to next file
        }
      }

      setError('Could not load terms and conditions');
      setLoading(false);
    };

    loadTerms();
  }, [open, eventId, locale]);

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
          {t('terms.title')}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {loading && (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        )}
        {error && (
          <Typography color="error">{error}</Typography>
        )}
        {!loading && !error && content && (
          <Box 
            sx={{ 
              '& h1': { typography: 'h5', mt: 0, mb: 2 },
              '& h2': { typography: 'h6', mt: 3, mb: 1 },
              '& h3': { typography: 'subtitle1', mt: 2, mb: 1 },
              '& p': { typography: 'body1', mb: 2 },
              '& ul': { pl: 3, mb: 2 },
              '& li': { typography: 'body1', mb: 0.5 },
              '& hr': { my: 2, border: 'none', borderTop: '1px solid', borderColor: 'divider' },
              '& strong': { fontWeight: 'bold' },
            }}
            dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(content) }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          {t('common.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TermsAndConditions;

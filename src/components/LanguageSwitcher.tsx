import React from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton, Menu, MenuItem, Typography, Box } from '@mui/material';
import { Globe } from 'lucide-react';
import { localeNames, Locale, supportedLocales } from '../i18n/locales';

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLanguageChange = (locale: Locale) => {
    i18n.changeLanguage(locale);
    handleClose();
  };

  const currentLocale = (i18n.language?.substring(0, 2) as Locale) || 'no';

  return (
    <>
      <IconButton
        onClick={handleClick}
        size="small"
        aria-label="Change language"
        aria-controls={open ? 'language-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        sx={{ color: 'inherit' }}
      >
        <Globe size={20} />
        <Typography variant="caption" sx={{ ml: 0.5, textTransform: 'uppercase' }}>
          {currentLocale}
        </Typography>
      </IconButton>
      <Menu
        id="language-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          'aria-labelledby': 'language-button',
        }}
      >
        {supportedLocales.map((locale) => (
          <MenuItem
            key={locale}
            onClick={() => handleLanguageChange(locale)}
            selected={locale === currentLocale}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography>{localeNames[locale]}</Typography>
              {locale === currentLocale && (
                <Typography variant="caption" color="text.secondary">
                  ✓
                </Typography>
              )}
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default LanguageSwitcher;

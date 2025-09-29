import Handlebars from 'handlebars';

// Register commonly used helpers for email templates
export function registerDefaultEmailHelpers(hb?: typeof Handlebars) {
  const H = hb || Handlebars;

  // Avoid re-registering if helpers already present
  if (!(H as any).__krultra_email_helpers__) {
    // formatDate: {{formatDate date "DD MMM YYYY"}}
    H.registerHelper('formatDate', function(date: any, fmt?: string) {
      try {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        // Very small formatter to avoid adding heavy libs
        const day = d.toLocaleDateString('en-GB', { day: '2-digit' });
        const monShort = d.toLocaleDateString('en-GB', { month: 'short' });
        const monLong = d.toLocaleDateString('en-GB', { month: 'long' });
        const year = d.getFullYear().toString();
        const map: Record<string, string> = {
          'DD MMM YYYY': `${day} ${monShort} ${year}`,
          'D MMM YYYY': `${d.getDate()} ${monShort} ${year}`,
          'DD MMMM YYYY': `${day} ${monLong} ${year}`,
          'YYYY-MM-DD': `${year}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
        };
        if (fmt && map[fmt]) return map[fmt];
        return `${d.getDate()} ${monShort} ${year}`; // default like '1 Jan 2025'
      } catch {
        return '';
      }
    });

    // formatDateTime: {{formatDateTime date}}
    H.registerHelper('formatDateTime', function(date: any) {
      try {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleString('en-GB', {
          year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
      } catch {
        return '';
      }
    });

    // Fallbacks
    H.registerHelper('upper', (s: any) => (s ?? '').toString().toUpperCase());
    H.registerHelper('lower', (s: any) => (s ?? '').toString().toLowerCase());

    (H as any).__krultra_email_helpers__ = true;
  }
}

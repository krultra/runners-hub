import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Box, Typography, MenuItem, FormControl, InputLabel, Select, TextField, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import Editor from '@monaco-editor/react';
import { html as beautifyHtml } from 'js-beautify';
import Handlebars from 'handlebars';
import { listEmailTemplates, updateEmailTemplate, importEmailTemplates, addEmailTemplate, deleteEmailTemplate, EmailTemplate } from '../../services/templateService';

const TemplatesPanel: React.FC = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<EmailTemplate | null>(null);
  const [selectedLocale, setSelectedLocale] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const locales = useMemo(() => Array.from(new Set(templates.map(t => t.locale))), [templates]);
  const types = useMemo(() => templates.filter(t => t.locale === selectedLocale).map(t => t.type), [templates, selectedLocale]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  // new template dialog state
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newLocale, setNewLocale] = useState('');
  const [newType, setNewType] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await listEmailTemplates();
      setTemplates(data);
      setLoading(false);
    })();
  }, []);

  const handleSubjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (current) setCurrent({ ...current, subjectTemplate: e.target.value });
  };

  const handleBodyChange = (value: string | undefined) => {
    if (current && value !== undefined) setCurrent({ ...current, bodyTemplate: value });
  };

  const handleFormat = () => {
    if (current) {
      const formatted = beautifyHtml(current.bodyTemplate, { indent_size: 2 });
      setCurrent({ ...current, bodyTemplate: formatted });
    }
  };

  const handlePreview = () => {
    if (current) {
      const context: any = {
        eventName: 'KrUltra TestEvent',
        eventShortName: 'KUTE',
        eventEdition: new Date().getFullYear(),
        eventDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        representing: 'KrUltra Runners',
        name: 'Test User',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@krultra.com',
        registrationNumber: 12345,
        dateOfBirth: new Date('1990-01-01'),
        nationality: 'NOR',
        phoneCountryCode: '+47',
        phoneNumber: '123456789',
        travelRequired: 'Yes',
        termsAccepted: true,
        comments: 'No comments',
        notifyFutureEvents: true,
        sendRunningOffers: false,
        // add test expiration date for waiting list
        waitinglistExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
      // format dates for preview as '1 Jan 1990'
      const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      context.dateOfBirth = fmt(context.dateOfBirth);
      context.waitinglistExpires = fmt(context.waitinglistExpires);
      // include formatted 'today' in preview
      context.today = fmt(new Date());
      try {
        const subjFn = Handlebars.compile(current.subjectTemplate);
        const subj = subjFn(context);
        setPreviewSubject(subj);
        const bodyFn = Handlebars.compile(current.bodyTemplate);
        const html = bodyFn(context);
        setPreviewHtml(html);
        setPreviewOpen(true);
      } catch (e) {
        alert('Preview error: ' + e);
      }
    }
  };

  const handleSave = async () => {
    if (current) {
      await updateEmailTemplate(current.type, current.locale, current.subjectTemplate, current.bodyTemplate);
      alert('Template saved');
      const data = await listEmailTemplates();
      setTemplates(data);
    }
  };

  const handleExport = async () => {
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: `emailTemplates_${new Date().toISOString()}.json`,
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(templates, null, 2));
        await writable.close();
      } catch {
        alert('Save cancelled or failed');
      }
    } else if ('chooseFileSystemEntries' in window) {
      try {
        const opts = { type: 'save-file', accepts: [{ description: 'JSON', extensions: ['json'], mimeTypes: ['application/json'] }] };
        const fileHandle = await (window as any).chooseFileSystemEntries(opts);
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(templates, null, 2));
        await writable.close();
      } catch {
        alert('Save cancelled or failed');
      }
    } else {
      const dataStr = JSON.stringify(templates, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `emailTemplates_${new Date().toISOString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const text = await file.text();
      try {
        const importedTemplates: EmailTemplate[] = JSON.parse(text);
        await importEmailTemplates(importedTemplates);
        const data = await listEmailTemplates();
        setTemplates(data);
        alert('Templates imported');
      } catch (err) {
        alert('Import failed: ' + err);
      }
    }
  };

  const triggerImport = () => fileInputRef.current?.click();

  const addNewTemplate = async () => {
    setLoading(true);
    await addEmailTemplate(newType, newLocale, newSubject, newBody);
    const data = await listEmailTemplates();
    setTemplates(data);
    setNewLocale(''); setNewType(''); setNewSubject(''); setNewBody('');
    setNewDialogOpen(false);
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!current) return;
    if (!window.confirm('Delete this template?')) return;
    setLoading(true);
    await deleteEmailTemplate(current.id);
    const data = await listEmailTemplates();
    setTemplates(data);
    setCurrent(null); setSelectedType('');
    setLoading(false);
  };

  return (
    <Box>
      <Typography variant="h5">Email Templates</Typography>
      <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
        <Button variant="outlined" onClick={handleExport}>Export</Button>
        <Button variant="outlined" onClick={triggerImport}>Import</Button>
        <input type="file" accept="application/json" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImport} />
        <Button variant="contained" onClick={() => setNewDialogOpen(true)}>Add Template</Button>
      </Box>
      {loading ? (
        <CircularProgress sx={{ mt: 2 }} />
      ) : (
        <Box>
          {/* Locale then Template Type selection */}
          <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Locale</InputLabel>
              <Select value={selectedLocale} label="Locale" onChange={e => { setSelectedLocale(e.target.value); setSelectedType(''); setCurrent(null); }}>
                {locales.map(loc => <MenuItem key={loc} value={loc}>{loc}</MenuItem>)}
              </Select>
            </FormControl>
            {selectedLocale && (
              <FormControl fullWidth>
                <InputLabel>Template Type</InputLabel>
                <Select value={selectedType} label="Template Type" onChange={e => {
                  const type = e.target.value;
                  setSelectedType(type);
                  const tpl = templates.find(t => t.locale === selectedLocale && t.type === type) || null;
                  setCurrent(tpl);
                }}>
                  {types.map(type => <MenuItem key={type} value={type}>{type}</MenuItem>)}
                </Select>
              </FormControl>
            )}
          </Box>
          {current && (
            <Box sx={{ mt: 2 }}>
              <TextField label="Subject" fullWidth value={current.subjectTemplate} onChange={handleSubjectChange} />
              <Box sx={{ mt: 2 }}>
                <Editor
                  height="300px"
                  defaultLanguage="handlebars"
                  value={current.bodyTemplate}
                  onChange={handleBodyChange}
                  options={{ minimap: { enabled: false } }}
                />
              </Box>
              <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                <Button variant="outlined" onClick={handlePreview}>Preview</Button>
                <Button variant="outlined" onClick={handleFormat}>Format</Button>
                <Button variant="contained" onClick={handleSave}>Save</Button>
                <Button variant="outlined" color="error" onClick={handleDelete} disabled={loading}>Delete</Button>
              </Box>
            </Box>
          )}
          <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
            <DialogTitle>Preview</DialogTitle>
            <DialogContent>
              <Typography variant="subtitle1" sx={{ mb: 2 }}><b>Subject:</b> {previewSubject}</Typography>
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPreviewOpen(false)}>Close</Button>
            </DialogActions>
          </Dialog>
          <Dialog open={newDialogOpen} onClose={() => setNewDialogOpen(false)} maxWidth="md" fullWidth>
            <DialogTitle>Add New Template</DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField label="Locale" value={newLocale} onChange={e => setNewLocale(e.target.value)} />
                <TextField label="Template Type" value={newType} onChange={e => setNewType(e.target.value)} />
                <TextField label="Subject Template" fullWidth value={newSubject} onChange={e => setNewSubject(e.target.value)} />
                <Editor
                  height="300px"
                  defaultLanguage="handlebars"
                  value={newBody}
                  onChange={val => setNewBody(val || '')}
                  options={{ minimap: { enabled: false } }}
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setNewDialogOpen(false)}>Cancel</Button>
              <Button variant="contained" onClick={addNewTemplate} disabled={!newLocale || !newType}>Add</Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}
    </Box>
  );
};

export default TemplatesPanel;

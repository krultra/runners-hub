import React, { useState, useEffect } from "react";
import {
  Box,
  TextField,
  Button,
  List,
  ListItem,
  IconButton,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  listCodeList,
  addCodeListItem,
  deleteCodeListItem,
  CodeListItem
} from "../../services/codeListService";

const CodeListPanel: React.FC = () => {
  // Dialog state for editing objects and types
  const [objectsDialogOpen, setObjectsDialogOpen] = useState<boolean>(false);
  const [typesDialogOpen, setTypesDialogOpen] = useState<boolean>(false);
  const [objectsList, setObjectsList] = useState<CodeListItem[]>([]);
  const [typesListDialog, setTypesListDialog] = useState<CodeListItem[]>([]);
  const [newObjectCode, setNewObjectCode] = useState<string>('');
  const [newObjectVerbose, setNewObjectVerbose] = useState<string>('');
  const [newObjectOrder, setNewObjectOrder] = useState<number>(0);
  const [selectedObjectForType, setSelectedObjectForType] = useState<string>('');
  const [newTypeCode, setNewTypeCode] = useState<string>('');
  const [newTypeVerbose, setNewTypeVerbose] = useState<string>('');
  const [newTypeOrder, setNewTypeOrder] = useState<number>(0);
  const [loadingObjectsDialog, setLoadingObjectsDialog] = useState<boolean>(false);
  const [loadingTypesDialog, setLoadingTypesDialog] = useState<boolean>(false);

  const [objects, setObjects] = useState<CodeListItem[]>([]);
  const [types, setTypes] = useState<CodeListItem[]>([]);
  const [items, setItems] = useState<CodeListItem[]>([]);
  const [selectedObject, setSelectedObject] = useState<string>(""); // For main dropdown

  const [selectedType, setSelectedType] = useState<string>("");
  const [newCode, setNewCode] = useState<string>("");
  const [newVerbose, setNewVerbose] = useState<string>("");
  const [newOrder, setNewOrder] = useState<number>(0);
  const [loadingObjects, setLoadingObjects] = useState<boolean>(false);
  const [loadingTypes, setLoadingTypes] = useState<boolean>(false);
  const [loadingItems, setLoadingItems] = useState<boolean>(false);

  // Fetch list of available objects
  // --- Object/Type dialog logic ---
  const loadObjects = async () => {
    setLoadingObjectsDialog(true);
    const data = await listCodeList('object', 'codeLists');
    setObjectsList(data);
    setLoadingObjectsDialog(false);
  };
  const handleAddObject = async () => {
    if (!newObjectCode) return;
    if (objectsList.some(o => o.code === newObjectCode)) {
      window.alert('Object code already exists');
      return;
    }
    await addCodeListItem({ type: 'object', object: 'codeLists', code: newObjectCode, verboseName: newObjectVerbose, sortOrder: newObjectOrder });
    setNewObjectCode(''); setNewObjectVerbose(''); setNewObjectOrder(0);
    loadObjects();
  };
  const handleDeleteObject = async (id: string) => {
    await deleteCodeListItem(id);
    loadObjects();
  };
  const openObjectsDialog = () => { setObjectsDialogOpen(true); loadObjects(); };
  const closeObjectsDialog = () => {
    setObjectsDialogOpen(false);
    // Refresh objects dropdown after closing dialog
    setLoadingObjects(true);
    listCodeList("object", "codeLists").then(data => {
      setObjects(data);
      setLoadingObjects(false);
    });
  };
  const openTypesDialog = () => { setTypesDialogOpen(true); loadObjects(); setSelectedObjectForType(''); setTypesListDialog([]); };
  const closeTypesDialog = () => {
    setTypesDialogOpen(false);
    // Refresh types dropdown after closing dialog (if an object is selected)
    if (selectedObject) {
      setLoadingTypes(true);
      listCodeList("type", selectedObject).then(data => {
        setTypes(data);
        setLoadingTypes(false);
      });
    }
  };
  const loadTypesDialog = async (objectCode?: string) => {
    const obj = objectCode || selectedObjectForType;
    if (!obj) return;
    setLoadingTypesDialog(true);
    const data = await listCodeList('type', obj);
    setTypesListDialog(data);
    setLoadingTypesDialog(false);
  };
  const handleObjectForTypeChange = (code: string) => {
    setSelectedObjectForType(code);
    setNewTypeCode(''); setNewTypeVerbose(''); setNewTypeOrder(0);
    loadTypesDialog(code);
  };
  const handleAddType = async () => {
    if (!selectedObjectForType || !newTypeCode) return;
    if (typesListDialog.some(t => t.code === newTypeCode)) {
      window.alert('Type code already exists');
      return;
    }
    await addCodeListItem({ type: 'type', object: selectedObjectForType, code: newTypeCode, verboseName: newTypeVerbose, sortOrder: newTypeOrder });
    setNewTypeCode(''); setNewTypeVerbose(''); setNewTypeOrder(0);
    loadTypesDialog();
  };
  const handleDeleteType = async (id: string) => {
    await deleteCodeListItem(id);
    loadTypesDialog();
  };
  // --- End Object/Type dialog logic ---
  useEffect(() => {
    setLoadingObjects(true);
    listCodeList("object", "codeLists").then(data => {
      setObjects(data);
      setLoadingObjects(false);
    });
  }, []);

  // Fetch types when object changes
  useEffect(() => {
    if (!selectedObject) {
      setTypes([]);
      setSelectedType("");
      setItems([]);
      return;
    }
    setLoadingTypes(true);
    listCodeList("type", selectedObject).then(data => {
      setTypes(data);
      setLoadingTypes(false);
    });
    setSelectedType("");
    setItems([]);
  }, [selectedObject]);

  // Fetch items when type changes
  useEffect(() => {
    if (!selectedObject || !selectedType) {
      setItems([]);
      return;
    }
    setLoadingItems(true);
    listCodeList(selectedType, selectedObject).then(data => {
      setItems(data);
      setLoadingItems(false);
    });
  }, [selectedType, selectedObject]);

  const handleAdd = async () => {
    if (!selectedObject || !selectedType || !newCode) return;
    await addCodeListItem({ code: newCode, verboseName: newVerbose, sortOrder: newOrder, type: selectedType, object: selectedObject });
    setNewCode("");
    setNewVerbose("");
    setNewOrder(0);
    // Reload items
    listCodeList(selectedType, selectedObject).then(data => setItems(data));
  };

  return (
    <React.Fragment>
      <Box p={2} mb={2} border={1} borderColor="divider" borderRadius={1}>
      <Box mb={2} fontWeight="bold">Code List Configuration</Box>
      <Box display="flex" gap={2} mb={2}>
        <Button variant="outlined" onClick={openObjectsDialog}>Edit Objects</Button>
        <Button variant="outlined" onClick={openTypesDialog} disabled={objectsList.length===0}>Edit Types</Button>
      </Box>
      <Box display="flex" gap={2} flexWrap="wrap" mb={2}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="object-select-label">Object</InputLabel>
          <Select
            labelId="object-select-label"
            value={selectedObject}
            label="Object"
            onChange={e => setSelectedObject(e.target.value)}
            disabled={loadingObjects}
          >
            {objects.map(o => <MenuItem key={o.id} value={o.code}>{o.code}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="type-select-label">Type</InputLabel>
          <Select
            labelId="type-select-label"
            value={selectedType}
            label="Type"
            onChange={e => setSelectedType(e.target.value)}
            disabled={!selectedObject || loadingTypes}
          >
            {types.map(t => <MenuItem key={t.id} value={t.code}>{t.code}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      {selectedObject && selectedType && (
        <>
          <Box display="flex" gap={1} mb={2} flexWrap="wrap">
            <TextField label="Code" value={newCode} onChange={e => setNewCode(e.target.value)} required />
            <TextField label="Verbose Name" value={newVerbose} onChange={e => setNewVerbose(e.target.value)} />
            <TextField
              label="Order"
              type="number"
              value={newOrder}
              onChange={e => setNewOrder(Number(e.target.value))}
              sx={{ width: 100 }}
            />
            <Button variant="contained" onClick={handleAdd}>Add</Button>
          </Box>

          {loadingItems ? (
            <CircularProgress size={24} />
          ) : (
            <List dense>
              {items.map(item => (
                <ListItem
                  key={item.id}
                  secondaryAction={
                    <IconButton edge="end" onClick={() => deleteCodeListItem(item.id).then(() => listCodeList(selectedType, selectedObject).then(setItems))}>
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  {item.sortOrder != null && `[${item.sortOrder}] `}
                  <strong>{item.code}</strong> – {item.verboseName}
                </ListItem>
              ))}
            </List>
          )}
        </>
      )}
    </Box>
      {/* Edit Objects Dialog */}
      <Dialog open={objectsDialogOpen} onClose={closeObjectsDialog} fullWidth maxWidth="sm">
      <DialogTitle>Edit Objects</DialogTitle>
      <DialogContent>
        {loadingObjectsDialog ? <CircularProgress /> : (
          <>
            <Box display="flex" gap={1} mb={2}>
              <TextField label="Code" value={newObjectCode} onChange={e => setNewObjectCode(e.target.value)} size="small" />
              <TextField label="Verbose" value={newObjectVerbose} onChange={e => setNewObjectVerbose(e.target.value)} size="small" />
              <TextField label="Order" type="number" value={newObjectOrder} onChange={e => setNewObjectOrder(Number(e.target.value))} size="small" />
              <Button onClick={handleAddObject} variant="contained" size="small">Add</Button>
            </Box>
            <List dense>
              {objectsList.map(o => (
                <ListItem key={o.id} secondaryAction={<IconButton edge="end" onClick={() => handleDeleteObject(o.id)}><DeleteIcon /></IconButton>}>
                  {o.sortOrder!=null && `[${o.sortOrder}] `}<strong>{o.code}</strong> – {o.verboseName}
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={closeObjectsDialog}>Close</Button>
      </DialogActions>
    </Dialog>
      {/* Edit Types Dialog */}
      <Dialog open={typesDialogOpen} onClose={closeTypesDialog} fullWidth maxWidth="sm">
      <DialogTitle>Edit Types</DialogTitle>
      <DialogContent>
        {loadingTypesDialog ? <CircularProgress /> : (
          <>
            <FormControl fullWidth sx={{ mb:2 }}>
              <InputLabel id="dlg-object-label">Object</InputLabel>
              <Select labelId="dlg-object-label" value={selectedObjectForType} label="Object" onChange={e => handleObjectForTypeChange(e.target.value)}>
                {objectsList.map(o => <MenuItem key={o.id} value={o.code}>{o.code}</MenuItem>)}
              </Select>
            </FormControl>
            {selectedObjectForType && (
              <Box display="flex" gap={1} mb={2}>
                <TextField label="Code" value={newTypeCode} onChange={e => setNewTypeCode(e.target.value)} size="small" />
                <TextField label="Verbose" value={newTypeVerbose} onChange={e => setNewTypeVerbose(e.target.value)} size="small" />
                <TextField label="Order" type="number" value={newTypeOrder} onChange={e => setNewTypeOrder(Number(e.target.value))} size="small" />
                <Button onClick={handleAddType} variant="contained" size="small">Add</Button>
              </Box>
            )}
            <List dense>
              {typesListDialog.map(t => (
                <ListItem key={t.id} secondaryAction={<IconButton edge="end" onClick={() => handleDeleteType(t.id)}><DeleteIcon /></IconButton>}>
                  {t.sortOrder!=null && `[${t.sortOrder}] `}<strong>{t.code}</strong> – {t.verboseName}
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={closeTypesDialog}>Close</Button>
      </DialogActions>
    </Dialog>
    </React.Fragment>
  );
}

export default CodeListPanel;

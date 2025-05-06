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
  MenuItem
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  listCodeList,
  addCodeListItem,
  deleteCodeListItem,
  CodeListItem
} from "../../services/codeListService";

const CodeListPanel: React.FC = () => {
  const [objects, setObjects] = useState<CodeListItem[]>([]);
  const [types, setTypes] = useState<CodeListItem[]>([]);
  const [items, setItems] = useState<CodeListItem[]>([]);
  const [selectedObject, setSelectedObject] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [newCode, setNewCode] = useState<string>("");
  const [newVerbose, setNewVerbose] = useState<string>("");
  const [newOrder, setNewOrder] = useState<number>(0);
  const [loadingObjects, setLoadingObjects] = useState<boolean>(false);
  const [loadingTypes, setLoadingTypes] = useState<boolean>(false);
  const [loadingItems, setLoadingItems] = useState<boolean>(false);

  // Fetch list of available objects
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
    <Box p={2} mb={2} border={1} borderColor="divider" borderRadius={1}>
      <Box mb={2} fontWeight="bold">Code List Configuration</Box>
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
  );
};

export default CodeListPanel;

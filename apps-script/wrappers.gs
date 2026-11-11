function onOpen() { M4CServer.menu(); }
function editVenue() { M4CServer.openEditor(false); }
function newVenue() { M4CServer.openEditor(true); }
function photoSettings() { M4CServer.configurePhotos(); }
function seedDemo() { M4CServer.seedDemonstration(); }
function loadEditor() { return M4CServer.loadEditor(); }
function loadRecord(sheetId, rowNumber) { return M4CServer.loadRecord(sheetId, rowNumber); }
function saveRecord(input) { return M4CServer.saveRecord(input); }
function uploadPhoto(input) { return M4CServer.uploadPhoto(input); }

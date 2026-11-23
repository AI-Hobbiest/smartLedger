/* Public SPA configuration only. Never put client secrets or API keys here. */
window.SMART_LEDGER_CONFIG = Object.freeze({
  microsoftClientId: "",
  authority: "https://login.microsoftonline.com/consumers",
  redirectUri: window.location.origin + window.location.pathname,
  workbookName: "GanatheFinance.xlsx",
  /* Optional shared-workbook binding. Fill these after the owner shares one workbook with family members. */
  workbookDriveId: "",
  workbookItemId: "",
  graphBase: "https://graph.microsoft.com/v1.0",
  scopes: ["User.Read", "Files.ReadWrite"]
});

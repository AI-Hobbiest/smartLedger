/* OneDrive file repository. Excel is treated as a file, not through Graph workbook APIs. */
(function (root) {
  "use strict";
  const config = root.SMART_LEDGER_CONFIG || {};
  /* Keep the human-facing workbook intentionally small. No technical audit tabs. */
  const TX_HEADERS = ["ID","Date","Type","Description","Category","Amount","Currency","Payment Method","Paid By","Trip","Shared With","Notes"];
  const TRIP_HEADERS = ["ID","Trip","Destination","Start Date","End Date","Participants","Status"];
  const MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  class OneDriveRepository {
    constructor() {
      if (!root.msal || !root.msal.PublicClientApplication) throw new Error("Microsoft sign-in library did not load.");
      this.client = new root.msal.PublicClientApplication({
        auth: { clientId: config.microsoftClientId, authority: config.authority || "https://login.microsoftonline.com/consumers",
          redirectUri: config.redirectUri || root.location.href, navigateToLoginRequestUrl: true },
        cache: { cacheLocation: "sessionStorage" }
      });
      this.account = null;
      this.lastItem = null;
    }

    isConfigured() { return Boolean(config.microsoftClientId && config.microsoftClientId.trim()); }

    async signIn() {
      if (!this.isConfigured()) throw new Error("Microsoft sign-in is not configured yet. Add the app registration Client ID in assets/js/config.js.");
      const redirectResult = await this.client.handleRedirectPromise();
      if (redirectResult && redirectResult.account) this.account = redirectResult.account;
      if (!this.account) this.account = this.client.getAllAccounts()[0] || null;
      if (!this.account) this.account = (await this.client.loginPopup({ scopes: config.scopes || ["Files.ReadWrite"] })).account;
      return this.getProfile();
    }

    async token() {
      if (!this.account) throw new Error("Connect your Microsoft account first.");
      const request = { account: this.account, scopes: config.scopes || ["Files.ReadWrite"] };
      try { return (await this.client.acquireTokenSilent(request)).accessToken; }
      catch (error) {
        if (error && (error.name === "InteractionRequiredAuthError" || error.errorCode === "interaction_required"))
          return (await this.client.acquireTokenPopup(request)).accessToken;
        throw error;
      }
    }

    async graph(path, options) {
      const token = await this.token();
      const response = await fetch((config.graphBase || "https://graph.microsoft.com/v1.0") + path, {
        ...(options || {}), headers: { Authorization: "Bearer " + token, ...((options && options.headers) || {}) }
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        const error = new Error("OneDrive request failed (" + response.status + "). " + detail.slice(0, 240));
        error.status = response.status; throw error;
      }
      return response;
    }

    async getProfile() {
      /* Use the identity already returned by MSAL; no separate Graph profile permission is needed. */
      return { name: this.account.name || this.account.username || "Microsoft account",
        email: this.account.username || "" };
    }

    itemRoute(itemId) {
      return "/me/drive/items/" + encodeURIComponent(itemId);
    }

    async getFileMetadata() {
      /* Single-owner model: resolve the workbook in the signed-in account's own OneDrive. */
      const route = "/me/drive/root:/" + encodeURIComponent(config.workbookName || "GanatheFinance.xlsx");
      this.lastItem = await (await this.graph(route + "?$select=id,name,eTag,size,lastModifiedDateTime,parentReference")).json();
      return this.lastItem;
    }

    createWorkbook() {
      const workbook = root.XLSX.utils.book_new();
      root.XLSX.utils.book_append_sheet(workbook, root.XLSX.utils.aoa_to_sheet([TX_HEADERS]), "Transactions");
      root.XLSX.utils.book_append_sheet(workbook, root.XLSX.utils.aoa_to_sheet([TRIP_HEADERS]), "Trips");
      return workbook;
    }

    async createWorkbookInDrive() {
      const name = encodeURIComponent(config.workbookName || "GanatheFinance.xlsx");
      const bytes = root.XLSX.write(this.createWorkbook(), { bookType: "xlsx", type: "array" });
      const response = await this.graph("/me/drive/root:/" + name + ":/content", {
        method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: new Blob([bytes], { type: MIME })
      });
      this.lastItem = await response.json();
      return this.lastItem;
    }

    async ensureWorkbook() {
      try { await this.getFileMetadata(); }
      catch (error) {
        if (error.status !== 404) throw error;
        await this.createWorkbookInDrive();
      }
      return this.loadWorkbook();
    }

    async loadWorkbook() {
      const item = await this.getFileMetadata();
      const metadata = await (await this.graph(this.itemRoute(item.id) + "?$select=id,name,eTag,parentReference,@microsoft.graph.downloadUrl")).json();
      if (!metadata["@microsoft.graph.downloadUrl"]) throw new Error("OneDrive did not provide a workbook download URL.");
      const download = await fetch(metadata["@microsoft.graph.downloadUrl"]);
      if (!download.ok) throw new Error("Workbook download failed (" + download.status + ").");
      return { workbook: root.XLSX.read(await download.arrayBuffer(), { type: "array" }), item: metadata };
    }

    rows(workbook, sheetName) {
      const sheet = workbook.Sheets[sheetName];
      return sheet ? root.XLSX.utils.sheet_to_json(sheet, { defval: "" }) : [];
    }

    async saveWorkbook(workbook, item) {
      if (!item || !item.id || !item.eTag) throw new Error("Workbook version information is missing. Reload before saving.");
      const token = await this.token();
      const response = await fetch((config.graphBase || "https://graph.microsoft.com/v1.0") + this.itemRoute(item.id) + "/createUploadSession", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", "If-Match": item.eTag },
        body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "replace" } })
      });
      if (response.status === 412) { const e = new Error("Workbook changed on another device. Reloading before retry."); e.status = 412; throw e; }
      if (!response.ok) throw new Error("Could not start the OneDrive save session (" + response.status + ").");
      const session = await response.json();
      const bytes = root.XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([bytes], { type: MIME });
      const upload = await fetch(session.uploadUrl, {
        method: "PUT", headers: { "Content-Range": "bytes 0-" + (blob.size - 1) + "/" + blob.size }, body: blob
      });
      if (upload.status === 412) { const e = new Error("Workbook version conflict. Reload the latest file and retry."); e.status = 412; throw e; }
      if (!upload.ok) throw new Error("Workbook upload failed (" + upload.status + ").");
      this.lastItem = await upload.json();
      return this.lastItem;
    }

    async mutate(mutator, attempts) {
      const maxAttempts = attempts || 3;
      let lastError;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const loaded = await this.loadWorkbook();
        mutator(loaded.workbook);
        try { await this.saveWorkbook(loaded.workbook, loaded.item); return this.loadWorkbook(); }
        catch (error) {
          lastError = error;
          if (error.status !== 412 || attempt === maxAttempts - 1) throw error;
          await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
        }
      }
      throw lastError || new Error("Unable to save workbook.");
    }

    async addTransaction(transaction) {
      return this.mutate(workbook => {
        if (this.rows(workbook, "Transactions").some(row => row.ID === transaction.id)) return;
        const row = { ID: transaction.id, Date: transaction.date, Type: transaction.type,
          Description: transaction.description, Category: transaction.category, Amount: transaction.amount,
          Currency: transaction.currency, "Payment Method": transaction.paymentType || "Other",
          "Paid By": transaction.paidBy || "Me", Trip: transaction.tripId || "",
          "Shared With": transaction.sharedWith || "", Notes: transaction.notes || "" };
        root.XLSX.utils.sheet_add_json(workbook.Sheets.Transactions, [row], { header: TX_HEADERS, skipHeader: true, origin: -1 });
      });
    }

    async addTrip(trip) {
      return this.mutate(workbook => {
        if (this.rows(workbook, "Trips").some(row => row.ID === trip.id)) return;
        const row = { ID: trip.id, Trip: trip.name, Destination: trip.destination || "",
          "Start Date": trip.startDate || "", "End Date": trip.endDate || "",
          Participants: trip.members || "", Status: "Active" };
        root.XLSX.utils.sheet_add_json(workbook.Sheets.Trips, [row], { header: TRIP_HEADERS, skipHeader: true, origin: -1 });
      });
    }

    async readAll() {
      const loaded = await this.loadWorkbook();
      return { transactions: this.rows(loaded.workbook, "Transactions"), trips: this.rows(loaded.workbook, "Trips"), item: loaded.item };
    }

  }
  root.GanatheOneDrive = OneDriveRepository;
})(window);

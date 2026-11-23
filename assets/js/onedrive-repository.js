/* OneDrive file repository. Excel is treated as a file, not through Graph workbook APIs. */
(function (root) {
  "use strict";
  const config = root.SMART_LEDGER_CONFIG || {};
  const TX_HEADERS = ["TransactionID","Date","Type","Description","Category","Amount","Currency","PaymentType","PaidBy","TripID","SplitMode","SplitMembers","Notes","CreatedAt","UpdatedAt"];
  const TRIP_HEADERS = ["TripID","TripName","Destination","StartDate","EndDate","Status","Members","CreatedAt"];
  const MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  class OneDriveRepository {
    constructor() {
      if (!root.msal || !root.msal.PublicClientApplication) throw new Error("Microsoft sign-in library did not load.");
      this.client = new root.msal.PublicClientApplication({
        auth: {
          clientId: config.microsoftClientId,
          authority: config.authority || "https://login.microsoftonline.com/consumers",
          redirectUri: config.redirectUri || root.location.href,
          navigateToLoginRequestUrl: true
        },
        cache: { cacheLocation: "sessionStorage" }
      });
      this.account = null;
      this.lastItem = null;
    }

    isConfigured() { return Boolean(config.microsoftClientId && config.microsoftClientId.trim()); }
    isSharedWorkbookConfigured() { return Boolean(config.workbookDriveId && config.workbookItemId); }

    async signIn() {
      if (!this.isConfigured()) throw new Error("Microsoft sign-in is not configured yet. Add the app registration Client ID in assets/js/config.js.");
      const redirectResult = await this.client.handleRedirectPromise();
      if (redirectResult && redirectResult.account) this.account = redirectResult.account;
      if (!this.account) this.account = this.client.getAllAccounts()[0] || null;
      if (!this.account) {
        const result = await this.client.loginPopup({ scopes: config.scopes || ["User.Read", "Files.ReadWrite"] });
        this.account = result.account;
      }
      return this.getProfile();
    }

    async token() {
      if (!this.account) throw new Error("Connect your Microsoft account first.");
      const request = { account: this.account, scopes: config.scopes || ["User.Read", "Files.ReadWrite"] };
      try {
        return (await this.client.acquireTokenSilent(request)).accessToken;
      } catch (error) {
        if (error && (error.name === "InteractionRequiredAuthError" || error.errorCode === "interaction_required")) {
          return (await this.client.acquireTokenPopup(request)).accessToken;
        }
        throw error;
      }
    }

    async graph(path, options) {
      const token = await this.token();
      const response = await fetch((config.graphBase || "https://graph.microsoft.com/v1.0") + path, {
        ...(options || {}),
        headers: { Authorization: "Bearer " + token, ...((options && options.headers) || {}) }
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        const error = new Error("OneDrive request failed (" + response.status + "). " + detail.slice(0, 240));
        error.status = response.status;
        throw error;
      }
      return response;
    }

    async getProfile() {
      const profile = await (await this.graph("/me?$select=displayName,mail,userPrincipalName")).json();
      return { name: profile.displayName || profile.mail || profile.userPrincipalName || "Microsoft user", email: profile.mail || profile.userPrincipalName || "" };
    }

    itemRoute(itemId) {
      if (config.workbookDriveId) return "/drives/" + encodeURIComponent(config.workbookDriveId) + "/items/" + encodeURIComponent(itemId);
      return "/me/drive/items/" + encodeURIComponent(itemId);
    }

    async getFileMetadata() {
      let route;
      if (this.isSharedWorkbookConfigured()) {
        route = "/drives/" + encodeURIComponent(config.workbookDriveId) + "/items/" + encodeURIComponent(config.workbookItemId);
      } else {
        const name = encodeURIComponent(config.workbookName || "GanatheFinance.xlsx");
        route = "/me/drive/root:/" + name;
      }
      const response = await this.graph(route + "?$select=id,name,eTag,size,lastModifiedDateTime,parentReference");
      this.lastItem = await response.json();
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
      const workbook = this.createWorkbook();
      const bytes = root.XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const response = await this.graph("/me/drive/root:/" + name + ":/content", {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: new Blob([bytes], { type: MIME })
      });
      this.lastItem = await response.json();
      return this.lastItem;
    }

    async ensureWorkbook() {
      try {
        await this.getFileMetadata();
      } catch (error) {
        if (error.status !== 404) throw error;
        if (this.isSharedWorkbookConfigured()) {
          throw new Error("The configured shared workbook could not be found. Check that the owner shared it with this Microsoft account and that the shared workbook IDs are correct.");
        }
        await this.createWorkbookInDrive();
      }
      return this.loadWorkbook();
    }

    async loadWorkbook() {
      const item = await this.getFileMetadata();
      const route = this.itemRoute(item.id);
      const metadata = await (await this.graph(route + "?$select=id,name,eTag,parentReference,@microsoft.graph.downloadUrl")).json();
      if (!metadata["@microsoft.graph.downloadUrl"]) throw new Error("OneDrive did not provide a workbook download URL.");
      const download = await fetch(metadata["@microsoft.graph.downloadUrl"]);
      if (!download.ok) throw new Error("Workbook download failed (" + download.status + ").");
      const bytes = await download.arrayBuffer();
      return { workbook: root.XLSX.read(bytes, { type: "array" }), item: metadata };
    }

    rows(workbook, sheetName) {
      const sheet = workbook.Sheets[sheetName];
      return sheet ? root.XLSX.utils.sheet_to_json(sheet, { defval: "" }) : [];
    }

    async saveWorkbook(workbook, item) {
      if (!item || !item.id || !item.eTag) throw new Error("Workbook version information is missing. Reload before saving.");
      const token = await this.token();
      const route = this.itemRoute(item.id);
      const sessionResponse = await fetch((config.graphBase || "https://graph.microsoft.com/v1.0") + route + "/createUploadSession", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", "If-Match": item.eTag },
        body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "replace" } })
      });
      if (sessionResponse.status === 412) {
        const conflict = new Error("This workbook changed on another device. Reloading the latest version before retrying.");
        conflict.status = 412; throw conflict;
      }
      if (!sessionResponse.ok) throw new Error("Could not start the OneDrive save session (" + sessionResponse.status + ").");
      const session = await sessionResponse.json();
      const bytes = root.XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([bytes], { type: MIME });
      const upload = await fetch(session.uploadUrl, {
        method: "PUT",
        headers: { "Content-Range": "bytes 0-" + (blob.size - 1) + "/" + blob.size },
        body: blob
      });
      if (upload.status === 412) {
        const conflict = new Error("Workbook version conflict. Reload the latest file and retry.");
        conflict.status = 412; throw conflict;
      }
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
        try {
          await this.saveWorkbook(loaded.workbook, loaded.item);
          return this.loadWorkbook();
        } catch (error) {
          lastError = error;
          if (error.status !== 412 || attempt === maxAttempts - 1) throw error;
          await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
        }
      }
      throw lastError || new Error("Unable to save workbook.");
    }

    async addTransaction(transaction) {
      return this.mutate(workbook => {
        const existing = this.rows(workbook, "Transactions");
        if (existing.some(row => row.TransactionID === transaction.id)) return;
        const row = {
          TransactionID: transaction.id, Date: transaction.date, Type: transaction.type,
          Description: transaction.description, Category: transaction.category,
          Amount: transaction.amount, Currency: transaction.currency,
          PaymentType: transaction.paymentType, PaidBy: transaction.paidBy,
          TripID: transaction.tripId || "", SplitMode: transaction.splitMode || "Equal",
          SplitMembers: transaction.splitMembers || "", Notes: transaction.notes || "",
          CreatedAt: transaction.createdAt || new Date().toISOString(), UpdatedAt: new Date().toISOString()
        };
        root.XLSX.utils.sheet_add_json(workbook.Sheets.Transactions, [row], { header: TX_HEADERS, skipHeader: true, origin: -1 });
      });
    }

    async addTrip(trip) {
      return this.mutate(workbook => {
        const existing = this.rows(workbook, "Trips");
        if (existing.some(row => row.TripID === trip.id)) return;
        const row = { TripID: trip.id, TripName: trip.name, Destination: trip.destination || "",
          StartDate: trip.startDate || "", EndDate: trip.endDate || "", Status: "Active",
          Members: trip.members || "", CreatedAt: new Date().toISOString() };
        root.XLSX.utils.sheet_add_json(workbook.Sheets.Trips, [row], { header: TRIP_HEADERS, skipHeader: true, origin: -1 });
      });
    }

    async readAll() {
      const loaded = await this.loadWorkbook();
      return { transactions: this.rows(loaded.workbook, "Transactions"), trips: this.rows(loaded.workbook, "Trips"), item: loaded.item };
    }

    getSharedWorkbookReference() {
      if (!this.lastItem) return null;
      return { driveId: this.lastItem.parentReference && this.lastItem.parentReference.driveId || "", itemId: this.lastItem.id || "" };
    }
  }

  root.GanatheOneDrive = OneDriveRepository;
})(window);

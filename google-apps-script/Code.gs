/**
 * Smart Ledger Google Apps Script API
 * Phase 1 backend for the GitHub Pages PWA.
 *
 * Run setupSmartLedger() once from the bound Apps Script editor.
 * Then run createInitialAdmin("admin", "CHANGE-THIS-PASSWORD", "Household Admin")
 * once. Do not publish credentials or Script Properties.
 *
 * Deploy as Web App: Execute as Me; access Anyone.
 * All data operations require a server-issued bearer session token.
 */

const SL = {
  VERSION: "1.0.0",
  PROP_DB_ID: "SMARTLEDGER_SPREADSHEET_ID",
  PROP_SESSION_PREFIX: "SL_SESSION_",
  SESSION_TTL_SECONDS: 21600,
  SHEETS: {
    Transactions: ["id", "payload", "updatedAt"],
    Users: ["id", "payload", "updatedAt"],
    Trips: ["id", "payload", "updatedAt"],
    TripMembers: ["id", "payload", "updatedAt"],
    Budgets: ["id", "payload", "updatedAt"],
    Settings: ["key", "value", "updatedAt"],
    Lists: ["key", "value", "updatedAt"]
  },
  COLLECTIONS: ["Transactions", "Users", "Trips", "TripMembers", "Budgets"]
};

function setupSmartLedger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("Open this script from the target Google Sheet using Extensions > Apps Script.");
  PropertiesService.getScriptProperties().setProperty(SL.PROP_DB_ID, ss.getId());
  Object.keys(SL.SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = SL.SHEETS[name];
    if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  });
  return "Smart Ledger database initialised: " + ss.getUrl();
}

function createInitialAdmin(username, password, displayName) {
  if (!username || !password || String(password).length < 12) {
    throw new Error("Provide an admin username and a password of at least 12 characters.");
  }
  const db = getDb_();
  const sh = db.getSheetByName("Users");
  const rows = readCollection_("Users");
  if (rows.some(u => String(u.username || "").toLowerCase() === String(username).toLowerCase())) {
    throw new Error("That username already exists.");
  }
  const salt = Utilities.getUuid() + Utilities.getUuid();
  const user = {
    id: Utilities.getUuid(), name: displayName || "Household Admin",
    username: String(username).trim(), email: "", householdRole: "HouseholdAdmin",
    status: "Active", isTripOnly: false, authSalt: salt,
    authHash: hashPassword_(password, salt), createdAt: new Date().toISOString()
  };
  appendRecord_("Users", user);
  return "Initial administrator created. Store the credentials safely.";
}

function doGet() {
  return json_({ success: true, service: "SmartLedger_API", version: SL.VERSION, status: "ONLINE" });
}

function doPost(e) {
  try {
    const body = JSON.parse(e && e.postData && e.postData.contents || "{}");
    const action = String(body.action || "");
    if (action === "login") return json_(login_(body));
    if (action === "createUser") return json_(createUser_(requireSession_(body.token), body.user));
    if (action === "health") return json_({ success: true, status: "ONLINE", version: SL.VERSION });
    const user = requireSession_(body.token);
    if (action === "snapshot") return json_({ success: true, data: getSnapshot_(user) });
    if (action === "save") return json_(saveRecord_(user, body.collection, body.record));
    if (action === "delete") return json_(deleteRecord_(user, body.collection, body.id));
    if (action === "logout") {
      CacheService.getScriptCache().remove(SL.PROP_SESSION_PREFIX + body.token);
      return json_({ success: true });
    }
    throw new Error("Unsupported action.");
  } catch (err) {
    return json_({ success: false, error: String(err && err.message || err) });
  }
}

function login_(body) {
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  const user = readCollection_("Users").find(u => String(u.username || "").toLowerCase() === username);
  if (!user || user.status !== "Active" || !user.authSalt || hashPassword_(password, user.authSalt) !== user.authHash) {
    throw new Error("Invalid username or password.");
  }
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put(SL.PROP_SESSION_PREFIX + token, user.id, SL.SESSION_TTL_SECONDS);
  return { success: true, token: token, expiresIn: SL.SESSION_TTL_SECONDS,
    user: publicUser_(user) };
}

function requireSession_(token) {
  if (!token) throw new Error("Sign in required.");
  const id = CacheService.getScriptCache().get(SL.PROP_SESSION_PREFIX + token);
  if (!id) throw new Error("Session expired. Sign in again.");
  const user = readCollection_("Users").find(u => u.id === id && u.status === "Active");
  if (!user) throw new Error("User is inactive or unavailable.");
  return user;
}

function getSnapshot_(user) {
  const data = {
    schemaVersion: 2,
    transactions: readCollection_("Transactions"),
    trips: readCollection_("Trips"),
    tripMembers: readCollection_("TripMembers"),
    users: readCollection_("Users").map(publicUser_),
    budgets: readCollection_("Budgets"),
    updatedAt: new Date().toISOString()
  };
  const admin = isAdmin_(user);
  const memberships = data.tripMembers;
  const visibleTrips = data.trips.filter(t => admin || memberships.some(m =>
    m.tripId === t.id && m.userId === user.id && (m.membershipStatus || "Active") === "Active"));
  const tripIds = new Set(visibleTrips.map(t => t.id));
  data.trips = visibleTrips;
  data.tripMembers = memberships.filter(m => tripIds.has(m.tripId) && (admin || m.userId === user.id));
  data.transactions = data.transactions.filter(t => {
    if (t.tripId) return tripIds.has(t.tripId);
    return admin || t.spentByUserId === user.id;
  });
  if (!admin) {
    const visibleUserIds = new Set([user.id]);
    data.tripMembers.forEach(m => visibleUserIds.add(m.userId));
    data.users = data.users.filter(u => visibleUserIds.has(u.id));
    data.budgets = [];
  }
  return data;
}

function saveRecord_(user, collection, record) {
  if (!SL.COLLECTIONS.includes(collection)) throw new Error("Invalid collection.");
  if (!record || !record.id) throw new Error("Record ID is required.");
  const admin = isAdmin_(user);
  if (collection === "Users" && !admin) throw new Error("Administrator permission required.");
  if (collection === "Trips" && !admin) throw new Error("Administrator permission required.");
  if (collection === "Budgets" && !admin) throw new Error("Administrator permission required.");
  if (collection === "Transactions") {
    if (!admin && record.spentByUserId !== user.id && !record.tripId) throw new Error("You can only record your own personal transactions.");
    if (!admin && record.recordedByUserId && record.recordedByUserId !== user.id) throw new Error("Invalid recorded-by user.");
  }
  if (collection === "TripMembers" && !admin) throw new Error("Administrator permission required.");
  const safeRecord = Object.assign({}, record);
  if (collection === "Users") {
    delete safeRecord.authHash; delete safeRecord.authSalt;
  }
  upsertRecord_(collection, safeRecord);
  return { success: true, saved: { id: safeRecord.id, collection: collection } };
}

function createUser_(actor, input) {\n  if (!isAdmin_(actor)) throw new Error("Administrator permission required.");\n  if (!input || !input.username || !input.password || String(input.password).length < 12) throw new Error("Username and a password of at least 12 characters are required.");\n  const users = readCollection_("Users");\n  if (users.some(u => String(u.username || "").toLowerCase() === String(input.username).trim().toLowerCase())) throw new Error("Username already exists.");\n  const salt = Utilities.getUuid() + Utilities.getUuid();\n  const user = { id: Utilities.getUuid(), name: String(input.name || input.username).trim(), username: String(input.username).trim(), email: String(input.email || "").trim(), householdRole: input.householdRole === "HouseholdAdmin" ? "HouseholdMember" : "HouseholdMember", status: "Active", isTripOnly: false, authSalt: salt, authHash: hashPassword_(input.password, salt), createdAt: new Date().toISOString() };\n  appendRecord_("Users", user);\n  return { success: true, user: publicUser_(user) };\n}\n\nfunction deleteRecord_(user, collection, id) {
  if (!SL.COLLECTIONS.includes(collection)) throw new Error("Invalid collection.");
  if (!isAdmin_(user) && collection !== "Transactions") throw new Error("Administrator permission required.");
  if (collection === "Transactions" && !isAdmin_(user)) {
    const row = readCollection_("Transactions").find(t => t.id === id);
    if (!row || row.spentByUserId !== user.id || row.recordedByUserId !== user.id || row.tripId) {
      throw new Error("You cannot delete this transaction.");
    }
  }
  const sh = getDb_().getSheetByName(collection);
  const values = sh.getDataRange().getValues();
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][0]) === String(id)) { sh.deleteRow(i + 1); return { success: true, deleted: id }; }
  }
  throw new Error("Record not found.");
}

function readCollection_(name) {
  const sh = getDb_().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues()
    .filter(r => r[0] !== "").map(r => JSON.parse(r[1]));
}

function appendRecord_(name, record) {
  const sh = getDb_().getSheetByName(name);
  sh.appendRow([record.id, JSON.stringify(record), new Date().toISOString()]);
}

function upsertRecord_(name, record) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = getDb_().getSheetByName(name);
    const values = sh.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(record.id)) {
        sh.getRange(i + 1, 1, 1, 3).setValues([[record.id, JSON.stringify(record), new Date().toISOString()]]);
        return;
      }
    }
    appendRecord_(name, record);
  } finally { lock.releaseLock(); }
}

function getDb_() {
  const id = PropertiesService.getScriptProperties().getProperty(SL.PROP_DB_ID);
  if (!id) throw new Error("Database not initialised. Run setupSmartLedger() first.");
  return SpreadsheetApp.openById(id);
}

function isAdmin_(user) { return ["HouseholdAdmin", "Admin"].includes(user.householdRole || user.role); }
function publicUser_(user) {
  const copy = Object.assign({}, user);
  delete copy.authHash; delete copy.authSalt;
  return copy;
}
function hashPassword_(password, salt) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + String(password), Utilities.Charset.UTF_8);
  return Utilities.base64Encode(bytes);
}
function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

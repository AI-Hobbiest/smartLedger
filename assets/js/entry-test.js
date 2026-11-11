(() => {
  const KEY = "smartLedger.entryTest.v1";
  const $ = (id) => document.getElementById(id);
  const expenseCategories = ["Food/EatOut","Grocery","Apparel","Devotional","Travel","Misc/Others","Spiritual","Investments"];
  const incomeCategories = ["Salary","Other Income","Refund","Misc/Others"];
  let records = [];
  try { records = JSON.parse(localStorage.getItem(KEY) || "[]"); if (!Array.isArray(records)) records = []; } catch { records = []; }
  const today = new Date();
  $("date").value = new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);
  const selectedType = () => document.querySelector('input[name="type"]:checked').value;
  function fillCategories() {
    const list = selectedType() === "Income" ? incomeCategories : expenseCategories;
    $("category").innerHTML = list.map(v => '<option value="'+v+'">'+v+'</option>').join("");
    document.querySelectorAll(".type-option").forEach(el => el.classList.toggle("active", el.dataset.type === selectedType()));
  }
  function fxUpdate() {
    const currency = $("currency").value;
    $("currency-prefix").textContent = currency;
    $("fx-row").hidden = currency === "AED";
    const amount = Number($("amount").value || 0);
    const rate = currency === "AED" ? 1 : Number($("fx-rate").value || 0);
    $("base-amount").value = amount && rate ? (amount*rate).toFixed(2) : "—";
  }
  function persist() { localStorage.setItem(KEY, JSON.stringify(records)); render(); }
  function money(value, currency="AED") { return currency+" "+Number(value).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function render() {
    $("total-count").textContent = records.length;
    const expense = records.filter(r=>r.type==="Expense").reduce((s,r)=>s+r.baseAmount,0);
    const income = records.filter(r=>r.type==="Income").reduce((s,r)=>s+r.baseAmount,0);
    $("total-expense").textContent = money(expense);
    $("total-income").textContent = money(income);
    const body = $("entries");
    if (!records.length) { body.innerHTML='<tr class="empty"><td colspan="7">No entries yet. Add one above or load the sample entries.</td></tr>'; return; }
    body.innerHTML = records.slice().reverse().map(r => {
      const amt = (r.type==="Income"?"+":"−")+money(r.amount,r.currency);
      return '<tr><td>'+r.date+'</td><td><span class="desc">'+escapeHtml(r.description)+'</span><span class="subdesc">'+r.type+(r.notes?' · '+escapeHtml(r.notes):'')+'</span></td><td>'+escapeHtml(r.category)+'</td><td>'+escapeHtml(r.spentByLabel)+'</td><td>'+escapeHtml(r.payment)+'</td><td class="right '+(r.type==="Income"?"amount-income":"amount-expense")+'">'+amt+'</td><td><button class="delete-row" data-id="'+r.id+'" aria-label="Delete transaction">×</button></td></tr>';
    }).join("");
    body.querySelectorAll(".delete-row").forEach(btn => btn.addEventListener("click",()=>{records=records.filter(r=>r.id!==btn.dataset.id);persist();}));
  }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  document.querySelectorAll('input[name="type"]').forEach(el=>el.addEventListener("change",fillCategories));
  ["currency","amount","fx-rate"].forEach(id=>$(id).addEventListener("input",fxUpdate));
  $("currency").addEventListener("change",fxUpdate);
  $("transaction-form").addEventListener("submit",e=>{
    e.preventDefault();
    const type=selectedType(), currency=$("currency").value, amount=Number($("amount").value), rate=currency==="AED"?1:Number($("fx-rate").value);
    if(!amount||amount<=0||!rate||rate<=0){$("form-message").textContent="Enter a valid amount and exchange rate.";return;}
    const user=$("spent-by"), rec={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),date:$("date").value,type,amount,currency,fxRateToBase:rate,baseAmount:amount*rate,category:$("category").value,description:$("description").value.trim(),payment:$("payment").value,spentBy:user.value,spentByLabel:user.options[user.selectedIndex].text,recordedBy:"TEST_USER_1",tripId:"",notes:$("notes").value.trim(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    if(!rec.date||!rec.description){$("form-message").textContent="Please complete the required fields.";return;}
    records.push(rec);persist();$("form-message").textContent="Added to this browser's test ledger. Not synced to OneDrive.";
    $("amount").value="";$("description").value="";$("notes").value="";fxUpdate();$("description").focus();
  });
  $("load-samples").addEventListener("click",()=>{
    const base=new Date(); const d=n=>new Date(base.getTime()-n*86400000).toISOString().slice(0,10);
    const samples=[
      {type:"Expense",date:d(0),amount:86.5,currency:"AED",fxRateToBase:1,baseAmount:86.5,category:"Grocery",description:"Weekly groceries",payment:"Debit Card",spentBy:"TEST_USER_1",spentByLabel:"Test User 1",recordedBy:"TEST_USER_1",tripId:"",notes:"Sample household purchase"},
      {type:"Expense",date:d(1),amount:1250,currency:"INR",fxRateToBase:0.044,baseAmount:55,category:"Travel",description:"Chennai airport taxi",payment:"Digital Wallet",spentBy:"TEST_USER_2",spentByLabel:"Test User 2",recordedBy:"TEST_USER_1",tripId:"",notes:"Foreign currency example"},
      {type:"Income",date:d(2),amount:500,currency:"AED",fxRateToBase:1,baseAmount:500,category:"Other Income",description:"Reimbursement",payment:"Bank Transfer",spentBy:"TEST_USER_1",spentByLabel:"Test User 1",recordedBy:"TEST_USER_1",tripId:"",notes:"Sample income entry"}
    ];
    samples.forEach(s=>{s.id=crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random());s.createdAt=new Date().toISOString();s.updatedAt=s.createdAt;});
    records.push(...samples);persist();$("form-message").textContent="3 sample entries added. You can delete them individually or clear all test data.";
  });
  $("clear-all").addEventListener("click",()=>{if(!records.length)return;if(confirm("Clear all test entries saved in this browser?")){records=[];persist();$("form-message").textContent="Test entries cleared."; }});
  $("export-csv").addEventListener("click",()=>{
    if(!records.length){$("form-message").textContent="There are no entries to export yet.";return;}
    const headers=["TransactionID","Date","Type","Amount","Currency","FXRateToBase","BaseAmount","Category","Description","PaymentType","SpentByUserID","RecordedByUserID","TripID","Notes","CreatedAt","UpdatedAt"];
    const rows=records.map(r=>[r.id,r.date,r.type,r.amount,r.currency,r.fxRateToBase,r.baseAmount,r.category,r.description,r.payment,r.spentBy,r.recordedBy,r.tripId,r.notes,r.createdAt,r.updatedAt]);
    const csv=[headers,...rows].map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="SmartLedger_Test_Transactions.csv";a.click();URL.revokeObjectURL(url);
  });
  fillCategories();fxUpdate();render();
})();
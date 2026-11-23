(() => {
  const KEY = "smartLedger.entryTest.v1";
  const $ = id => document.getElementById(id);
  const categories = ["Food/EatOut","Grocery","Apparel","Devotional","Travel","Misc/Others","Spiritual","Investments","Salary","Other Income","Refund"];
  const payments = ["Cash","Debit Card","Credit Card","Bank Transfer","Digital Wallet","Other"];
  let pending = null, pendingCard = null, pendingConversation = null, lastReportQuery = null, lastSavedId = null;
  const context = window.SmartLedgerContext.create();
  const localISO = d => { const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0"); return y+"-"+m+"-"+day; };
  const todayISO = () => localISO(new Date());
  const readRecords = () => { try { const v=JSON.parse(localStorage.getItem(KEY)||"[]"); return Array.isArray(v)?v:[]; } catch { return []; } };
  const writeRecords = rows => localStorage.setItem(KEY,JSON.stringify(rows));
  const escapeHtml = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const addMessage = (text,who="assistant") => {
    if(!Array.isArray(window.SmartLedgerConversationHistory))window.SmartLedgerConversationHistory=[];
    window.SmartLedgerConversationHistory.push({role:who==="user"?"user":"assistant",content:String(text||"").slice(0,1500)});
    if(window.SmartLedgerConversationHistory.length>12)window.SmartLedgerConversationHistory.shift();
    const el=document.createElement("div"); el.className="message "+who;
    const bubble=document.createElement("div"); bubble.className="bubble"; bubble.textContent=text;
    const time=document.createElement("time"); time.textContent=who==="user"?"You":"Smart Ledger";
    el.append(bubble,time); $("chat").append(el); $("chat").scrollTop=$("chat").scrollHeight;
  };
  const updateCount = () => $("entry-count").textContent=readRecords().length;
  const parseDate = text => {
    const t=text.toLowerCase(), now=new Date();
    if(t.includes("day before yesterday")){now.setDate(now.getDate()-2);return localISO(now);}
    if(t.includes("yesterday")){now.setDate(now.getDate()-1);return localISO(now);}
    if(t.includes("tomorrow")){now.setDate(now.getDate()+1);return localISO(now);}
    const m=t.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
    if(m){let y=m[3]?Number(m[3]):now.getFullYear();if(y<100)y+=2000;const d=new Date(y,Number(m[2])-1,Number(m[1]));if(!Number.isNaN(d.getTime()))return localISO(d);}
    return todayISO();
  };
  const inferCategory = (text,type,merchant) => {
    const t=(text+" "+merchant).toLowerCase();
    if(type==="Income"){if(/salary|payroll/.test(t))return "Salary";if(/refund|reimburs/.test(t))return "Refund";return "Other Income";}
    if(/groc|groceir|supermarket|carrefour|lulu|hypermarket|vegetable|milk/.test(t))return "Grocery";
    if(/taxi|uber|careem|flight|airport|metro|fuel|petrol|bus|train/.test(t))return "Travel";
    if(/temple|hundi|donation|offering/.test(t))return "Spiritual";
    if(/shirt|shoe|clothes|apparel|dress/.test(t))return "Apparel";
    if(/lunch|dinner|breakfast|coffee|restaurant|food|snack/.test(t))return "Food/EatOut";
    return "Misc/Others";
  };
  const parse = raw => {
    const text=raw.trim(), lower=text.toLowerCase();
    const amountMatch=lower.match(/(?:\b(?:aed|dhs?|dirhams?|inr|rs\.?|rupees?|usd|\$|omr|sgd|eur|gbp)\s*)?([0-9][0-9,]*(?:\.\d{1,2})?)(?:\s*(?:aed|dhs?|dirhams?|inr|rs\.?|rupees?|usd|\$|omr|sgd|eur|gbp))?/i);
    if(!amountMatch)return {error:"I couldn't find an amount. Please include a number, for example “45 AED”."};
    const amount=Number(amountMatch[1].replace(/,/g,""));
    if(!amount||amount<=0)return {error:"Please provide an amount greater than zero."};
    const around=lower.slice(Math.max(0,amountMatch.index-15),amountMatch.index+amountMatch[0].length+15);
    const currencyMatch=around.match(/\b(aed|dhs?|dirhams?|inr|rs\.?|rupees?|usd|omr|sgd|eur|gbp)\b|\$/i);
    let currency="AED"; if(currencyMatch){const c=currencyMatch[0].toLowerCase();currency=/^(inr|rs\.?|rupees?)$/.test(c)?"INR":c==="usd"||c==="$"?"USD":c==="omr"?"OMR":c==="sgd"?"SGD":c==="eur"?"EUR":c==="gbp"?"GBP":"AED";}
    const type=/\b(received|salary|income|earned|credited|reimbursement|refund)\b/.test(lower)?"Income":"Expense";
    const payment=/credit card|cc\b/.test(lower)?"Credit Card":/debit card/.test(lower)?"Debit Card":/cash/.test(lower)?"Cash":/bank transfer|transferred/.test(lower)?"Bank Transfer":/wallet|apple pay|google pay/.test(lower)?"Digital Wallet":"Other";
    const clean=text.replace(amountMatch[0]," ").replace(/\b(i|we|my|our|spent|paid|for|on|at|in|using|with|today|yesterday|tomorrow|day before yesterday|received|salary|income|earned|credited|reimbursement|refund|expense|of)\b/gi," ").replace(/\b(aed|dhs?|dirhams?|inr|rs\.?|rupees?|usd|omr|sgd|eur|gbp)\b|\$/gi," ").replace(/\s+/g," ").trim();
    const merchant=clean.replace(/\b(credit card|debit card|bank transfer|digital wallet|cash|wallet)\b/gi,"").trim();
    const description=merchant?merchant.charAt(0).toUpperCase()+merchant.slice(1):type==="Income"?"Income":"Expense";
    const fx=currency==="AED"?1:currency==="INR"?0.044:currency==="USD"?3.6725:currency==="OMR"?9.55:currency==="SGD"?2.75:currency==="EUR"?3.95:4.65;
    return {date:parseDate(text),type,amount,currency,fxRateToBase:fx,baseAmount:amount*fx,category:inferCategory(text,type,merchant),description,payment,spentBy:"TEST_USER_1",spentByLabel:"Test User 1",notes:"",original:text};
  };
  const moneyAED = value => "AED "+Number(value||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  const reportIntent = text => {
    const t=text.toLowerCase();
    const monthYear=/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*['’]?\s*\d{2,4}\b|\b\d{4}\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i.test(t);
    return /\b(summary|summar(y|ise|ize)|report|breakdown|how much|total|show|list|what did i spend|transactions?)\b/i.test(t)
      || (/\b(expense|expenses|expnse|expence|expens|spend|spending|outgoings?)\b/i.test(t) && (/\b(today|yesterday|this week|last week|this month|last month|last 7 days|past 7 days)\b/i.test(t) || /\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b/.test(t) || monthYear));
  };
  const reportRange = text => {
    const period=window.SmartLedgerContext.extractPeriod(text);
    if(period)return {from:period.from,to:period.to};
    const now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    return {from:localISO(start),to:localISO(start)};
  };
  const answerReport = (text, reportContext=null) => {
    lastReportQuery=text;
    const spec=reportContext||context.getReport();
    const range=spec&&spec.period?{from:spec.period.from,to:spec.period.to}:reportRange(text);
    const filters=spec&&spec.filters?spec.filters:{};
    const all=readRecords();
    let rows=all.filter(r=>r.date>=range.from&&r.date<=range.to);
    if(filters.type && filters.type!=="All")rows=rows.filter(r=>r.type===filters.type);
    if(filters.category)rows=rows.filter(r=>(r.category||"Misc/Others")===filters.category);
    if(filters.payment)rows=rows.filter(r=>(r.payment||"Other")===filters.payment);
    const expenses=rows.filter(r=>r.type==="Expense"), incomes=rows.filter(r=>r.type==="Income");
    const base=r=>Number.isFinite(Number(r.baseAmount))?Number(r.baseAmount):Number(r.amount||0)*Number(r.fxRateToBase||1);
    const expenseTotal=expenses.reduce((sum,r)=>sum+base(r),0), incomeTotal=incomes.reduce((sum,r)=>sum+base(r),0);
    const net=incomeTotal-expenseTotal;
    const label=range.from===range.to?range.from:range.from+" to "+range.to;
    if(!rows.length){addMessage("I couldn't find any saved transactions matching that request for "+label+". Try widening the date range or removing a filter.");return;}
    const lines=["Your ledger summary · "+label];
    if(filters.type==="Expense")lines.push("","Expenses: "+moneyAED(expenseTotal)+" ("+expenses.length+" entries)");
    else if(filters.type==="Income")lines.push("","Income: "+moneyAED(incomeTotal)+" ("+incomes.length+" entries)");
    else lines.push("","Expenses: "+moneyAED(expenseTotal)+" ("+expenses.length+" entries)","Income: "+moneyAED(incomeTotal)+" ("+incomes.length+" entries)","Net: "+(net<0?"−":"+")+moneyAED(Math.abs(net)));
    if(expenses.length && (!filters.groupBy || filters.groupBy==="category")){
      const byCategory={};expenses.forEach(r=>{const key=r.category||"Uncategorised";byCategory[key]=(byCategory[key]||0)+base(r);});
      lines.push("","Expense breakdown:");
      Object.entries(byCategory).sort((x,y)=>y[1]-x[1]).forEach(([key,value])=>lines.push("• "+key+": "+moneyAED(value)));
    }
    if(filters.groupBy==="payment" && rows.length){
      const byPayment={};rows.forEach(r=>{const key=r.payment||"Other";byPayment[key]=(byPayment[key]||0)+base(r);});
      lines.push("","Payment breakdown:");
      Object.entries(byPayment).sort((x,y)=>y[1]-x[1]).forEach(([key,value])=>lines.push("• "+key+": "+moneyAED(value)));
    }
    const expenseOnly=filters.type==="Expense" || (/\b(expense|expenses|spent|spend|spending)\b/i.test(text)&&!filters.type);
    const shown=(expenseOnly?expenses:rows).slice().sort((x,y)=>(y.date||"").localeCompare(x.date||"")).slice(0,8);
    if(shown.length){lines.push("","Transactions"+(shown.length===8?" (latest 8)":"")+":");shown.forEach(r=>lines.push("• "+r.date+" · "+(r.description||r.category||"Transaction")+" · "+r.currency+" "+Number(r.amount||0).toFixed(2)+" ("+moneyAED(base(r))+")"));}
    addMessage(lines.join("\n"));
  };
  const dateLabel = value => {
    if(!value)return "Date not set";
    if(value===todayISO())return "Today";
    const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
    if(value===localISO(yesterday))return "Yesterday";
    const parts=value.split("-").map(Number);
    const parsed=new Date(parts[0],parts[1]-1,parts[2]);
    return Number.isNaN(parsed.getTime())?value:parsed.toLocaleDateString(undefined,{day:"numeric",month:"short",year:parts[0]===new Date().getFullYear()?undefined:"numeric"});
  };
  const currencyLabel = (currency,amount) => String(currency||"AED")+" "+Number(amount||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  const paymentLabel = value => value==="Other"?"Other / Not sure":value||"Payment not specified";
  const transactionAcknowledgement = draft => {
    const amount=currencyLabel(draft.currency,draft.amount);
    const description=(draft.description||"transaction").toLowerCase();
    if(draft.type==="Income"){
      return "Got it — I’ve prepared an income entry for "+amount+(draft.description&&draft.description!=="Transaction"?" ("+draft.description+")":"")+". Please check the summary below and confirm when you’re ready.";
    }
    return "Got it — I’ve prepared an expense for "+amount+" on "+description+". "+(paymentLabel(draft.payment)==="Payment not specified"?"The payment method wasn’t included, so I’ve left a quick selector in the confirmation below. ":"")+"Please check the summary and confirm when you’re ready.";
  };
  const renderReview = draft => {
    pending=draft;context.setPending(draft);
    let paymentChosen=payments.includes(draft.payment)&&draft.payment!=="Other";
    const wrapper=document.createElement("div");wrapper.className="message assistant";
    const card=document.createElement("div");card.className="review-card compact-review";
    const options=(arr,selected)=>arr.map(v=>'<option '+(v===selected?'selected':'')+' value="'+escapeHtml(v)+'">'+escapeHtml(v)+'</option>').join("");
    card.innerHTML=
      '<div class="review-head"><b>Review entry</b><span>DRAFT · NOT SAVED</span></div>'+
      '<div class="compact-review-summary">'+
        '<div class="compact-review-top"><span class="review-kind" id="review-type-label">'+escapeHtml(draft.type.toUpperCase())+'</span><strong id="review-amount-label">'+escapeHtml(currencyLabel(draft.currency,draft.amount))+'</strong></div>'+
        '<div class="review-description" id="review-description-label">'+escapeHtml(draft.description||"Transaction")+'</div>'+
        '<div class="review-meta"><span id="review-date-label">'+escapeHtml(dateLabel(draft.date))+'</span><span id="review-category-label">'+escapeHtml(draft.category||"Uncategorised")+'</span><span id="review-payment-label"'+(paymentChosen?"":' hidden')+'>'+escapeHtml(paymentLabel(draft.payment))+'</span></div>'+
        (!paymentChosen?'<div class="compact-payment-field" id="compact-payment-field"><label for="quick-payment">Payment method <small>Required · choose before saving</small></label><select id="quick-payment" required aria-required="true"><option value="" selected>Choose payment method</option>'+payments.map(v=>'<option value="'+escapeHtml(v)+'">'+escapeHtml(v==="Other"?"Other / Not sure":v)+'</option>').join("")+'</select></div>':"")+
      '</div>'+
      '<div class="review-actions compact-review-actions"><button class="confirm-btn" id="confirm-entry" type="button">Confirm</button><button class="edit-cancel" id="edit-entry" type="button">Edit details</button><button class="edit-cancel" id="cancel-entry" type="button">Cancel</button></div>'+
      '<div class="review-edit-fields" id="review-edit-fields" hidden>'+
        '<div class="review-grid">'+
          '<label>Type<select id="r-type">'+options(["Expense","Income"],draft.type)+'</select></label>'+
          '<label>Date<input id="r-date" type="date" value="'+escapeHtml(draft.date)+'"></label>'+
          '<label>Amount<input id="r-amount" type="number" min="0.01" step="0.01" value="'+draft.amount+'"></label>'+
          '<label>Currency<select id="r-currency">'+options(["AED","INR","USD","OMR","SGD","EUR","GBP"],draft.currency)+'</select></label>'+
          '<label>Category<select id="r-category">'+options(categories,draft.category)+'</select></label>'+
          '<label class="wide fx-field" id="r-rate-field"'+(draft.currency==="AED"?" hidden":"")+'>FX rate to AED<input id="r-rate" type="number" min="0.000001" step="any" value="'+draft.fxRateToBase+'"></label>'+
          '<label>Payment<select id="r-payment" required>'+(paymentChosen?"":'<option value="" selected>Choose payment method</option>')+options(payments,paymentChosen?draft.payment:"")+'</select></label>'+
          '<label class="wide">Description<input id="r-description" maxlength="120" value="'+escapeHtml(draft.description)+'"></label>'+
          '<label class="wide">Spent by<select id="r-spent">'+options(["TEST_USER_1","TEST_USER_2","TEST_USER_3"],draft.spentBy)+'</select></label>'+
          '<label class="wide">Notes<input id="r-notes" maxlength="500" value="'+escapeHtml(draft.notes)+'" placeholder="Optional notes"></label>'+
        '</div><div id="base-preview" class="base-preview"></div>'+
      '</div>';
    wrapper.append(card);$("chat").append(wrapper);pendingCard=card;$("chat").scrollTop=$("chat").scrollHeight;
    const editFields=$("review-edit-fields");
    const readDraft=()=>{
      const currency=$("r-currency").value,amount=Number($("r-amount").value||0),rate=currency==="AED"?1:Number($("r-rate").value||0);
      const quickPayment=$("quick-payment"),payment=quickPayment&&quickPayment.value?quickPayment.value:$("r-payment").value;
      return {type:$("r-type").value,date:$("r-date").value,amount,currency,fxRateToBase:rate,baseAmount:amount*rate,category:$("r-category").value,payment,description:$("r-description").value.trim(),spentBy:$("r-spent").value,spentByLabel:$("r-spent").options[$("r-spent").selectedIndex].text,notes:$("r-notes").value.trim()};
    };
    const syncSummary=()=>{
      const value=readDraft();
      $("review-type-label").textContent=value.type.toUpperCase();
      $("review-amount-label").textContent=currencyLabel(value.currency,value.amount);
      $("review-description-label").textContent=value.description||"Description needed";
      $("review-date-label").textContent=dateLabel(value.date);
      $("review-category-label").textContent=value.category;
      const paymentSummary=$("review-payment-label");if(paymentSummary){paymentSummary.textContent=paymentLabel(value.payment);paymentSummary.hidden=!paymentChosen;}
      const quickPaymentField=$("compact-payment-field");if(quickPaymentField)quickPaymentField.hidden=paymentChosen;
      $("r-rate-field").hidden=value.currency==="AED";
      $("base-preview").textContent=value.currency==="AED"?"Base amount: AED "+value.baseAmount.toFixed(2):"Estimated base amount: AED "+value.baseAmount.toFixed(2)+" · Verify the exchange rate before saving.";
      return value;
    };
    const quickPayment=$("quick-payment");
    const updateEditPreview=event=>{
      if(event&&event.target&&event.target.id==="r-payment"){
        paymentChosen=!!event.target.value;
        if(quickPayment)quickPayment.value=paymentChosen?event.target.value:"";
      }
      syncSummary();
    };
    if(quickPayment)quickPayment.addEventListener("change",()=>{
      paymentChosen=!!quickPayment.value;
      $("r-payment").value=paymentChosen?quickPayment.value:"";
      syncSummary();
    });
    ["r-type","r-date","r-amount","r-currency","r-category","r-payment","r-description","r-spent","r-notes","r-rate"].forEach(id=>{
      $(id).addEventListener("input",updateEditPreview);
      $(id).addEventListener("change",updateEditPreview);
    });
    $("r-currency").addEventListener("change",()=>{
      const rates={AED:1,INR:0.044,USD:3.6725,OMR:9.55,SGD:2.75,EUR:3.95,GBP:4.65};
      $("r-rate").value=rates[$("r-currency").value];syncSummary();
    });
    $("edit-entry").addEventListener("click",()=>{
      editFields.hidden=!editFields.hidden;
      card.classList.toggle("is-editing",!editFields.hidden);
      $("edit-entry").textContent=editFields.hidden?"Edit details":"Hide details";
      if(!editFields.hidden){const quickPayment=$("quick-payment");$("r-payment").value=quickPayment&&quickPayment.value?quickPayment.value:($("r-payment").value||"");syncSummary();}
    });
    $("confirm-entry").addEventListener("click",()=>{
      const value=readDraft();
      if(!paymentChosen||!value.payment){
        addMessage("One detail before I save this: which payment method did you use? Please choose cash, debit card, credit card, bank transfer, digital wallet, or Other / Not sure.");
        if(quickPayment){quickPayment.focus();}
        else{$("edit-entry").click();$("r-payment").focus();}
        return;
      }
      if(!value.amount||value.amount<=0||!value.date||!value.description||!value.fxRateToBase||value.fxRateToBase<=0){addMessage("Please check the amount, date, description and exchange rate before saving.");return;}
      const rows=readRecords(),now=new Date().toISOString();
      const rec={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),date:value.date,type:value.type,amount:value.amount,currency:value.currency,fxRateToBase:value.fxRateToBase,baseAmount:value.baseAmount,category:value.category,description:value.description,payment:value.payment,spentBy:value.spentBy,spentByLabel:value.spentByLabel,recordedBy:"TEST_USER_1",tripId:"",notes:value.notes,createdAt:now,updatedAt:now};
      rows.push(rec);writeRecords(rows);lastSavedId=rec.id;context.setLastTransaction(rec.id);
      card.className="review-card compact-review saved-review";
      card.innerHTML='<div class="review-head"><b>Saved to test ledger</b><span>CONFIRMED</span></div><div class="compact-review-summary"><div class="compact-review-top"><span class="review-kind">SAVED</span><strong>'+escapeHtml(currencyLabel(rec.currency,rec.amount))+'</strong></div><div class="review-description">'+escapeHtml(rec.description)+'</div><div class="review-meta"><span>'+escapeHtml(dateLabel(rec.date))+'</span><span>'+escapeHtml(rec.category)+'</span></div></div>';
      pending=null;pendingCard=null;context.setPending(null);updateCount();
      addMessage("All set — I’ve saved that entry to your local test ledger. It hasn’t synced to OneDrive.");
      $("chat").scrollTop=$("chat").scrollHeight;
    });
    $("cancel-entry").addEventListener("click",()=>{
      card.className="review-card compact-review";
      card.innerHTML='<div class="review-head"><b>Draft cancelled</b><span>NOT SAVED</span></div><p class="compact-cancel-note">No changes were saved. You can describe the transaction again whenever you’re ready.</p>';
      pending=null;pendingCard=null;context.setPending(null);
    });
  };
  const renderBatchReview = drafts => {
    pending=drafts;context.setPending(drafts);
    const wrapper=document.createElement("div");wrapper.className="message assistant";
    const card=document.createElement("div");card.className="review-card batch-review compact-review";
    const options=(arr,selected)=>arr.map(v=>'<option '+(v===selected?'selected':'')+' value="'+escapeHtml(v)+'">'+escapeHtml(v)+'</option>').join("");
    const paymentOptions=selected=>(selected&&selected!=="Other"?options(payments,selected):'<option value="" selected>Choose payment method</option>'+options(payments,""));
    const currencies=["AED","INR","USD","OMR","SGD","EUR","GBP"];
    const people=["TEST_USER_1","TEST_USER_2","TEST_USER_3"];
    const entries=drafts.map((draft,index)=>'<section class="batch-entry"><div class="batch-entry-head"><b>Transaction '+(index+1)+'</b><span>'+escapeHtml(draft.source||"DRAFT")+'</span></div>'+
      '<div class="review-grid">'+
      '<label>Type<select id="b-type-'+index+'">'+options(["Expense","Income"],draft.type)+'</select></label>'+
      '<label>Date<input id="b-date-'+index+'" type="date" value="'+escapeHtml(draft.date)+'"></label>'+
      '<label>Amount<input id="b-amount-'+index+'" type="number" min="0.01" step="0.01" value="'+draft.amount+'"></label>'+
      '<label>Currency<select id="b-currency-'+index+'">'+options(currencies,draft.currency)+'</select></label>'+
      '<label>Category<select id="b-category-'+index+'">'+options(categories,draft.category)+'</select></label>'+
      '<label>FX rate to AED<input id="b-rate-'+index+'" type="number" min="0.000001" step="any" value="'+draft.fxRateToBase+'"></label>'+
      '<label>Payment<select id="b-payment-'+index+'" required aria-required="true">'+paymentOptions(draft.payment)+'</select></label>'+
      '<label>Spent by<select id="b-spent-'+index+'">'+options(people,draft.spentBy)+'</select></label>'+
      '<label class="wide">Description<input id="b-description-'+index+'" maxlength="120" value="'+escapeHtml(draft.description)+'"></label>'+
      '<label class="wide">Notes<input id="b-notes-'+index+'" maxlength="500" value="" placeholder="Optional notes"></label>'+
      '</div><div class="base-preview" id="b-preview-'+index+'"></div></section>').join("");
    const summaryRows=drafts.map((draft,index)=>'<div class="compact-batch-row"><div><b>'+(index+1)+'. '+escapeHtml(draft.description||"Transaction")+'</b><small>'+escapeHtml(draft.type+' · '+draft.category+' · '+dateLabel(draft.date))+'</small><small class="'+(draft.payment&&draft.payment!=="Other"?"":"payment-needed")+'">'+escapeHtml(draft.payment&&draft.payment!=="Other"?draft.payment:"Payment method required")+'</small></div><strong>'+escapeHtml(currencyLabel(draft.currency,draft.amount))+'</strong></div>').join("");
    card.innerHTML='<div class="review-head"><b>Review '+drafts.length+' entries</b><span>DRAFT · NOT SAVED</span></div>'+
      '<div class="compact-batch-summary">'+summaryRows+'</div>'+
      '<div class="review-actions compact-review-actions"><button class="confirm-btn" id="confirm-batch" type="button">Confirm all</button><button class="edit-cancel" id="edit-batch-entries" type="button">Edit entries</button><button class="edit-cancel" id="cancel-batch" type="button">Cancel</button></div>'+
      '<div class="review-edit-fields batch-edit-fields" id="batch-edit-fields" hidden>'+entries+'</div>';
    wrapper.append(card);$("chat").append(wrapper);pendingCard=card;$("chat").scrollTop=$("chat").scrollHeight;
    const batchEditFields=$("batch-edit-fields");
    $("edit-batch-entries").addEventListener("click",()=>{
      batchEditFields.hidden=!batchEditFields.hidden;
      card.classList.toggle("is-editing",!batchEditFields.hidden);
      $("edit-batch-entries").textContent=batchEditFields.hidden?"Edit entries":"Hide details";
    });
    const rates={AED:1,INR:0.044,USD:3.6725,OMR:9.55,SGD:2.75,EUR:3.95,GBP:4.65};
    drafts.forEach((draft,index)=>{
      const update=()=>{const currency=$("b-currency-"+index).value,amount=Number($("b-amount-"+index).value||0),rate=currency==="AED"?1:Number($("b-rate-"+index).value||0);$("b-preview-"+index).textContent="Estimated base amount: AED "+(amount*rate).toFixed(2)+(currency!=="AED"?" · FX rate is an editable estimate; verify before saving.":"");};
      ["b-amount-"+index,"b-rate-"+index].forEach(id=>$(id).addEventListener("input",update));
      $("b-currency-"+index).addEventListener("change",()=>{$("b-rate-"+index).value=rates[$("b-currency-"+index).value];update();});
      update();
    });
    $("confirm-batch").addEventListener("click",()=>{
      const records=[],now=new Date().toISOString();
      for(let i=0;i<drafts.length;i++){
        const amount=Number($("b-amount-"+i).value),currency=$("b-currency-"+i).value,rate=currency==="AED"?1:Number($("b-rate-"+i).value),description=$("b-description-"+i).value.trim(),date=$("b-date-"+i).value;
        const payment=$("b-payment-"+i).value;
        if(!payment){
          batchEditFields.hidden=false;card.classList.add("is-editing");$("edit-batch-entries").textContent="Hide details";
          addMessage("Please choose a payment method for Transaction "+(i+1)+" before saving. You can select Other / Not sure.");
          $("b-payment-"+i).focus();return;
        }
        if(!amount||amount<=0||!date||!description||!rate||rate<=0){batchEditFields.hidden=false;card.classList.add("is-editing");$("edit-batch-entries").textContent="Hide details";addMessage("Please check Transaction "+(i+1)+": amount, date, description and FX rate must all be valid. Nothing has been saved.");return;}
        const spent=$("b-spent-"+i);
        records.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+"-"+i,date,type:$("b-type-"+i).value,amount,currency,fxRateToBase:rate,baseAmount:amount*rate,category:$("b-category-"+i).value,description,payment,spentBy:spent.value,spentByLabel:spent.options[spent.selectedIndex].text,recordedBy:"TEST_USER_1",tripId:"",notes:$("b-notes-"+i).value.trim(),createdAt:now,updatedAt:now});
      }
      const rows=readRecords();rows.push(...records);writeRecords(rows);lastSavedId=records[records.length-1].id;context.setLastTransaction(lastSavedId);
      card.innerHTML='<div class="review-head"><b>Batch saved to test ledger</b><span>CONFIRMED</span></div>'+records.map((r,i)=>'<div class="batch-saved-row"><b>'+(i+1)+'. '+escapeHtml(r.description)+'</b><span>'+escapeHtml(r.currency+" "+r.amount.toFixed(2)+" · AED "+r.baseAmount.toFixed(2))+'</span></div>').join("");
      pending=null;pendingCard=null;context.setPending(null);updateCount();addMessage("Done. I've added all "+records.length+" transactions to your local test ledger. They are not synced to OneDrive.");
      $("chat").scrollTop=$("chat").scrollHeight;
    });
    $("cancel-batch").addEventListener("click",()=>{card.innerHTML='<b>Batch cancelled.</b><p>None of these transactions were saved.</p>';pending=null;context.setPending(null);});
  };
  const handleFollowUp = text => {
    const lower=text.toLowerCase();
    if(Array.isArray(pending)){
      const ordinal=lower.match(/\b(first|second|third|fourth|fifth|last|transaction\s+(\d+)|#(\d+))\b/);
      const index=ordinal?(ordinal[1]==="first"?0:ordinal[1]==="second"?1:ordinal[1]==="third"?2:ordinal[1]==="fourth"?3:ordinal[1]==="fifth"?4:ordinal[1]==="last"?pending.length-1:Number(ordinal[2]||ordinal[3])-1):-1;
      if(index>=0 && index<pending.length){
        const draft=pending[index];let changed=false;
        const amount=lower.match(/\b(?:should be|was|to|make it|change (?:it|that) to|actually (?:it was|that was))\s*([0-9][0-9,]*(?:\.\d{1,2})?)/);
        if(amount){draft.amount=Number(amount[1].replace(/,/g,""));draft.baseAmount=draft.amount*Number(draft.fxRateToBase||1);changed=true;}
        const pay=lower.match(/\b(cash|credit card|debit card|bank transfer|digital wallet)\b/);
        if(pay){draft.payment=pay[1]==="credit card"?"Credit Card":pay[1]==="debit card"?"Debit Card":pay[1]==="bank transfer"?"Bank Transfer":pay[1]==="digital wallet"?"Digital Wallet":"Cash";changed=true;}
        if(/\b(today|yesterday|tomorrow|day before yesterday)\b/.test(lower)){draft.date=parseDate(text);changed=true;}
        const extracted=window.SmartLedgerContext.extractFilters(text);
        if(extracted.category){draft.category=extracted.category;changed=true;}
        if(changed){if(pendingCard)pendingCard.innerHTML="<b>Batch draft updated.</b><p>The revised batch is shown below. Nothing has been saved.</p>";renderBatchReview(pending);addMessage("Updated Transaction "+(index+1)+". Review the revised batch before confirming.");return true;}
      }
      if(/\b(change|correct|actually|instead|should be|make it|set it)\b/i.test(lower)){
        addMessage("For a batch, mention which one you mean (first, second, third…) and the change. You can also edit each transaction directly in the review list.");
        return true;
      }
    }
    if(pending){
      let changed=false;
      const amount=lower.match(/\b(?:make that|change (?:it|that) to|set (?:it|the amount) to|actually (?:it was|that was)|it was|that was|it should be|should be|amount should be)\s*([0-9][0-9,]*(?:\.\d{1,2})?)/);
      if(amount){pending.amount=Number(amount[1].replace(/,/g,""));pending.baseAmount=pending.amount*Number(pending.fxRateToBase||1);changed=true;}
      const payMatches=[...lower.matchAll(/\b(cash|credit card|debit card|bank transfer|digital wallet)\b/g)];
      if(payMatches.length){const pay=payMatches[payMatches.length-1][1];pending.payment=pay==="credit card"?"Credit Card":pay==="debit card"?"Debit Card":pay==="bank transfer"?"Bank Transfer":pay==="digital wallet"?"Digital Wallet":"Cash";changed=true;}
      if(/\b(today|yesterday|tomorrow|day before yesterday)\b/.test(lower)){pending.date=parseDate(text);changed=true;}
      const extracted=window.SmartLedgerContext.extractFilters(text);
      if(extracted.category){pending.category=extracted.category;changed=true;}
      if(/\b(income|received|salary|earned)\b/.test(lower)){pending.type="Income";pending.category=extracted.category||inferCategory(text,"Income",pending.description);changed=true;}
      else if(/\b(expense|spent|paid)\b/.test(lower)){pending.type="Expense";changed=true;}
      if(changed){
        if(pendingCard)pendingCard.innerHTML="<b>Draft updated.</b><p>The revised draft is shown below. Nothing has been saved yet.</p>";
        renderReview(pending);
        addMessage("Got it — I've updated the draft. Review the changes and confirm when ready.");
        return true;
      }
    }
        const amountCorrection=lower.match(/\b(?:change (?:it|that) to|make (?:it|that)|set (?:it|the amount) to|actually (?:it was|that was)|it was|that was)\s*([0-9][0-9,]*(?:\.\d{1,2})?)/);
    if(!pending && amountCorrection){
      const rows=readRecords(),idx=lastSavedId?rows.findIndex(r=>r.id===lastSavedId):rows.length-1,amount=Number(amountCorrection[1].replace(/,/g,""));
      if(idx>=0 && amount>0){rows[idx].amount=amount;rows[idx].baseAmount=amount*Number(rows[idx].fxRateToBase||1);rows[idx].updatedAt=new Date().toISOString();writeRecords(rows);addMessage("Updated the most recently saved transaction to "+rows[idx].currency+" "+amount.toFixed(2)+" (AED "+rows[idx].baseAmount.toFixed(2)+").");return true;}
    }
const paymentMatch=lower.match(/\b(cash|credit card|debit card|bank transfer|digital wallet)\b/);
    if(paymentMatch && /\b(previous one|last one|last transaction|that transaction|that was|actually it was)\b/.test(lower)){
      const rows=readRecords(),idx=lastSavedId?rows.findIndex(r=>r.id===lastSavedId):rows.length-1;
      if(idx>=0){rows[idx].payment=paymentMatch[1]==="credit card"?"Credit Card":paymentMatch[1]==="debit card"?"Debit Card":paymentMatch[1]==="bank transfer"?"Bank Transfer":paymentMatch[1]==="digital wallet"?"Digital Wallet":"Cash";rows[idx].updatedAt=new Date().toISOString();writeRecords(rows);addMessage("Updated the most recently saved transaction's payment method to "+rows[idx].payment+".");return true;}
    }
    const dateFollowup=/^(?:(?:just|only)\s+)?(?:today|yesterday|tomorrow|this week|last week|this month|last month)[?.!\s]*$/.test(lower.trim());
    if(lastReportQuery && (dateFollowup || /\b(what about|how about|and)\b/.test(lower)) && /\b(today|yesterday|tomorrow|this week|last week|this month|last month)\b/.test(lower)){
      const dateWords=lower.match(/\b(today|yesterday|tomorrow|this week|last week|this month|last month)\b/);
      const revised=lastReportQuery.replace(/\b(today|yesterday|tomorrow|this week|last week|this month|last month)\b/gi,dateWords[1]);
      answerReport(revised);return true;
    }
    if(lastReportQuery && /\b(and by category|category breakdown|break it down by category)\b/.test(lower)){answerReport(lastReportQuery+" by category");return true;}
    return false;
  };
  const showPendingQuestion = transaction => {
    if(!transaction.amount){
      pendingConversation.stage="amount";
      if(transaction.receivedFrom)addMessage("How much did "+transaction.receivedFrom.toLowerCase()+" pay you? Include the currency if it wasn't AED.");
      else if(transaction.description && transaction.description!=="Transaction")addMessage("How much did you spend on "+transaction.description+"? Include currency if it wasn't AED.");
      else addMessage("How much was the "+transaction.type.toLowerCase()+"? Include the currency if it wasn't AED.");
      return;
    }
    if(transaction.needsPurpose){pendingConversation.stage="purpose";addMessage("What was this payment from "+transaction.receivedFrom.toLowerCase()+" for — a repayment, gift, loan, or something else?");return;}
    if(transaction.needsDescription || transaction.description==="Transaction"){pendingConversation.stage="description";addMessage(transaction.type==="Income"?"What was this income from?":"What was the expense for?");return;}
    pendingConversation=null;
    addMessage("Here’s what I understood. Please review it before saving.");
    renderReview(transaction);
  };
  const continuePendingConversation = reply => {
    if(!pendingConversation)return false;
    const text=String(reply||"").trim(),tx=pendingConversation.transaction;
    if(/^(cancel|stop|never mind|nevermind|forget it)$/i.test(text)){
      pendingConversation=null;addMessage("Okay, cancelled. Nothing was saved.");return true;
    }
    if(pendingConversation.stage==="amount"){
      const amount=window.SmartLedgerIntentAdapter.parseAmount(text);
      if(!amount){addMessage("I still need the amount. You can enter it like “AED 120” or “120”.");return true;}
      tx.amount=amount.amount;tx.currency=amount.currency||tx.currency||"AED";
      const rate={AED:1,INR:0.044,USD:3.6725,OMR:9.55,SGD:2.75,EUR:3.95,GBP:4.65}[tx.currency]||1;
      tx.fxRateToBase=rate;tx.baseAmount=tx.amount*rate;
      const pay=/credit card|\bcc\b/i.test(text)?"Credit Card":/debit card|\bdc\b/i.test(text)?"Debit Card":/bank transfer|transferred/i.test(text)?"Bank Transfer":/cash/i.test(text)?"Cash":/wallet|apple pay|google pay/i.test(text)?"Digital Wallet":null;
      if(pay)tx.payment=pay;
      if(/\b(today|yesterday|tomorrow|day before yesterday)\b/i.test(text))tx.date=parseDate(text);
      const purpose=window.SmartLedgerIntentAdapter.inferIncomePurpose(text);
      if(purpose){tx.purpose=purpose;tx.notes=(tx.receivedFrom?"Received from: "+tx.receivedFrom+" · ":"")+"Purpose: "+purpose;tx.needsPurpose=false;}
      showPendingQuestion(tx);return true;
    }
    if(pendingConversation.stage==="purpose"){
      const purpose=window.SmartLedgerIntentAdapter.inferIncomePurpose(text);
      tx.purpose=purpose||"Other";
      tx.notes=(tx.receivedFrom?"Received from: "+tx.receivedFrom+" · ":"")+"Purpose: "+tx.purpose+(purpose?"":" ("+text+")");
      if(purpose==="Refund")tx.category="Refund";else if(purpose==="Salary")tx.category="Salary";else tx.category="Other Income";
      tx.needsPurpose=false;showPendingQuestion(tx);return true;
    }
    if(pendingConversation.stage==="description"){
      if(!text){addMessage("Please describe what this transaction was for.");return true;}
      tx.description=text.charAt(0).toUpperCase()+text.slice(1);
      tx.category=window.SmartLedgerContext.extractFilters(text).category||inferCategory(text,tx.type,tx.description);
      tx.needsDescription=false;showPendingQuestion(tx);return true;
    }
    addMessage("Please answer the question above, or say “cancel” to stop.");return true;
  };
  const handleGreeting = text => {
    const t=text.trim().toLowerCase();
    if(/^(hi|hello|hey|hiya|good morning|good afternoon|good evening)[!.\s]*$/.test(t)){
      addMessage("Hello! I'm here. You can tell me about an expense, ask for a spending summary, or continue with a follow-up question.");
      return true;
    }
    return false;
  };
  const intentAdapter=window.SmartLedgerIntentAdapter.create({provider:window.SmartLedgerLanguageProvider||null});
  if(intentAdapter.hasProvider()){
    $("ai-status").textContent="Free AI bridge configured";
    $("ai-status-detail").textContent="Groq Free API · local test ledger · no OneDrive sync";
  }else{
    $("ai-status").textContent="Local parsing mode";
    $("ai-status-detail").textContent="Free AI setup pending · local test ledger · no OneDrive sync";
  }
  $("chat-form").addEventListener("submit",async e=>{
    e.preventDefault();const text=$("prompt").value.trim();if(!text)return;
    addMessage(text,"user");$("prompt").value="";
    if(pendingConversation){continuePendingConversation(text);return;}
    const route=context.route(text);
    if(route.intent==="greeting"){handleGreeting(text);return;}
    if(route.intent==="correction" && handleFollowUp(text))return;
    if(route.intent==="report"){
      const reportSpec=route.report || context.getReport();
      if(!reportSpec || !reportSpec.period){
        lastReportQuery=text;
        addMessage("Of course. Which period should I use — today, this month, or all available history?");
        return;
      }
      // Report filtering and follow-ups are deterministic local operations; the AI
      // must never invent totals or decide which saved ledger rows exist.
      answerReport(text,reportSpec);
      return;
    }
    if(handleFollowUp(text))return;
    lastReportQuery=null;
    const interpreted=await intentAdapter.interpret(text,context.snapshot());
    if(interpreted.intent==="clarification"){
      if(interpreted.pendingTransaction)pendingConversation={transaction:{...interpreted.pendingTransaction},stage:""};
      addMessage(interpreted.question);
      if(pendingConversation){
        const tx=pendingConversation.transaction;
        pendingConversation.stage=!tx.amount?"amount":tx.needsPurpose?"purpose":"description";
      }
      return;
    }
    if(interpreted.intent==="provider.error"){addMessage(interpreted.message);return;}
    if(interpreted.intent==="greeting"){addMessage(interpreted.reply||"Hello! How can I help with your finances?");return;}
    if(interpreted.intent==="unknown"){addMessage(interpreted.reply||"I can help with personal finance: recording expenses or income, correcting entries, and understanding your spending. What would you like to do?");return;}
    if(interpreted.intent==="report.query"){context.setReport(interpreted.report);answerReport(text,interpreted.report);return;}
    if(interpreted.intent==="help"){addMessage(interpreted.reply||"I can record expenses and income, review multiple transactions together, correct a draft, or answer questions about your saved spending. Describe what happened in your own words.");return;}
    if(interpreted.intent==="transaction.create"){
      if(interpreted.transactions.length>1){
        addMessage("I found "+interpreted.transactions.length+" entries in your message. I’ve prepared a short summary of each one below; nothing is saved until you confirm.");
        renderBatchReview(interpreted.transactions);
      } else {
        addMessage(transactionAcknowledgement(interpreted.transactions[0]));
        renderReview(interpreted.transactions[0]);
      }
      return;
    }
    const draft=parse(text);
    if(draft.error){addMessage(draft.error);return;}
    addMessage(transactionAcknowledgement(draft));
    renderReview(draft);
  });
  document.querySelectorAll(".suggestion").forEach(btn=>btn.addEventListener("click",()=>{$("prompt").value=btn.dataset.prompt;$("prompt").focus();const end=$("prompt").value.length;$("prompt").setSelectionRange(end,end);}));
  $("clear-chat").addEventListener("click",()=>{$("chat").innerHTML='<div class="message assistant"><div class="bubble"><b>Chat reset.</b><p>Describe a transaction to get started.</p></div><time>Smart Ledger</time></div>';pending=null;pendingCard=null;pendingConversation=null;lastReportQuery=null;lastSavedId=null;context.clear();window.SmartLedgerConversationHistory=[];});
  $("prompt").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("chat-form").requestSubmit();}});
  updateCount();
})();
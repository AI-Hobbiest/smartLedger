(() => {
  const KEY = "smartLedger.entryTest.v1";
  const $ = id => document.getElementById(id);
  const categories = ["Food/EatOut","Grocery","Apparel","Devotional","Travel","Misc/Others","Spiritual","Investments","Salary","Other Income","Refund"];
  const payments = ["Cash","Debit Card","Credit Card","Bank Transfer","Digital Wallet","Other"];
  let pending = null, pendingCard = null, lastReportQuery = null, lastSavedId = null;
  const context = window.SmartLedgerContext.create();
  const localISO = d => { const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0"); return y+"-"+m+"-"+day; };
  const todayISO = () => localISO(new Date());
  const readRecords = () => { try { const v=JSON.parse(localStorage.getItem(KEY)||"[]"); return Array.isArray(v)?v:[]; } catch { return []; } };
  const writeRecords = rows => localStorage.setItem(KEY,JSON.stringify(rows));
  const escapeHtml = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const addMessage = (text,who="assistant") => {
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
    const lines=["Your ledger summary · "+label,"","Expenses: "+moneyAED(expenseTotal)+" ("+expenses.length+" entries)","Income: "+moneyAED(incomeTotal)+" ("+incomes.length+" entries)","Net: "+(net<0?"−":"+")+moneyAED(Math.abs(net))];
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
  const renderReview = draft => {
    pending=draft;context.setPending(draft);
    const wrapper=document.createElement("div");wrapper.className="message assistant";
    const card=document.createElement("div");card.className="review-card";
    const options=(arr,selected)=>arr.map(v=>'<option '+(v===selected?'selected':'')+' value="'+escapeHtml(v)+'">'+escapeHtml(v)+'</option>').join("");
    card.innerHTML='<div class="review-head"><b>Review transaction</b><span>DRAFT · NOT SAVED</span></div>'+
      '<div class="review-grid">'+
      '<label>Type<select id="r-type">'+options(["Expense","Income"],draft.type)+'</select></label>'+
      '<label>Date<input id="r-date" type="date" value="'+escapeHtml(draft.date)+'"></label>'+
      '<label>Amount<input id="r-amount" type="number" min="0.01" step="0.01" value="'+draft.amount+'"></label>'+
      '<label>Currency<select id="r-currency">'+options(["AED","INR","USD","OMR","SGD","EUR","GBP"],draft.currency)+'</select></label>'+
      '<label>Category<select id="r-category">'+options(categories,draft.category)+'</select></label>'+
      '<label>FX rate to AED<input id="r-rate" type="number" min="0.000001" step="any" value="'+draft.fxRateToBase+'"></label>'+
      '<label>Payment<select id="r-payment">'+options(payments,draft.payment)+'</select></label>'+
      '<label class="wide">Description<input id="r-description" maxlength="120" value="'+escapeHtml(draft.description)+'"></label>'+
      '<label class="wide">Spent by<select id="r-spent">'+options(["TEST_USER_1","TEST_USER_2","TEST_USER_3"],draft.spentBy)+'</select></label>'+
      '<label class="wide">Notes<input id="r-notes" maxlength="500" value="'+escapeHtml(draft.notes)+'" placeholder="Optional notes"></label>'+
      '</div><div id="base-preview" class="base-preview"></div>'+
      '<div class="review-actions"><button class="confirm-btn" id="confirm-entry" type="button">Confirm & save</button><button class="edit-cancel" id="cancel-entry" type="button">Cancel</button></div>';
    wrapper.append(card);$("chat").append(wrapper);pendingCard=card;$("chat").scrollTop=$("chat").scrollHeight;
    const updatePreview=()=>{const curr=$("r-currency").value,amt=Number($("r-amount").value||0),rate=curr==="AED"?1:Number($("r-rate").value||0);$("base-preview").textContent="Estimated base amount: AED "+(amt*rate).toFixed(2)+(curr!=="AED"?" · FX rate is an editable estimate; verify before saving.":"");};
    ["r-currency","r-amount","r-rate"].forEach(id=>$(id).addEventListener("input",updatePreview));$("r-currency").addEventListener("change",()=>{const rates={AED:1,INR:0.044,USD:3.6725,OMR:9.55,SGD:2.75,EUR:3.95,GBP:4.65};$("r-rate").value=rates[$("r-currency").value];updatePreview();});updatePreview();
    $("confirm-entry").addEventListener("click",()=>{
      const amount=Number($("r-amount").value),currency=$("r-currency").value,rate=currency==="AED"?1:Number($("r-rate").value);
      if(!amount||amount<=0||!$("r-date").value||!$("r-description").value.trim()||!rate||rate<=0){addMessage("Please check the amount, date, description and FX rate before saving.");return;}
      const rows=readRecords(),now=new Date().toISOString(),spent=$("r-spent");
      const rec={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),date:$("r-date").value,type:$("r-type").value,amount,currency,fxRateToBase:rate,baseAmount:amount*rate,category:$("r-category").value,description:$("r-description").value.trim(),payment:$("r-payment").value,spentBy:spent.value,spentByLabel:spent.options[spent.selectedIndex].text,recordedBy:"TEST_USER_1",tripId:"",notes:$("r-notes").value.trim(),createdAt:now,updatedAt:now};
      rows.push(rec);writeRecords(rows);lastSavedId=rec.id;context.setLastTransaction(rec.id);card.innerHTML='<div class="review-head"><b>Saved to test ledger</b><span>CONFIRMED</span></div><div class="base-preview">'+escapeHtml(rec.type+" · "+rec.currency+" "+rec.amount.toFixed(2)+" · "+rec.description)+"<br>Base amount: AED "+rec.baseAmount.toFixed(2)+'</div>';pending=null;pendingCard=null;context.setPending(null);updateCount();addMessage("Done. I've added this transaction to your local test ledger. It is not synced to OneDrive.");$("chat").scrollTop=$("chat").scrollHeight;
    });
    $("cancel-entry").addEventListener("click",()=>{card.innerHTML='<b>Draft cancelled.</b><p>You can describe the transaction again whenever you’re ready.</p>';pending=null;context.setPending(null);});
  };
  const handleFollowUp = text => {
    const lower=text.toLowerCase();
    if(pending && /\b(make that|change (it|that) to|set (it|the amount) to|actually)\b/.test(lower)){
      let changed=false;
      const amount=lower.match(/\b(?:make that|change (?:it|that) to|set (?:it|the amount) to)\s*([0-9][0-9,]*(?:\.\d{1,2})?)/);
      if(amount){pending.amount=Number(amount[1].replace(/,/g,""));pending.baseAmount=pending.amount*pending.fxRateToBase;changed=true;}
      const pay=lower.match(/\b(cash|credit card|debit card|bank transfer|digital wallet)\b/);
      if(pay){pending.payment=pay[1]==="credit card"?"Credit Card":pay[1]==="debit card"?"Debit Card":pay[1]==="bank transfer"?"Bank Transfer":pay[1]==="digital wallet"?"Digital Wallet":"Cash";changed=true;}
      if(changed){if(pendingCard)pendingCard.innerHTML="<b>Draft updated.</b><p>The revised draft is shown below. Nothing has been saved yet.</p>";renderReview(pending);addMessage("I've updated the draft. Please review it again before confirming.");return true;}
    }
        const amountCorrection=lower.match(/\b(?:change (?:it|that) to|make (?:it|that)|set (?:it|the amount) to)\s*([0-9][0-9,]*(?:\.\d{1,2})?)/);
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
  const handleGreeting = text => {
    const t=text.trim().toLowerCase();
    if(/^(hi|hello|hey|hiya|good morning|good afternoon|good evening)[!.\\s]*$/.test(t)){
      addMessage("Hello! I'm here. You can tell me about an expense, ask for a spending summary, or continue with a follow-up question.");
      return true;
    }
    return false;
  };
  $("chat-form").addEventListener("submit",e=>{e.preventDefault();const text=$("prompt").value.trim();if(!text)return;addMessage(text,"user");$("prompt").value="";const route=context.route(text);if(route.intent==="greeting"){handleGreeting(text);return;}if(route.intent==="correction" && handleFollowUp(text))return;if(route.intent==="report"){answerReport(text,route.report);return;}if(handleFollowUp(text))return;lastReportQuery=null;const draft=parse(text);if(draft.error){addMessage(draft.error);return;}addMessage("Here’s what I understood. Please review and correct anything that needs changing before saving.");renderReview(draft);});
  document.querySelectorAll(".suggestion").forEach(btn=>btn.addEventListener("click",()=>{$("prompt").value=btn.dataset.prompt;$("chat-form").requestSubmit();}));
  $("clear-chat").addEventListener("click",()=>{$("chat").innerHTML='<div class="message assistant"><div class="bubble"><b>Chat reset.</b><p>Describe a transaction to get started.</p></div><time>Smart Ledger</time></div>';pending=null;pendingCard=null;lastReportQuery=null;lastSavedId=null;context.clear();});
  $("prompt").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("chat-form").requestSubmit();}});
  updateCount();
})();
(() => {
  const KEY = "smartLedger.entryTest.v1";
  const $ = id => document.getElementById(id);
  const categories = ["Food/EatOut","Grocery","Apparel","Devotional","Travel","Misc/Others","Spiritual","Investments","Salary","Other Income","Refund"];
  const payments = ["Cash","Debit Card","Credit Card","Bank Transfer","Digital Wallet","Other"];
  let pending = null;
  const todayISO = () => { const d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); };
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
    if(t.includes("day before yesterday")){now.setDate(now.getDate()-2);return now.toISOString().slice(0,10);}
    if(t.includes("yesterday")){now.setDate(now.getDate()-1);return now.toISOString().slice(0,10);}
    if(t.includes("tomorrow")){now.setDate(now.getDate()+1);return now.toISOString().slice(0,10);}
    const m=t.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
    if(m){let y=m[3]?Number(m[3]):now.getFullYear();if(y<100)y+=2000;const d=new Date(y,Number(m[2])-1,Number(m[1]));if(!Number.isNaN(d.getTime()))return d.toISOString().slice(0,10);}
    return todayISO();
  };
  const inferCategory = (text,type,merchant) => {
    const t=(text+" "+merchant).toLowerCase();
    if(type==="Income"){if(/salary|payroll/.test(t))return "Salary";if(/refund|reimburs/.test(t))return "Refund";return "Other Income";}
    if(/grocery|supermarket|carrefour|lulu|hypermarket|vegetable|milk/.test(t))return "Grocery";
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
  const renderReview = draft => {
    pending=draft;
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
      '<label>Payment<select id="r-payment">'+options(payments,draft.payment)+'</select></label>'+
      '<label class="wide">Description<input id="r-description" maxlength="120" value="'+escapeHtml(draft.description)+'"></label>'+
      '<label class="wide">Spent by<select id="r-spent">'+options(["TEST_USER_1","TEST_USER_2","TEST_USER_3"],draft.spentBy)+'</select></label>'+
      '<label class="wide">Notes<input id="r-notes" maxlength="500" value="'+escapeHtml(draft.notes)+'" placeholder="Optional notes"></label>'+
      '</div><div id="base-preview" class="base-preview"></div>'+
      '<div class="review-actions"><button class="confirm-btn" id="confirm-entry" type="button">Confirm & save</button><button class="edit-cancel" id="cancel-entry" type="button">Cancel</button></div>';
    wrapper.append(card);$("chat").append(wrapper);$("chat").scrollTop=$("chat").scrollHeight;
    const updatePreview=()=>{const curr=$("r-currency").value,amt=Number($("r-amount").value||0),rate=curr==="AED"?1:curr==="INR"?0.044:curr==="USD"?3.6725:curr==="OMR"?9.55:curr==="SGD"?2.75:curr==="EUR"?3.95:4.65;$("base-preview").textContent="Estimated base amount: AED "+(amt*rate).toFixed(2)+(curr!=="AED"?" · Indicative FX rate "+rate+"; verify before saving.":"");};
    ["r-currency","r-amount"].forEach(id=>$(id).addEventListener("input",updatePreview));updatePreview();
    $("confirm-entry").addEventListener("click",()=>{
      const amount=Number($("r-amount").value),currency=$("r-currency").value;
      if(!amount||amount<=0||!$("r-date").value||!$("r-description").value.trim()){addMessage("Please check the amount, date and description before saving.");return;}
      const rate=currency==="AED"?1:currency==="INR"?0.044:currency==="USD"?3.6725:currency==="OMR"?9.55:currency==="SGD"?2.75:currency==="EUR"?3.95:4.65;
      const rows=readRecords(),now=new Date().toISOString(),spent=$("r-spent");
      const rec={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),date:$("r-date").value,type:$("r-type").value,amount,currency,fxRateToBase:rate,baseAmount:amount*rate,category:$("r-category").value,description:$("r-description").value.trim(),payment:$("r-payment").value,spentBy:spent.value,spentByLabel:spent.options[spent.selectedIndex].text,recordedBy:"TEST_USER_1",tripId:"",notes:$("r-notes").value.trim(),createdAt:now,updatedAt:now};
      rows.push(rec);writeRecords(rows);card.innerHTML='<div class="review-head"><b>Saved to test ledger</b><span>CONFIRMED</span></div><div class="base-preview">'+escapeHtml(rec.type+" · "+rec.currency+" "+rec.amount.toFixed(2)+" · "+rec.description)+"<br>Base amount: AED "+rec.baseAmount.toFixed(2)+'</div>';pending=null;updateCount();addMessage("Done. I've added this transaction to your local test ledger. It is not synced to OneDrive.");$("chat").scrollTop=$("chat").scrollHeight;
    });
    $("cancel-entry").addEventListener("click",()=>{card.innerHTML='<b>Draft cancelled.</b><p>You can describe the transaction again whenever you’re ready.</p>';pending=null;});
  };
  $("chat-form").addEventListener("submit",e=>{e.preventDefault();const text=$("prompt").value.trim();if(!text)return;addMessage(text,"user");$("prompt").value="";const draft=parse(text);if(draft.error){addMessage(draft.error);return;}addMessage("Here’s what I understood. Please review and correct anything that needs changing before saving.");renderReview(draft);});
  document.querySelectorAll(".suggestion").forEach(btn=>btn.addEventListener("click",()=>{$("prompt").value=btn.dataset.prompt;$("chat-form").requestSubmit();}));
  $("clear-chat").addEventListener("click",()=>{$("chat").innerHTML='<div class="message assistant"><div class="bubble"><b>Chat reset.</b><p>Describe a transaction to get started.</p></div><time>Smart Ledger</time></div>';pending=null;});
  $("prompt").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("chat-form").requestSubmit();}});
  updateCount();
})();
/* Smart Ledger — provider-neutral finance intent adapter.
 * The adapter translates messages into structured intents. It never reads or writes
 * ledger storage and never performs financial actions.
 *
 * An optional provider may be injected by a trusted same-origin backend bridge as
 * window.SmartLedgerLanguageProvider. Never put provider secrets in this public PWA.
 */
(() => {
  "use strict";
  const CURRENCIES = ["AED","INR","USD","OMR","SGD","EUR","GBP"];
  const RATES = {AED:1,INR:0.044,USD:3.6725,OMR:9.55,SGD:2.75,EUR:3.95,GBP:4.65};
  const CURRENCY_PATTERN = "(?:AED|DHS?|DIRHAMS?|INR|RS\\.?|RUPEES?|USD|OMR|SGD|EUR|GBP|\\$)";
  const AMOUNT_RE = new RegExp("(?:\\b"+CURRENCY_PATTERN+"\\s*)?([0-9][0-9,]*(?:\\.[0-9]{1,2})?)(?:\\s*"+CURRENCY_PATTERN+")?","gi");
  const clean = value => String(value || "").replace(/[’]/g,"'").replace(/\s+/g," ").trim();
  const localISO = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
  const currencyFrom = text => {
    const match=String(text||"").match(/\b(aed|dhs?|dirhams?|inr|rs\.?|rupees?|usd|omr|sgd|eur|gbp)\b|\$/i);
    if(!match)return null;
    const token=match[0].toLowerCase();
    if(/^(inr|rs\.?|rupees?)$/.test(token))return "INR";
    if(token==="$"||token==="usd")return "USD";
    return token==="omr"?"OMR":token==="sgd"?"SGD":token==="eur"?"EUR":token==="gbp"?"GBP":"AED";
  };
  const typeFrom = text => {
    const t=String(text||"");
    const income=/\b(received|salary|income|earned|credited|reimbursement|refund|cashback|reimbursed|got paid)\b/i.test(t);
    const expense=/\b(spent|spend|paid|pay|purchase|purchased|bought|expense|expenses)\b/i.test(t);
    return income===expense?null:(income?"Income":"Expense");
  };
  const paymentFrom = text => {
    const t=String(text||"").toLowerCase();
    if(/credit card|\bcc\b/.test(t))return "Credit Card";
    if(/debit card/.test(t))return "Debit Card";
    if(/bank transfer|transferred/.test(t))return "Bank Transfer";
    if(/digital wallet|wallet|apple pay|google pay/.test(t))return "Digital Wallet";
    if(/\bcash\b/.test(t))return "Cash";
    return "Other";
  };
  const dateFrom = text => {
    const now=new Date(),d=new Date(now.getFullYear(),now.getMonth(),now.getDate()),t=String(text||"").toLowerCase();
    if(/day before yesterday/.test(t))d.setDate(d.getDate()-2);
    else if(/yesterday/.test(t))d.setDate(d.getDate()-1);
    else if(/tomorrow/.test(t))d.setDate(d.getDate()+1);
    const numeric=t.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
    if(numeric){let year=numeric[3]?Number(numeric[3]):d.getFullYear();if(year<100)year+=2000;const value=new Date(year,Number(numeric[2])-1,Number(numeric[1]));if(value.getFullYear()===year&&value.getMonth()===Number(numeric[2])-1&&value.getDate()===Number(numeric[1]))return localISO(value);}
    return localISO(d);
  };
  const categoryFrom = (text,type) => {
    const t=String(text||"").toLowerCase();
    if(type==="Income"){
      if(/salary|payroll/.test(t))return "Salary";
      if(/refund|reimburs/.test(t))return "Refund";
      return "Other Income";
    }
    if(/groc|supermarket|carrefour|lulu|hypermarket|vegetable|milk/.test(t))return "Grocery";
    if(/taxi|uber|careem|flight|airport|metro|fuel|petrol|bus|train/.test(t))return "Travel";
    if(/temple|hundi|donation|offering/.test(t))return "Spiritual";
    if(/shirt|shoe|clothes|apparel|dress/.test(t))return "Apparel";
    if(/lunch|dinner|breakfast|coffee|restaurant|food|snack|cafe|café/.test(t))return "Food/EatOut";
    if(/investment|stocks|shares|mutual fund/.test(t))return "Investments";
    if(/devotional|pooja|puja/.test(t))return "Devotional";
    return "Misc/Others";
  };
  const parseAmountMatches = text => {
    const matches=[];
    const re=new RegExp(AMOUNT_RE.source,"gi");
    let m;
    while((m=re.exec(text))!==null){
      const adjacent=text[m.index-1]||"",after=text[re.lastIndex]||"";
      if(/[\/.-]/.test(adjacent)||/[\/.-]/.test(after))continue; // Ignore date components such as 11/11/2026.
      const amount=Number(m[1].replace(/,/g,""));
      if(Number.isFinite(amount)&&amount>0){
        const currency=currencyFrom(m[0]) || null;
        matches.push({amount,currency,start:m.index,end:re.lastIndex,raw:m[0]});
      }
      if(m[0].length===0)re.lastIndex++;
    }
    return matches;
  };
  const splitTransactionSegments = text => {
    // Split only when a conjunction is followed by another currency/amount.
    // This avoids splitting "lunch and groceries" when there is only one amount.
    const delimiter= new RegExp("(?:\\s*(?:(?<![0-9]),|;|\\n)\\s*|\\s+(?:and|also|plus|then)\\s+)(?=(?:(?:(?:i|we|my account)\\s+)?(?:spent|spend|paid|pay|bought|purchased|received|earned|credited|reimbursed|refunded|got)\\s+)*(?:"+CURRENCY_PATTERN+"\\s*)?[0-9])","gi");
    return String(text||"").split(delimiter).map(part=>part.trim().replace(/^[,;\s]+|[,;\s]+$/g,"")).filter(Boolean);
  };
  const cleanDescription = (segment, amountMatch) => {
    let value=String(segment||"");
    if(amountMatch)value=value.replace(amountMatch.raw," ");
    value=value.replace(/\b(i|we|my|our|spent|spend|paid|pay|purchase|purchased|bought|for|on|at|in|using|with|today|yesterday|tomorrow|day before yesterday|received|salary|income|earned|credited|reimbursement|reimbursed|refund|cashback|expense|of|and|also|plus|then|aed|dhs?|dirhams?|inr|rs\.?|rupees?|usd|omr|sgd|eur|gbp)\b/gi," ");
    value=value.replace(/\b(credit card|debit card|bank transfer|digital wallet|cash|wallet|cc)\b/gi," ");
    value=value.replace(/\$|[,;.!?]/g," ").replace(/\s+/g," ").trim();
    return value?value.charAt(0).toUpperCase()+value.slice(1):"Transaction";
  };
  const makeDraft = (segment, fullText, options={}) => {
    const match=parseAmountMatches(segment)[0] || options.amountMatch;
    if(!match)return null;
    const type=typeFrom(segment)||options.sharedType||"Expense";
    const currency=match.currency||currencyFrom(segment)||options.sharedCurrency||"AED";
    const date=dateFrom(/\b(today|yesterday|tomorrow|day before yesterday|\d{1,2}[\/.-]\d{1,2})\b/i.test(segment)?segment:fullText);
    const payment=paymentFrom(segment)!=="Other"?paymentFrom(segment):(options.sharedPayment||paymentFrom(fullText));
    const description=cleanDescription(segment,match);
    const category=categoryFrom(segment+" "+description,type);
    const rate=RATES[currency]||1;
    return {
      type,amount:match.amount,currency,fxRateToBase:rate,baseAmount:match.amount*rate,
      date,category,description,payment,spentBy:"TEST_USER_1",spentByLabel:"Test User 1",notes:"",
      original:segment,source:"local-fallback"
    };
  };
  const normalizeProviderDraft = (raw, defaults={}) => {
    if(!raw||typeof raw!=="object")throw new Error("The language provider returned an invalid transaction draft.");
    const type=raw.type==="Income"?"Income":raw.type==="Expense"?"Expense":null;
    const amount=Number(raw.amount);
    const currency=CURRENCIES.includes(String(raw.currency||"").toUpperCase())?String(raw.currency).toUpperCase():null;
    const dateValue=typeof raw.date==="string"?raw.date:"";
    const dateObject=/^\d{4}-\d{2}-\d{2}$/.test(dateValue)?new Date(dateValue+"T00:00:00Z"):null;
    const date=dateObject&&!Number.isNaN(dateObject.getTime())&&dateObject.toISOString().slice(0,10)===dateValue?dateValue:null;
    if(!type||!Number.isFinite(amount)||amount<=0||!currency||!date)throw new Error("The language provider draft is missing a valid type, positive amount, currency or date.");
    const allowedCategories=["Food/EatOut","Grocery","Apparel","Devotional","Travel","Misc/Others","Spiritual","Investments","Salary","Other Income","Refund"];
    const category=allowedCategories.includes(raw.category)?raw.category:"Misc/Others";
    const payment=["Cash","Debit Card","Credit Card","Bank Transfer","Digital Wallet","Other"].includes(raw.payment)?raw.payment:"Other";
    const description=typeof raw.description==="string"&&raw.description.trim()?raw.description.trim().slice(0,120):"Transaction";
    const rate=RATES[currency]||1; // The language provider never controls FX calculations.
    return {type,amount,currency,fxRateToBase:rate,baseAmount:amount*rate,date,category,description,payment,spentBy:"TEST_USER_1",spentByLabel:"Test User 1",notes:typeof raw.notes==="string"?raw.notes.slice(0,500):"",original:String(defaults.original||""),source:"provider"};
  };
  const validateProviderResult = (result, input, conversation={}) => {
    if(!result||typeof result!=="object"||typeof result.intent!=="string")throw new Error("The language provider returned an invalid intent.");
    if(result.intent==="transaction.create"){
      if(!Array.isArray(result.transactions)||result.transactions.length<1||result.transactions.length>20)throw new Error("The provider must return between 1 and 20 transaction drafts.");
      return {intent:"transaction.create",transactions:result.transactions.map(item=>normalizeProviderDraft(item,{original:input})),source:"provider",clarification:null};
    }
    if(result.intent==="clarification"){
      return {intent:"clarification",question:typeof result.question==="string"?result.question.slice(0,400):"Could you clarify the transaction?",source:"provider"};
    }
    if(result.intent==="report.query"){
      const validDate=value=>{
        if(typeof value!=="string"||!(/^\d{4}-\d{2}-\d{2}$/.test(value)))return false;
        const d=new Date(value+"T00:00:00Z");
        return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;
      };
      const proposed=result.period&&validDate(result.period.from)&&validDate(result.period.to)&&result.period.from<=result.period.to
        ?{kind:typeof result.period.kind==="string"?result.period.kind:"custom",from:result.period.from,to:result.period.to}
        :conversation.report&&conversation.report.period?conversation.report.period:null;
      const today=localISO(new Date());
      const filters=result.filters&&typeof result.filters==="object"?result.filters:{};
      const type=["Expense","Income","All"].includes(filters.type)?filters.type:null;
      const category=typeof filters.category==="string"&&filters.category.trim()?filters.category.trim():null;
      const payment=["Cash","Debit Card","Credit Card","Bank Transfer","Digital Wallet","Other"].includes(filters.payment)?filters.payment:null;
      const groupBy=["category","payment"].includes(filters.groupBy)?filters.groupBy:null;
      return {intent:"report.query",report:{period:proposed||{kind:"today",from:today,to:today},filters:{type,category,payment,groupBy}},source:"provider",text:String(input)};
    }
    if(result.intent==="greeting"||result.intent==="help"||result.intent==="unknown"){
      return {intent:result.intent,source:"provider",text:String(input)};
    }
    throw new Error("The language provider requested an unsupported finance action.");
  };
  const create = (options={}) => {
    const provider=options.provider || null;
    return {
      async interpret(input, conversation={}) {
        const text=clean(input);
        if(!text)return {intent:"unknown",source:"local-fallback",text:""};
        if(provider&&typeof provider.interpret==="function"){
          try{
            const result=await provider.interpret({message:text,context:conversation,schemaVersion:"1.0"});
            return validateProviderResult(result,text,conversation);
          }catch(error){
            const safeMessage=String(error&&error.message||"The free AI service is temporarily unavailable. Your message was not saved.");
            return {intent:"provider.error",source:"provider",message:safeMessage.slice(0,400)};
          }
        }
        const route=window.SmartLedgerContext?window.SmartLedgerContext.create().route(text):{intent:"unknown"};
        if(route.intent==="greeting"||route.intent==="report"||route.intent==="help"||route.intent==="correction"){
          return {intent:route.intent==="report"?"report.query":route.intent,source:"local-fallback",text,route};
        }
        const amounts=parseAmountMatches(text);
        if(!amounts.length)return {intent:"clarification",source:"local-fallback",question:"I couldn't identify an amount. What amount should I record?"};
        const segments=splitTransactionSegments(text);
        const usable=segments.length>1?segments.filter(segment=>parseAmountMatches(segment).length>0):[text];
        const sharedType=typeFrom(text),sharedCurrency=amounts[0].currency,sharedPayment=paymentFrom(text);
        if(usable.length>20)return {intent:"clarification",source:"local-fallback",question:"I can review up to 20 transactions at once. Please split this into two messages."};
        const transactions=usable.map(segment=>makeDraft(segment,text,{sharedType,sharedCurrency,sharedPayment})).filter(Boolean);
        if(!transactions.length)return {intent:"clarification",source:"local-fallback",question:"I found a number, but couldn't confidently turn it into a transaction. Could you describe the amount and what it was for?"};
        return {intent:"transaction.create",transactions,source:"local-fallback",clarification:null,confidence:"heuristic"};
      },
      hasProvider(){return !!(provider&&typeof provider.interpret==="function");}
    };
  };
  window.SmartLedgerIntentAdapter={create,validateProviderResult};
})();

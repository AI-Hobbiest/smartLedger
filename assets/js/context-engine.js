/* Smart Ledger finance conversation context engine.
 * Deterministic, provider-neutral context layer. No network calls or AI dependency.
 */
(() => {
  "use strict";
  const PERIODS = [
    ["dayBeforeYesterday", /\bday before yesterday\b/i],
    ["yesterday", /\byesterday\b/i],
    ["today", /\b(today|just today|only today)\b/i],
    ["tomorrow", /\btomorrow\b/i],
    ["last7Days", /\b(last|past) 7 days\b/i],
    ["lastWeek", /\b(last|past) week\b/i],
    ["thisWeek", /\b(this week|week to date)\b/i],
    ["lastMonth", /\b(last month|previous month)\b/i],
    ["thisMonth", /\b(this month|month to date)\b/i]
  ];
  const MONTHS = {jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11};
  const CATEGORIES = [
    {name:"Food/EatOut", aliases:["food","eat out","eating out","restaurant","restaurants","dining"]},
    {name:"Grocery", aliases:["grocery","groceries","grocer","supermarket"]},
    {name:"Apparel", aliases:["apparel","clothes","clothing"]},
    {name:"Devotional", aliases:["devotional"]},
    {name:"Travel", aliases:["travel","transport","transportation"]},
    {name:"Spiritual", aliases:["spiritual","temple","hundi","donation"]},
    {name:"Investments", aliases:["investment","investments"]},
    {name:"Salary", aliases:["salary","payroll"]},
    {name:"Other Income", aliases:["other income","income"]},
    {name:"Refund", aliases:["refund","reimbursement"]},
    {name:"Misc/Others", aliases:["miscellaneous","misc","others","other expenses"]}
  ];
  const PAYMENTS = [
    {name:"Credit Card", aliases:["credit card","credit","cc"]},
    {name:"Debit Card", aliases:["debit card","debit"]},
    {name:"Bank Transfer", aliases:["bank transfer","transfer","transferred"]},
    {name:"Digital Wallet", aliases:["digital wallet","wallet","apple pay","google pay"]},
    {name:"Cash", aliases:["cash"]}
  ];
  const clean = value => String(value || "").toLowerCase().replace(/[’']/g,"'").replace(/\s+/g," ").trim();
  const has = (text, pattern) => pattern.test(text);
  const localISO = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
  const datePeriod = (kind, now) => {
    const today = new Date(now.getFullYear(),now.getMonth(),now.getDate());
    let from = new Date(today), to = new Date(today);
    if (kind === "yesterday") from.setDate(from.getDate()-1), to = new Date(from);
    if (kind === "dayBeforeYesterday") from.setDate(from.getDate()-2), to = new Date(from);
    if (kind === "tomorrow") from.setDate(from.getDate()+1), to = new Date(from);
    if (kind === "last7Days") from.setDate(from.getDate()-6);
    if (kind === "thisWeek") { from.setDate(from.getDate()-((from.getDay()+6)%7)); }
    if (kind === "lastWeek") { from.setDate(from.getDate()-((from.getDay()+6)%7)-7); to = new Date(from); to.setDate(to.getDate()+6); }
    if (kind === "thisMonth") from = new Date(today.getFullYear(),today.getMonth(),1);
    if (kind === "lastMonth") { from = new Date(today.getFullYear(),today.getMonth()-1,1); to = new Date(today.getFullYear(),today.getMonth(),0); }
    return {kind,from:localISO(from),to:localISO(to)};
  };
  const extractPeriod = (text, now = new Date()) => {
    const t=clean(text);
    for (const [kind,pattern] of PERIODS) if (has(t,pattern)) return datePeriod(kind,now);
    const named=t.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*[' ]?\s*(\d{2,4})\b|\b(\d{4})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i);
    if(named){const month=(named[1]||named[4]).toLowerCase(),rawYear=named[2]||named[3];let year=Number(rawYear);if(year<100)year+=2000;const start=new Date(year,MONTHS[month],1),end=new Date(year,MONTHS[month]+1,0);return {kind:"month",from:localISO(start),to:localISO(end)};}
    const numeric=t.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
    if(numeric){let year=numeric[3]?Number(numeric[3]):now.getFullYear();if(year<100)year+=2000;const day=Number(numeric[1]),month=Number(numeric[2])-1,d=new Date(year,month,day);if(d.getFullYear()===year&&d.getMonth()===month&&d.getDate()===day)return {kind:"date",from:localISO(d),to:localISO(d)};}
    return null;
  };
  const extractOne = (text, dictionary) => {
    for(const item of dictionary){for(const alias of item.aliases){const escaped=alias.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");if(new RegExp("(^|\\b)"+escaped+"(\\b|$)","i").test(text))return item.name;}}
    return null;
  };
  const extractFilters = text => {
    const t=clean(text);
    let type=null;
    if(/\b(expenses?|spent|spend|spending|outgoings?|expenses?|spent|spend|spending|outgoings?)\b/.test(t))type="Expense";
    if(/\b(income|salary|earnings?|received|credited)\b/.test(t))type="Income";
    if(/\b(all transactions|everything|overall|both income and expenses)\b/.test(t))type="All";
    return {type,category:extractOne(t,CATEGORIES),payment:extractOne(t,PAYMENTS),groupBy:/\b(by category|category breakdown|breakdown by category|categories)\b/.test(t)?"category":/\b(by payment|payment method|payment type)\b/.test(t)?"payment":null};
  };
  const isGreeting = t => /^(hi|hello|hey|hiya|good morning|good afternoon|good evening)[!.\s]*$/i.test(t);
  const isReport = t => /\b(summary|summar(y|ise|ize)|report|breakdown|how much|total|show|list|what did i spend|transactions?|expense|expenses|expnse|expence|expens|spend|spending|outgoings?|income)\b/i.test(t)
    && !/\b(spent|paid|bought|purchased|received|earned|credited)\s+(?:aed|inr|usd|omr|sgd|eur|gbp|\d)/i.test(t);
  const isCorrection = t => /\b(actually|i meant|change (it|that)|make (it|that)|set (it|the amount)|wrong|correct that|previous one|last transaction)\b/i.test(t);
  const isReportFollowUp = (t, prior) => !!prior && (
    /^(?:(?:just|only)\s+)?(?:today|yesterday|tomorrow|this week|last week|this month|last month|last 7 days|past 7 days)[?.!\s]*$/i.test(t) ||
    /^(what about|how about|and|also|break it down|show me|just|no|not|instead|rather)\b/i.test(t) &&
      /(today|yesterday|tomorrow|week|month|category|grocer|food|travel|cash|card|income|expense)/i.test(t)
  );
  const mergeReport = (prior, text, now) => {
    const next={...prior,filters:{...prior.filters}};
    const period=extractPeriod(text,now),filters=extractFilters(text);
    if(period)next.period=period;
    Object.keys(filters).forEach(k=>{if(filters[k]!==null)next.filters[k]=filters[k];});
    return next;
  };
  const create = (options={}) => {
    const now=options.now || (()=>new Date());
    let report=null, lastIntent=null, pending=null, lastTransaction=null;
    return {
      route(input){
        const text=String(input||"").trim(),t=clean(text);
        if(isGreeting(t))return {intent:"greeting",text};
        if(isReportFollowUp(t,report)){
          report=mergeReport(report,t,now());lastIntent="report";
          return {intent:"report",text,report,isFollowUp:true};
        }
        if(isReport(t)){
          report=mergeReport({period:extractPeriod(t,now()),filters:{}},t,now());
          lastIntent="report";
          return {intent:"report",text,report,isFollowUp:false};
        }
        if(isCorrection(t))return {intent:"correction",text};
        if(/\b(help|what can you do|how does this work)\b/i.test(t))return {intent:"help",text};
        if(/\b(spent|paid|bought|purchased|received|earned|credited|salary|refund|reimbursed)\b/i.test(t) || /\b\d+(?:\.\d{1,2})?\s*(aed|inr|usd|omr|sgd|eur|gbp)\b/i.test(t)){
          report=null;lastIntent="transaction";return {intent:"transaction",text};
        }
        return {intent:"unknown",text,previousIntent:lastIntent};
      },
      getReport(){return report?JSON.parse(JSON.stringify(report)):null;},
      clear(){report=null;lastIntent=null;pending=null;lastTransaction=null;},
      clearReport(){report=null;},
      setPending(value){pending=value;},
      getPending(){return pending;},
      setLastTransaction(value){lastTransaction=value;},
      getLastTransaction(){return lastTransaction;},
      snapshot(){return {lastIntent,report:this.getReport(),hasPending:!!pending,lastTransaction};}
    };
  };
  window.SmartLedgerContext={create,extractPeriod,extractFilters};
})();

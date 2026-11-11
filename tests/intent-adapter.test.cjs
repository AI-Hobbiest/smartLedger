const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const windowStub = {};
vm.runInNewContext(fs.readFileSync("assets/js/context-engine.js","utf8"),{window:windowStub});
vm.runInNewContext(fs.readFileSync("assets/js/intent-adapter.js","utf8"),{window:windowStub});
const adapterApi=windowStub.SmartLedgerIntentAdapter;

test("one natural-language message produces multiple separate expense drafts", async () => {
  const adapter=adapterApi.create();
  const result=await adapter.interpret("I spent 20 AED on lunch and 35 AED on groceries yesterday using cash");
  assert.equal(result.intent,"transaction.create");
  assert.equal(result.transactions.length,2);
  assert.deepEqual(Array.from(result.transactions,x=>x.amount),[20,35]);
  assert.deepEqual(Array.from(result.transactions,x=>x.category),["Food/EatOut","Grocery"]);
  assert.deepEqual(Array.from(result.transactions,x=>x.date),[result.transactions[0].date,result.transactions[0].date]);
  assert.deepEqual(Array.from(result.transactions,x=>x.payment),["Cash","Cash"]);
  assert.deepEqual(Array.from(result.transactions,x=>x.currency),["AED","AED"]);
});

test("shared income intent applies to every transaction while category is inferred per item", async () => {
  const result=await adapterApi.create().interpret("Received 5,000 AED salary and 200 AED refund");
  assert.equal(result.transactions.length,2);
  assert.deepEqual(Array.from(result.transactions,x=>x.type),["Income","Income"]);
  assert.deepEqual(Array.from(result.transactions,x=>x.category),["Salary","Refund"]);
  assert.deepEqual(Array.from(result.transactions,x=>x.amount),[5000,200]);
});

test("different currencies in one message are preserved per transaction", async () => {
  const result=await adapterApi.create().interpret("Paid INR 1,250 for a taxi and AED 40 for lunch");
  assert.equal(result.transactions.length,2);
  assert.deepEqual(Array.from(result.transactions,x=>x.currency),["INR","AED"]);
  assert.deepEqual(Array.from(result.transactions,x=>x.category),["Travel","Food/EatOut"]);
});

test("one amount does not split merely because the description contains 'and'", async () => {
  const result=await adapterApi.create().interpret("I spent 30 AED on lunch and groceries");
  assert.equal(result.transactions.length,1);
  assert.equal(result.transactions[0].amount,30);
});

test("message without an amount asks a clarification instead of creating a draft", async () => {
  const result=await adapterApi.create().interpret("I bought groceries yesterday");
  assert.equal(result.intent,"clarification");
  assert.match(result.question,/amount/i);
});

test("provider output is normalized and restricted to safe transaction data", async () => {
  const provider={interpret:async()=>({intent:"transaction.create",transactions:[{
    type:"Expense",amount:12.5,currency:"AED",date:"2026-11-11",category:"Grocery",description:"Milk",payment:"Cash"
  }]})};
  const result=await adapterApi.create({provider}).interpret("Spent 12.5 on milk");
  assert.equal(result.intent,"transaction.create");
  assert.equal(result.transactions[0].baseAmount,12.5);
  assert.equal(result.transactions[0].source,"provider");
  assert.equal(result.transactions[0].spentBy,"TEST_USER_1");
  assert.equal("deleteLedger" in result.transactions[0],false);
});

test("provider cannot return unsupported actions or invalid amounts", async () => {
  assert.throws(()=>adapterApi.validateProviderResult({intent:"ledger.delete",id:"x"},"delete my ledger"),/unsupported finance action/i);
  assert.throws(()=>adapterApi.validateProviderResult({intent:"transaction.create",transactions:[{
    type:"Expense",amount:-5,currency:"AED",date:"2026-11-11"
  }]},"bad"),/positive amount/i);
});


test("comma-separated transactions are split without splitting thousands separators", async () => {
  const result=await adapterApi.create().interpret("Spent AED 1,250 on groceries, 35 AED on lunch");
  assert.equal(result.transactions.length,2);
  assert.deepEqual(Array.from(result.transactions,x=>x.amount),[1250,35]);
});

test("numeric transaction dates are not misread as extra transaction amounts", async () => {
  const result=await adapterApi.create().interpret("Spent AED 25 on lunch on 10/11/2026");
  assert.equal(result.transactions.length,1);
  assert.equal(result.transactions[0].amount,25);
  assert.equal(result.transactions[0].date,"2026-11-10");
});

test("provider report filters and date ranges are validated and normalized", async () => {
  const provider={interpret:async()=>({intent:"report.query",period:{kind:"month",from:"2026-11-01",to:"2026-11-30"},filters:{type:"Expense",category:"Grocery",payment:"Cash",groupBy:"category"}})};
  const result=await adapterApi.create({provider}).interpret("How much did I spend on groceries in November?");
  assert.equal(result.intent,"report.query");
  assert.equal(result.report.period.from,"2026-11-01");
  assert.equal(result.report.filters.type,"Expense");
  assert.equal(result.report.filters.category,"Grocery");
  assert.equal(result.report.filters.payment,"Cash");
});

test("invalid provider report dates fall back to the prior context rather than corrupting ranges", async () => {
  const provider={interpret:async()=>({intent:"report.query",period:{from:"2026-02-31",to:"2026-03-01"},filters:{type:"Expense"}})};
  const result=await adapterApi.create({provider}).interpret("What did I spend?",{report:{period:{kind:"lastMonth",from:"2026-10-01",to:"2026-10-31"}}});
  assert.equal(result.report.period.from,"2026-10-01");
  assert.equal(result.report.period.to,"2026-10-31");
});


test("mixed expenses and income keep their own transaction types", async () => {
  const result=await adapterApi.create().interpret("I spent 20 AED on lunch and received 500 AED salary");
  assert.equal(result.transactions.length,2);
  assert.deepEqual(Array.from(result.transactions,x=>x.type),["Expense","Income"]);
  assert.deepEqual(Array.from(result.transactions,x=>x.category),["Food/EatOut","Salary"]);
});


test("a new clause with its own verb creates a mixed second transaction", async () => {
  const result=await adapterApi.create().interpret("I spent 20 AED on lunch and I received 500 AED salary");
  assert.equal(result.transactions.length,2);
  assert.deepEqual(Array.from(result.transactions,x=>x.type),["Expense","Income"]);
  assert.deepEqual(Array.from(result.transactions,x=>x.category),["Food/EatOut","Salary"]);
});

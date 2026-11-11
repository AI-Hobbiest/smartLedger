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
  assert.deepEqual(result.transactions.map(x=>x.amount),[20,35]);
  assert.deepEqual(result.transactions.map(x=>x.category),["Food/EatOut","Grocery"]);
  assert.deepEqual(result.transactions.map(x=>x.date),[result.transactions[0].date,result.transactions[0].date]);
  assert.deepEqual(result.transactions.map(x=>x.payment),["Cash","Cash"]);
  assert.deepEqual(result.transactions.map(x=>x.currency),["AED","AED"]);
});

test("shared income intent applies to every transaction while category is inferred per item", async () => {
  const result=await adapterApi.create().interpret("Received 5,000 AED salary and 200 AED refund");
  assert.equal(result.transactions.length,2);
  assert.deepEqual(result.transactions.map(x=>x.type),["Income","Income"]);
  assert.deepEqual(result.transactions.map(x=>x.category),["Salary","Refund"]);
  assert.deepEqual(result.transactions.map(x=>x.amount),[5000,200]);
});

test("different currencies in one message are preserved per transaction", async () => {
  const result=await adapterApi.create().interpret("Paid INR 1,250 for a taxi and AED 40 for lunch");
  assert.equal(result.transactions.length,2);
  assert.deepEqual(result.transactions.map(x=>x.currency),["INR","AED"]);
  assert.deepEqual(result.transactions.map(x=>x.category),["Travel","Food/EatOut"]);
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
  assert.equal(result.transactions[0].deleteLedger,false);
});

test("provider cannot return unsupported actions or invalid amounts", async () => {
  const badAction=adapterApi.validateProviderResult({intent:"ledger.delete",id:"x"},"delete my ledger");
  assert.throws(()=>badAction,/unsupported finance action/i);
  assert.throws(()=>adapterApi.validateProviderResult({intent:"transaction.create",transactions:[{
    type:"Expense",amount:-5,currency:"AED",date:"2026-11-11"
  }]},"bad"),/positive amount/i);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/js/conversation-test.js", "utf8");

test("single-entry confirmation requires an explicitly selected payment method", () => {
  assert.match(source, /let paymentChosen=payments\.includes\(draft\.payment\)&&draft\.payment!=="Other"/);
  assert.match(source, /<select id="quick-payment" required aria-required="true">/);
  assert.match(source, /if\(!paymentChosen\|\|!value\.payment\)/);
  assert.match(source, /Other \/ Not sure/);
  assert.match(source, /<option value="" selected>Choose payment method<\/option>/);
});

test("batch confirmation requires a payment method for every entry", () => {
  assert.match(source, /const paymentOptions=selected=>/);
  assert.match(source, /<select id="b-payment-'+index\+'" required aria-required="true">/);
  assert.match(source, /if\(!payment\)/);
  assert.match(source, /Please choose a payment method for Transaction/);
});

test("missing or null payment values are not silently defaulted to Cash", () => {
  assert.match(source, /payments\.includes\(draft\.payment\)/);
  assert.match(source, /draft\.payment&&draft\.payment!=="Other"\?draft\.payment:"Payment method required"/);
});

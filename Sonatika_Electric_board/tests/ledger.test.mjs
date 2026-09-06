import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/boot\(\);\s*$/, '');
function fixture() {
  const element={innerHTML:'',classList:{add(){},remove(){}}};
  const context={document:{querySelector:()=>element,addEventListener(){}},window:{addEventListener(){}},MutationObserver:class{observe(){}},setInterval(){},setTimeout(){},clearTimeout(){},console,Intl,Map};
  vm.createContext(context);vm.runInContext(source,context);
  const run=code=>vm.runInContext(code,context);
  run(`data={consumers:[{C_ID:1,Customer_Name:'One'},{C_ID:2,Customer_Name:'Two'}],bills:[{B_ID:8,C_ID:1,Status:'Unpaid',Total_Amt:315},{B_ID:9,C_ID:2,Status:'paid/legacy',Total_Amt:400}],tariffs:[],readings:[]};userId=1;`);
  return {context,run};
}

test('bill tables separate paid/unpaid records and retain consumer ownership',()=>{
  const {run}=fixture();
  let html=run('billsPage()');
  assert.match(html,/Unpaid \(1\)/);assert.match(html,/Paid \(0\)/);
  assert.ok(!html.includes('#9'));
  run("data.bills[0].Status='Paid'");html=run('billsPage()');
  assert.match(html,/Unpaid \(0\)/);assert.match(html,/Paid \(1\)/);
  assert.match(html,/VIEW RECEIPT/);
  run("accountRole='administrator'");html=run('billsPage()');
  assert.match(html,/Paid \(2\)/);
  run('userId=999');assert.equal(run('userBills().length'),0);
});

test('refresh uses server records without resurrecting browser-only bills',async()=>{
  const {run,context}=fixture();
  let cache;
  context.fetch=async(_,options)=>{cache=options.cache;return {ok:true,json:async()=>({consumers:[],bills:[],tariffs:[],readings:[]})}};
  await run('refresh()');
  assert.equal(cache,'no-store');assert.equal(run('data.bills.length'),0);
});

test('receipts reopened later use the stored payment date and transaction ID',()=>{
  const {run}=fixture();
  run("data.bills[0]={...data.bills[0],Status:'Paid',Transaction_ID:'ORIGINAL-TXN',Paid_At:'2026-09-01T12:00:00Z',Payment_Method:'upi'};paymentBillId=8");
  const html=run('receiptPage()');
  assert.match(html,/ORIGINAL-TXN/);assert.match(html,/UPI/);
  assert.ok(!html.includes('Recorded in the SEB database'));
});

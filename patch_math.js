
const fs = require('fs');

function patchController(file) {
  let code = fs.readFileSync(file, 'utf8');

  // Replace reduce functions for revenue/collections
  code = code.replace(
    /sub \=\> sum \+ \(\(sub\.plan\?\.price \|\| 0\) \- sub\.balanceAmount\)/g,
    \sub => {
      const price = sub.plan?.price || 0;
      if (sub.paymentStatus === 'PAID') return sum + price;
      if (sub.paymentStatus === 'PENDING') {
        if (sub.balanceAmount > 0) return sum + Math.max(0, price - sub.balanceAmount);
        return sum; // If balance is 0 but status is PENDING, assume 0 paid.
      }
      return sum;
    }\
  );

  code = code.replace(
    /sub \=\> sum \+ \(sub\.plan\?\.price \|\| 0\) \- sub\.balanceAmount/g,
    \sub => {
      const price = sub.plan?.price || 0;
      if (sub.paymentStatus === 'PAID') return sum + price;
      if (sub.paymentStatus === 'PENDING') {
        if (sub.balanceAmount > 0) return sum + Math.max(0, price - sub.balanceAmount);
        return sum; // If balance is 0 but status is PENDING, assume 0 paid.
      }
      return sum;
    }\
  );

  code = code.replace(
    /dailyRevenueMap\[name\] \+\= \(sub\.plan\?\.price \|\| 0\) \- sub\.balanceAmount;/g,
    \const price = sub.plan?.price || 0;
      if (sub.paymentStatus === 'PAID') {
        dailyRevenueMap[name] += price;
      } else if (sub.paymentStatus === 'PENDING' && sub.balanceAmount > 0) {
        dailyRevenueMap[name] += Math.max(0, price - sub.balanceAmount);
      }\
  );

  code = code.replace(
    /paymentMap\[sub\.paymentMethod\] \= \(paymentMap\[sub\.paymentMethod\] \|\| 0\) \+ \(\(sub\.plan\?\.price \|\| 0\) \- sub\.balanceAmount\);/g,
    \const price = sub.plan?.price || 0;
      let paid = 0;
      if (sub.paymentStatus === 'PAID') paid = price;
      else if (sub.paymentStatus === 'PENDING' && sub.balanceAmount > 0) paid = Math.max(0, price - sub.balanceAmount);
      paymentMap[sub.paymentMethod] = (paymentMap[sub.paymentMethod] || 0) + paid;\
  );

  fs.writeFileSync(file, code);
}

patchController('backend/src/controllers/subscription.controller.ts');
patchController('backend/src/controllers/reports.controller.ts');
console.log('Math patched');


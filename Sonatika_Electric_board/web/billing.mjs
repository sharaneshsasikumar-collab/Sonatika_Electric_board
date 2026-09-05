export function insertBill(db, bill) {
  const statement = db.prepare(`
    INSERT INTO Bill
      (C_ID, Bill_Month, Previous_Reading, Current_Reading,
       Units_Consumed, Rate_Per_Unit, Total_Amt, Status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `);
  const created = statement.get(
    bill.consumerId,
    bill.month,
    bill.previous,
    bill.current,
    bill.units,
    bill.rate,
    bill.total,
    bill.status,
  );
  if (!created) throw new Error('The generated bill was not stored.');
  return created;
}

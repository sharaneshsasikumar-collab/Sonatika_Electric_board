// Import into an empty database only. Preserve IDs and legacy payment statuses.
export const recordTables = [
  ['consumers', 'Consumers', 'C_ID', ['C_ID','Customer_Name','Address','Phone','Meter_ID','Connection_Type']],
  ['tariffs', 'Tariff', 'SLAB_ID', ['SLAB_ID','Connection_Type','Min_Units','Max_Units','Rate_Per_Unit','Fixed_Charge','Tax_Percent']],
  ['readings', 'Meter_Readings', 'R_ID', ['R_ID','C_ID','R_Date','Previous_Reading','Units_Consumed']],
  ['bills', 'Bill', 'B_ID', ['B_ID','C_ID','Bill_Month','Previous_Reading','Current_Reading','Units_Consumed','Rate_Per_Unit','Total_Amt','Status','Paid_At','Payment_Method','Transaction_ID']],
];

export async function importRecords(client, data) {
  for (const [key] of recordTables) {
    if (!Array.isArray(data[key])) throw new Error(`Backup is missing ${key}.`);
  }
  await client.query('BEGIN');
  try {
    await client.query('LOCK TABLE Consumers, Bill, Meter_Readings, Tariff IN ACCESS EXCLUSIVE MODE');
    const result = await client.query('SELECT (SELECT COUNT(*) FROM Consumers) + (SELECT COUNT(*) FROM Bill) + (SELECT COUNT(*) FROM Meter_Readings) AS count');
    if (Number(result.rows[0].count)) throw new Error('Destination already contains records; refusing to overwrite or duplicate them.');
    await client.query('DELETE FROM Tariff');
    for (const [key, table, id, columns] of recordTables) {
      for (const record of data[key]) {
        const included = columns.filter(column => Object.hasOwn(record, column));
        if (!included.includes(id)) throw new Error(`A ${key} record has no ${id}.`);
        await client.query(`INSERT INTO ${table} (${included.join(',')}) VALUES (${included.map((_, i) => `$${i+1}`).join(',')})`, included.map(column => record[column]));
      }
      await client.query(`SELECT setval(pg_get_serial_sequence('${table.toLowerCase()}', '${id.toLowerCase()}'), GREATEST(COALESCE(MAX(${id}), 0), 1), COALESCE(MAX(${id}), 0) >= 1) FROM ${table}`);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}
